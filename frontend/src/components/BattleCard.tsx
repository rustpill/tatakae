"use client";

import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { Swords, ImageIcon, X, ChevronDown } from "lucide-react";
import type { BattleAccount, FighterOption } from "@/types";
import { ModeBadge } from "./ModeBadge";
import { fetchFighterMetadata } from "@/lib/instructions";
import { ExplorerLink } from "./ExplorerLink";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { getFighterPda } from "@/lib/pda";

interface BattleCardProps {
  battle: BattleAccount;
  myFighters: FighterOption[];
  publicKey: PublicKey | null;
  accepting: string | null;
  onAccept: (battle: BattleAccount, mint: PublicKey) => void;
  highlight?: boolean;
}

function FighterThumb({ uri, size = 48 }: { uri?: string; size?: number }) {
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    if (!uri) return;
    fetchFighterMetadata(uri).then((m) => setImage(m.image));
  }, [uri]);

  return (
    <div
      className="shrink-0 bg-navy border-2 border-steel-4 flex items-center justify-center overflow-hidden"
      style={{ width: size, height: size }}
    >
      {image
        ? <img src={image} className="w-full h-full object-cover" style={{ imageRendering: "pixelated" }} />
        : <ImageIcon size={size * 0.4} className="text-steel-4" />
      }
    </div>
  );
}

function DetailModal({ battle: b, myFighters, publicKey, accepting, onAccept, onClose, signerPower }: BattleCardProps & { onClose: () => void; signerPower: number | null }) {
  const [selectedFighter, setSelectedFighter] = useState(myFighters[0]?.mint.toBase58() ?? "");
  const [challengerName, setChallengerName] = useState<string | null>(null);

  useEffect(() => {
    if (myFighters.length === 0) { setSelectedFighter(""); return; }
    const stillExists = myFighters.some((f) => f.mint.toBase58() === selectedFighter);
    if (!stillExists) setSelectedFighter(myFighters[0].mint.toBase58());
  }, [myFighters]);

  useEffect(() => {
    if (!b.signerNftUri) return;
    fetchFighterMetadata(b.signerNftUri).then((m) => setChallengerName(m.name));
  }, [b.signerNftUri]);

  const eligible = myFighters.filter((f) => {
    if (b.minPower !== null && f.power < b.minPower) return false;
    if (b.maxPower !== null && f.power > b.maxPower) return false;
    return true;
  });

  const isAccepting = accepting === b.publicKey.toBase58();
  const isOwnBattle = publicKey?.toBase58() === b.signer.toBase58();
  const selectedFighterObj = myFighters.find((f) => f.mint.toBase58() === selectedFighter);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] bg-black/85 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pixel-panel w-full max-w-[520px] relative p-6"
      >
        <button
          onClick={onClose}
          className="absolute top-2.5 right-2.5 bg-transparent border-none cursor-pointer text-steel-2 p-1"
        >
          <X size={16} />
        </button>

        {/* Header - title + mode badge side by side */}
        <div className="flex items-center gap-3 mb-5">
          <div className="font-pixel text-gold tracking-[2px]">BATTLE DETAILS</div>
          <ModeBadge mode={b.battleMode} />
        </div>

        {/* VS section */}
        <div className="flex gap-4 items-start justify-center mb-5">
          {/* Challenger */}
          <div className="flex-1 flex flex-col items-center gap-2">
            {challengerName && (
              <div className="font-pixel text-sm text-steel-1 text-center">{challengerName}</div>
            )}
            <FighterThumb uri={b.signerNftUri} size={96} />
            {signerPower !== null && (
              <span className="power-badge text-[7px] px-1.5 py-0.5">PWR {signerPower}</span>
            )}
            <ExplorerLink address={b.signerNft.toBase58()} type="address" className="text-sm!" />
          </div>

          {/* VS divider */}
          <div className="flex flex-col items-center gap-1 pt-8">
            <Swords size={24} className="text-red" />
            <div className="vs-text text-base">VS</div>
          </div>

          {/* You */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="font-pixel text-sm text-steel-1 text-center">Your Fighter</div>
            <FighterThumb uri={selectedFighterObj?.uri} size={96} />
            {b.opponentNft
              ? <ExplorerLink address={b.opponentNft.toBase58()} type="address" className="text-sm!" />
              : null
            }
          </div>
        </div>

        {/* Battle info */}
        <div className="pixel-panel p-3 mb-4 flex flex-wrap gap-3">
          {(b.minPower !== null || b.maxPower !== null) && (
            <div>
              <div className="font-pixel text- text-steel-3 mb-1">POWER RANGE</div>
              <span className="font-pixel text-steel-1">
                {b.minPower ?? 0} – {b.maxPower ?? "MAX"}
              </span>
            </div>
          )}
          {(b.minPower !== null || b.maxPower !== null) && (
            <div>
              -
            </div>
          )}
          <div>
            <div className="font-pixel text-steel-3 mb-1">BATTLE ID</div>
            <ExplorerLink address={b.publicKey.toBase58()} type="address" className="text-sm!" />
          </div>
        </div>

        {/* Accept controls */}
        {publicKey && !isOwnBattle && (
          b.opponentNft ? (
            <button
              className="pixel-btn pixel-btn--green w-full text-[10px] py-3 flex items-center justify-center gap-2"
              disabled={isAccepting}
              onClick={() => onAccept(b, b.opponentNft!)}
            >
              <Swords size={12} />
              {isAccepting ? "ACCEPTING..." : "ACCEPT BATTLE"}
            </button>
          ) : eligible.length === 0 ? (
            <div className="font-pixel text-red-dark text-center p-4">
              NO ELIGIBLE FIGHTERS
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="font-pixel text-sm text-steel-2">SELECT YOUR FIGHTER</label>
              <select
                className="pixel-input"
                value={selectedFighter}
                onChange={(e) => setSelectedFighter(e.target.value)}
              >
                {eligible.map((f) => (
                  <option key={f.mint.toBase58()} value={f.mint.toBase58()}>
                    {f.mint.toBase58().slice(0, 10)}...  PWR: {f.power}
                  </option>
                ))}
              </select>
              <button
                className="pixel-btn pixel-btn--green w-full text-[10px] py-3 flex items-center justify-center gap-2"
                disabled={isAccepting || !selectedFighter}
                onClick={() => onAccept(b, new PublicKey(selectedFighter))}
              >
                <Swords size={12} />
                {isAccepting ? "ACCEPTING..." : "ACCEPT BATTLE"}
              </button>
            </div>
          )
        )}

        {isOwnBattle && (
          <div className="font-pixel text-[8px] text-steel-4 text-center py-2">
            YOUR BATTLE - WAITING FOR OPPONENT
          </div>
        )}
      </div>
    </div>
  );
}

