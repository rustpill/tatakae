import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Anchor } from "../target/types/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

describe("fighter-battle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Anchor as Program<Anchor>;
  const payer = provider.wallet as anchor.Wallet;

  // Test wallets
  let userA: Keypair;
  let userB: Keypair;

  // Fighter mints
  let fighterMintA: PublicKey;
  let fighterMintB: PublicKey;

  // PDAs
  let fighterPdaA: PublicKey;
  let fighterPdaB: PublicKey;
  let battlePda: PublicKey;
  let escrowA: PublicKey;
  let escrowB: PublicKey;

  before(async () => {
    // Airdrop to test wallets
    userA = Keypair.generate();
    userB = Keypair.generate();

    const airdropSigA = await provider.connection.requestAirdrop(
      userA.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    const airdropSigB = await provider.connection.requestAirdrop(
      userB.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );

    await provider.connection.confirmTransaction(airdropSigA);
    await provider.connection.confirmTransaction(airdropSigB);
  });

  describe("mint_fighter", () => {
    it("Mints a fighter NFT for User A", async () => {
      // Generate mint keypair
      const mint = Keypair.generate();
      fighterMintA = mint.publicKey;

      // Derive Fighter PDA
      [fighterPdaA] = PublicKey.findProgramAddressSync(
        [Buffer.from("fighter"), fighterMintA.toBuffer()],
        program.programId
      );

      // Get user's token account
      const userTokenAccount = await anchor.utils.token.associatedAddress({
        mint: fighterMintA,
        owner: userA.publicKey,
      });

      const name = "Dragon";
      const power = 85;

      const tx = await program.methods
        .mintFighter(name, power)
        .accounts({
          user: userA.publicKey,
          fighterMint: fighterMintA,
        })
        .signers([userA, mint])
        .rpc();

      console.log("Fighter A minted:", tx);

      // Verify Fighter state
      const fighter = await program.account.fighter.fetch(fighterPdaA);
      assert.equal(fighter.name, name);
      assert.equal(fighter.power, power);
      assert.equal(fighter.wins, 0);
      assert.equal(fighter.losses, 0);
      assert.equal(fighter.owner.toBase58(), userA.publicKey.toBase58());
      assert.equal(fighter.mint.toBase58(), fighterMintA.toBase58());

      // Verify NFT was minted
      const tokenAccount = await provider.connection.getTokenAccountBalance(
        userTokenAccount
      );
      assert.equal(tokenAccount.value.amount, "1");
    });

    it("Mints a fighter NFT for User B", async () => {
      const mint = Keypair.generate();
      fighterMintB = mint.publicKey;

      [fighterPdaB] = PublicKey.findProgramAddressSync(
        [Buffer.from("fighter"), fighterMintB.toBuffer()],
        program.programId
      );

      const userTokenAccount = await anchor.utils.token.associatedAddress({
        mint: fighterMintB,
        owner: userB.publicKey,
      });

      const name = "Phoenix";
      const power = 90;

      await program.methods
        .mintFighter(name, power)
        .accountsPartial({
          user: userB.publicKey,
          fighterMint: fighterMintB,
          userTokenAccount,
          fighter: fighterPdaB,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([userB, mint])
        .rpc();

      const fighter = await program.account.fighter.fetch(fighterPdaB);
      assert.equal(fighter.name, name);
      assert.equal(fighter.power, power);
    });

    it("Fails to mint fighter with invalid power", async () => {
      const mint = Keypair.generate();
      const [fighterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fighter"), mint.publicKey.toBuffer()],
        program.programId
      );

      const userTokenAccount = await anchor.utils.token.associatedAddress({
        mint: mint.publicKey,
        owner: userA.publicKey,
      });

      try {
        await program.methods
          .mintFighter("Invalid", 150) // Power > 100
          .accounts({
            user: userA.publicKey,
            fighterMint: mint.publicKey,
          })
          .signers([userA, mint])
          .rpc();
        assert.fail("Should have failed with invalid power");
      } catch (err) {
        assert.include(err.toString(), "InvalidPowerRange");
      }
    });

    it("Fails to mint fighter with empty name", async () => {
      const mint = Keypair.generate();
      const [fighterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fighter"), mint.publicKey.toBuffer()],
        program.programId
      );

      const userTokenAccount = await anchor.utils.token.associatedAddress({
        mint: mint.publicKey,
        owner: userA.publicKey,
      });

      try {
        await program.methods
          .mintFighter("", 75) // Empty name
          .accounts({
            user: userA.publicKey,
            fighterMint: mint.publicKey,
          })
          .signers([userA, mint])
          .rpc();
        assert.fail("Should have failed with empty name");
      } catch (err) {
        assert.include(err.toString(), "NameEmpty");
      }
    });
  });

  describe("create_battle", () => {
    it("Creates an open battle (PinkSlip mode)", async () => {
      // Derive Battle PDA
      [battlePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("battle"), fighterMintA.toBuffer()],
        program.programId
      );

      // Derive Escrow PDA
      [escrowA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          battlePda.toBuffer(),
          fighterMintA.toBuffer(),
        ],
        program.programId
      );

      const signerTokenAccount = await anchor.utils.token.associatedAddress({
        mint: fighterMintA,
        owner: userA.publicKey,
      });

      const tx = await program.methods
        .createBattle()
        .accounts({
          signer: userA.publicKey,
          signerMint: fighterMintA,
          signerTokenAccount,
        })
        .signers([userA])
        .rpc();

      console.log("Battle created:", tx);

      // Verify Battle state
      const battle = await program.account.battle.fetch(battlePda);
      assert.equal(battle.signer.toBase58(), userA.publicKey.toBase58());
      assert.isNull(battle.opponent);
      assert.isNull(battle.opponentNft);
      assert.equal(battle.signerNft.toBase58(), fighterMintA.toBase58());
      assert.deepEqual(battle.battleMode, { pinkSlip: {} });
      assert.deepEqual(battle.status, { pending: {} });

      // Verify NFT was escrowed
      const signerBalance = await provider.connection.getTokenAccountBalance(
        signerTokenAccount
      );
      assert.equal(signerBalance.value.amount, "0");

      const escrowBalance = await provider.connection.getTokenAccountBalance(
        escrowA
      );
      assert.equal(escrowBalance.value.amount, "1");
    });

    it("Creates a targeted battle (Bite mode)", async () => {
      // Mint another fighter for userA
      const mint = Keypair.generate();
      const fighterMintC = mint.publicKey;

      const [fighterPdaC] = PublicKey.findProgramAddressSync(
        [Buffer.from("fighter"), fighterMintC.toBuffer()],
        program.programId
      );

      const userTokenAccount = await anchor.utils.token.associatedAddress({
        mint: fighterMintC,
        owner: userA.publicKey,
      });

      await program.methods
        .mintFighter("Titan", 80)
        .accounts({
          user: userA.publicKey,
          fighterMint: fighterMintC,
        })
        .signers([userA, mint])
        .rpc();

      // Create targeted battle
      const [battlePdaTargeted] = PublicKey.findProgramAddressSync(
        [Buffer.from("battle"), fighterMintC.toBuffer()],
        program.programId
      );

      const [escrowC] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          battlePdaTargeted.toBuffer(),
          fighterMintC.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .createBattle(
        )
        .accounts({
          signer: userA.publicKey,
          signerMint: fighterMintC,
          signerTokenAccount: userTokenAccount,
        })
        .signers([userA])
        .rpc();

      const battle = await program.account.battle.fetch(battlePdaTargeted);
      assert.equal(battle.opponent.toBase58(), userB.publicKey.toBase58());
      assert.equal(battle.opponentNft.toBase58(), fighterMintB.toBase58());
      assert.deepEqual(battle.battleMode, { bite: {} });
    });

    it("Fails to create battle challenging yourself", async () => {
      const mint = Keypair.generate();
      const fighterMint = mint.publicKey;

      const [fighterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fighter"), fighterMint.toBuffer()],
        program.programId
      );

      const userTokenAccount = await anchor.utils.token.associatedAddress({
        mint: fighterMint,
        owner: userA.publicKey,
      });

      await program.methods
        .mintFighter("SelfTest", 75)
        .accounts({
          user: userA.publicKey,
          fighterMint,
        })
        .signers([userA, mint])
        .rpc();

      const [battlePdaSelf] = PublicKey.findProgramAddressSync(
        [Buffer.from("battle"), fighterMint.toBuffer()],
        program.programId
      );

      const [escrowSelf] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          battlePdaSelf.toBuffer(),
          fighterMint.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .createBattle()
          .accounts({
            signer: userA.publicKey,
            signerMint: fighterMint,
            signerTokenAccount: userTokenAccount,
          })
          .signers([userA])
          .rpc();
        assert.fail("Should have failed challenging yourself");
      } catch (err) {
        assert.include(err.toString(), "InvalidOpponent");
      }
    });
  });

  describe("accept_battle and resolve", () => {
    it("User B accepts open battle and battle resolves (PinkSlip)", async () => {
      // Derive Escrow B
      [escrowB] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          battlePda.toBuffer(),
          fighterMintB.toBuffer(),
        ],
        program.programId
      );

      const opponentTokenAccount = await anchor.utils.token.associatedAddress({
        mint: fighterMintB,
        owner: userB.publicKey,
      });

      const signerTokenAccount = await anchor.utils.token.associatedAddress({
        mint: fighterMintA,
        owner: userA.publicKey,
      });

      // Get slot hashes sysvar
      const slotHashes = new PublicKey(
        "SysvarS1otHashes111111111111111111111111111"
      );

      const tx = await program.methods
        .acceptBattle()
        .accounts({
          opponent: userB.publicKey,
          opponentMint: fighterMintB,
          signerMint: fighterMintA,
          opponentTokenAccount,
          signerTokenAccount,
          battle: battlePda,
        })
        .signers([userB])
        .rpc();

      console.log("Battle accepted and resolved:", tx);

      // Verify Battle completed
      const battle = await program.account.battle.fetch(battlePda);
      assert.deepEqual(battle.status, { completed: {} });
      assert.isNotNull(battle.winner);
      assert.isNotNull(battle.randomSeed);

      // Verify winner got both NFTs (PinkSlip mode)
      const winner = battle.winner;
      const winnerTokenAccountA = await anchor.utils.token.associatedAddress({
        mint: fighterMintA,
        owner: winner,
      });
      const winnerTokenAccountB = await anchor.utils.token.associatedAddress({
        mint: fighterMintB,
        owner: winner,
      });

      const balanceA = await provider.connection.getTokenAccountBalance(
        winnerTokenAccountA
      );
      const balanceB = await provider.connection.getTokenAccountBalance(
        winnerTokenAccountB
      );

      // Winner should have both NFTs
      assert.equal(balanceA.value.amount, "1");
      assert.equal(balanceB.value.amount, "1");

      // Verify fighter stats updated
      const fighterA = await program.account.fighter.fetch(fighterPdaA);
      const fighterB = await program.account.fighter.fetch(fighterPdaB);

      const totalBattles =
        fighterA.wins + fighterA.losses + fighterB.wins + fighterB.losses;
      assert.equal(totalBattles, 2); // One win, one loss
    });

    it("Bite mode returns NFTs to owners and applies penalty", async () => {
      // Create new fighters for bite test
      const mintC = Keypair.generate();
      const mintD = Keypair.generate();
      const fighterMintC = mintC.publicKey;
      const fighterMintD = mintD.publicKey;

      // Mint fighter C for userA
      const [fighterPdaC] = PublicKey.findProgramAddressSync(
        [Buffer.from("fighter"), fighterMintC.toBuffer()],
        program.programId
      );

      const tokenAccountC = await anchor.utils.token.associatedAddress({
        mint: fighterMintC,
        owner: userA.publicKey,
      });

      await program.methods
        .mintFighter("Viper", 70)
        .accounts({
          user: userA.publicKey,
          fighterMint: fighterMintC,
        })
        .signers([userA, mintC])
        .rpc();

      // Mint fighter D for userB
      const [fighterPdaD] = PublicKey.findProgramAddressSync(
        [Buffer.from("fighter"), fighterMintD.toBuffer()],
        program.programId
      );

      const tokenAccountD = await anchor.utils.token.associatedAddress({
        mint: fighterMintD,
        owner: userB.publicKey,
      });

      await program.methods
        .mintFighter("Cobra", 75)
        .accounts({
          user: userB.publicKey,
          fighterMint: fighterMintD,
        })
        .signers([userB, mintD])
        .rpc();

      // Create Bite battle
      const [battlePdaBite] = PublicKey.findProgramAddressSync(
        [Buffer.from("battle"), fighterMintC.toBuffer()],
        program.programId
      );

      const [escrowC] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          battlePdaBite.toBuffer(),
          fighterMintC.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .createBattle()
        .accounts({
          signer: userA.publicKey,
          signerMint: fighterMintC,
          signerTokenAccount: tokenAccountC,
        })
        .signers([userA])
        .rpc();

      // Accept battle
      const [escrowD] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          battlePdaBite.toBuffer(),
          fighterMintD.toBuffer(),
        ],
        program.programId
      );

      const slotHashes = new PublicKey(
        "SysvarS1otHashes111111111111111111111111111"
      );

      await program.methods
        .acceptBattle()
        .accounts({
          opponent: userB.publicKey,
          opponentMint: fighterMintD,
          signerMint: fighterMintC,
          opponentTokenAccount: tokenAccountD,
          signerTokenAccount: tokenAccountC,
          battle: battlePdaBite,
        })
        .signers([userB])
        .rpc();

      // Verify both got their NFTs back
      const balanceC = await provider.connection.getTokenAccountBalance(
        tokenAccountC
      );
      const balanceD = await provider.connection.getTokenAccountBalance(
        tokenAccountD
      );
      assert.equal(balanceC.value.amount, "1");
      assert.equal(balanceD.value.amount, "1");

      // Verify loser has bite penalty
      const fighterC = await program.account.fighter.fetch(fighterPdaC);
      const fighterD = await program.account.fighter.fetch(fighterPdaD);

      const loser =
        fighterC.losses > fighterD.losses ? fighterC : fighterD;
      assert.isAbove(loser.bitePenalties, 0);
    });

    it("Fails to accept your own battle", async () => {
      // Create battle
      const mint = Keypair.generate();
      const fighterMint = mint.publicKey;

      const [fighterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fighter"), fighterMint.toBuffer()],
        program.programId
      );

      const tokenAccount = await anchor.utils.token.associatedAddress({
        mint: fighterMint,
        owner: userA.publicKey,
      });

      await program.methods
        .mintFighter("SelfBattle", 80)
        .accounts({
          user: userA.publicKey,
          fighterMint,
        })
        .signers([userA, mint])
        .rpc();

      const [battlePdaSelf] = PublicKey.findProgramAddressSync(
        [Buffer.from("battle"), fighterMint.toBuffer()],
        program.programId
      );

      const [escrow] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          battlePdaSelf.toBuffer(),
          fighterMint.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .createBattle()
        .accounts({
          signer: userA.publicKey,
          signerMint: fighterMint,
          signerTokenAccount: tokenAccount,
        })
        .signers([userA])
        .rpc();

      // Try to accept own battle
      const slotHashes = new PublicKey(
        "SysvarS1otHashes111111111111111111111111111"
      );

      try {
        await program.methods
          .acceptBattle()
          .accounts({
            opponent: userA.publicKey, // Same user
            opponentMint: fighterMint,
            signerMint: fighterMint,
            opponentTokenAccount: tokenAccount,
            signerTokenAccount: tokenAccount,
            battle: battlePdaSelf,
          })
          .signers([userA])
          .rpc();
        assert.fail("Should have failed accepting own battle");
      } catch (err) {
        assert.include(err.toString(), "CannotAcceptOwnBattle");
      }
    });
  });
});