import { Connection } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "@/idl/anchor.json";
import type { Anchor } from "@/idl/program";

const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8899",
  "confirmed"
);

// Read only
const readonlyProvider = new AnchorProvider(
  connection,
  {
    publicKey: PublicKey.default,
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  },
  { commitment: "confirmed" }
);

export const readonlyProgram = new Program<Anchor>(idl as any, readonlyProvider);