"use client";
import { Shield, Swords, Trophy, Zap, Scroll, Factory } from "lucide-react";
import { PixelNav } from "@/components/PixelNav";
import { useState } from "react";

function Tooltip({ word, title, lines }: { word: string; title: string; lines: string[] }) {
  const [visible, setVisible] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline" }}>
      <span
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        style={{
          color: "var(--color-gold)",
          borderBottom: "1px dashed var(--color-gold)",
          cursor: "help",
        }}
      >
        {word}
      </span>
      {visible && (
        <span style={{
          position: "absolute",
          bottom: "calc(100% + 8px)",
          left: "50%",
          transform: "translateX(-50%)",
          width: 300,
          background: "var(--color-panel-bg)",
          border: "2px solid var(--color-steel-3)",
          boxShadow: "inset 2px 2px 0 var(--color-steel-2), inset -2px -2px 0 var(--color-steel-4), 4px 4px 0 var(--color-steel-4)",
          padding: "12px",
          zIndex: 100,
          pointerEvents: "none",
        }}>
          <div style={{ fontFamily: "var(--font-pixel)", fontSize: 12, color: "var(--color-gold)", marginBottom: 5 }}>
            {title}
          </div>
          {lines.map((line, i) =>
            line === "" ? (
              <div key={i} style={{ height: 6 }} />
            ) : (
              <div key={i} style={{ fontFamily: "var(--font-vt)", fontSize: 18, color: "var(--color-steel-1)", lineHeight: 1.5 }}>
                {line}
              </div>
            )
          )}
        </span>
      )}
    </span>
  );
}

const steps = [
  {
    icon: Factory,
    title: "CLAIM YOUR FIGHTER",
    description: "",
  },
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
    description: "",
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
                      {i === 0 ? (
                        <>
                        Head to the{" "}
                          <a href="/faucet" style={{
                              color: "var(--color-gold)",
                              borderBottom: "1px solid var(--color-gold)",
                              textDecoration: "none",
                              cursor: "pointer",
                            }}>
                            faucet
                          </a>
                        , and claim your fighter.
                        </>
                      ) : i === 3 ? (
                        <>
                          Our resolver picks a winner using on-chain{" "}
                          <Tooltip
                            word="randomness"
                            title="Probability"
                            lines={[
                              "P(win) = A ÷ (A + B)",
                              "A = your power, B = opponent power",
                              "",
                              "random % (A + B) < A",
                              "",
                              "600 vs 400 → 60% chance",
                              "800 vs 200 → 80% chance",
                              "500 vs 500 → 50% chance",
                              "",
                              "Seed: hash(SlotHashes, battleKey)",
                            ]}
                          />
                          . No one can predict or manipulate the outcome.
                        </>
                      ) : step.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Battle modes */}
        <div>
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