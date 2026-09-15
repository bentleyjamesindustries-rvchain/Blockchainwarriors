import type { Candle, SymbolId, ThesisLock } from "./types";
const SEED = "seed_v2";
function extrema(candles: Candle[], from: number, to: number) {
  const slice = candles.slice(Math.max(0, from), Math.min(candles.length, to));
  let lo = slice[0]; let hi = slice[0];
  if (!lo || !hi) return null;
  for (const c of slice) { if (c.low < lo.low) lo = c; if (c.high > hi.high) hi = c; }
  return { lo, hi };
}
export function deriveSampleLock(symbol: SymbolId, candles: Candle[]): ThesisLock | null {
  if (candles.length < 80) return null;
  const n = candles.length;
  const first = extrema(candles, n - 80, n - 45);
  const mid = extrema(candles, n - 50, n - 22);
  const last = extrema(candles, n - 24, n - 2);
  if (!first || !mid || !last) return null;
  const w1Start = first.lo.low;
  const w1End = Math.max(mid.hi.high, last.hi.high);
  const w2End = last.lo.low;
  const mark = candles[n - 1]!.close;
  if (!(w1End > w1Start) || !(mark > 0)) return null;
  const invalidation = Math.min(w2End, mark) * (symbol === "BTC-USD" ? 0.978 : 0.96);
  const stop = Math.abs(mark - invalidation);
  if (stop <= 0) return null;
  return {
    id: `${SEED}_${symbol}`, symbol, bias: "long", waveRole: 3, invalidation,
    tp1: mark + stop * 2.25, tp2: mark + stop * 3.6,
    pivots: { w1Start, w1End, w2End, confirmation: w1End },
    alternate: "Alt: this advance is ABC of a larger 4, not a 3.",
    sitOut: false, diagonalOk: false, htfBias: "long",
    notes: "Sample lock from the last impulse + retrace.",
    createdAt: Date.now(), updatedAt: Date.now(), state: "WATCH",
  };
}
export function ensureSeedLocks(existing: ThesisLock[], candles: Partial<Record<SymbolId, Candle[]>>): ThesisLock[] {
  const custom = existing.filter((l) => !l.id.startsWith("seed_") && !l.notes.includes("Sample"));
  if (custom.length > 0) return existing;
  const next: ThesisLock[] = [];
  for (const symbol of ["BTC-USD", "DOGE-USD"] as const) {
    const c = candles[symbol]; if (!c) continue;
    const lock = deriveSampleLock(symbol, c); if (lock) next.push(lock);
  }
  return next.length ? next : existing;
}
