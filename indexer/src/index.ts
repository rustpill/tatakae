import { Buffer } from "node:buffer";
globalThis.Buffer = Buffer;

import { Keypair, Connection, PublicKey, TransactionMessage, VersionedTransaction, ComputeBudgetProgram, SignatureStatusConfig } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { resolvePendingBattles } from "./resolveBattle";
import { syncFighterMetadata } from "./updateMetadata";
import { retryFailedMetadata } from "./retryMetadata";
import { CORS_HEADERS } from "./constants";

export interface Env {
  RPC_URL: string;
  AUTHORITY_KEYPAIR: string;
  R2: R2Bucket;
  WORKER_SECRET:     string;
  D1: D1Database;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const keypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(env.AUTHORITY_KEYPAIR) as number[])
    );
 
    switch (event.cron) {
      case "":
      case "* * * * *": {
        const { resolvedBattles, battleRecords } = await resolvePendingBattles(env.RPC_URL, keypair);
        
        // Write battle history to D1
        const stmts = battleRecords.map((record) =>
          env.D1.prepare(`INSERT OR IGNORE INTO battle_history
            (id, signer, signer_nft, opponent, opponent_nft, winner, battle_mode, signer_power, opponent_power, resolved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            record.id, record.signer, record.signerNft,
            record.opponent, record.opponentNft, record.winner,
            record.battleMode, record.signerPower, record.opponentPower, record.resolvedAt
          )
        );

        // One round trip for all of them
        if (stmts.length > 0) await env.D1.batch(stmts);
        
        // Sync metadata for resolved NFTs
        const mintsToSync = resolvedBattles.flatMap((b) => [b.signerNft, b.opponentNft]);
        await syncFighterMetadata(env.RPC_URL, keypair, env.R2, mintsToSync);
        break;
      }

      case "retry":
      case "*/10 * * * *": {
        await retryFailedMetadata(env.RPC_URL, keypair, env.R2);
        break;
      }

      default:
        console.log(`Unknown cron: "${event.cron}"`);
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
 
    if (url.pathname === "/history") {
      const wallet = url.searchParams.get("wallet");
      if (!wallet) {
        return new Response(JSON.stringify({ error: "wallet param required" }), {
          status: 400,
          headers: CORS_HEADERS,
        });
      }
 
      try {
        const { results } = await env.D1.prepare(`
          SELECT * FROM battle_history
          WHERE signer = ? OR opponent = ?
          ORDER BY resolved_at DESC
          LIMIT 50
        `).bind(wallet, wallet).all();
 
        return new Response(JSON.stringify(results), {
          headers: CORS_HEADERS,
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: CORS_HEADERS,
        });
      }
    }

    if (url.pathname === "/stats") {
      try {
        const result = await env.D1.prepare(
          "SELECT COUNT(*) as count FROM battle_history"
        ).first<{ count: number }>();

        return new Response(JSON.stringify({ resolvedBattles: result?.count ?? 0 }), {
          headers: CORS_HEADERS,
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
      }
    }

    // GET /faucet/status?wallet=
    if (url.pathname === "/faucet/status") {
      const wallet = url.searchParams.get("wallet");
      if (!wallet) {
        return new Response(JSON.stringify({ error: "wallet param required" }), {
          status: 400, headers: CORS_HEADERS,
        });
      }
      try {
        const claimed = await env.D1.prepare(
          "SELECT COUNT(*) as count FROM faucet_fighters WHERE claimed_by = ?"
        ).bind(wallet).first<{ count: number }>();
 
        const remaining = await env.D1.prepare(
          "SELECT COUNT(*) as count FROM faucet_fighters WHERE claimed_by IS NULL"
        ).first<{ count: number }>();
 
        return new Response(JSON.stringify({
          hasClaimed:  (claimed?.count ?? 0) > 0,
          remaining:   remaining?.count ?? 0,
        }), { headers: CORS_HEADERS });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
      }
    }

    // POST /faucet/mint send nft to target
    if (url.pathname === "/faucet/mint" && request.method === "POST") {
      try {
        // Require wallet
        const { wallet } = await request.json() as { wallet: string };
        if (!wallet) {
          return new Response(JSON.stringify({ error: "wallet required" }), {
            status: 400,
            headers: CORS_HEADERS,
        });
        }

        // One mint per wallet
        const alreadyClaimed = await env.D1.prepare(
          "SELECT mint FROM faucet_fighters WHERE claimed_by = ? LIMIT 1"
        ).bind(wallet).first<{ mint: string }>();
        if (alreadyClaimed) {
          return new Response(JSON.stringify({
            error: "Wallet has already claimed a fighter",
            mint: alreadyClaimed.mint,
          }), { status: 400, headers: CORS_HEADERS });
        }

        // Grab an unclaimed fighter
        const fighter = await env.D1.prepare(
          "SELECT mint, power FROM faucet_fighters WHERE claimed_by IS NULL ORDER BY RANDOM() LIMIT 1"
        ).first<{ mint: string; power: number }>();
        if (!fighter) {
          return new Response(JSON.stringify({ error: "No fighters remaining in faucet" }), {
            status: 404, headers: CORS_HEADERS,
          });
        }

        // Transfer NFT to wallet
        const keypair    = Keypair.fromSecretKey(new Uint8Array(JSON.parse(env.AUTHORITY_KEYPAIR) as number[]));
        const connection = new Connection(env.RPC_URL, "confirmed");
        const mintPubkey = new PublicKey(fighter.mint);
        const recipient  = new PublicKey(wallet);
        const authorityAta  = await getAssociatedTokenAddress(mintPubkey, keypair.publicKey);
        const recipientAta  = await getAssociatedTokenAddress(mintPubkey, recipient);

        const instructions = [];

        // Create ATA if needed
        const recipientInfo = await connection.getAccountInfo(recipientAta);
        if (!recipientInfo) {
          instructions.push(
            createAssociatedTokenAccountInstruction(
              keypair.publicKey,
              recipientAta,
              recipient,
              mintPubkey
            )
          );
        }

        // Transfer NFT
        instructions.push(
          createTransferInstruction(
            authorityAta,
            recipientAta,
            keypair.publicKey,
            1
          )
        );

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();

        const message = new TransactionMessage({
          payerKey: keypair.publicKey,
          recentBlockhash: blockhash,
          instructions
        }).compileToV0Message();

        // Sign
        const tx = new VersionedTransaction(message);
        tx.sign([keypair]);

        // Send and confirm
        const sig = await connection.sendRawTransaction(tx.serialize());
        let config: SignatureStatusConfig = {
          searchTransactionHistory: true
        };

        let signatureStatus = await connection.getSignatureStatuses([sig], config);
        console.log(signatureStatus);

        // Mark as claimed
        await env.D1.prepare(
          "UPDATE faucet_fighters SET claimed_by = ?, claimed_at = ? WHERE mint = ?"
        ).bind(wallet, Math.floor(Date.now() / 1000), fighter.mint).run();
        console.log(`Faucet: minted ${fighter.mint} (PWR:${fighter.power}) to ${wallet}`);
        return new Response(JSON.stringify({
          mint: fighter.mint,
          power: fighter.power,
        }), { headers: CORS_HEADERS });

      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: CORS_HEADERS,
        });
      }
    }
    // POST /seed-faucet (called by setup script, secret gated in env)
    if (url.pathname === "/seed-faucet" && request.method === "POST") {
      const auth = request.headers.get("Authorization");
      if (auth !== `Bearer ${env.WORKER_SECRET}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: CORS_HEADERS,
        });
      }
      try {
        const { fighters } = await request.json() as { fighters: { mint: string; power: number }[] };
        const stmts = fighters.map((f) =>
          env.D1.prepare(
            "INSERT OR IGNORE INTO faucet_fighters (mint, power) VALUES (?, ?)"
          ).bind(f.mint, f.power)
        );
        await env.D1.batch(stmts);
        console.log(`Seeded ${fighters.length} fighters into faucet_fighters`);
        return new Response(JSON.stringify({ seeded: fighters.length }), { headers: CORS_HEADERS });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
      }
    }
    
    return new Response("tatakae indexer running");
  },
};