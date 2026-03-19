import { Connection, Keypair, PublicKey, SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import type { Anchor } from "./idl/anchor";
import idl from "./idl/anchor.json";
import { BATTLE_SEED, ESCROW_SEED, FIGHTER_SEED } from "./constants";
import { buildWallet } from "./utils";

export interface BattleRecord {
  id: string;
  signer: string;
  signerNft: string;
  opponent: string;
  opponentNft: string;
  winner: string;
  battleMode: string;
  signerPower: number;
  opponentPower: number;
  resolvedAt: number;
}

export async function resolvePendingBattles(
  rpcUrl: string,
  keypair: Keypair
): Promise<{
  resolvedBattles: { signerNft: PublicKey; opponentNft: PublicKey }[];
  battleRecords: BattleRecord[];
}> {
  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = buildWallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    skipPreflight: true,
    preflightCommitment: "confirmed",
  });
  const program = new Program<Anchor>(idl as any, provider);

  const battles = await program.account.battle.all();
  const accepted = battles.filter((b) => "accepted" in b.account.status)

  console.log(`Found ${accepted.length} accepted battles`);

  const currentSlot = await connection.getSlot("confirmed");

  // Filter to only battles that are ready to resolve
  const readyBattles = accepted.filter((b) => {
    const acceptedSlot = b.account.acceptedSlot?.toNumber();
    if (!acceptedSlot) return false;
    if (currentSlot <= acceptedSlot + 2) {
      console.log(`Battle ${b.publicKey.toBase58()} not ready yet`);
      return false;
    }
    return true;
  });
  console.log(`${readyBattles.length} battles ready to resolve — processing in parallel`);
  // Resolve all ready battles in parallel
  const results = await Promise.allSettled(
    readyBattles.map((b) =>
      resolveBattleAndParseEvent(program, connection, keypair, b.account)
    )
  );

  const resolvedBattles: { signerNft: PublicKey; opponentNft: PublicKey }[] = [];
  const battleRecords: BattleRecord[] = [];

  for (let i = 0; i < results.length; i++) {

    const result = results[i];
    const b = readyBattles[i];
    if (result.status === "fulfilled") {
      console.log(`Resolved battle: ${b.publicKey.toBase58()}`);
      resolvedBattles.push({ signerNft: b.account.signerNft, opponentNft: b.account.opponentNft! });
      battleRecords.push(result.value);

    } else {
      const err = result.reason;

      if (err?.name === "TransactionExpiredTimeoutError") {
        console.log(`Resolved battle (timeout): ${b.publicKey.toBase58()}`);
        resolvedBattles.push({ signerNft: b.account.signerNft, opponentNft: b.account.opponentNft! });

        // Transaction likely landed despite timeout — recover event from logs
        const sig = err?.signature ?? err?.transactionSignature;
        console.log(`Attempting event recovery from sig: ${sig}`);
        if (sig) {
          try {
            // Wait for tx to be indexed
            await new Promise((r) => setTimeout(r, 3000));
            const record = await parseEventFromSignature(
              program, connection, sig,
              b.account,
            );
            battleRecords.push(record);
            console.log(`Recovered battle record from timeout: ${b.publicKey.toBase58()}`);
          } catch (recoveryErr) {
            console.error(`Could not recover battle record after timeout:`, recoveryErr);
          }
        } else {
          console.warn(`No signature on timeout error — cannot recover battle record`);
        }
      } else {
        console.error(`Failed to resolve battle ${b.publicKey.toBase58()}:`, err);
      }
    }
  }

  return { resolvedBattles, battleRecords };
}

async function resolveBattleAndParseEvent(
  program: Program<Anchor>,
  connection: Connection,
  authority: Keypair,
  account: Awaited<ReturnType<typeof program.account.battle.all>>[number]["account"],
): Promise<BattleRecord> {
  const sig = await submitResolveTx(program, authority, account);
  await new Promise((r) => setTimeout(r, 1000));
  return parseEventFromSignature(program, connection, sig, account);
}

async function submitResolveTx(
  program: Program<Anchor>,
  authority: Keypair,
  account: Awaited<ReturnType<typeof program.account.battle.all>>[number]["account"],
): Promise<string> {
  const PROGRAM_ID = program.programId;

  const signerNft = account.signerNft;
  const opponentNft = account.opponentNft!;
  const signerWallet = account.signer;
  const opponentWallet = account.opponent!;

  const [battle] = PublicKey.findProgramAddressSync([BATTLE_SEED,  signerNft.toBuffer()],                      PROGRAM_ID);
  const [signerEscrow] = PublicKey.findProgramAddressSync([ESCROW_SEED,  battle.toBuffer(), signerNft.toBuffer()],   PROGRAM_ID);
  const [opponentEscrow] = PublicKey.findProgramAddressSync([ESCROW_SEED,  battle.toBuffer(), opponentNft.toBuffer()], PROGRAM_ID);
  const [signerFighter] = PublicKey.findProgramAddressSync([FIGHTER_SEED, signerNft.toBuffer()],                      PROGRAM_ID);
  const [opponentFighter] = PublicKey.findProgramAddressSync([FIGHTER_SEED, opponentNft.toBuffer()],                    PROGRAM_ID);

  const signerAta = await getAssociatedTokenAddress(signerNft,   signerWallet);
  const opponentAta = await getAssociatedTokenAddress(opponentNft, opponentWallet);
  const signersOpponentAta = await getAssociatedTokenAddress(opponentNft, signerWallet);
  const opponentsSignerAta = await getAssociatedTokenAddress(signerNft,   opponentWallet);

  return program.methods
    .resolveBattle()
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

async function parseEventFromSignature(
  program: Program<Anchor>,
  connection: Connection,
  sig: string,
  account: Awaited<ReturnType<typeof program.account.battle.all>>[number]["account"],
): Promise<BattleRecord> {
  const tx = await connection.getTransaction(sig, {
    commitment:                     "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  console.log(`tx null? ${tx === null} for sig ${sig}`);

  const logs = tx?.meta?.logMessages ?? [];
  console.log(`log count: ${logs.length}`);

  let resolvedEvent: any = null;
  for (const log of logs) {
    if (!log.startsWith("Program data: ")) continue;
    const base64 = log.replace("Program data: ", "");
    try {
      const decoded = program.coder.events.decode(base64);
      console.log(`decoded event name: ${decoded?.name}`);
      if (decoded?.name === "battleResolved") {
        resolvedEvent = decoded.data;
        break;
      }
    } catch { /* not an anchor event */ }
  }

  if (!resolvedEvent) {
    throw new Error(`Could not parse BattleResolved event from tx ${sig}`);
  }

  return {
    id: sig,
    signer: account.signer.toBase58(),
    signerNft: account.signerNft.toBase58(),
    opponent: account.opponent!.toBase58(),
    opponentNft: account.opponentNft!.toBase58(),
    winner: resolvedEvent.winner.toBase58(),
    battleMode: "pinkSlip" in resolvedEvent.battleMode ? "pinkSlip" : "bite",
    signerPower: resolvedEvent.signerPower,
    opponentPower: resolvedEvent.opponentPower,
    resolvedAt: Math.floor(Date.now() / 1000),
  };
}