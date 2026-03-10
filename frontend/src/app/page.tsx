"use client";

import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function LandingPage() {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>Tatakae</h1>
      <p>NFT Fighting Game on Solana</p>

      <div style={{ marginTop: "1rem" }}>
        <WalletMultiButton />
      </div>

      <nav style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <Link href="/profile">Profile</Link>
        <Link href="/arena">Arena</Link>
      </nav>
    </main>
  );
}