export function BattleCard({
  battle: b,
  myFighters,
  publicKey,
  accepting,
  onAccept,
  highlight = false,
}: BattleCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFighter, setSelectedFighter] = useState(myFighters[0]?.mint.toBase58() ?? "");
  const [signerPower, setSignerPower] = useState<number | null>(null);
  const [opponentPower, setOpponentPower] = useState<number | null>(null);
  const { program } = useAnchorProgram();

  useEffect(() => {
    if (myFighters.length === 0) { setSelectedFighter(""); return; }
    const stillExists = myFighters.some((f) => f.mint.toBase58() === selectedFighter);
    if (!stillExists) setSelectedFighter(myFighters[0].mint.toBase58());
  }, [myFighters]);

  useEffect(() => {
    if (!program) return;
    const [fighterPda] = getFighterPda(b.signerNft);
    program.account.fighter.fetch(fighterPda)
      .then((f) => setSignerPower(f.power))
      .catch(() => {});
  }, [program, b.signerNft]);

  useEffect(() => {
    if (!program || !b.opponentNft) return;
    const [fighterPda] = getFighterPda(b.opponentNft);
    program.account.fighter.fetch(fighterPda)
      .then((f) => setOpponentPower(f.power))
      .catch(() => {});
  }, [program, b.opponentNft]);

  const eligible = myFighters.filter((f) => {
    if (b.minPower !== null && f.power < b.minPower) return false;
    if (b.maxPower !== null && f.power > b.maxPower) return false;
    return true;
  });

  const isAccepting = accepting === b.publicKey.toBase58();
  const isOwnBattle = publicKey?.toBase58() === b.signer.toBase58();
  const selectedFighterObj = myFighters.find((f) => f.mint.toBase58() === selectedFighter);

  return (
    <>
      <div
        className={`p-4 pixel-panel battle-card cursor-pointer ${highlight ? "pixel-panel--red" : ""}`}
        onClick={() => setModalOpen(true)}
      >
        {/* Top row */}
        <div className="flex justify-between items-start flex-wrap gap-2 mb-2.5">
          <div className="flex gap-2 flex-wrap items-center">
            <ModeBadge mode={b.battleMode} />
            {(b.minPower !== null || b.maxPower !== null) && (
              <span className="font-pixel text-sm text-steel-2 px-1.5 py-0.5 border border-steel-4">
                PWR {b.minPower ?? 0}–{b.maxPower ?? "MAX"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <ExplorerLink
              address={b.publicKey.toBase58()}
              type="address"
              className="text-steel-4! border-transparent!"
            />
            <ChevronDown size={12} className="text-steel-4" />
          </div>
        </div>

        {/* Challenger VS Opponent row */}
        <div className="flex gap-4 items-center">
          <div className="flex gap-2 items-center">
            <FighterThumb uri={b.signerNftUri} />
            <div>
              <span className="font-pixel text-sm text-steel-3">CHALLENGER</span>
              <div className="flex items-center gap-1.5 mb-[3px]">
                {signerPower !== null && (
                  <span className="power-badge text-[7px] px-[5px] py-0.5">PWR {signerPower}</span>
                )}
              </div>
              <ExplorerLink address={b.signerNft.toBase58()} type="address" />
            </div>
          </div>

          <div className="px-2 flex items-center">
            <Swords size={16} className="text-red" />
          </div>

          <div className="flex gap-2 items-center">
            <FighterThumb uri={selectedFighterObj?.uri} />
            <div>
              <div className="font-pixel text-sm text-steel-3 mb-[3px]">
                {b.opponentNft ? "REQUIRED NFT" : "OPEN"}
              </div>
              <div className="flex items-center gap-1.5 mb-[3px]">
                {b.opponentNft && opponentPower !== null && (
                  <span className="power-badge text-[7px] px-[5px] py-0.5">PWR {opponentPower}</span>
                )}
              </div>
              {b.opponentNft
                ? <ExplorerLink address={b.opponentNft.toBase58()} type="address" />
                : <span className="font-vt text-steel-3">ANY FIGHTER</span>
              }
            </div>
          </div>
        </div>

        {/* Inline accept */}
        {publicKey && !isOwnBattle && (
          <div
            className="mt-2.5 flex gap-2 items-center flex-wrap"
            onClick={(e) => e.stopPropagation()}
          >
            {b.opponentNft ? (
              <button
                className="pixel-btn pixel-btn--green text-[9px]"
                disabled={isAccepting}
                onClick={() => onAccept(b, b.opponentNft!)}
              >
                {isAccepting ? "ACCEPTING..." : "ACCEPT"}
              </button>
            ) : eligible.length === 0 ? (
              <span className="font-pixel text-red-dark">NO ELIGIBLE FIGHTERS</span>
            ) : (
              <>
                <select
                  className="pixel-input w-auto text-[18px]"
                  value={selectedFighter}
                  onChange={(e) => setSelectedFighter(e.target.value)}
                >
                  {eligible.map((f) => (
                    <option key={f.mint.toBase58()} value={f.mint.toBase58()}>
                      {f.mint.toBase58().slice(0, 8)}... PWR:{f.power}
                    </option>
                  ))}
                </select>
                <button
                  className="pixel-btn pixel-btn--green text-[9px]"
                  disabled={isAccepting || !selectedFighter}
                  onClick={() => onAccept(b, new PublicKey(selectedFighter))}
                >
                  {isAccepting ? "ACCEPTING..." : "ACCEPT"}
                </button>
                <button
                  className="pixel-btn pixel-btn--primary text-[8px]"
                  onClick={() => setModalOpen(true)}
                >
                  DETAILS
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <DetailModal
          battle={b}
          myFighters={myFighters}
          publicKey={publicKey}
          accepting={accepting}
          onAccept={(battle, mint) => { onAccept(battle, mint); setModalOpen(false); }}
          onClose={() => setModalOpen(false)}
          highlight={highlight}
          signerPower={signerPower}
        />
      )}
    </>
  );
}