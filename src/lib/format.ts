import type { SymbolId } from "./types";

export function formatPrice(value: number, symbol?: SymbolId): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const digits =
    symbol === "DOGE-USD" ? (abs >= 1 ? 4 : 6) : abs >= 1000 ? 2 : abs >= 1 ? 2 : 6;
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatUsd(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatPct(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

export function formatR(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}R`;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
