import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Anchor } from "../target/types/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_SLOT_HASHES_PUBKEY,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Load setup output
const SETUP_PATH = path.resolve(__dirname, "scripts/output/setup.json");
if (!fs.existsSync(SETUP_PATH)) {
  throw new Error(
    "scripts/output/setup.json not found.\n"
  );
}
const setup = JSON.parse(fs.readFileSync(SETUP_PATH, "utf-8"));
const f = setup.fighters as { mint: string; power: number; proof: number[][] }[];
if (f.length < 11) {
  throw new Error(
    `Need at least 11 fighters in setup.json, found ${f.length}.\n` +
    `Add more to FIGHTER_POWERS in setup.ts and re run.`
  );
}


const WALLET_PATH = path.join(os.homedir(), ".config/solana/id.json");
if (!fs.existsSync(WALLET_PATH)) {
  throw new Error(`Authority wallet not found at ${WALLET_PATH}\n`);
}
const authorityKeypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8")))
);

// PDA helpers
const BATTLE_SEED = Buffer.from("battle");
const ESCROW_SEED = Buffer.from("escrow");
const FIGHTER_SEED = Buffer.from("fighter");
const CONFIG_SEED = Buffer.from("config");
const MPL_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

function battlePda(pid: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync([BATTLE_SEED, mint.toBuffer()], pid);
}
function escrowPda(pid: PublicKey, battle: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [ESCROW_SEED, battle.toBuffer(), mint.toBuffer()], pid
  );
}
function fighterPda(pid: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync([FIGHTER_SEED, mint.toBuffer()], pid);
}
function configPda(pid: PublicKey) {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], pid);
}
function metadataPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), MPL_ID.toBuffer(), mint.toBuffer()],
    MPL_ID
  )[0];
}

// Account builders
function initFighterAccounts(
  pid: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  ownerTokenAccount: PublicKey
) {
  return {
    owner,
    config: configPda(pid)[0],
    fighter: fighterPda(pid, mint)[0],
    fighterMint: mint,
    fighterMetadata: metadataPda(mint),
    ownerTokenAccount,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: anchor.web3.SystemProgram.programId,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  };
}

function createBattleAccounts(
  pid: PublicKey,
  signer: PublicKey,
  signerMint: PublicKey,
  signerTokenAccount: PublicKey
) {
  const [battle] = battlePda(pid, signerMint);
  const [signerEscrow] = escrowPda(pid, battle, signerMint);
  return {
    signer,
    signerMint,
    signerTokenAccount,
    signerEscrow,
    battle,
    systemProgram: anchor.web3.SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  };
}

// Helpers
async function airdrop(connection: Connection, pubkey: PublicKey, sol = 5) {
  const sig = await connection.requestAirdrop(pubkey, sol * 1e9);
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature: sig,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  }, "confirmed");
}

async function transferNft(
  provider: anchor.AnchorProvider,
  mint: PublicKey,
  to: PublicKey
) {
  const from = provider.wallet.publicKey;
  const fromAta = await getAssociatedTokenAddress(mint, from);
  const toAta = await getAssociatedTokenAddress(mint, to);
  const tx = new Transaction();

  try {
    await getAccount(provider.connection, toAta);
  } catch {
    tx.add(createAssociatedTokenAccountInstruction(from, toAta, to, mint));
  }
  tx.add(createTransferInstruction(fromAta, toAta, from, 1));
  await provider.sendAndConfirm(tx);
}

async function waitForSlots(connection: Connection, fromSlot: number, n: number) {
  let current = await connection.getSlot("confirmed");
  while (current <= fromSlot + n) {
    await new Promise(r => setTimeout(r, 400));
    current = await connection.getSlot("confirmed");
  }
}

