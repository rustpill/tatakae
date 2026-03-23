"use client";

import { useState, useEffect } from "react";
import { ImageIcon } from "lucide-react";
import type { InitialisedFighter } from "@/types";
import { fetchFighterMetadata } from "@/lib/instructions";
import { ExplorerLink } from "./ExplorerLink";

interface FighterCardProps {
  fighter: InitialisedFighter;
}

export function FighterCard({ fighter }: FighterCardProps) {
  const [image, setImage] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);

  useEffect(() => {
    if (!fighter.uri) return;
    setImgLoading(true);
    fetchFighterMetadata(fighter.uri)
      .then((meta) => { setImage(meta.image); setName(meta.name); })
      .finally(() => setImgLoading(false));
  }, [fighter.uri]);

  const displayName = name ?? `${fighter.mint.toBase58().slice(0, 8)}...`;

  return (
    <div className="pixel-panel fighter-card p-4">
      {/* Image */}
      <div className="w-full aspect-square bg-navy border-2 border-steel-4 mb-2.5 flex items-center justify-center overflow-hidden relative">
        {imgLoading && (
          <span className="font-pixel text-[7px] text-steel-3" style={{ animation: "blink 0.8s infinite" }}>
            LOADING...
          </span>
        )}
        {!imgLoading && image && (
          <img
            src={image}
            alt={displayName}
            className="w-full h-full object-cover"
            style={{ imageRendering: "pixelated" }}
          />
        )}
        {!imgLoading && !image && <ImageIcon size={32} color="var(--steel-4)" />}
        <div style={{ position: "absolute", bottom: 4, right: 4 }}>
          <span className="power-badge">PWR {fighter.power}</span>
        </div>
      </div>

      {/* Name */}
      <div className="font-pixel text-steel-1">
        {displayName}
      </div>

      {/* NFT mint - clickable explorer link */}
      <div className="mb-2.5">
        <ExplorerLink address={fighter.mint.toBase58()} type="address" />
      </div>

      {/* W / L / Ratio */}
      <div className="flex gap-4">
        {[
          { label: "WINS",   value: fighter.wins,   colorClass: "text-green" },
          { label: "LOSSES", value: fighter.losses, colorClass: "text-red"   },
          {
            label: "%",
            value: fighter.wins + fighter.losses === 0
              ? "-"
              : Math.round((fighter.wins / (fighter.wins + fighter.losses)) * 100) + "%",
            colorClass: "text-steel-1",
          },
        ].map((s) => (
          <div key={s.label} className="flex-1">
            <div className={`font-pixel text-md ${s.colorClass}`}>{s.label}</div>
            <div className={`font-pixel text-3xl ${s.colorClass}`}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}