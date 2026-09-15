import type { Candle, SymbolId, ThesisLock } from "./types";

const SEED = "seed_v2";

function extrema(candles: Candle[], from: number, to: number) {
  const slice = candles.slice(Math.max(0, from), Math.min(candles.length, to));
  let lo = slice[0];
  let hi = slice[0];
  if (!lo || !hi) return null;
  for (const c of slice) {
    if (c.low < lo.low) lo = c;
    if (c.high > hi.high) hi = c;
  }
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
  const confirmation = w1End;
  const mark = candles[n - 1]!.close;
  if (!(w1End > w1Start) || !(mark > 0)) return null;

  const invalidation = Math.min(w2End, mark) * (symbol === "BTC-USD" ? 0.978 : 0.96);
  const stop = Math.abs(mark - invalidation);
  if (stop <= 0) return null;
  const tp1 = mark + stop * 2.25;
  const tp2 = mark + stop * 3.6;

  const isDoge = symbol === "DOGE-USD";
  return {
    id: `${SEED}_${symbol}`,
    symbol,
    bias: "long",
    waveRole: 3,
    invalidation,
    tp1,
    tp2,
    pivots: { w1Start, w1End, w2End, confirmation },
    alternate: isDoge
      ? "Alt: this DOGE thrust is still ABC-C of a larger WXY under BTC risk. If BTC loses EMA50, stand down even if local 1-2 holds."
      : "Alt: this advance is ABC of a larger 4, not a 3. Invalidation is a break of W2. If overlap of W1 prints, switch to diagonal/corrective and sit.",
    sitOut: false,
    diagonalOk: false,
    htfBias: "long",
    notes: isDoge
      ? "Sample DOGE lock. BTC-lead gate must pass before arming a long."
      : "Sample BTC lock from the last impulse + retrace. Targets sized from mark so paper R:R clears the desk minimum. Edit pivots before treating it as your count.",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    state: "WATCH",
  };
}

export function ensureSeedLocks(
  existing: ThesisLock[],
  candles: Partial<Record<SymbolId, Candle[]>>,
): ThesisLock[] {
  const custom = existing.filter((l) => !l.id.startsWith("seed_") && !l.notes.includes("Sample"));
  if (custom.length > 0) return existing;
  const haveCurrent = existing.some((l) => l.id.startsWith(`${SEED}_`));
  if (haveCurrent && existing.length >= 2) return existing;
  const next: ThesisLock[] = [];
  for (const symbol of ["BTC-USD", "DOGE-USD"] as const) {
    const c = candles[symbol];
    if (!c) continue;
    const lock = deriveSampleLock(symbol, c);
    if (lock) next.push(lock);
  }
  return next.length ? next : existing;
}
