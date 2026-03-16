import { Keypair, PublicKey } from "@solana/web3.js";
import { syncFighterMetadata } from "./updateMetadata";
const MAX_RETRY_COUNT = 5;

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

    // Retry the sync
    console.log(`Retrying metadata sync for ${mintStr} (attempt ${log.retryCount + 1})`);
    try {
      await syncFighterMetadata(rpcUrl, keypair, bucket, [new PublicKey(mintStr)]);
      // Success - delete the error log
      await bucket.delete(errorKey);
      console.log(`Retry succeeded for ${mintStr} - error log cleared`);
    } catch (err) {
      // syncFighterMetadata already wrote the updated error log, nothing else to do
      console.error(`Retry failed for ${mintStr}:`, err);
    }
  }
}