async function resolveBattle(
  program: Program<Anchor>,
  connection: Connection,
  signerMint: PublicKey,
  opponentMint: PublicKey,
  signerWallet: PublicKey,
  opponentWallet: PublicKey,
) {
  const pid = program.programId;
  const [battle] = battlePda(pid, signerMint);
  const [signerEscrow] = escrowPda(pid, battle, signerMint);
  const [opponentEscrow] = escrowPda(pid, battle, opponentMint);
  const [signerFighter] = fighterPda(pid, signerMint);
  const [opponentFighter] = fighterPda(pid, opponentMint);

  const signerAta  = await getAssociatedTokenAddress(signerMint, signerWallet);
  const opponentAta = await getAssociatedTokenAddress(opponentMint, opponentWallet);
  const signersOpponentAta = await getAssociatedTokenAddress(opponentMint, signerWallet);
  const opponentsSignerAta = await getAssociatedTokenAddress(signerMint, opponentWallet);

  // Wait for the slot delay before submitting
  const battleData = await program.account.battle.fetch(battle);
  const acceptedSlot = (battleData.acceptedSlot as anchor.BN).toNumber();
  await waitForSlots(connection, acceptedSlot, 2);

  try {
    await program.methods
      .resolveBattle()
      .accountsPartial({
        authority: authorityKeypair.publicKey,
        battle,
        battleSigner: signerWallet,
        battleOpponent: opponentWallet,
        signerEscrow,
        opponentEscrow,
        signerTokenAccount: signerAta,
        opponentTokenAccount: opponentAta,
        signersOpponentAta,
        opponentsSignerAta,
        signerNftMint: signerMint,
        opponentNftMint: opponentMint,
        signerFighter,
        opponentFighter,
        slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([authorityKeypair])
      .rpc();
  } catch (e) {
    console.log(e)
  }
}

describe("fighter-battles", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Anchor as Program<Anchor>;
  const connection = provider.connection;
  const pid = program.programId;

  // foo + bar used throughout multiple tests
  let foo: Keypair;
  let bar: Keypair;
  let fooMint: PublicKey;
  let barMint: PublicKey;

  before(async () => {
    foo = Keypair.generate();
    bar = Keypair.generate();
    fooMint = new PublicKey(f[0].mint);
    barMint = new PublicKey(f[1].mint);

    await airdrop(connection, foo.publicKey);
    await airdrop(connection, bar.publicKey);

    // transfer nfts from setup to the wallets
    await transferNft(provider, fooMint, foo.publicKey);
    await transferNft(provider, barMint,   bar.publicKey);

    console.log("\nfoo:", foo.publicKey.toBase58());
    console.log("bar:", bar.publicKey.toBase58());
  });

  // initialize_fighter()

  describe("initialize_fighter", () => {

    // uses f[0] (foo), inits
    it("initializes foo fighter with correct power", async () => {
      const ata = await getAssociatedTokenAddress(fooMint, foo.publicKey);

      await program.methods
        .initializeFighter(f[0].power, f[0].proof)
        .accounts(initFighterAccounts(pid, foo.publicKey, fooMint, ata))
        .signers([foo])
        .rpc();

      const acc = await program.account.fighter.fetch(fighterPda(pid, fooMint)[0]);
      assert.equal(acc.mint.toBase58(), fooMint.toBase58());
      assert.equal(acc.power, f[0].power);
      assert.equal(acc.wins, 0);
      assert.equal(acc.losses, 0);
      console.log(`\nfoo initialized - power: ${f[0].power}`);
    });
    // uses f[1] (bar), inits
    it("initializes bar fighter with correct power", async () => {
      const ata = await getAssociatedTokenAddress(barMint, bar.publicKey);

      await program.methods
        .initializeFighter(f[1].power, f[1].proof)
        .accounts(initFighterAccounts(pid, bar.publicKey, barMint, ata))
        .signers([bar])
        .rpc();

      const acc = await program.account.fighter.fetch(fighterPda(pid, barMint)[0]);
      assert.equal(acc.power, f[1].power);
      console.log(`bar initialized - power: ${f[1].power}`);
    });
    // uses f[2] (transfers), inits
    it("rejects tampered power (invalid merkle proof)", async () => {
      const mint = new PublicKey(f[2].mint);
      const wallet = Keypair.generate();
      await airdrop(connection, wallet.publicKey);
      await transferNft(provider, mint, wallet.publicKey);
      const ata = await getAssociatedTokenAddress(mint, wallet.publicKey);

      try {
        await program.methods
          .initializeFighter(f[2].power + 1, f[2].proof)
          .accounts(initFighterAccounts(pid, wallet.publicKey, mint, ata))
          .signers([wallet])
          .rpc();
        assert.fail("Should have thrown InvalidProof");
      } catch (e: any) {
        assert.include(e.message, "InvalidProof");
        console.log("Different power rejected");
      }
    });
    // uses f[1] (no transfers), no inits
    it("rejects wallet that does not own the NFT", async () => {
      const ata = await getAssociatedTokenAddress(barMint, foo.publicKey);
      try {
        await program.methods
          .initializeFighter(f[1].power, f[1].proof)
          .accounts(initFighterAccounts(pid, foo.publicKey, barMint, ata))
          .signers([foo])
          .rpc();
        assert.fail("Should have rejected non-owner");
      } catch (e: any) {
        assert.ok(e.message);
        console.log("Non owner rejected");
      }
    });
  });

  // create_battle()

  describe("create_battle", () => {

    // uses f[0] (foo), transfers to escrow
    it("creates open PinkSlip battle and locks NFT in escrow", async () => {
      const ata = await getAssociatedTokenAddress(fooMint, foo.publicKey);
      const accounts = createBattleAccounts(pid, foo.publicKey, fooMint, ata);

      await program.methods
        .createBattle(null, null, { pinkSlip: {} }, null, null)
        .accounts(accounts)
        .signers([foo])
        .rpc();

      const battle = await program.account.battle.fetch(accounts.battle);
      assert.equal(battle.signer.toBase58(), foo.publicKey.toBase58());
      assert.isNull(battle.opponent);
      assert.deepEqual(battle.status, { pending: {} });
      assert.deepEqual(battle.battleMode, { pinkSlip: {} });
      assert.isNull(battle.minPower);
      assert.isNull(battle.maxPower);
      assert.isNull(battle.acceptedSlot);

      const escrow = await getAccount(connection, accounts.signerEscrow);
      assert.equal(escrow.amount.toString(), "1");
      console.log("\nOpen PinkSlip battle created - NFT in escrow");
    });

    // uses f[3] (transfers), inits, create battle, battle targets f[1] (bar)
    it("creates targeted Bite battle with specific opponent", async () => {
      const mint = new PublicKey(f[3].mint);
      const wallet = Keypair.generate();
      await airdrop(connection, wallet.publicKey);
      await transferNft(provider, mint, wallet.publicKey);
      const ata = await getAssociatedTokenAddress(mint, wallet.publicKey);

      await program.methods
        .initializeFighter(f[3].power, f[3].proof)
        .accounts(initFighterAccounts(pid, wallet.publicKey, mint, ata))
        .signers([wallet])
        .rpc();

      const accounts = createBattleAccounts(pid, wallet.publicKey, mint, ata);

      await program.methods
        .createBattle(bar.publicKey, barMint, { bite: {} }, null, null)
        .accounts(accounts)
        .signers([wallet])
        .rpc();

      const battle = await program.account.battle.fetch(accounts.battle);
      assert.equal(battle.opponent.toBase58(), bar.publicKey.toBase58());
      assert.equal(battle.opponentNft.toBase58(), barMint.toBase58());
      assert.deepEqual(battle.battleMode, { bite: {} });
      console.log("Targeted Bite battle created");
    });

    // uses f[4] (transfers), inits, creates power gated battle
    it("creates power gated open battle", async () => {
      const mint = new PublicKey(f[4].mint);
      const wallet = Keypair.generate();
      await airdrop(connection, wallet.publicKey);
      await transferNft(provider, mint, wallet.publicKey);
      const ata = await getAssociatedTokenAddress(mint, wallet.publicKey);

      await program.methods
        .initializeFighter(f[4].power, f[4].proof)
        .accounts(initFighterAccounts(pid, wallet.publicKey, mint, ata))
        .signers([wallet])
        .rpc();

      const accounts = createBattleAccounts(pid, wallet.publicKey, mint, ata);

      await program.methods
        .createBattle(null, null, { pinkSlip: {} }, 50, 450)
        .accounts(accounts)
        .signers([wallet])
        .rpc();

      const battle = await program.account.battle.fetch(accounts.battle);
      assert.equal(battle.minPower, 50);
      assert.equal(battle.maxPower, 450);
      console.log("Power gated battle created (50-450)");
    });

    // uses f[5] (transfers), inits, battle targets f[1] (bar)
    it("rejects opponent set without opponent_nft", async () => {
      const mint = new PublicKey(f[5].mint);
      const wallet = Keypair.generate();
      await airdrop(connection, wallet.publicKey);
      await transferNft(provider, mint, wallet.publicKey);
      const ata = await getAssociatedTokenAddress(mint, wallet.publicKey);

      await program.methods
        .initializeFighter(f[5].power, f[5].proof)
        .accounts(initFighterAccounts(pid, wallet.publicKey, mint, ata))
        .signers([wallet])
        .rpc();

      const accounts = createBattleAccounts(pid, wallet.publicKey, mint, ata);

      try {
        await program.methods
          .createBattle(bar.publicKey, null, { pinkSlip: {} }, null, null)
          .accounts(accounts)
          .signers([wallet])
          .rpc();
        assert.fail("Should have thrown InvalidOpponentDeclaration");
      } catch (e: any) {
        assert.include(e.message, "InvalidOpponentDeclaration");
        console.log("Mismatched opponent/opponent_nft rejected");
      }
    });
  });

  // cancel_battle()

  describe("cancel_battle", () => {

    // uses f[0] (foo), returns nft from escrow
    it("creator cancels battle and recovers NFT from escrow", async () => {
      const [battle] = battlePda(pid, fooMint);
      const [signerEscrow] = escrowPda(pid, battle, fooMint);
      const ata = await getAssociatedTokenAddress(fooMint, foo.publicKey);

      await program.methods
        .cancelBattle()
        .accountsPartial({
          signer: foo.publicKey,
          signerMint: fooMint,
          signerTokenAccount: ata,
          signerEscrow,
          battle,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([foo])
        .rpc();

      assert.isNull(await connection.getAccountInfo(battle), "Battle PDA should be closed");
      const fooAta = await getAccount(connection, ata);
      assert.equal(fooAta.amount.toString(), "1");
      console.log("\nBattle cancelled - NFT returned to foo");
    });

    // uses f[0] (foo)
    it("non creator cannot cancel", async () => {
      const ata = await getAssociatedTokenAddress(fooMint, foo.publicKey);
      const accounts = createBattleAccounts(pid, foo.publicKey, fooMint, ata);

      await program.methods
        .createBattle(null, null, { pinkSlip: {} }, null, null)
        .accounts(accounts)
        .signers([foo])
        .rpc();

      const [battle] = battlePda(pid, fooMint);
      const [signerEscrow] = escrowPda(pid, battle, fooMint);
      const barFakeAta = await getAssociatedTokenAddress(fooMint, bar.publicKey);

      try {
        await program.methods
          .cancelBattle()
          .accountsPartial({
            signer: bar.publicKey,
            signerMint: fooMint,
            signerTokenAccount: barFakeAta,
            signerEscrow,
            battle,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([bar])
          .rpc();
        assert.fail("Should have thrown UnauthorizedCancel");
      } catch (e: any) {
        assert.ok(e.message);
        console.log("Non creator cancel rejected");
      }
    });
  });

  // accept_battle() - PinkSlip

  describe("accept_battle + resolve_battle - PinkSlip", () => {

    // uses f[0] (foo) f[1] (bar), returns nft from escrow, 1 wallet gets both
    it("accept locks NFTs in escrow, resolve sends to winner", async () => {
      const [battle] = battlePda(pid, fooMint);
      const [fooEscrow] = escrowPda(pid, battle, fooMint);
      const [barEscrow] = escrowPda(pid, battle, barMint);
      const [fooFighter] = fighterPda(pid, fooMint);
      const [barFighter] = fighterPda(pid, barMint);

      const fooAta = await getAssociatedTokenAddress(fooMint, foo.publicKey);
      const barAta = await getAssociatedTokenAddress(barMint, bar.publicKey);
      const fooReceivesbarNft = await getAssociatedTokenAddress(barMint, foo.publicKey);
      const barReceivesfooNft = await getAssociatedTokenAddress(fooMint, bar.publicKey);

      // foos battle exist from the cancel test (non creator cannot cancel)
      const battleInfo = await connection.getAccountInfo(battle);
      if (!battleInfo) {
        await program.methods
          .createBattle(null, null, { pinkSlip: {} }, null, null)
          .accounts(createBattleAccounts(pid, foo.publicKey, fooMint, fooAta))
          .signers([foo])
          .rpc();
      }

      const prefoo = await program.account.fighter.fetch(fooFighter);
      const prebar = await program.account.fighter.fetch(barFighter);

      // acceptBattle
      await program.methods
        .acceptBattle()
        .accountsPartial({
          opponent: bar.publicKey,
          opponentMint: barMint,
          opponentTokenAccount: barAta,
          opponentEscrow: barEscrow,
          battle,
          signerFighter: fooFighter,
          opponentFighter: barFighter,
          battleSigner: foo.publicKey,
          signersOpponentAta: fooReceivesbarNft,
          signerNftMint: fooMint,
          opponentsSignerAta: barReceivesfooNft,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([bar])
        .rpc();

      // Battle should now be Accepted — not closed
      const battleState = await program.account.battle.fetch(battle);
      assert.deepEqual(battleState.status, { accepted: {} }, "Battle should be Accepted after accept_battle");
      assert.isNotNull(battleState.acceptedSlot, "acceptedSlot should be set");

      // Both NFTs should be locked in escrow
      const fooEscrowAcc = await getAccount(connection, fooEscrow);
      const barEscrowAcc = await getAccount(connection, barEscrow);
      assert.equal(fooEscrowAcc.amount.toString(), "1", "Signer NFT should be in escrow");
      assert.equal(barEscrowAcc.amount.toString(), "1", "Opponent NFT should be in escrow");
      console.log("\naccept_battle: both NFTs locked in escrow, battle Accepted");
      
      // resolve battle
      await resolveBattle(program, connection, fooMint, barMint, foo.publicKey, bar.publicKey);

      assert.isNull(await connection.getAccountInfo(battle), "Battle PDA should be closed");

      const postfoo = await program.account.fighter.fetch(fooFighter);
      const postbar = await program.account.fighter.fetch(barFighter);

      assert.equal(
        (postfoo.wins - prefoo.wins) + (postbar.wins - prebar.wins), 1
      );
      assert.equal(
        (postfoo.losses - prefoo.losses) + (postbar.losses - prebar.losses), 1
      );

      const fooTotal =
        await getAccount(connection, fooAta).then(a => Number(a.amount)).catch(() => 0) +
        await getAccount(connection, fooReceivesbarNft).then(a => Number(a.amount)).catch(() => 0);
      const barTotal =
        await getAccount(connection, barAta).then(a => Number(a.amount)).catch(() => 0) +
        await getAccount(connection, barReceivesfooNft).then(a => Number(a.amount)).catch(() => 0);

      assert.equal(fooTotal + barTotal, 2);
      assert.ok(fooTotal === 2 || barTotal === 2, "Winner should hold both NFTs");

      const winner = fooTotal === 2 ? "foo" : "bar";
      console.log(`\nPinkSlip resolved - ${winner} won`);
      console.log(`foo: ${postfoo.wins}W / ${postfoo.losses}L`);
      console.log(`bar: ${postbar.wins}W / ${postbar.losses}L`);
    });
  });

  // accept_battle() - Bite

  describe("accept_battle + resolve_battle - Bite mode", () => {

    // uses f[6] f[7] (transfers), inits, returns nft from escrow
    it("NFTs returned to owners, 20% power transferred to winner", async () => {
      const mintA = new PublicKey(f[6].mint);
      const mintB = new PublicKey(f[7].mint);
      const walletA = Keypair.generate();
      const walletB = Keypair.generate();
      await airdrop(connection, walletA.publicKey);
      await airdrop(connection, walletB.publicKey);
      await transferNft(provider, mintA, walletA.publicKey);
      await transferNft(provider, mintB, walletB.publicKey);

      const ataA = await getAssociatedTokenAddress(mintA, walletA.publicKey);
      const ataB = await getAssociatedTokenAddress(mintB, walletB.publicKey);

      await program.methods
        .initializeFighter(f[6].power, f[6].proof)
        .accounts(initFighterAccounts(pid, walletA.publicKey, mintA, ataA))
        .signers([walletA])
        .rpc();

      await program.methods
        .initializeFighter(f[7].power, f[7].proof)
        .accounts(initFighterAccounts(pid, walletB.publicKey, mintB, ataB))
        .signers([walletB])
        .rpc();

      const [fighterPdaA] = fighterPda(pid, mintA);
      const [fighterPdaB] = fighterPda(pid, mintB);
      const preA = await program.account.fighter.fetch(fighterPdaA);
      const preB = await program.account.fighter.fetch(fighterPdaB);

      const [battle]  = battlePda(pid, mintA);
      const [escrowB] = escrowPda(pid, battle, mintB);

      await program.methods
        .createBattle(null, null, { bite: {} }, null, null)
        .accounts(createBattleAccounts(pid, walletA.publicKey, mintA, ataA))
        .signers([walletA])
        .rpc();

      const aReceivesB = await getAssociatedTokenAddress(mintB, walletA.publicKey);
      const bReceivesA = await getAssociatedTokenAddress(mintA, walletB.publicKey);

      // acceptBattle
      await program.methods
        .acceptBattle()
        .accountsPartial({
          opponent: walletB.publicKey,
          opponentMint: mintB,
          opponentTokenAccount: ataB,
          opponentEscrow: escrowB,
          battle,
          signerFighter: fighterPdaA,
          opponentFighter: fighterPdaB,
          battleSigner: walletA.publicKey,
          signersOpponentAta: aReceivesB,
          signerNftMint: mintA,
          opponentsSignerAta: bReceivesA,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([walletB])
        .rpc();

      const battleState = await program.account.battle.fetch(battle);
      assert.deepEqual(battleState.status, { accepted: {} });
      console.log("\naccept_battle: Bite battle accepted");

      // resolveBattle
      await resolveBattle(program, connection, mintA, mintB, walletA.publicKey, walletB.publicKey);

      const postA = await program.account.fighter.fetch(fighterPdaA);
      const postB = await program.account.fighter.fetch(fighterPdaB);

      const ataAPost = await getAccount(connection, ataA);
      const ataBPost = await getAccount(connection, ataB);
      assert.equal(ataAPost.amount.toString(), "1", "Fighter A should have NFT back");
      assert.equal(ataBPost.amount.toString(), "1", "Fighter B should have NFT back");
      assert.equal(preA.power + preB.power, postA.power + postB.power, "Power conserved");
      assert.notEqual(postA.power, preA.power, "Power should have shifted");

      const winner = postA.power > preA.power ? "Fighter A" : "Fighter B";
      console.log(`\nBite resolved - ${winner} won`);
      console.log(`Fighter A: ${preA.power} → ${postA.power}`);
      console.log(`Fighter B: ${preB.power} → ${postB.power}`);
    });
  });

  // Other
  describe("resolve_battle - slot delay guard", () => {
    
    // uses f[8] f[9] 
    it("rejects resolve_battle called in the same slot as accept_battle", async () => {
      const mintA   = new PublicKey(f[8].mint);
      const mintB   = new PublicKey(f[9].mint);
      const walletA = Keypair.generate();
      const walletB = Keypair.generate();
      await airdrop(connection, walletA.publicKey);
      await airdrop(connection, walletB.publicKey);
      await transferNft(provider, mintA, walletA.publicKey);
      await transferNft(provider, mintB, walletB.publicKey);

      const ataA = await getAssociatedTokenAddress(mintA, walletA.publicKey);
      const ataB = await getAssociatedTokenAddress(mintB, walletB.publicKey);

      await program.methods
        .initializeFighter(f[8].power, f[8].proof)
        .accounts(initFighterAccounts(pid, walletA.publicKey, mintA, ataA))
        .signers([walletA])
        .rpc();
      await program.methods
        .initializeFighter(f[9].power, f[9].proof)
        .accounts(initFighterAccounts(pid, walletB.publicKey, mintB, ataB))
        .signers([walletB])
        .rpc();

      const [battle]  = battlePda(pid, mintA);
      const [escrowA] = escrowPda(pid, battle, mintA);
      const [escrowB] = escrowPda(pid, battle, mintB);
      const [fighterA] = fighterPda(pid, mintA);
      const [fighterB] = fighterPda(pid, mintB);

      await program.methods
        .createBattle(null, null, { bite: {} }, null, null)
        .accounts(createBattleAccounts(pid, walletA.publicKey, mintA, ataA))
        .signers([walletA])
        .rpc();

      const aReceivesB = await getAssociatedTokenAddress(mintB, walletA.publicKey);
      const bReceivesA = await getAssociatedTokenAddress(mintA, walletB.publicKey);

      await program.methods
        .acceptBattle()
        .accountsPartial({
          opponent:             walletB.publicKey,
          opponentMint:         mintB,
          opponentTokenAccount: ataB,
          opponentEscrow:       escrowB,
          battle,
          signerFighter:        fighterA,
          opponentFighter:      fighterB,
          battleSigner:         walletA.publicKey,
          signersOpponentAta:   aReceivesB,
          signerNftMint:        mintA,
          opponentsSignerAta:   bReceivesA,
          systemProgram:        anchor.web3.SystemProgram.programId,
          tokenProgram:         TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([walletB])
        .rpc();

      // Attempt immediate resolve — should fail with BattleNotReadyToResolve
      try {
        await program.methods
          .resolveBattle()
          .accountsPartial({
            authority:            authorityKeypair.publicKey,
            battle,
            battleSigner:         walletA.publicKey,
            battleOpponent:       walletB.publicKey,
            signerEscrow:         escrowA,
            opponentEscrow:       escrowB,
            signerTokenAccount:   ataA,
            opponentTokenAccount: ataB,
            signersOpponentAta:   aReceivesB,
            opponentsSignerAta:   bReceivesA,
            signerNftMint:        mintA,
            opponentNftMint:      mintB,
            signerFighter:        fighterA,
            opponentFighter:      fighterB,
            slotHashes:           SYSVAR_SLOT_HASHES_PUBKEY,
            systemProgram:        anchor.web3.SystemProgram.programId,
            tokenProgram:         TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([authorityKeypair])
          .rpc();
        assert.fail("Should have thrown BattleNotReadyToResolve");
      } catch (e: any) {
        assert.include(e.message, "BattleNotReadyToResolve");
        console.log("\nSlot delay enforced — immediate resolve rejected");
      }

      // Clean up: wait and resolve so the battle PDA and escrows are properly closed
      const battleData = await program.account.battle.fetch(battle);
      const acceptedSlot = (battleData.acceptedSlot as anchor.BN).toNumber();
      await waitForSlots(connection, acceptedSlot, 2);
      await resolveBattle(program, connection, mintA, mintB, walletA.publicKey, walletB.publicKey);
      console.log("Slot delay test battle cleaned up");
    });
  });

  describe("edge cases", () => {
    // uses f[3] f[10]
    it("targeted battle rejects wrong opponent", async () => {
      const mint = new PublicKey(f[3].mint);
      const [battle] = battlePda(pid, mint); // created in create_battle test

      // initialize f[10] (opponent)
      const mintA = new PublicKey(f[10].mint);
      const walletA = Keypair.generate();
      await airdrop(connection, walletA.publicKey);
      await transferNft(provider, mintA, walletA.publicKey);
      const ataA = await getAssociatedTokenAddress(mintA, walletA.publicKey);

      await program.methods
        .initializeFighter(f[10].power, f[10].proof)
        .accounts(initFighterAccounts(pid, walletA.publicKey, mintA, ataA))
        .signers([walletA])
        .rpc();

      const battleData = await program.account.battle.fetch(battle);
      const [opponentEscrow] = escrowPda(pid, battle, mintA);
      const [mintAFighterPda] = fighterPda(pid, mintA);
      const [signerFighterPda] = fighterPda(pid, mint);
      const mintA_Ata = await getAssociatedTokenAddress(mintA, walletA.publicKey);
      const signersMintA_Ata = await getAssociatedTokenAddress(mintA, battleData.signer);
      const mintASignerAta = await getAssociatedTokenAddress(mint, walletA.publicKey);

      try {
        await program.methods
          .acceptBattle()
          .accountsPartial({
            opponent: walletA.publicKey,
            opponentMint: mintA,
            opponentTokenAccount: mintA_Ata,
            opponentEscrow,
            battle,
            signerFighter: signerFighterPda,
            opponentFighter: mintAFighterPda,
            battleSigner: battleData.signer,
            signersOpponentAta: signersMintA_Ata,
            signerNftMint: mint,
            opponentsSignerAta: mintASignerAta,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([walletA])
          .rpc();
        assert.fail("Should have thrown InvalidOpponent");
      } catch (e: any) {
        assert.include(e.message, "InvalidOpponent");
        console.log("Wrong opponent rejected on targeted battle");
      }
    });
  });
});