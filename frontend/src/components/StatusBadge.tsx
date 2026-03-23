import type { BattleAccount } from "@/types";

interface StatusBadgeProps {
  status: BattleAccount["status"];
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if ("pending" in status) return <span className="status-badge status-badge--pending">PENDING</span>;
  if ("accepted" in status) return <span className="status-badge status-badge--accepted">ACCEPTED</span>;
  if ("completed" in status) return <span className="status-badge status-badge--completed">COMPLETED</span>;
  return <span className="status-badge status-badge--cancelled">CANCELLED</span>;
}