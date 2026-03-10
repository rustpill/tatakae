import { PublicKey } from "@solana/web3.js";

// arena/page.tsx
export interface BattleAccount {
  publicKey: PublicKey;
  signer: PublicKey;
  signerNft: PublicKey;
  opponent: PublicKey | null;
  opponentNft: PublicKey | null;
  battleMode: { pinkSlip: {} } | { bite: {} };
  minPower: number | null;
  maxPower: number | null;
  status: { pending: {} } | { accepted: {} } | { completed: {} } | { cancelled: {} };
  winner: PublicKey | null;
}
export interface FighterOption {
  mint: PublicKey;
  power: number;
}

// profile/page.tsx
export interface NftMint {
  mint: PublicKey;
}
export interface InitialisedFighter {
  mint: PublicKey;
  power: number;
  wins: number;
  losses: number;
}

// hooks/useToast.tsx
export interface ToastState {
  message: string;
  txSignature?: string;
}