"use client";

import { useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { getFighterPda, getMetadataPda } from "@/lib/pda";
import { Toast } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import Link from "next/link";
import { NftMint, InitialisedFighter } from "@/types/"
import { COLLECTION_MINT } from "@/constants"
import { getCollectionFromMetadata } from "@/lib/metadata"

export default function ProfilePage() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { program } = useAnchorProgram();
  const { toast, showToast, hideToast } = useToast();

  const [initialisedFighters, setInitialisedFighters] = useState<InitialisedFighter[]>([]);
  const [uninitialisedMints, setUninitialisedMints] = useState<NftMint[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey || !program) return;
    fetchFighters();
  }, [publicKey, program]);

  async function fetchFighters() {
    if (!publicKey || !program) return;
    setLoading(true);

    try {
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      const nftMints: PublicKey[] = tokenAccounts.value
        .filter((t) => {
          const info = t.account.data.parsed.info;
          return (
            info.tokenAmount.decimals === 0 &&
            info.tokenAmount.uiAmount === 1
          );
        })
        .map((t) => new PublicKey(t.account.data.parsed.info.mint));

      const collectionNfts: PublicKey[] = [];

      for (const mint of nftMints) {
        try {
          const metadataPda = getMetadataPda(mint);
          const metadataAccount = await connection.getAccountInfo(metadataPda);
          if (!metadataAccount) continue;

          const collection = getCollectionFromMetadata(metadataAccount.data);
          if (
            collection &&
            collection.verified &&
            collection.key.equals(COLLECTION_MINT)
          ) {
            collectionNfts.push(mint);
          }
        } catch {
          continue;
        }
      }

      const inited: InitialisedFighter[] = [];
      const uninited: NftMint[] = [];

      for (const mint of collectionNfts) {
        const [fighterPda] = getFighterPda(mint);
        try {
          const fighter = await program.account.fighter.fetch(fighterPda);
          inited.push({
            mint,
            power: fighter.power,
            wins: fighter.wins,
            losses: fighter.losses,
          });
        } catch {
          uninited.push({ mint });
        }
      }

      setInitialisedFighters(inited);
      setUninitialisedMints(uninited);
    } catch (err) {
      console.error("fetchFighters error:", err);
      showToast("Failed to load fighters");
    } finally {
      setLoading(false);
    }
  }

  async function initializeFighter(mint: PublicKey, power: number, proof: number[][]) {
    if (!publicKey || !program) return;
    setInitializing(mint.toBase58());


    try {
      const proofBytes = proof.map((p) => Array.from(p));

      const tx = await program.methods
        .initializeFighter(power, proofBytes)
        .accounts({
          owner: publicKey,
          fighterMint: mint,
        })
        .rpc();

      showToast("Fighter initialised", tx);
      await fetchFighters();
    } catch (err: any) {
      console.error("initializeFighter error:", err);
      showToast(`Failed to initialise fighter: ${err?.message ?? "Unknown error"}`);
    } finally {
      setInitializing(null);
    }
  }

  if (!publicKey) {
    return (
      <main style={{ padding: "2rem" }}>
        <Link href="/">← Back</Link>
        <h1>Profile</h1>
        <p>Connect your wallet to view your fighters.</p>
        <WalletMultiButton />
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem" }}>
      <Link href="/">← Back</Link>
      <h1>Profile</h1>
      <p>Wallet: {publicKey.toBase58()}</p>
      <WalletMultiButton />

      {loading && <p>Loading fighters...</p>}

      {!loading && (
        <>
          <section style={{ marginTop: "2rem" }}>
            <h2>Your Fighters</h2>
            {initialisedFighters.length === 0 && <p>No initialised fighters.</p>}
            {initialisedFighters.map((f) => (
              <div
                key={f.mint.toBase58()}
                style={{ border: "1px solid #ccc", padding: "1rem", marginTop: "1rem" }}
              >
                <p>Mint: {f.mint.toBase58()}</p>
                <p>Power: {f.power}</p>
                <p>Wins: {f.wins} / Losses: {f.losses}</p>
              </div>
            ))}
          </section>

          <section style={{ marginTop: "2rem" }}>
            <h2>Uninitialised NFTs</h2>
            {uninitialisedMints.length === 0 && <p>None.</p>}
            {uninitialisedMints.map((n) => {
              const handleInit = async () => {
                const res = await fetch(`/proofs/${n.mint.toBase58()}.json`);
                const fighterData = await res.json();
                if (!fighterData) {
                  showToast(`Mint not found in setup.json: ${n.mint.toBase58()}`);
                  return;
                }
                await initializeFighter(n.mint, fighterData.power, fighterData.proof);
              };

              return (
                <div
                  key={n.mint.toBase58()}
                  style={{ border: "1px solid #ccc", padding: "1rem", marginTop: "1rem" }}
                >
                  <p>Mint: {n.mint.toBase58()}</p>
                  <p style={{ color: "orange" }}>Fighter not initialised</p>
                  <button
                    onClick={handleInit}
                    disabled={initializing === n.mint.toBase58()}
                  >
                    {initializing === n.mint.toBase58() ? "Initialising..." : "Initialize Fighter"}
                  </button>
                </div>
              );
            })}
          </section>
        </>
      )}

      {toast && (
        <Toast
          message={toast.message}
          txSignature={toast.txSignature}
          onClose={hideToast}
        />
      )}
    </main>
  );
}