import { PublicKey } from "@solana/web3.js";
import {
  FIGHTER_SEED,
  CONFIG_SEED,
  PROGRAM_ID,
  MPL_METADATA_PROGRAM_ID
} from "@/constants"
// PDA derivations
export function getFighterPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [FIGHTER_SEED, mint.toBuffer()],
    PROGRAM_ID
  );
}

export function getConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CONFIG_SEED],
    PROGRAM_ID
  );
}

export function getMetadataPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      MPL_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    MPL_METADATA_PROGRAM_ID
  )[0];
}