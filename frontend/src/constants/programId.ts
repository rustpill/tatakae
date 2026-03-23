import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!);
export const MPL_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
export const COLLECTION_MINT = new PublicKey(process.env.NEXT_PUBLIC_COLLECTION_MINT!);