import { Buffer } from "node:buffer";
globalThis.Buffer = Buffer;

import { Keypair } from "@solana/web3.js";
import { resolvePendingBattles } from "./resolveBattle";
import { syncFighterMetadata } from "./updateMetadata";
import { retryFailedMetadata } from "./retryMetadata";

export interface Env {
  RPC_URL: string;
  AUTHORITY_KEYPAIR: string;
  tatakae_metadata: R2Bucket;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const keypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(env.AUTHORITY_KEYPAIR) as number[])
    );
 
    switch (event.cron) {
      case "":
      case "* * * * *": {
        const { resolvedBattles } = await resolvePendingBattles(env.RPC_URL, keypair);
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

  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response("tatakae indexer running");
  },
};