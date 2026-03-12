import { Buffer } from "node:buffer";
globalThis.Buffer = Buffer;

import { Keypair } from "@solana/web3.js";
import { resolvePendingBattles } from "./resolveBattle";
import { syncFighterMetadata } from "./updateMetadata";

export interface Env {
  RPC_URL: string;
  AUTHORITY_KEYPAIR: string;
  tatakae_metadata: R2Bucket;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    try {
      await run(env);
    } catch (err) {
      console.error("scheduled error:", err);
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return new Response("indexer running");
  },
};

async function run(env: Env): Promise<void> {
  const keypairBytes = JSON.parse(env.AUTHORITY_KEYPAIR) as number[];
  const keypair = Keypair.fromSecretKey(new Uint8Array(keypairBytes));

  // resolve battles
  const { resolvedBattles } = await resolvePendingBattles(env.RPC_URL, keypair);

  // sync metadata
  const mintsToSync = resolvedBattles.flatMap((b) => [b.signerNft, b.opponentNft]);
  await syncFighterMetadata(env.RPC_URL, keypair, env.tatakae_metadata, mintsToSync);
}