import { PublicKey } from "@solana/web3.js";
import {
  BATTLE_SEED,
  ESCROW_SEED,
  FIGHTER_SEED,
  CONFIG_SEED,
  PROGRAM_ID,
  MPL_METADATA_PROGRAM_ID
} from "@/constants"
// PDA derivations
export function getBattlePda(signerNftMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [BATTLE_SEED, signerNftMint.toBuffer()],
    PROGRAM_ID
  );
}

export function getEscrowPda(battle: PublicKey, mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ESCROW_SEED, battle.toBuffer(), mint.toBuffer()],
    PROGRAM_ID
  );
}

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