import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import type { Anchor } from "./idl/anchor";
import { buildWallet } from "./utils";
import idl from "./idl/anchor.json";
import { FIGHTER_SEED } from "./constants";

interface FighterMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  attributes: { trait_type: string; value: number | string }[];
  properties: {
    files: { uri: string; type: string }[];
    category: string;
  };
}

export async function syncFighterMetadata(
  rpcUrl: string,
  keypair: Keypair,
  bucket: R2Bucket,
  mints: PublicKey[]
): Promise<void> {
  if (mints.length === 0) {
    console.log("No fighters to sync metadata for");
    return;
  }

  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = buildWallet(keypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new Program<Anchor>(idl as any, provider);

  for (const mint of mints) {

    const mintStr = mint.toBase58();
    const key = `metadata/${mintStr}.json`;

    try {
      const [fighterPda] = PublicKey.findProgramAddressSync(
        [FIGHTER_SEED, mint.toBuffer()],
        program.programId
      );

      const fighter = await program.account.fighter.fetch(fighterPda);
      console.log(`Looking for key: ${key}`);

      // Fetch existing metadata from R2
      const existing = await bucket.get(key);
      if (!existing) {
        console.log(`No existing metadata found for ${mintStr}, skipping`);
        continue;
      }

      const metadata: FighterMetadata = await existing.json();

      // Find and update Power attribute
      const powerAttr = metadata.attributes.find((a) => a.trait_type === "Power");
      if (!powerAttr) {
        console.log(`No Power attribute found for ${mintStr}, skipping`);
        continue;
      }

      if (powerAttr.value === fighter.power) {
        console.log(`Power unchanged for ${mintStr}, skipping`);
        continue;
      }

      console.log(`Updating ${mintStr} power: ${powerAttr.value} → ${fighter.power}`);
      powerAttr.value = fighter.power;

      // Write updated metadata back to R2
      await bucket.put(key, JSON.stringify(metadata), {
        httpMetadata: { contentType: "application/json" },
      });

      console.log(`Metadata updated for ${mintStr}`);
    } catch (err) {
      console.error(`Failed to sync metadata for ${mint.toBase58()}:`, err);

      // Log to R2 so the retry worker can pick it up
      await logSyncError(bucket, mintStr, err).catch((logErr) =>
        console.error(`Failed to write error log for ${mintStr}:`, logErr)
      );
    }
  }
}

async function logSyncError(
  bucket: R2Bucket,
  mintStr: string,
  err: any
): Promise<void> {
  const key = `errors/${mintStr}.json`;
  // Preserve existing log if present, increment retry count
  let existing: { retryCount: number; errors: any[] } = { retryCount: 0, errors: [] };
  try {
    const obj = await bucket.get(key);
    if (obj) existing = await obj.json();
  } catch { /* no existing log */ }
  const log = {
    mint: mintStr,
    retryCount: existing.retryCount + 1,
    lastFailedAt: new Date().toISOString(),
    errors: [
      ...existing.errors,
      {
        message: err?.message ?? String(err),
        failedAt: new Date().toISOString(),
      },
    ],
  };
  await bucket.put(key, JSON.stringify(log, null, 2), {
    httpMetadata: { contentType: "application/json" },
  });
  console.log(`Error logged to R2: ${key}`);
}