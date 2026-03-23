"use client";

import { useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { SlidersHorizontal, X, Swords, RefreshCw, Plus } from "lucide-react";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { Toast } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { PixelNav } from "@/components/PixelNav";
import { BattleCard } from "@/components/BattleCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ModeBadge } from "@/components/ModeBadge";
import { SectionHeader } from "@/components/SectionHeader";
import { ExplorerLink } from "@/components/ExplorerLink";
import {
  fetchBattles,
  fetchMyFighters,
  createBattle,
  acceptBattle,
  cancelBattle,
} from "@/lib/instructions";
import type { BattleAccount, FighterOption } from "@/types";
import Link from "next/link";

type Tab = "open" | "targeted" | "created" | "create";

interface BattleFilters {
  search: string;
  mode: "all" | "pinkSlip" | "bite";
  minPowerFilter: string;
  maxPowerFilter: string;
}

function filterBattles(battles: BattleAccount[], filters: BattleFilters): BattleAccount[] {
  return battles.filter((b) => {
    if (filters.search &&
        !b.publicKey.toBase58().toLowerCase().includes(filters.search.toLowerCase()) &&
        !b.signer.toBase58().toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.mode !== "all") {
      const isMode = filters.mode === "pinkSlip" ? "pinkSlip" in b.battleMode : "bite" in b.battleMode;
      if (!isMode) return false;
    }
    if (filters.minPowerFilter !== "") {
      const min = parseInt(filters.minPowerFilter);
      if (b.maxPower !== null && b.maxPower < min) return false;
    }
    if (filters.maxPowerFilter !== "") {
      const max = parseInt(filters.maxPowerFilter);
      if (b.minPower !== null && b.minPower > max) return false;
    }
    return true;
  });
}

export default function ArenaPage() {
  const { publicKey, wallet } = useWallet();
  const { connection } = useConnection();
  const { program } = useAnchorProgram();
  const { toast, showToast, hideToast } = useToast();

  const [openBattles, setOpenBattles] = useState<BattleAccount[]>([]);
  const [targetedBattles, setTargetedBattles] = useState<BattleAccount[]>([]);
  const [createdBattles, setCreatedBattles] = useState<BattleAccount[]>([]);
  const [myFighters, setMyFighters] = useState<FighterOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("open");
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<BattleFilters>({
    search: "", mode: "all", minPowerFilter: "", maxPowerFilter: "",
  });

  const [selectedMint, setSelectedMint] = useState("");
  const [battleMode, setBattleMode] = useState<"pinkSlip" | "bite">("pinkSlip");
  const [minPower, setMinPower] = useState("");
  const [maxPower, setMaxPower] = useState("");
  const [targetOpponentNft, setTargetOpponentNft] = useState("");
  const [creating, setCreating] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => { if (program) handleFetchBattles(); }, [program, publicKey]);
  useEffect(() => { if (publicKey && program) handleFetchMyFighters(); }, [publicKey, program]);

  async function handleFetchBattles() {
    if (!program) return;
    setLoading(true);
    try {
      const { open, targeted, mine } = await fetchBattles(program, publicKey, connection);
      setOpenBattles(open); setTargetedBattles(targeted); setCreatedBattles(mine);
    } catch (err: any) {
      showToast(`Failed to load battles: ${err?.message ?? "Unknown error"}`);
    } finally { setLoading(false); }
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
      const tx = await createBattle(program, publicKey, connection, selectedMint, battleMode, minPower, maxPower, targetOpponentNft);
      showToast("Battle created!", tx);
      setTargetOpponentNft(""); setMinPower(""); setMaxPower("");
      await handleFetchBattles(); await handleFetchMyFighters();
    } catch (err: any) {
      showToast(`Failed: ${err?.message ?? "Unknown error"}`);
    } finally { setCreating(false); }
  }

  async function handleAcceptBattle(battle: BattleAccount, opponentMint: PublicKey) {
    if (!publicKey || !program) return;
    setAccepting(battle.publicKey.toBase58());
    try {
      const tx = await acceptBattle(program, publicKey, connection, wallet?.adapter as any, battle, opponentMint);
      showToast("Battle accepted!", tx);
      await handleFetchBattles(); await handleFetchMyFighters();
    } catch (err: any) {
      showToast(`Failed: ${err?.message ?? "Unknown error"}`);
    } finally { setAccepting(null); }
  }

  async function handleCancelBattle(battle: BattleAccount) {
    if (!publicKey || !program) return;
    setCancelling(battle.publicKey.toBase58());
    try {
      const tx = await cancelBattle(program, publicKey, battle);
      showToast("Battle cancelled.", tx);
      await handleFetchBattles(); await handleFetchMyFighters();
    } catch (err: any) {
      showToast(`Failed: ${err?.message ?? "Unknown error"}`);
    } finally { setCancelling(null); }
  }

  const filteredOpen = filterBattles(openBattles, filters);
  const filteredTargeted = filterBattles(targetedBattles, filters);

  const tabs: { id: Tab; label: string; count: number | null }[] = [
    { id: "open", label: "OPEN", count: openBattles.length },
    { id: "targeted", label: "TARGETED", count: targetedBattles.length },
    { id: "created", label: "CREATED", count: createdBattles.length },
    { id: "create", label: "CREATE", count: null },
  ];

  const hasActiveFilters = filters.search !== "" || filters.mode !== "all" || filters.minPowerFilter !== "" || filters.maxPowerFilter !== "";

  return (
    <main className="min-h-screen bg-black">
        
      <PixelNav />

      <div className="max-w-[960px] mx-auto px-6 py-8">

        {/* Title + refresh */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2.5">
            <Swords className="text-red" />
            <span className="font-pixel text-white" style={{ textShadow: "2px 2px 0 var(--color-red-dark)" }}>
              BATTLE ARENA
            </span>
          </div>
          <button
            className="pixel-btn pixel-btn--primary text-[8px] flex items-center gap-1"
            onClick={handleFetchBattles}
            disabled={loading}
          >
            <RefreshCw size={10} /> {loading ? "LOADING..." : "REFRESH"}
          </button>
        </div>

        <div className="pixel-divider" />

        {/* Tab bar */}
        <div className="flex border-b-[3px] border-steel-4 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="font-pixel text-md px-4 py-3 border-none cursor-pointer flex items-center gap-1.5 -mb-[3px]"
              style={{
                background: activeTab === tab.id ? "var(--color-steel-4)" : "transparent",
                color: activeTab === tab.id ? "var(--color-gold)" : "var(--color-steel-3)",
                borderBottom: activeTab === tab.id ? "3px solid var(--color-gold)" : "3px solid transparent",
              }}
            >
              {tab.id === "create" && <Plus size={10} />}
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span
                  className="text-white text-sm px-[5px] min-w-4 text-center"
                  style={{ background: tab.id === "targeted" ? "var(--color-red)" : "var(--color-steel-3)" }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        {(activeTab === "open" || activeTab === "targeted") && (
          <div className="mb-6">
            <div className="flex gap-2 flex-wrap items-center">
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  className="pixel-input pl-7"
                  placeholder="Search by address..."
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                />
              </div>
              <button
                className={`pixel-btn ${showFilters || hasActiveFilters ? "pixel-btn--gold" : "pixel-btn--primary"} flex items-center gap-1`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal size={20} />
                FILTERS {hasActiveFilters && "(ON)"}
              </button>
              {hasActiveFilters && (
                <button
                  className="pixel-btn pixel-btn--red text-[8px] flex items-center gap-1"
                  onClick={() => setFilters({ search: "", mode: "all", minPowerFilter: "", maxPowerFilter: "" })}
                >
                  <X size={20} /> CLEAR
                </button>
              )}
            </div>

            {showFilters && (
              <div className="pixel-panel p-4 mt-2 flex gap-3 flex-wrap items-end">
                <div>
                  <label className="font-pixel text-steel-2 block mb-1">MODE</label>
                  <div className="flex gap-1.5">
                    {(["all", "pinkSlip", "bite"] as const).map((m) => (
                      <button
                        key={m}
                        className={`pixel-btn ${filters.mode === m ? "pixel-btn--gold" : "pixel-btn--primary"} text-[7px]`}
                        onClick={() => setFilters((f) => ({ ...f, mode: m }))}
                      >
                        {m === "all" ? "ALL" : m === "pinkSlip" ? "PINK SLIP" : "BITE"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="font-pixel text-steel-2 block mb-1">MIN PWR</label>
                  <input
                    type="number"
                    className="pixel-input w-20"
                    placeholder="0"
                    value={filters.minPowerFilter}
                    onChange={(e) => setFilters((f) => ({ ...f, minPowerFilter: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="font-pixel text-steel-2 block mb-1">MAX PWR</label>
                  <input
                    type="number"
                    className="pixel-input w-20"
                    placeholder="9999"
                    value={filters.maxPowerFilter}
                    onChange={(e) => setFilters((f) => ({ ...f, maxPowerFilter: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* OPEN */}
        {activeTab === "open" && (
          <section className="flex flex-col gap-4">
            <SectionHeader>OPEN CHALLENGES</SectionHeader>

            {loading && <div className="pixel-loading">LOADING...</div>}

            {!loading && filteredOpen.length === 0 && (
              <div className="font-pixel text-steel-4 text-center py-6">
                {hasActiveFilters ? "NO BATTLES MATCH FILTERS" : "NO OPEN BATTLES"}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {filteredOpen.map((b) => (
                <BattleCard
                  key={b.publicKey.toBase58()}
                  battle={b}
                  myFighters={myFighters}
                  publicKey={publicKey}
                  accepting={accepting}
                  onAccept={handleAcceptBattle}
                />
              ))}
            </div>
          </section>
        )}

        {/* TARGETED */}
        {activeTab === "targeted" && (
          <section className="flex flex-col gap-4">
            <SectionHeader>TARGETED AT YOU</SectionHeader>

            {filteredTargeted.length === 0 && !loading && (
              <div className="font-pixel text-steel-4 text-center py-6">
                {hasActiveFilters
                  ? "NO BATTLES MATCH FILTERS"
                  : "NO TARGETED BATTLES"}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTargeted.map((b) => (
                <BattleCard
                  key={b.publicKey.toBase58()}
                  battle={b}
                  myFighters={myFighters}
                  publicKey={publicKey}
                  accepting={accepting}
                  onAccept={handleAcceptBattle}
                  highlight
                />
              ))}
            </div>
          </section>
        )}

        {/* CREATED */}
        {activeTab === "created" && (
          <section className="flex flex-col gap-4">
            <SectionHeader>MY BATTLES</SectionHeader>

            {createdBattles.length === 0 && !loading && (
              <div className="font-pixel text-steel-4 text-center py-6">
                NO BATTLES YET
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {createdBattles.map((b) => (
                <div
                  key={b.publicKey.toBase58()}
                  className="pixel-panel battle-card flex flex-col gap-3 p-4"
                >
                  {/* Top row */}
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div className="flex gap-2 flex-wrap">
                      <ModeBadge mode={b.battleMode} />
                      <StatusBadge status={b.status} />
                    </div>

                    {b.winner && (
                      <span
                        className={`font-pixel ${
                          b.winner.toBase58() === publicKey?.toBase58()
                            ? "text-green"
                            : "text-red"
                        }`}
                      >
                        {b.winner.toBase58() === publicKey?.toBase58()
                          ? "WIN"
                          : "LOSS"}
                      </span>
                    )}
                  </div>

                  {/* Address */}
                  <ExplorerLink
                    address={b.publicKey.toBase58()}
                    type="address"
                    className="text-[22px]!"
                  />

                  {/* Actions */}
                  {"pending" in b.status &&
                    publicKey &&
                    b.signer.toBase58() === publicKey.toBase58() && (
                      <button
                        className="pixel-btn pixel-btn--red text-[8px] mt-2 flex items-center gap-1 self-start"
                        disabled={cancelling === b.publicKey.toBase58()}
                        onClick={() => handleCancelBattle(b)}
                      >
                        <X size={10} />
                        {cancelling === b.publicKey.toBase58()
                          ? "CANCELLING..."
                          : "CANCEL"}
                      </button>
                    )}
                </div>
              ))}
            </div>
          </section>
      )}

        {/* CREATE */}
        {activeTab === "create" && (
          <section>
            <SectionHeader>CREATE BATTLE</SectionHeader>

            {!publicKey && (
              <div className="font-pixel  text-steel-3 text-center py-6">
                CONNECT WALLET TO CREATE
              </div>
            )}

            {publicKey && myFighters.length === 0 && (
              <div className="font-pixel  text-steel-3 text-center py-6 leading-[3]">
                NO FIGHTERS AVAILABLE<br />
                <Link href="/profile" className="text-gold no-underline text-[8px]">
                  GO TO PROFILE TO REGISTER
                </Link>
              </div>
            )}

            {publicKey && myFighters.length > 0 && (
              <div className="pixel-panel p-6 max-w-[520px]">

                <div className="mb-5">
                  <label className="font-pixel text-steel-2 block mb-1.5">SELECT FIGHTER</label>
                  <select className="pixel-input" value={selectedMint} onChange={(e) => setSelectedMint(e.target.value)}>
                    {myFighters.map((f) => (
                      <option key={f.mint.toBase58()} value={f.mint.toBase58()}>
                        {f.mint.toBase58().slice(0, 10)}...  PWR: {f.power}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-5">
                  <label className="font-pixel text-steel-2 block mb-1.5">BATTLE MODE</label>
                  <div className="flex gap-2">
                    {(["pinkSlip", "bite"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setBattleMode(mode)}
                        className={`pixel-btn ${battleMode === mode ? (mode === "pinkSlip" ? "pixel-btn--red" : "pixel-btn--gold") : "pixel-btn--primary"} flex-1 `}
                      >
                        {mode === "pinkSlip" ? "PINK SLIP" : "BITE"}
                      </button>
                    ))}
                  </div>
                  <div className="font-vt text-[18px] text-steel-3 mt-1.5">
                    {battleMode === "pinkSlip" ? "Winner takes opponent's NFT forever." : "Winner steals 20% power. NFTs returned."}
                  </div>
                </div>

                <div
                  className="grid grid-cols-2 gap-2 mb-5 transition-opacity duration-150"
                  style={{ opacity: targetOpponentNft.trim() !== "" ? 0.3 : 1, pointerEvents: targetOpponentNft.trim() !== "" ? "none" : "auto" }}
                >
                  <div>
                    <label className="font-pixel text-steel-2 block mb-1">
                      MIN PWR (OPTIONAL) {targetOpponentNft.trim() !== "" && <span className="text-steel-4">(ignored)</span>}
                    </label>
                    <input type="number" className="pixel-input" value={minPower} onChange={(e) => setMinPower(e.target.value)} placeholder="0" disabled={targetOpponentNft.trim() !== ""} />
                  </div>
                  <div>
                    <label className="font-pixel text-steel-2 block mb-1">
                      MAX PWR (OPTIONAL) {targetOpponentNft.trim() !== "" && <span className="text-steel-4">(ignored)</span>}
                    </label>
                    <input type="number" className="pixel-input" value={maxPower} onChange={(e) => setMaxPower(e.target.value)} placeholder="9999" disabled={targetOpponentNft.trim() !== ""} />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="font-pixel text-md text-steel-2 block mb-1">TARGET NFT MINT (OPTIONAL)</label>
                  <input type="text" className="pixel-input" value={targetOpponentNft} onChange={(e) => setTargetOpponentNft(e.target.value)} placeholder="Paste mint address..." />
                </div>

                <button
                  className="pixel-btn pixel-btn--red w-full text-[11px] py-[14px] flex items-center justify-center gap-2"
                  onClick={handleCreateBattle}
                  disabled={creating || !selectedMint}
                >
                  <Swords size={14} />
                  {creating ? "CREATING BATTLE..." : "INITIATE BATTLE"}
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {toast && <Toast message={toast.message} txSignature={toast.txSignature} onClose={hideToast} />}
    </main>
  );
}