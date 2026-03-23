import { Scroll, Zap } from "lucide-react";
import type { BattleAccount } from "@/types";

interface ModeBadgeProps {
  mode: BattleAccount["battleMode"];
}

export function ModeBadge({ mode }: ModeBadgeProps) {
  if ("pinkSlip" in mode) {
    return (
      <span className="mode-badge mode-badge--pinkslip" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Scroll size={10} /> PINK SLIP
      </span>
    );
  }
  return (
    <span className="mode-badge mode-badge--bite" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Zap size={10} /> BITE
    </span>
  );
}