"use client";
import { Shield, Swords, Trophy, Zap, Scroll, ArrowRight } from "lucide-react";
import { PixelNav } from "@/components/PixelNav";

const steps = [
  {
    icon: Shield,
    title: "REGISTER YOUR FIGHTER",
    description: "Go to your profile and register your NFTs as fighters. Each NFT gets a power level assigned at mint.",
  },
  {
    icon: Swords,
    title: "CHALLENGE OR ACCEPT",
    description: "Create a battle and lock your NFT in escrow, or browse open challenges and accept one with your fighter.",
  },
  {
    icon: Trophy,
    title: "BATTLE RESOLVED",
    description: "Our resolver picks a winner using on-chain randomness from Solana's slot hashes. No one can predict or manipulate the outcome.",
  },
];

export default function About() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--color-black)" }}>
      <PixelNav />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 1.5rem" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontFamily: "var(--font-pixel)", fontSize: 18, color: "var(--color-white)", marginBottom: 16, textShadow: "3px 3px 0 var(--color-red-dark)" }}>
            HOW IT WORKS
          </div>
          <div style={{ fontFamily: "var(--font-vt)", fontSize: 22, color: "var(--color-steel-2)", lineHeight: 1.6 }}>
            An on-chain NFT fighting game on Solana. Battle your fighters and grow stronger.
          </div>
        </div>

        {/* Steps */}
        <div style={{ marginBottom: "3rem" }}>
          <div className="section-header">THE FLOW</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="pixel-panel" style={{ padding: "1.25rem", display: "flex", gap: "1.25rem", alignItems: "flex-start" }}>
                  <div style={{
                    flexShrink: 0, width: 40, height: 40,
                    background: "var(--color-steel-4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "2px solid var(--color-steel-3)",
                  }}>
                    <Icon size={18} color="var(--color-gold)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontFamily: "var(--font-pixel)", fontSize: 10, color: "var(--color-steel-3)" }}>0{i + 1}</span>
                      <span style={{ fontFamily: "var(--font-pixel)", fontSize: 10, color: "var(--color-white)" }}>{step.title}</span>
                    </div>
                    <div style={{ fontFamily: "var(--font-vt)", fontSize: 20, color: "var(--color-steel-2)", lineHeight: 1.5 }}>
                      {step.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Battle modes */}
        <div style={{ marginBottom: "3rem" }}>
          <div className="section-header">BATTLE MODES</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            <div className="pixel-panel pixel-panel--red" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Scroll size={16} color="var(--color-red)" />
                <span style={{ fontFamily: "var(--font-pixel)", fontSize: 11, color: "var(--color-red)" }}>PINK SLIP</span>
              </div>
              <div style={{ fontFamily: "var(--font-vt)", fontSize: 20, color: "var(--color-steel-1)", lineHeight: 1.5 }}>
                Winner takes the loser's NFT . Only enter if you're willing to lose your fighter.
              </div>
            </div>
            <div className="pixel-panel pixel-panel--gold" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Zap size={16} color="var(--color-gold)" />
                <span style={{ fontFamily: "var(--font-pixel)", fontSize: 11, color: "var(--color-gold)" }}>BITE</span>
              </div>
              <div style={{ fontFamily: "var(--font-vt)", fontSize: 20, color: "var(--color-steel-1)", lineHeight: 1.5 }}>
                Winner steals 20% of the loser's power. Both NFTs are returned. Grow stronger by defeating powerful fighters.
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}