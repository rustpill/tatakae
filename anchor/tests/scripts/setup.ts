import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createNft,
  verifyCollectionV1,
  findMetadataPda,
  findMasterEditionPda,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  generateSigner,
  keypairIdentity,
  percentAmount,
  transactionBuilder,
} from "@metaplex-foundation/umi";
import { keccak_256 } from "@noble/hashes/sha3.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const RPC_URL = "http://127.0.0.1:8899";

// Fighters to be genned for tests
const FIGHTER_POWERS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100];

const WALLET_PATH = path.join(os.homedir(), ".config/solana/id.json");
const IDL_PATH    = path.resolve(__dirname, "../../target/idl/anchor.json");
const OUTPUT_DIR  = path.resolve(__dirname, "output");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "setup.json");
const CONFIG_SEED = Buffer.from("config");

// Merkle root helpers
function computeLeaf(mint: PublicKey, power: number): Buffer {
  const mintBytes  = mint.toBytes();
  const powerBytes = Buffer.alloc(2);
  powerBytes.writeUInt16LE(power, 0);
  return Buffer.from(keccak_256(Buffer.concat([mintBytes, powerBytes])));
}

function hashPair(a: Buffer, b: Buffer): Buffer {
  return Buffer.compare(a, b) <= 0
    ? Buffer.from(keccak_256(Buffer.concat([a, b])))
    : Buffer.from(keccak_256(Buffer.concat([b, a])));
}

function buildTree(leaves: Buffer[]): Buffer[][] {
  const layers: Buffer[][] = [leaves];
  let current = leaves;
  while (current.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(
        i + 1 < current.length
          ? hashPair(current[i], current[i + 1])
          : current[i]
      );
    }
    layers.push(next);
    current = next;
  }
  return layers;
}

function getProof(layers: Buffer[][], index: number): Buffer[] {
  const proof: Buffer[] = [];
  let i = index;
  for (let l = 0; l < layers.length - 1; l++) {
    const siblingIdx = i % 2 === 0 ? i + 1 : i - 1;
    if (siblingIdx < layers[l].length) proof.push(layers[l][siblingIdx]);
    i = Math.floor(i / 2);
  }
  return proof;
}

// Summary
function printSummary(output: any) {
  console.log("Collection Mint:", output.collectionMint);
  console.log("Merkle Root:    ", output.merkleRoot, "\n");
  console.log(`Fighters: ${output.fighters.length}`);
  output.fighters.forEach((f: any, i: number) => {
    console.log(`  [${i}] ${f.mint}  power: ${f.power}`);
  });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  // Validate paths
  if (!fs.existsSync(WALLET_PATH)) {
    throw new Error(`Wallet not found at ${WALLET_PATH}\n`);
  }
  if (!fs.existsSync(IDL_PATH)) {
    throw new Error(
      `IDL not found at ${IDL_PATH}\n`
    );
  }

  // Load keypair
  const walletJson = JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"));
  const keypair    = Keypair.fromSecretKey(new Uint8Array(walletJson));
  console.log(`Wallet: ${keypair.publicKey.toBase58()}`);

  // Load IDL
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf-8"));

  // Providers
  const connection = new Connection(RPC_URL, "confirmed");
  const provider   = new AnchorProvider(connection, new Wallet(keypair), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);
  const program = new Program(idl, provider);

  // UMI instance
  const umi        = createUmi(RPC_URL).use(mplTokenMetadata());
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(keypair.secretKey);
  umi.use(keypairIdentity(umiKeypair));

  // Airdrop
  const sig = await connection.requestAirdrop(keypair.publicKey, 1e9);
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature: sig,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  }, "confirmed");

  // Verify output dir exists
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Create Collection
  console.log("Creating Collection\n");
  const collectionSigner = generateSigner(umi);

  await createNft(umi, {
    mint: collectionSigner,
    name: "Tatakaes",
    symbol: "KAE",
    uri: "https://tatakae.com/collection.json",
    sellerFeeBasisPoints: percentAmount(0),
    isCollection: true,
  }).sendAndConfirm(umi);

  const collectionMint = new PublicKey(collectionSigner.publicKey.toString());
  console.log(`Collection ID: ${collectionMint.toBase58()}\n`);

  // Minting NFTs
  console.log("Minting NFTs\n");

  const fighters = await Promise.all(
    FIGHTER_POWERS.map(async (power, i) => {
      // Each fighter gets its own UMI
      const umiInstance = createUmi(RPC_URL).use(mplTokenMetadata());
      umiInstance.use(keypairIdentity(umiKeypair));

      const mintSigner = generateSigner(umiInstance);

      await transactionBuilder()
        .add(createNft(umiInstance, {
          mint: mintSigner,
          name: `Fighter #${i + 1}`,
          symbol: "FGT",
          uri: `https://example.com/fighter-${i + 1}.json`,
          sellerFeeBasisPoints: percentAmount(0),
          collection: { key: collectionSigner.publicKey, verified: false },
        }))
        .add(verifyCollectionV1(umiInstance, {
          metadata: findMetadataPda(umiInstance, { mint: mintSigner.publicKey }),
          collectionMint: collectionSigner.publicKey,
          collectionMetadata: findMetadataPda(umiInstance, { mint: collectionSigner.publicKey }),
          collectionMasterEdition: findMasterEditionPda(umiInstance, { mint: collectionSigner.publicKey }),
          authority: umiInstance.identity,
        }))
        .sendAndConfirm(umiInstance);
      return { mint: mintSigner.publicKey.toString(), power };
    })
  );

  // Gen merkle proof for minted NFTs
  const leaves = fighters.map(f => computeLeaf(new PublicKey(f.mint), f.power));
  const layers = buildTree(leaves);
  const root   = layers[layers.length - 1][0];

  // Verify all proofs locally
  for (let i = 0; i < fighters.length; i++) {
    let current = leaves[i];
    for (const sibling of getProof(layers, i)) current = hashPair(current, sibling);
    if (Buffer.compare(current, root) !== 0) {
      throw new Error(`fighter #${i} failed proof verification`);
    }
  }
  console.log(`Root: ${root.toString("hex")}`);

  // Initialize config (merkle + collection mint)
  console.log("Calling initialize_config\n");

  const [configPda] = PublicKey.findProgramAddressSync(
    [CONFIG_SEED],
    program.programId
  );

  const configInfo = await connection.getAccountInfo(configPda);
  if (configInfo !== null) {
    console.log("Config PDA already exists\n");
  } else {
    const tx = await program.methods
      .initializeConfig(Array.from(root), collectionMint)
      .accounts({
        authority:     keypair.publicKey,
        config:        configPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([keypair])
      .rpc({ commitment: "confirmed" });
    console.log(`Initialized config tx: ${tx}\n`);
  }

  // Save to output
  const output = {
    collectionMint: collectionMint.toBase58(),
    merkleRoot: root.toString("hex"),
    merkleRootBytes: Array.from(root),
    fighters: fighters.map((f, i) => ({
      ...f,
      proof: getProof(layers, i).map(p => Array.from(p)),
    })),
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Saved to: ${OUTPUT_PATH}`);

  printSummary(output);
}

main().catch(err => {
  console.error("\nSetup failed:", err.message ?? err);
  process.exit(1);
});