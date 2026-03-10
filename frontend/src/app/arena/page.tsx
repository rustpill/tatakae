"use client";

import { useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { Toast } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { renderMode, renderStatus } from "@/utils/format";
import {
  fetchBattles,
  fetchMyFighters,
  createBattle,
  acceptBattle,
  cancelBattle
} from "@/lib/instructions";
import type { BattleAccount, FighterOption } from "@/types/";
import Link from "next/link";

export default function ArenaPage() {
  const { publicKey, wallet } = useWallet();
  const { connection } = useConnection();
  const { program } = useAnchorProgram();
  const { toast, showToast, hideToast } = useToast();
 
  const [openBattles, setOpenBattles] = useState<BattleAccount[]>([]);
  const [targetedBattles, setTargetedBattles] = useState<BattleAccount[]>([]);
  const [myBattles, setMyBattles] = useState<BattleAccount[]>([]);
  const [myFighters, setMyFighters] = useState<FighterOption[]>([]);
  const [loading, setLoading] = useState(false);

  // For create_battle
  const [selectedMint, setSelectedMint] = useState<string>("");
  const [battleMode, setBattleMode] = useState<"pinkSlip" | "bite">("pinkSlip");
  const [minPower, setMinPower] = useState<string>("");
  const [maxPower, setMaxPower] = useState<string>("");
  const [targetOpponentNft, setTargetOpponentNft] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    if (!program) return;
    handleFetchBattles();
  }, [program, publicKey]);

  useEffect(() => {
    if (!publicKey || !program) return;
    handleFetchMyFighters();
  }, [publicKey, program]);

  async function handleFetchBattles() {
    if (!program) return;
    setLoading(true);
    try {
      const { open, targeted, mine } = await fetchBattles(program, publicKey);
      setOpenBattles(open);
      setTargetedBattles(targeted);
      setMyBattles(mine);
    } catch (err: any) {
      showToast(`Failed to load battles: ${err?.message ?? "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleFetchMyFighters() {
    if (!publicKey || !program) return;
    try {
      const fighters = await fetchMyFighters(program, publicKey, connection);
      setMyFighters(fighters);
      if (fighters.length > 0) setSelectedMint(fighters[0].mint.toBase58());
    } catch (err: any) {
      showToast(`Failed to load fighters: ${err?.message ?? "Unknown error"}`);
    }
  }

  async function handleCreateBattle() {
    if (!publicKey || !program || !selectedMint) return;
    setCreating(true);
    try {
      const tx = await createBattle(
        program,
        publicKey,
        connection,
        selectedMint,
        battleMode,
        minPower,
        maxPower,
        targetOpponentNft,
      );
      showToast("Battle created", tx);
      setTargetOpponentNft("");
      setMinPower("");
      setMaxPower("");
      await handleFetchBattles();
    } catch (err: any) {
      showToast(`Failed to create battle: ${err?.message ?? "Unknown error"}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleAcceptBattle(battle: BattleAccount, opponentMint: PublicKey) {
    if (!publicKey || !program) return;
    setAccepting(battle.publicKey.toBase58());
    try {
      const tx = await acceptBattle(
        program,
        publicKey,
        connection,
        wallet?.adapter as any,
        battle,
        opponentMint
      );
      showToast("Battle accepted! Waiting for resolution.", tx);
      await handleFetchBattles();
    } catch (err: any) {
      showToast(`Failed to accept battle: ${err?.message ?? "Unknown error"}`);
    } finally {
      setAccepting(null);
    }
  }

  async function handleCancelBattle(battle: BattleAccount) {
    if (!publicKey || !program) return;
    setCancelling(battle.publicKey.toBase58());
    try {
      const tx = await cancelBattle(program, publicKey, battle);
      showToast("Battle cancelled. NFT returned.", tx);
      await handleFetchBattles();
    } catch (err: any) {
      showToast(`Failed to cancel battle: ${err?.message ?? "Unknown error"}`);
    } finally {
      setCancelling(null);
    }
  }

  return (
    <main style={{ padding: "2rem" }}>
      <Link href="/">← Back</Link>
      <h1>Arena</h1>
      <WalletMultiButton />

      {/* Create battle */}
      {publicKey && myFighters.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2>Create Battle</h2>

          <div style={{ marginTop: "1rem" }}>
            <label>Your Fighter</label>
            <br />
            <select
              value={selectedMint}
              onChange={(e) => setSelectedMint(e.target.value)}
            >
              {myFighters.map((f) => (
                <option key={f.mint.toBase58()} value={f.mint.toBase58()}>
                  {f.mint.toBase58().slice(0, 8)}... — Power: {f.power}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <label>Battle Mode</label>
            <br />
            <select
              value={battleMode}
              onChange={(e) => setBattleMode(e.target.value as "pinkSlip" | "bite")}
            >
              <option value="pinkSlip">Pink Slip (winner takes NFT)</option>
              <option value="bite">Bite (20% power transfer)</option>
            </select>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <label>Min Power (optional)</label>
            <br />
            <input
              type="number"
              value={minPower}
              onChange={(e) => setMinPower(e.target.value)}
              placeholder="e.g. 100"
            />
          </div>

          <div style={{ marginTop: "0.5rem" }}>
            <label>Max Power (optional)</label>
            <br />
            <input
              type="number"
              value={maxPower}
              onChange={(e) => setMaxPower(e.target.value)}
              placeholder="e.g. 500"
            />
          </div>

          <div style={{ marginTop: "1rem" }}>
            <label>Target Opponent NFT Mint (optional)</label>
            <br />
            <input
              type="text"
              value={targetOpponentNft}
              onChange={(e) => setTargetOpponentNft(e.target.value)}
              placeholder="Opponent NFT mint"
              style={{ width: "400px" }}
            />
          </div>

          <button
            onClick={handleCreateBattle}
            disabled={creating}
            style={{ marginTop: "1rem" }}
          >
            {creating ? "Creating..." : "Create Battle"}
          </button>
        </section>
      )}

      {publicKey && myFighters.length === 0 && !loading && (
        <p style={{ marginTop: "1rem" }}>
          No initialised fighters found. Go to your{" "}
          <Link href="/profile">Profile</Link> to initialise them first.
        </p>
      )}

      {loading && <p style={{ marginTop: "1rem" }}>Loading battles...</p>}

      {/* Battles targeting user */}
      {publicKey && targetedBattles.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2>Battles Targeting You</h2>
          {targetedBattles.map((b) => (
            <div
              key={b.publicKey.toBase58()}
              style={{ border: "1px solid #f90", padding: "1rem", marginTop: "1rem" }}
            >
              <p>Battle: {b.publicKey.toBase58()}</p>
              <p>From: {b.signer.toBase58()}</p>
              <p>Their NFT: {b.signerNft.toBase58()}</p>
              <p>Mode: {renderMode(b.battleMode)}</p>
              {b.opponentNft && <p>They want your NFT: {b.opponentNft.toBase58()}</p>}
              {b.opponentNft ? (
                <button
                  disabled={accepting === b.publicKey.toBase58()}
                  onClick={() => handleAcceptBattle(b, b.opponentNft!)}
                >
                  {accepting === b.publicKey.toBase58() ? "Accepting..." : "Accept"}
                </button>
              ) : (
                <>
                  <select id={`accept-select-${b.publicKey.toBase58()}`}>
                    {myFighters.map((f) => (
                      <option key={f.mint.toBase58()} value={f.mint.toBase58()}>
                        {f.mint.toBase58().slice(0, 8)}... — Power: {f.power}
                      </option>
                    ))}
                  </select>
                  <button
                    style={{ marginLeft: "0.5rem" }}
                    disabled={accepting === b.publicKey.toBase58()}
                    onClick={() => {
                      const sel = document.getElementById(
                        `accept-select-${b.publicKey.toBase58()}`
                      ) as HTMLSelectElement;
                      handleAcceptBattle(b, new PublicKey(sel.value));
                    }}
                  >
                    {accepting === b.publicKey.toBase58() ? "Accepting..." : "Accept"}
                  </button>
                </>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Open battles */}
      <section style={{ marginTop: "2rem" }}>
        <h2>Open Battles</h2>
        {openBattles.length === 0 && !loading && <p>No open battles.</p>}
        {openBattles.map((b) => (
          <div
            key={b.publicKey.toBase58()}
            style={{ border: "1px solid #ccc", padding: "1rem", marginTop: "1rem" }}
          >
            <p>Battle: {b.publicKey.toBase58()}</p>
            <p>From: {b.signer.toBase58()}</p>
            <p>Their NFT: {b.signerNft.toBase58()}</p>
            <p>Mode: {renderMode(b.battleMode)}</p>
            {b.minPower !== null && <p>Min Power: {b.minPower}</p>}
            {b.maxPower !== null && <p>Max Power: {b.maxPower}</p>}
            {publicKey && myFighters.length > 0 && (() => {
              const eligible = myFighters.filter((f) => {
                if (b.minPower !== null && f.power < b.minPower) return false;
                if (b.maxPower !== null && f.power > b.maxPower) return false;
                return true;
              });

              if (eligible.length === 0) {
                return <p style={{ color: "#888", marginTop: "0.5rem" }}>No fighters meet the power requirements.</p>;
              }

              return (
                <div style={{ marginTop: "0.5rem" }}>
                  <select id={`open-select-${b.publicKey.toBase58()}`}>
                    {eligible.map((f) => (
                      <option key={f.mint.toBase58()} value={f.mint.toBase58()}>
                        {f.mint.toBase58().slice(0, 8)}... — Power: {f.power}
                      </option>
                    ))}
                  </select>
                  <button
                    style={{ marginLeft: "0.5rem" }}
                    disabled={accepting === b.publicKey.toBase58()}
                    onClick={() => {
                      const sel = document.getElementById(
                        `open-select-${b.publicKey.toBase58()}`
                      ) as HTMLSelectElement;
                      handleAcceptBattle(b, new PublicKey(sel.value));
                    }}
                  >
                    {accepting === b.publicKey.toBase58() ? "Accepting..." : "Accept"}
                  </button>
                </div>
              );
            })()}
          </div>
        ))}
      </section>

      {/* User battle history */}
      {publicKey && (
        <section style={{ marginTop: "2rem" }}>
          <h2>My Battle History</h2>
          {myBattles.length === 0 && !loading && <p>No battles yet.</p>}
          {myBattles.map((b) => (
            <div
              key={b.publicKey.toBase58()}
              style={{ border: "1px solid #555", padding: "1rem", marginTop: "1rem" }}
            >
              <p>Battle: {b.publicKey.toBase58()}</p>
              <p>Mode: {renderMode(b.battleMode)}</p>
              <p>Status: {renderStatus(b.status)}</p>
              {b.winner && (
                <p>
                  Winner:{" "}
                  <span style={{ color: b.winner.toBase58() === publicKey.toBase58() ? "green" : "red" }}>
                    {b.winner.toBase58() === publicKey.toBase58() ? "You" : b.winner.toBase58()}
                  </span>
                </p>
              )}
              {"pending" in b.status &&
                b.signer.toBase58() === publicKey.toBase58() && (
                  <button
                    style={{ marginTop: "0.5rem", color: "red" }}
                    disabled={cancelling === b.publicKey.toBase58()}
                    onClick={() => handleCancelBattle(b)}
                  >
                    {cancelling === b.publicKey.toBase58() ? "Cancelling..." : "Cancel Battle"}
                  </button>
                )}
            </div>
          ))}
        </section>
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