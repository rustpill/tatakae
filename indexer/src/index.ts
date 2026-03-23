import { Buffer } from "node:buffer";
globalThis.Buffer = Buffer;

import { Keypair, Connection, PublicKey, Transaction} from "@solana/web3.js";
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
  tatakae_metadata: R2Bucket;
  WORKER_SECRET:     string;
  DB: D1Database;
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
          env.DB.prepare(`INSERT OR IGNORE INTO battle_history
            (id, signer, signer_nft, opponent, opponent_nft, winner, battle_mode, signer_power, opponent_power, resolved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            record.id, record.signer, record.signerNft,
            record.opponent, record.opponentNft, record.winner,
            record.battleMode, record.signerPower, record.opponentPower, record.resolvedAt
          )
        );

        // One round trip for all of them
        if (stmts.length > 0) await env.DB.batch(stmts);
        
        // Sync metadata for resolved NFTs
        const mintsToSync = resolvedBattles.flatMap((b) => [b.signerNft, b.opponentNft]);
        await syncFighterMetadata(env.RPC_URL, keypair, env.tatakae_metadata, mintsToSync);
        break;
      }

      case "retry":
      case "*/10 * * * *": {
        await retryFailedMetadata(env.RPC_URL, keypair, env.tatakae_metadata);
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
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
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
        const { results } = await env.DB.prepare(`
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
        const result = await env.DB.prepare(
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
        const claimed = await env.DB.prepare(
          "SELECT COUNT(*) as count FROM faucet_fighters WHERE claimed_by = ?"
        ).bind(wallet).first<{ count: number }>();
 
        const remaining = await env.DB.prepare(
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
        const { wallet } = await request.json() as { wallet: string };
        if (!wallet) {
          return new Response(JSON.stringify({ error: "wallet required" }), {
            status: 400, headers: CORS_HEADERS,
          });
        }
        // One mint per wallet
        const alreadyClaimed = await env.DB.prepare(
          "SELECT mint FROM faucet_fighters WHERE claimed_by = ? LIMIT 1"
        ).bind(wallet).first<{ mint: string }>();
        if (alreadyClaimed) {
          return new Response(JSON.stringify({
            error: "Wallet has already claimed a fighter",
            mint: alreadyClaimed.mint,
          }), { status: 400, headers: CORS_HEADERS });
        }
        // Grab an unclaimed fighter
        const fighter = await env.DB.prepare(
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
        const tx = new Transaction();
        // Create recipient ATA if it doesn't exist
        const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
        if (!recipientAtaInfo) {
          tx.add(createAssociatedTokenAccountInstruction(
            keypair.publicKey, recipientAta, recipient, mintPubkey
          ));
        }
        tx.add(createTransferInstruction(
          authorityAta, recipientAta, keypair.publicKey, 1
        ));
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        tx.feePayer = keypair.publicKey;
        tx.sign(keypair);
        const sig = await connection.sendRawTransaction(tx.serialize(), {skipPreflight: true});
        // Temp confirm strat remove for dev net
        const latestBlockHash = await connection.getLatestBlockhash();
        const confirmStrategy = {
          blockhash: latestBlockHash.blockhash,
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
          signature: sig,
        };

        try {
          await connection.confirmTransaction(confirmStrategy, "confirmed");
        } catch (err: any) {
          if (err?.name === "TransactionExpiredBlockheightExceededError") {
            // Wait and check if landed
            await new Promise((r) => setTimeout(r, 3000));
            const status = await connection.getSignatureStatus(sig);
            if (!status.value || status.value.err) {
              throw new Error("Transaction failed to land");
            }
            // landed continue
          } else {
            throw err;
          }
        }
        // Mark as claimed
        await env.DB.prepare(
          "UPDATE faucet_fighters SET claimed_by = ?, claimed_at = ? WHERE mint = ?"
        ).bind(wallet, Math.floor(Date.now() / 1000), fighter.mint).run();
        console.log(`Faucet: minted ${fighter.mint} (PWR:${fighter.power}) to ${wallet}`);
        return new Response(JSON.stringify({
          mint:        fighter.mint,
          power:       fighter.power,
          txSignature: sig,
        }), { headers: CORS_HEADERS });
      } catch (err: any) {
        console.error("Faucet mint error:", err);
        return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
          status: 500, headers: CORS_HEADERS,
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
          env.DB.prepare(
            "INSERT OR IGNORE INTO faucet_fighters (mint, power) VALUES (?, ?)"
          ).bind(f.mint, f.power)
        );
        await env.DB.batch(stmts);
        console.log(`Seeded ${fighters.length} fighters into faucet_fighters`);
        return new Response(JSON.stringify({ seeded: fighters.length }), { headers: CORS_HEADERS });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
      }
    }
    
    return new Response("tatakae indexer running");
  },
};