import { Connection, Keypair, PublicKey, SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import type { Anchor } from "./types/anchor";
import idl from "../idl/anchor.json";

export async function resolvePendingBattles(
  rpcUrl: string,
  keypair: Keypair
): Promise<{ resolvedBattles: { signerNft: PublicKey; opponentNft: PublicKey }[] }> {
  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = buildWallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    skipPreflight: true,
    preflightCommitment: "confirmed",
  });
  const program = new Program<Anchor>(idl as any, provider);

  const battles = await program.account.battle.all();
  const accepted = battles.filter((b) =>
    JSON.stringify(b.account.status) === JSON.stringify({ accepted: {} })
  );

  console.log(`Found ${accepted.length} accepted battles`);

  const currentSlot = await connection.getSlot("confirmed");
  const resolvedBattles: { signerNft: PublicKey; opponentNft: PublicKey }[] = [];

  for (const b of accepted) {
    const acceptedSlot = b.account.acceptedSlot?.toNumber();
    if (!acceptedSlot) continue;

    if (currentSlot <= acceptedSlot + 2) {
      console.log(`Battle ${b.publicKey.toBase58()} not ready yet`);
      continue;
    }

    try {
      await resolveBattle(program, keypair, b.account);
      console.log(`Resolved battle: ${b.publicKey.toBase58()}`);
      resolvedBattles.push({
        signerNft: b.account.signerNft,
        opponentNft: b.account.opponentNft!,
      });
    } catch (err: any) {
      if (err?.name === "TransactionExpiredTimeoutError") {
        console.log(`Resolved battle (timeout): ${b.publicKey.toBase58()}`);
        resolvedBattles.push({
          signerNft: b.account.signerNft,
          opponentNft: b.account.opponentNft!,
        });
      } else {
        console.error(`Failed to resolve battle ${b.publicKey.toBase58()}:`, err);
      }
    }
  }

  return { resolvedBattles };
}

async function resolveBattle(
  program: Program<Anchor>,
  authority: Keypair,
  account: Awaited<ReturnType<typeof program.account.battle.all>>[number]["account"]
): Promise<void> {
  const BATTLE_SEED = Buffer.from("battle");
  const ESCROW_SEED = Buffer.from("escrow");
  const FIGHTER_SEED = Buffer.from("fighter");
  const PROGRAM_ID = program.programId;

  const signerNft = account.signerNft;
  const opponentNft = account.opponentNft!;
  const signerWallet = account.signer;
  const opponentWallet = account.opponent!;

  const [battle] = PublicKey.findProgramAddressSync([BATTLE_SEED, signerNft.toBuffer()], PROGRAM_ID);
  const [signerEscrow] = PublicKey.findProgramAddressSync([ESCROW_SEED, battle.toBuffer(), signerNft.toBuffer()], PROGRAM_ID);
  const [opponentEscrow] = PublicKey.findProgramAddressSync([ESCROW_SEED, battle.toBuffer(), opponentNft.toBuffer()], PROGRAM_ID);
  const [signerFighter] = PublicKey.findProgramAddressSync([FIGHTER_SEED, signerNft.toBuffer()], PROGRAM_ID);
  const [opponentFighter] = PublicKey.findProgramAddressSync([FIGHTER_SEED, opponentNft.toBuffer()], PROGRAM_ID);

  const signerAta = await getAssociatedTokenAddress(signerNft, signerWallet);
  const opponentAta = await getAssociatedTokenAddress(opponentNft, opponentWallet);
  const signersOpponentAta = await getAssociatedTokenAddress(opponentNft, signerWallet);
  const opponentsSignerAta = await getAssociatedTokenAddress(signerNft, opponentWallet);

  await program.methods
    .resolveBattle()
    // partial required here cannot infer for cron
    .accountsPartial({
      authority: authority.publicKey,
      battle,
      battleSigner: signerWallet,
      battleOpponent: opponentWallet,
      signerEscrow,
      opponentEscrow,
      signerTokenAccount: signerAta,
      opponentTokenAccount: opponentAta,
      signersOpponentAta,
      opponentsSignerAta,
      signerNftMint: signerNft,
      opponentNftMint: opponentNft,
      signerFighter,
      opponentFighter,
      slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
    })
    .signers([authority])
    .rpc();
}

export function buildWallet(keypair: Keypair) {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async <T extends import("@solana/web3.js").Transaction | import("@solana/web3.js").VersionedTransaction>(tx: T): Promise<T> => {
      if (tx instanceof (await import("@solana/web3.js")).Transaction) tx.sign(keypair);
      return tx;
    },
    signAllTransactions: async <T extends import("@solana/web3.js").Transaction | import("@solana/web3.js").VersionedTransaction>(txs: T[]): Promise<T[]> => {
      const { Transaction } = await import("@solana/web3.js");
      return txs.map((tx) => {
        if (tx instanceof Transaction) tx.sign(keypair);
        return tx;
      });
    },
  };
}