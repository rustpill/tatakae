import type { BattleAccount } from "@/types";

export function renderMode(mode: BattleAccount["battleMode"]): string {
  return "pinkSlip" in mode ? "Pink Slip" : "Bite";
}

export function renderStatus(status: BattleAccount["status"]): string {
  if ("pending" in status) return "Pending";
  if ("accepted" in status) return "Accepted";
  if ("completed" in status) return "Completed";
  if ("cancelled" in status) return "Cancelled";
  return "Unknown";
}