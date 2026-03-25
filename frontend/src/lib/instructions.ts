import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { Anchor } from "@/idl/anchor.ts";
import type { BattleAccount, BattleHistoryRecord, FighterOption, FighterMetadataJson } from "@/types";
import {
  getFighterPda,
  getMetadataPda,
} from "@/lib/pda"
import { ArenaStats } from "@/types"
import { getUriFromMetadata } from "./metadata";
import { readonlyProgram } from "./readonlyProgram";

export async function fetchArenaStats(): Promise<ArenaStats> {
  const [fighters, battles, workerStats] = await Promise.all([
    readonlyProgram.account.fighter.all(),
    readonlyProgram.account.battle.all(),
    fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/stats`)
      .then((r) => r.json())
      .catch(() => ({ resolvedBattles: 0 })),
  ]);

  return {
    totalFighters: fighters.length,
    openBattles: battles.filter((b) => "pending" in b.account.status).length,
    resolvedBattles: workerStats.resolvedBattles,
  };
}

async function resolveNftUri(mint: PublicKey, connection: Connection): Promise<string | undefined> {
  try {
    const metadataPda = getMetadataPda(mint);
    const account = await connection.getAccountInfo(metadataPda);
    if (!account) return undefined;
    return getUriFromMetadata(account.data) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function fetchBattles(
  program: Program<Anchor>,
  publicKey: PublicKey | null,
  connection: Connection,
): Promise<{
  open: BattleAccount[];
  targeted: BattleAccount[];
  mine: BattleAccount[];
}> {
  const allBattles = await program.account.battle.all();

  const open: BattleAccount[] = [];
  const targeted: BattleAccount[] = [];
  const mine: BattleAccount[] = [];

  for (const b of allBattles) {
    const account = b.account;
    const isPending = "pending" in account.status;
    const isOwnBattle = !!(publicKey && account.signer.toBase58() === publicKey.toBase58());
 
    // Fetch URI only for pending battles the user can interact with
    let signerNftUri: string | undefined;
    if (isPending && !isOwnBattle) {
      signerNftUri = await resolveNftUri(account.signerNft, connection);
    }
 
    const battle: BattleAccount = {
      publicKey: b.publicKey,
      signer: account.signer,
      signerNft: account.signerNft,
      signerNftUri,
      opponent: account.opponent ?? null,
      opponentNft: account.opponentNft ?? null,
      battleMode: account.battleMode as BattleAccount["battleMode"],
      minPower: account.minPower ?? null,
      maxPower: account.maxPower ?? null,
      status: account.status as BattleAccount["status"],
      winner: account.winner ?? null,
    };
 
    if (
      publicKey && (
        account.signer.toBase58() === publicKey.toBase58() ||
        (account.opponent && account.opponent.toBase58() === publicKey.toBase58())
      )
    ) {
      mine.push(battle);
    }
 
    if (!isPending) continue;
    if (isOwnBattle) continue;
 
    if (!account.opponent) {
      open.push(battle);
    } else if (publicKey && account.opponent.toBase58() === publicKey.toBase58()) {
      targeted.push(battle);
    }
  }
 
  return { open, targeted, mine };
}

export async function fetchMyFighters(
  program: Program<Anchor>,
  publicKey: PublicKey,
  connection: Connection,
): Promise<FighterOption[]> {
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    publicKey,
    { programId: TOKEN_PROGRAM_ID }
  );

  const nftMints = tokenAccounts.value
    .filter((t) => {
      const info = t.account.data.parsed.info;
      return info.tokenAmount.decimals === 0 && info.tokenAmount.uiAmount === 1;
    })
    .map((t) => new PublicKey(t.account.data.parsed.info.mint));

  const fighters: FighterOption[] = [];

  for (const mint of nftMints) {
    const [fighterPda] = getFighterPda(mint);
    try {
      const fighter = await program.account.fighter.fetch(fighterPda);

      // uri
      let uri: string | undefined;
      try {
        const metadataPda = getMetadataPda(mint);
        const metadataAccount = await connection.getAccountInfo(metadataPda);
        if (metadataAccount) {
          uri = getUriFromMetadata(metadataAccount.data) ?? undefined;
        }
      } catch {
        
      }
      
      fighters.push({ mint, power: fighter.power, uri });
    } catch {
      // no fighter PDA for this mint so skip
    }
  }

  return fighters;
}

export async function initializeAllFighters(
  program: Program<Anchor>,
  publicKey: PublicKey,
  connection: Connection,
  wallet: {
    signTransaction?: (tx: Transaction) => Promise<Transaction>;
    signAllTransactions?: (txs: Transaction[]) => Promise<Transaction[]>;
  },
  uninitMints: PublicKey[]
): Promise<string[]> {
  if (uninitMints.length === 0) throw new Error("No fighters to initialise");
 
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
 
  // Build one transaction per mint
  const transactions: Transaction[] = [];
 
  for (const mint of uninitMints) {
    const res = await fetch(`/proofs/${mint.toBase58()}.json`);
    if (!res.ok) throw new Error(`No proof found for mint ${mint.toBase58().slice(0, 8)}...`);
    const data = await res.json();
    const proofBytes = data.proof.map((p: number[]) => Array.from(p));
 
    const ix = await program.methods
      .initializeFighter(data.power, proofBytes)
      .accounts({ owner: publicKey, fighterMint: mint })
      .instruction();
 
    const tx = new Transaction();
    tx.add(ix);
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = publicKey;
    transactions.push(tx);
  }
 
  // Single wallet prompt for all transactions
  let signed: Transaction[];
  if (wallet.signAllTransactions) {
    signed = await wallet.signAllTransactions(transactions);
  } else if (wallet.signTransaction) {
    // Fallback: sign one by one (multiple prompts)
    signed = [];
    for (const tx of transactions) {
      signed.push(await wallet.signTransaction(tx));
    }
  } else {
    throw new Error("Wallet not connected");
  }
 
  // Broadcast all and collect sigs
  const sigs: string[] = [];
  for (const tx of signed) {
    const sig = await connection.sendRawTransaction(tx.serialize());
    sigs.push(sig);
  }
 
  // Confirm last one - if it lands the earlier ones did too
  if (sigs.length > 0) {
    await connection.confirmTransaction(
      { signature: sigs[sigs.length - 1], blockhash, lastValidBlockHeight },
      "confirmed"
    );
  }
 
  return sigs;
}

export async function createBattle(
  program: Program<Anchor>,
  publicKey: PublicKey,
  connection: Connection,
  selectedMint: string,
  battleMode: "pinkSlip" | "bite",
  minPower: string,
  maxPower: string,
  targetOpponentNft: string,
): Promise<string> {
  const mint = new PublicKey(selectedMint);

  let opponent: PublicKey | null = null;
  let opponentNft: PublicKey | null = null;

  if (targetOpponentNft.trim() !== "") {
    opponentNft = new PublicKey(targetOpponentNft.trim());
    const derived = await getOwnerOfNft(opponentNft, connection);
    if (!derived) throw new Error("Could not find owner of that NFT mint");
    opponent = derived;
  }

  const parsepower = (val: string): number | null => {
    if (val.trim() === "") return null;
    const n = Math.floor(Number(val));
    if (isNaN(n) || n < 0 || n > 65535) throw new Error(`Invalid power value: ${val} (must be 0–65535)`);
    return n;
  };

  const min = parsepower(minPower);
  const max = parsepower(maxPower);

  if (min !== null && max !== null && min > max) {
    throw new Error("Min power cannot be greater than max power");
  }

  const mode = battleMode === "pinkSlip" ? { pinkSlip: {} } : { bite: {} };

  return program.methods
    .createBattle(opponent, opponentNft, mode, min, max)
    .accounts({
      signer: publicKey,
      signerMint: mint,
    })
    .rpc();
}

export async function acceptBattle(
  program: Program<Anchor>,
  publicKey: PublicKey,
  connection: Connection,
  wallet: { signTransaction: ((tx: Transaction) => Promise<Transaction>) | undefined },
  battle: BattleAccount,
  opponentMint: PublicKey
): Promise<string> {
  const [opponentFighterPda] = getFighterPda(opponentMint);
  const fighterAccount = await connection.getAccountInfo(opponentFighterPda);
  const needsInit = fighterAccount === null;

  if (needsInit) {
    const res = await fetch(`/proofs/${opponentMint.toBase58()}.json`);
    const fighterData = await res.json();
    if (!fighterData) throw new Error("Cannot accept: opponent NFT has no fighter data");

    const proofBytes = fighterData.proof.map((p: number[]) => Array.from(p));

    const initIx = await program.methods
      .initializeFighter(fighterData.power, proofBytes)
      .accounts({
        owner: publicKey,
        fighterMint: opponentMint,
      })
      .instruction();

    const acceptIx = await program.methods
      .acceptBattle()
      .accounts({
        opponent: publicKey,
        opponentMint,
        battle: battle.publicKey,
        battleSigner: battle.signer,
        signerNftMint: battle.signerNft,
      })
      .instruction();

    const tx = new Transaction().add(initIx, acceptIx);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = publicKey;

    if (!wallet.signTransaction) throw new Error("Wallet not connected");
    const signed = await wallet.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    return sig;
  }

  return program.methods
    .acceptBattle()
    .accounts({
      opponent: publicKey,
      opponentMint,
      battle: battle.publicKey,
      battleSigner: battle.signer,
      signerNftMint: battle.signerNft,
    })
    .rpc();
}

export async function cancelBattle(
  program: Program<Anchor>,
  publicKey: PublicKey,
  battle: BattleAccount
): Promise<string> {
  return program.methods
    .cancelBattle()
    .accounts({
      signer: publicKey,
      signerMint: battle.signerNft,
    })
    .rpc();
}

async function getOwnerOfNft(mint: PublicKey, connection: Connection): Promise<PublicKey | null> {
  const largestAccounts = await connection.getTokenLargestAccounts(mint);
  if (largestAccounts.value.length === 0) return null;

  const accountInfo = await connection.getParsedAccountInfo(largestAccounts.value[0].address);
  if (!accountInfo.value || !("parsed" in accountInfo.value.data)) return null;

  return new PublicKey(accountInfo.value.data.parsed.info.owner);
}

export async function fetchBattleHistory(wallet: string): Promise<BattleHistoryRecord[]> {
  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL;
  if (!workerUrl) {
    console.warn("NEXT_PUBLIC_WORKER_URL not set");
    return [];
  }

  try {
    const res = await fetch(`${workerUrl}/history?wallet=${wallet}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchFighterMetadata(metadataUri: string): Promise<FighterMetadataJson> {
  try {
    const res = await fetch(metadataUri);
    if (!res.ok) return { name: null, image: null };
    const json = await res.json();
    return {
      name:  json?.name  ?? null,
      image: json?.image ?? null,
    };
  } catch {
    return { name: null, image: null };
  }
}

export async function fetchFighterImage(metadataUri: string): Promise<string | null> {
  return (await fetchFighterMetadata(metadataUri)).image;
}