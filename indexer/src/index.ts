import { Buffer } from "node:buffer";
globalThis.Buffer = Buffer;

import { Keypair } from "@solana/web3.js";
import { resolvePendingBattles } from "./resolveBattle";
import { syncFighterMetadata } from "./updateMetadata";
import { retryFailedMetadata } from "./retryMetadata";
import { CORS_HEADERS } from "./constants";

export interface Env {
  RPC_URL: string;
  AUTHORITY_KEYPAIR: string;
  tatakae_metadata: R2Bucket;
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
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
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
    
    return new Response("tatakae indexer running");
  },
};