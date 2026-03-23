import { PublicKey } from "@solana/web3.js";

// arena/page.tsx
export interface BattleAccount {
  publicKey: PublicKey;
  signer: PublicKey;
  signerNft: PublicKey;
  signerNftUri?: string;
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
  uri?: string; 
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
  uri?: string; 
}

// hooks/useToast.tsx
export interface ToastState {
  message: string;
  txSignature?: string;
}

// lib/instructions.ts
export interface ArenaStats {
  totalFighters: number;
  openBattles: number;
  resolvedBattles: number;
}

// lib/fetchbattlehistory.ts
export interface BattleHistoryRecord {
  id: string;
  signer: string;
  signer_nft: string;
  opponent: string;
  opponent_nft: string;
  winner: string;
  battle_mode: string;
  signer_power: number;
  opponent_power: number;
  resolved_at: number;
}

// lib/instructions
export interface FighterMetadataJson {
  name: string | null;
  image: string | null;
}
