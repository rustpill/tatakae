"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Swords, Zap } from "lucide-react";
import { PixelNav } from "@/components/PixelNav";
import { ExplorerLink } from "@/components/ExplorerLink";

interface FaucetStatus {
  hasClaimed: boolean;
  remaining: number;
}

interface MintResult {
  mint: string;
  power: number;
}

export default function FaucetPage() {
  const { publicKey } = useWallet();

  const [status, setStatus] = useState<FaucetStatus | null>(null);
  const [result, setResult] = useState<MintResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) { setStatus(null); return; }
    fetchStatus();
  }, [publicKey]);

  async function fetchStatus() {
    if (!publicKey) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_WORKER_URL}/faucet/status?wallet=${publicKey.toBase58()}`
      );
      const data = await res.json();
      setStatus(data);
    } catch {
      setError("Failed to fetch faucet status");
    }
  }

  async function handleMint() {
    if (!publicKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/faucet/mint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Mint failed");

      setResult(data);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--black)" }}>
      <PixelNav />

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "4rem 1.5rem" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <Swords size={32} color="var(--red)" />
          </div>
          <div style={{ fontFamily: "var(--font-pixel)", fontSize: 16, color: "var(--white)", marginBottom: 12, textShadow: "2px 2px 0 var(--red-dark)" }}>
            FIGHTER FAUCET
          </div>
          <div style={{ fontFamily: "var(--font-vt)", fontSize: 20, color: "var(--steel-2)", lineHeight: 1.6 }}>
            Claim a free fighter NFT to start battling. One per wallet.
          </div>
        </div>

        {!publicKey ? (
          <div className="pixel-panel" style={{ padding: "2rem", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-pixel)", fontSize: 9, color: "var(--steel-2)", marginBottom: "1.5rem", lineHeight: 2 }}>
              CONNECT YOUR WALLET<br />TO CLAIM A FIGHTER
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <WalletMultiButton />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* Status panel */}
            <div className="pixel-panel" style={{ padding: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontFamily: "var(--font-pixel)", fontSize: 7, color: "var(--steel-3)", marginBottom: 4 }}>FIGHTERS REMAINING</div>
                <div style={{ fontFamily: "var(--font-pixel)", fontSize: 20, color: "var(--gold)" }}>
                  {status === null
                    ? <span style={{ animation: "blink 0.8s infinite", display: "inline-block" }}>...</span>
                    : status.remaining
                  }
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-pixel)", fontSize: 7, color: "var(--steel-3)", marginBottom: 4 }}>STATUS</div>
                <div style={{ fontFamily: "var(--font-pixel)", fontSize: 9 }}>
                  {status === null
                    ? <span style={{ color: "var(--steel-3)" }}>CHECKING...</span>
                    : status.hasClaimed
                    ? <span style={{ color: "var(--green)" }}>✓ CLAIMED</span>
                    : <span style={{ color: "var(--steel-2)" }}>NOT CLAIMED</span>
                  }
                </div>
              </div>
            </div>

            {/* Already claimed */}
            {status?.hasClaimed && !result && (
              <div className="pixel-panel pixel-panel--gold" style={{ padding: "1.25rem", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-pixel)", fontSize: 9, color: "var(--gold)", marginBottom: 8 }}>
                  FIGHTER ALREADY CLAIMED
                </div>
                <div style={{ fontFamily: "var(--font-vt)", fontSize: 20, color: "var(--steel-2)" }}>
                  This wallet has already claimed a fighter. Head to your profile to register and battle.
                </div>
              </div>
            )}

            {/* Mint button */}
            {!status?.hasClaimed && (
              <button
                className="pixel-btn pixel-btn--red"
                style={{ width: "100%", fontSize: 12, padding: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                onClick={handleMint}
                disabled={loading || status?.remaining === 0}
              >
                <Zap size={14} />
                {loading
                  ? "CLAIMING..."
                  : status?.remaining === 0
                  ? "FAUCET EMPTY"
                  : "CLAIM FIGHTER"
                }
              </button>
            )}

            {/* Error */}
            {error && (
              <div className="pixel-panel pixel-panel--red" style={{ padding: "1rem" }}>
                <div style={{ fontFamily: "var(--font-pixel)", fontSize: 8, color: "var(--red)" }}>
                  {error}
                </div>
              </div>
            )}

            {/* Success */}
            {result && (
              <div className="pixel-panel pixel-panel--green" style={{ padding: "1.5rem" }}>
                <div style={{ fontFamily: "var(--font-pixel)", fontSize: 10, color: "var(--green)", marginBottom: 12 }}>
                  ✓ FIGHTER CLAIMED!
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-pixel)", fontSize: 8, color: "var(--steel-3)", marginBottom: 4 }}>POWER LEVEL</div>
                    <span className="power-badge">PWR {result.power}</span>
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-pixel)", fontSize: 8, color: "var(--steel-3)", marginBottom: 4 }}>NFT MINT</div>
                    <ExplorerLink address={result.mint} type="address" />
                  </div>
                </div>
                <div style={{ marginTop: 16, fontFamily: "var(--font-vt)", fontSize: 20, color: "var(--steel-2)", lineHeight: 1.5 }}>
                  Go to your profile to register your fighter, then head to the arena to battle.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}