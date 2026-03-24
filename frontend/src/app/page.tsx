"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Swords, Trophy } from "lucide-react";
import { PixelNav } from "@/components/PixelNav";
import { ArenaStats } from "@/types";
import { fetchArenaStats } from "@/lib/instructions";

export default function LandingPage() {
  const [stats, setStats] = useState<ArenaStats | null>(null);

  useEffect(() => {
    fetchArenaStats().then(setStats).catch(() => {});
  }, []);

  const statCards = [
    { icon: Users, label: "ACTIVE\nFIGHTERS", value: stats?.totalFighters },
    { icon: Swords, label: "OPEN\nBATTLES", value: stats?.openBattles },
    { icon: Trophy, label: "BATTLES\nRESOLVED", value: stats?.resolvedBattles },
  ];

  const corners = [
    { top: 40, left: 40, borderTop: "3px solid var(--steel-3)", borderLeft: "3px solid var(--steel-3)" },
    { top: 40, right: 40, borderTop: "3px solid var(--steel-3)", borderRight: "3px solid var(--steel-3)" },
    { bottom: 40, left: 40, borderBottom: "3px solid var(--steel-3)", borderLeft: "3px solid var(--steel-3)" },
    { bottom: 40, right: 40, borderBottom: "3px solid var(--steel-3)", borderRight: "3px solid var(--steel-3)" },
  ];

  return (
    <main className="min-h-screen bg-black flex flex-col">
      <PixelNav />

      <section className="flex-1 flex flex-col items-center justify-center gap-12 px-8 py-16 relative overflow-hidden">

        {/* Grid bg */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `linear-gradient(var(--color-steel-4) 1px, transparent 1px), linear-gradient(90deg, var(--color-steel-4) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Corner brackets */}
        {corners.map((corner, i) => {
          const { top, left, right, bottom, ...borders } = corner;
          return (
            <div key={i} style={{
              position: "absolute", top, left, right, bottom,
              width: 32, height: 32,
              ...borders,
            }} />
          );
        })}

        {/* Logo */}
        <img
          src="/logo.png"
          alt="TATAKAE"
          className="relative w-xl"
          style={{ imageRendering: "pixelated", animation: "flicker 6s infinite" }}
        />

        {/* Tagline */}
        <div className="relative font-pixel text-steel-2 tracking-[4px] text-center -mt-6">
          NFT FIGHTING GAME ON SOLANA
        </div>

        {/* Live stats */}
        <div className="relative flex gap-8 flex-wrap justify-center">
          {statCards.map((s) => {
            const Icon = s.icon;
            const isLoading = stats === null;
            return (
              <div key={s.label} className="pixel-panel text-center py-4 px-8">
                <div className="flex justify-center">
                  <Icon size={24} className="text-steel-3" />
                </div>
                <div className="font-pixel text-gold">
                  {isLoading
                    ? <span style={{ display: "inline-block", animation: "blink 0.8s infinite" }}>...</span>
                    : s.value
                  }
                </div>
                <div className="font-pixel text-steel-2">
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTAs */}
        <div className="relative flex gap-6 flex-wrap justify-center">
          <Link href="/arena" className="no-underline">
            <button className="pixel-btn pixel-btn--red text-[12px] px-9 py-4">ENTER ARENA</button>
          </Link>
          <Link href="/profile" className="no-underline">
            <button className="pixel-btn pixel-btn--primary text-[12px] px-9 py-4">MY FIGHTERS</button>
          </Link>
        </div>

      </section>

    </main>
  );
}