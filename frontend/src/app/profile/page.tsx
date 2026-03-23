"use client";

import { useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AccountInfo, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ArrowUpDown, Search, Zap, Trophy, XCircle, Swords, RefreshCw } from "lucide-react";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { getFighterPda, getMetadataPda } from "@/lib/pda";
import { Toast } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { PixelNav } from "@/components/PixelNav";
import { FighterCard } from "@/components/FighterCard";
import { SectionHeader } from "@/components/SectionHeader";
import { ModeBadge } from "@/components/ModeBadge";
import { ExplorerLink } from "@/components/ExplorerLink";
import { fetchBattleHistory, initializeAllFighters } from "@/lib/instructions";
import type { NftMint, InitialisedFighter, BattleHistoryRecord } from "@/types";
import { COLLECTION_MINT } from "@/constants";
import { getCollectionFromMetadata, getUriFromMetadata } from "@/lib/metadata";

type SortKey = "power" | "wins" | "losses";

export default function ProfilePage() {
  const { publicKey, wallet } = useWallet();
  const { connection } = useConnection();
  const { program } = useAnchorProgram();
  const { toast, showToast, hideToast } = useToast();

  const [initialisedFighters, setInitialisedFighters] = useState<InitialisedFighter[]>([]);
  const [uninitialisedMints, setUninitialisedMints] = useState<NftMint[]>([]);
  const [battleHistory, setBattleHistory] = useState<BattleHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [initingAll, setInitingAll] = useState(false);
  const [profileTab, setProfileTab] = useState<"fighters" | "history">("fighters");

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("power");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    if (!publicKey || !program) return;
    fetchFighters();
    fetchBattleHistory(publicKey.toBase58()).then(setBattleHistory);
  }, [publicKey, program]);

  async function fetchFighters() {
    if (!publicKey || !program) return;
    setLoading(true);
    try {
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID });
      const nftMints: PublicKey[] = tokenAccounts.value
        .filter((t) => {
          const info = t.account.data.parsed.info;
          return info.tokenAmount.decimals === 0 && info.tokenAmount.uiAmount === 1;
        })
        .map((t) => new PublicKey(t.account.data.parsed.info.mint));

      const collectionNfts: { mint: PublicKey; metadataAccount: AccountInfo<Buffer> }[] = [];

      for (const mint of nftMints) {
        try {
          const metadataPda = getMetadataPda(mint);
          const metadataAccount = await connection.getAccountInfo(metadataPda);
          if (!metadataAccount) continue;
          const collection = getCollectionFromMetadata(metadataAccount.data);
          if (collection && collection.verified && collection.key.equals(COLLECTION_MINT)) {
            collectionNfts.push({ mint, metadataAccount });
          }
        } catch { continue; }
      }

      const inited: InitialisedFighter[] = [];
      const uninited: NftMint[]          = [];

      for (const { mint, metadataAccount } of collectionNfts) {
        const [fighterPda] = getFighterPda(mint);
        try {
          const fighter = await program.account.fighter.fetch(fighterPda);
          const uri = getUriFromMetadata(metadataAccount.data) ?? undefined;
          inited.push({ mint, power: fighter.power, wins: fighter.wins, losses: fighter.losses, uri });
        } catch {
          uninited.push({ mint });
        }
      }

      setInitialisedFighters(inited);
      setUninitialisedMints(uninited);
    } catch {
      showToast("Failed to load fighters");
    } finally {
      setLoading(false);
    }
  }

  async function handleInitAll() {
    if (!publicKey || !program || !wallet?.adapter) return;
    setInitingAll(true);
    try {
      const mints = uninitialisedMints.map((n) => n.mint);
      const sigs = await initializeAllFighters(program, publicKey, connection, wallet.adapter as any, mints);
      showToast(`${mints.length} fighter${mints.length > 1 ? "s" : ""} registered!`, sigs[sigs.length - 1]);
      await fetchFighters();
    } catch (err: any) {
      showToast(`Failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setInitingAll(false);
    }
  }

  const displayFighters = initialisedFighters
    .filter((f) => search === "" || f.mint.toBase58().toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortAsc ? diff : -diff;
    });

  if (!publicKey) {
    return (
      <main className="min-h-screen bg-black">
        <PixelNav />
        <div className="flex flex-col items-center justify-center gap-2" style={{ height: "calc(100vh - 63px)" }}>
          <div className="font-pixel text-steel-2 text-center leading-[2.5]">
            CONNECT WALLET
          </div>
          <WalletMultiButton />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black">
      <PixelNav />

      <div className="max-w-[960px] mx-auto px-6 py-8">

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontFamily: "var(--font-pixel)", fontSize: 14, color: "var(--white)", textShadow: "2px 2px 0 var(--steel-4)" }}>
              FIGHTER ROSTER
            </div>
            <button
              className="pixel-btn pixel-btn--primary text-[8px] flex items-center gap-1"
              onClick={async () => {
                await fetchFighters();
                if (publicKey) fetchBattleHistory(publicKey.toBase58()).then(setBattleHistory);
              }}
              disabled={loading}
            >
              <RefreshCw size={10} /> {loading ? "LOADING..." : "REFRESH"}
            </button>
          </div>
          <div className="pixel-address">{publicKey.toBase58().slice(0, 16)}...{publicKey.toBase58().slice(-8)}</div>
        </div>

        <div className="pixel-divider" />

        {/* Profile tabs */}
        <div className="flex border-b-[3px] border-steel-4 mb-6">
          {([
            { id: "fighters" as const, label: "FIGHTERS", count: initialisedFighters.length },
            { id: "history"  as const, label: "HISTORY",  count: battleHistory.length },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setProfileTab(tab.id)}
              className="font-pixel text-md px-4 py-3 border-none cursor-pointer flex items-center gap-1.5 -mb-[3px]"
              style={{
                background: profileTab === tab.id ? "var(--color-steel-4)" : "transparent",
                color: profileTab === tab.id ? "var(--color-gold)"    : "var(--color-steel-3)",
                borderBottom: profileTab === tab.id ? "3px solid var(--color-gold)" : "3px solid transparent",
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="bg-steel-3 text-white px-[5px] min-w-4 text-center">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading && <div className="pixel-loading">LOADING FIGHTERS...</div>}

        {!loading && profileTab === "fighters" && (
          <>
            <section className="mb-10">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
                <SectionHeader>MY FIGHTERS ({displayFighters.length})</SectionHeader>
              </div>

              {initialisedFighters.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-4 items-center">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-steel-3" />
                    <input
                      type="text"
                      className="pixel-input pl-7"
                      placeholder="Search mint..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  {([
                    { key: "power" as SortKey, icon: Zap, label: "PWR"    },
                    { key: "wins" as SortKey, icon: Trophy, label: "WINS"   },
                    { key: "losses" as SortKey, icon: XCircle, label: "LOSSES" },
                  ]).map(({ key, icon: Icon, label }) => (
                    <button
                      key={key}
                      className={`pixel-btn ${sortKey === key ? "pixel-btn--gold" : "pixel-btn--primary"} flex items-center gap-1`}
                      onClick={() => {
                        if (sortKey === key) setSortAsc(!sortAsc);
                        else { setSortKey(key); setSortAsc(false); }
                      }}
                    >
                      <Icon size={10} />
                      {label}
                      {sortKey === key && <ArrowUpDown size={8} />}
                    </button>
                  ))}
                </div>
              )}

              {displayFighters.length === 0 && search !== "" && (
                <div className="font-pixel text-sm text-steel-4 text-center py-8">NO RESULTS</div>
              )}
              {initialisedFighters.length === 0 && (
                <div className="font-pixel text-md text-steel-3 text-center py-4">NO FIGHTERS REGISTERED</div>
              )}

              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                {displayFighters.map((f) => (
                  <FighterCard key={f.mint.toBase58()} fighter={f} />
                ))}
              </div>
            </section>

            {uninitialisedMints.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <SectionHeader>UNREGISTERED NFTs ({uninitialisedMints.length})</SectionHeader>
                  <button
                    className="pixel-btn pixel-btn--gold text-md"
                    onClick={handleInitAll}
                    disabled={initingAll}
                  >
                    {initingAll ? "REGISTERING ALL..." : `REGISTER ALL (${uninitialisedMints.length})`}
                  </button>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                  {uninitialisedMints.map((n) => (
                    <div key={n.mint.toBase58()} className="pixel-panel p-3.5 opacity-70">
                      <div className="font-pixel text-md text-steel-3 mb-2">UNREGISTERED</div>
                      <div className="pixel-address text-[16px]" title={n.mint.toBase58()}>
                        {n.mint.toBase58().slice(0, 12)}...{n.mint.toBase58().slice(-6)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {!loading && profileTab === "history" && (
          <section>
            <SectionHeader>BATTLE HISTORY ({battleHistory.length})</SectionHeader>
            {battleHistory.length === 0 && (
              <div className="font-pixel text-md text-steel-4 text-center py-8">NO BATTLES YET</div>
            )}
            <div className="flex flex-col gap-2">
              {battleHistory.map((b) => {
                const isWinner = b.winner === publicKey.toBase58();
                const isSigner = b.signer === publicKey.toBase58();
                const myNft = isSigner ? b.signer_nft : b.opponent_nft;
                const oppNft = isSigner ? b.opponent_nft : b.signer_nft;
                const myPower = isSigner ? b.signer_power : b.opponent_power;
                const oppPower = isSigner ? b.opponent_power : b.signer_power;
                return (
                  <div key={b.id} className="pixel-panel p-3.5">
                    <div className="flex justify-between items-start flex-wrap gap-2 mb-2.5">
                      <div className="flex gap-2 items-center">
                        <ModeBadge mode={b.battle_mode === "pinkSlip" ? { pinkSlip: {} } : { bite: {} }} />
                        <span className={`font-pixel text-md ${isWinner ? "text-green" : "text-red"}`}>
                          {isWinner ? "WIN" : "LOSS"}
                        </span>
                      </div>
                      <span className="font-pixel text-steel-3">
                        {new Date(b.resolved_at * 1000).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-4 items-center flex-wrap">
                      <div>
                        <div className="font-pixel text-steel-3">MY NFT</div>
                        <ExplorerLink address={myNft} type="address" />
                        <div className="font-pixel text-steel-3">PWR {myPower}</div>
                      </div>
                      <Swords size={14} className={isWinner ? "text-green" : "text-red"} />
                      <div>
                        <div className="font-pixel text-steel-3">OPPONENT NFT</div>
                        <ExplorerLink address={oppNft} type="address" />
                        <div className="font-pixel text-steel-3">PWR {oppPower}</div>
                      </div>
                      <div className="ml-auto">
                        <div className="font-pixel text-steel-3">TX</div>
                        <ExplorerLink address={b.id} type="tx" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {toast && <Toast message={toast.message} txSignature={toast.txSignature} onClose={hideToast} />}
    </main>
  );
}