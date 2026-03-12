import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import type { Anchor } from "./types/anchor";
import { buildWallet } from "./resolveBattle";
import idl from "../idl/anchor.json";

const FIGHTER_SEED = Buffer.from("fighter");

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
    try {
      const [fighterPda] = PublicKey.findProgramAddressSync(
        [FIGHTER_SEED, mint.toBuffer()],
        program.programId
      );

      const fighter = await program.account.fighter.fetch(fighterPda);
      const mintStr = mint.toBase58();
      const key = `metadata/${mintStr}.json`;
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
    }
  }
}