import { Keypair, PublicKey } from "@solana/web3.js";
import { syncFighterMetadata } from "./updateMetadata";
import { MAX_RETRY_COUNT } from "./constants";

export async function retryFailedMetadata(
  rpcUrl: string,
  keypair: Keypair,
  bucket: R2Bucket
): Promise<void> {
  const listed = await bucket.list({ prefix: "errors/" });

  if (listed.objects.length === 0) {
    console.log("No metadata errors to retry");
    return;
  }

  console.log(`Found ${listed.objects.length} metadata error(s) to retry`);

  const mintsToRetry: PublicKey[] = [];

  for (const obj of listed.objects) {
    const errorKey = obj.key;
    const mintStr  = errorKey.replace("errors/", "").replace(".json", "");

    let log: { mint: string; retryCount: number; lastFailedAt: string; errors: any[] } | null = null;
    try {
      const raw = await bucket.get(errorKey);
      if (!raw) continue;
      log = await raw.json();
    } catch (err) {
      console.error(`Failed to read error log ${errorKey}:`, err);
      continue;
    }

    if (!log) continue;

    // Too many retries - move to failures/ and give up
    if (log.retryCount >= MAX_RETRY_COUNT) {
      console.error(`Mint ${mintStr} exceeded max retries (${MAX_RETRY_COUNT}), moving to failures/`);
      await bucket.put(
        `failures/${mintStr}.json`,
        JSON.stringify({ ...log, abandonedAt: new Date().toISOString() }, null, 2),
        { httpMetadata: { contentType: "application/json" } }
      ).catch(() => {});
      await bucket.delete(errorKey).catch(() => {});
      continue;
    }

    console.log(`Queuing retry for ${mintStr} (attempt ${log.retryCount + 1})`);
    mintsToRetry.push(new PublicKey(mintStr));
  }
 
  if (mintsToRetry.length === 0) {
    console.log("No mints to retry after filtering");
    return;
  }

  console.log(`Retrying ${mintsToRetry.length} mint(s) in one pass`);
  await syncFighterMetadata(rpcUrl, keypair, bucket, mintsToRetry);
}