import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Anchor } from "../target/types/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { assert } from "chai";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";

describe("fighter-battle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Anchor as Program<Anchor>;

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
      const userTokenAccount = anchor.utils.token.associatedAddress({
        mint: fighterMintA,
        owner: userA.publicKey,
      });

      const tx = await program.methods
        .mintFighter()
        .accounts({
          user: userA.publicKey,
          fighterMint: fighterMintA,
        })
        .signers([userA, mint])
        .rpc();

      console.log("Fighter A minted:", tx);

      // Verify Fighter state
      const fighter = await program.account.fighter.fetch(fighterPdaA);
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

      await program.methods
        .mintFighter()
        .accounts({
          user: userB.publicKey,
          fighterMint: fighterMintB,
        })
        .signers([userB, mint])
        .rpc();

      const fighter = await program.account.fighter.fetch(fighterPdaB);
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

      const signerTokenAccount = anchor.utils.token.associatedAddress({
        mint: fighterMintA,
        owner: userA.publicKey,
      });

      const tx = await program.methods
        .createBattle(
          null, // No specific opponent
          null, // No specific opponent NFT
          { pinkSlip: {} } // Battle mode
        )
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

      const userTokenAccount = anchor.utils.token.associatedAddress({
        mint: fighterMintC,
        owner: userA.publicKey,
      });

      await program.methods
        .mintFighter()
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

      await program.methods
        .createBattle(
          userB.publicKey, // Specific opponent
          fighterMintB, // Specific opponent NFT
          { bite: {} }
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

      const userTokenAccount = anchor.utils.token.associatedAddress({
        mint: fighterMint,
        owner: userA.publicKey,
      });

      await program.methods
        .mintFighter()
        .accounts({
          user: userA.publicKey,
          fighterMint,
        })
        .signers([userA, mint])
        .rpc();

      try {
        await program.methods
          .createBattle(
            userA.publicKey, // Self
            fighterMint,
            { pinkSlip: {} }
          )
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

      const opponentTokenAccount = anchor.utils.token.associatedAddress({
        mint: fighterMintB,
        owner: userB.publicKey,
      });

      const signerTokenAccount = anchor.utils.token.associatedAddress({
        mint: fighterMintA,
        owner: userA.publicKey,
      });

      const tx = await program.methods
        .acceptBattle()
        .accounts({
          opponent: userB.publicKey,
          opponentMint: fighterMintB,
          opponentTokenAccount,
          battle: battlePda,
          battleSigner: userA.publicKey,
          signerNftMint: fighterMintA,
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
      const winnerTokenAccountA = anchor.utils.token.associatedAddress({
        mint: fighterMintA,
        owner: winner,
      });
      const winnerTokenAccountB = anchor.utils.token.associatedAddress({
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

      const tokenAccountC = anchor.utils.token.associatedAddress({
        mint: fighterMintC,
        owner: userA.publicKey,
      });

      await program.methods
        .mintFighter()
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

      const tokenAccountD = anchor.utils.token.associatedAddress({
        mint: fighterMintD,
        owner: userB.publicKey,
      });

      await program.methods
        .mintFighter()
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

      await program.methods
        .createBattle(null, null, { bite: {} })
        .accounts({
          signer: userA.publicKey,
          signerMint: fighterMintC,
          signerTokenAccount: tokenAccountC,
        })
        .signers([userA])
        .rpc();

      // Accept battle

      await program.methods
        .acceptBattle()
        .accounts({
          opponent: userB.publicKey,
          opponentMint: fighterMintD,
          opponentTokenAccount: tokenAccountD,
          battle: battlePdaBite,
          battleSigner: userA.publicKey,
          signerNftMint: fighterMintC,
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
      const mint2 = Keypair.generate();
      const opponentMint = mint2.publicKey;

      const tokenAccount = anchor.utils.token.associatedAddress({
        mint: fighterMint,
        owner: userA.publicKey,
      });

      const opponentTokenAccount = anchor.utils.token.associatedAddress({
        mint: opponentMint,
        owner: userA.publicKey,
      });

      await program.methods
        .mintFighter()
        .accounts({
          user: userA.publicKey,
          fighterMint,
        })
        .signers([userA, mint])
        .rpc();

        await program.methods
        .mintFighter()
        .accounts({
          user: userA.publicKey,
          fighterMint: opponentMint,
        })
        .signers([userA, mint2])
        .rpc();

      const [battlePdaSelf] = PublicKey.findProgramAddressSync(
        [Buffer.from("battle"), fighterMint.toBuffer()],
        program.programId
      );

      await program.methods
        .createBattle(null, null, { pinkSlip: {} })
        .accounts({
          signer: userA.publicKey,
          signerMint: fighterMint,
          signerTokenAccount: tokenAccount,
        })
        .signers([userA])
        .rpc();

      try {
        await program.methods
          .acceptBattle()
          .accounts({
            opponent: userA.publicKey, // Same user
            opponentMint: opponentMint,
            opponentTokenAccount: opponentTokenAccount,
            battle: battlePdaSelf,
            battleSigner: userA.publicKey,
            signerNftMint: fighterMint, 
          })
          .signers([userA])
          .rpc();
        assert.fail("Should have failed accepting own battle");
      } catch (err) {
        const logs = err.transactionLogs?.join(" ") ?? err.toString();
        assert.include(logs, "CannotAcceptOwnBattle");
        assert.include(logs, "6004")
      }
    });
  });

  describe("cancel_battle", () => {
    let cancelMintKeypair: Keypair;
    let cancelMint: PublicKey;
    let cancelBattlePda: PublicKey;
    let cancelEscrow: PublicKey;
    let cancelTokenAccount: PublicKey;

    beforeEach(async () => {
      cancelMintKeypair = Keypair.generate();
      cancelMint = cancelMintKeypair.publicKey;

      cancelTokenAccount = anchor.utils.token.associatedAddress({
        mint: cancelMint,
        owner: userA.publicKey,
      });

      await program.methods
        .mintFighter()
        .accounts({
          user: userA.publicKey,
          fighterMint: cancelMint,
        })
        .signers([userA, cancelMintKeypair])
        .rpc();

      [cancelBattlePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("battle"), cancelMint.toBuffer()],
        program.programId
      );

      [cancelEscrow] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          cancelBattlePda.toBuffer(),
          cancelMint.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .createBattle(null, null, { pinkSlip: {} })
        .accounts({
          signer: userA.publicKey,
          signerMint: cancelMint,
          signerTokenAccount: cancelTokenAccount,
        })
        .signers([userA])
        .rpc();
    });

    it("Creator can cancel a pending battle and reclaims NFT", async () => {
      // NFT must be in escrow before cancel
      const escrowBefore = await provider.connection.getTokenAccountBalance(cancelEscrow);
      assert.equal(escrowBefore.value.amount, "1");

      const signerBefore = await provider.connection.getTokenAccountBalance(cancelTokenAccount);
      assert.equal(signerBefore.value.amount, "0");

      const tx = await program.methods
        .cancelBattle()
        .accounts({
          signer: userA.publicKey,
          signerMint: cancelMint,
        })
        .signers([userA])
        .rpc();

      console.log("Battle cancelled:", tx);

      // NFT returned to signer
      const signerAfter = await provider.connection.getTokenAccountBalance(cancelTokenAccount);
      assert.equal(signerAfter.value.amount, "1");

      // Battle PDA closed
      const battleAccount = await provider.connection.getAccountInfo(cancelBattlePda);
      assert.isNull(battleAccount);

      // Escrow token account closed
      const escrowAccount = await provider.connection.getAccountInfo(cancelEscrow);
      assert.isNull(escrowAccount);
    });

    it("Creator's SOL balance increases after cancel (rent reclaimed)", async () => {
      const balanceBefore = await provider.connection.getBalance(userA.publicKey);

      await program.methods
        .cancelBattle()
        .accounts({
          signer: userA.publicKey,
          signerMint: cancelMint,
        })
        .signers([userA])
        .rpc();

      const balanceAfter = await provider.connection.getBalance(userA.publicKey);

      // Rent reclaimed from battle PDA + escrow > tx fee
      assert.isAbove(balanceAfter, balanceBefore);
    });

    it("Non-creator (userB) cannot cancel userA's battle", async () => {

      try {
        await program.methods
          .cancelBattle()
          .accounts({
            signer: userB.publicKey,
            signerMint: cancelMint,
          })
          .signers([userB])
          .rpc();
        assert.fail("Should have failed: unauthorized cancel");
      } catch (err) {
        const logs = err.transactionLogs?.join(" ") ?? err.toString();
        assert.include(logs, "UnauthorizedCancel");
      }
    });

    it("Cannot cancel a battle that has already been completed", async () => {
      // fresh for this test
      const userBMintKeypair = Keypair.generate();
      const fighterMintB = userBMintKeypair.publicKey;

      await program.methods
        .mintFighter()
        .accounts({
          user: userB.publicKey,
          fighterMint: fighterMintB,
        })
        .signers([userB, userBMintKeypair])
        .rpc();
        
      const userBTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        userB,
        fighterMintB,
        userB.publicKey
      );
      
      // userB accepts, battle resolves immediately to Completed
      await program.methods
        .acceptBattle()
        .accounts({
          opponent: userB.publicKey,
          opponentMint: fighterMintB,
          battle: cancelBattlePda,
          battleSigner: userA.publicKey,
          signerNftMint: cancelMint,
          opponentTokenAccount: userBTokenAccount.address,
        })
        .signers([userB])
        .rpc();

      // Battle is now Completed, cancel must be rejected
      try {
        await program.methods
          .cancelBattle()
          .accounts({
            signer: userA.publicKey,
            signerMint: cancelMint,
          })
          .signers([userA])
          .rpc();
        assert.fail("Should have failed: battle not pending");
      } catch (err) {
        const logs = err.transactionLogs?.join(" ") ?? err.toString();
        assert.include(logs, "BattleNotPending");
      }
    });
  });

});