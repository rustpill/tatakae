import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import type { Anchor } from "@/idl/program";
import type { BattleAccount, FighterOption } from "@/types";
import {
  getFighterPda,
} from "@/lib/pda"

export async function fetchBattles(
  program: Program<Anchor>,
  publicKey: PublicKey | null
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
    const battle: BattleAccount = {
      publicKey: b.publicKey,
      signer: account.signer,
      signerNft: account.signerNft,
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

    if (!("pending" in account.status)) continue;
    if (publicKey && account.signer.toBase58() === publicKey.toBase58()) continue;

    if (!account.opponent) {
      open.push(battle);
    } else if (
      publicKey &&
      account.opponent.toBase58() === publicKey.toBase58()
    ) {
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
  const allFighters = await program.account.fighter.all();
  const myFighterList: FighterOption[] = [];

  for (const f of allFighters) {
    try {
      const ata = await getAssociatedTokenAddress(f.account.mint, publicKey);
      const tokenAccount = await connection.getTokenAccountBalance(ata);
      if (tokenAccount.value.uiAmount === 1) {
        myFighterList.push({
          mint: f.account.mint,
          power: f.account.power,
        });
      }
    } catch {
      continue;
    }
  }

  return myFighterList;
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

  const min = minPower.trim() !== "" ? parseInt(minPower) : null;
  const max = maxPower.trim() !== "" ? parseInt(maxPower) : null;
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
    const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
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