import type { Candle } from "./types";

export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0]!;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    out.push(i >= period - 1 ? sum / period : sum / (i + 1));
  }
  return out;
}

export function atr(candles: Candle[], period = 14): number[] {
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!;
    const prev = candles[i - 1];
    const tr = prev ? Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)) : c.high - c.low;
    trs.push(tr);
  }
  return sma(trs, period);
}

export function last<T>(arr: T[]): T | null {
  return arr.length ? arr[arr.length - 1]! : null;
}

export function swingHigh(candles: Candle[], lookback = 20): number | null {
  if (!candles.length) return null;
  return candles.slice(-lookback).reduce((m, c) => Math.max(m, c.high), -Infinity);
}

export function swingLow(candles: Candle[], lookback = 20): number | null {
  if (!candles.length) return null;
  return candles.slice(-lookback).reduce((m, c) => Math.min(m, c.low), Infinity);
}

export function returnN(candles: Candle[], n: number): number {
  if (candles.length < n + 1) return 0;
  const a = candles[candles.length - 1 - n]!.close;
  const b = candles[candles.length - 1]!.close;
  return a === 0 ? 0 : (b - a) / a;
}

export function impulseChannel(p: { w1Start: number; w1End: number; w2End: number }) {
  const offset = p.w1End - p.w1Start;
  return { baseA: p.w1Start, baseB: p.w2End, parallelA: p.w1Start + offset, parallelB: p.w2End + offset, medianA: p.w1Start + offset / 2, medianB: p.w2End + offset / 2 };
}

export function fibRetrace(start: number, end: number, ratio: number): number {
  return end - (end - start) * ratio;
}

export function measuredImpulse(pivots: { w1Start: number; w1End: number; w2End: number }) {
  const impulse = Math.abs(pivots.w1End - pivots.w1Start);
  const depth = impulse === 0 ? 0 : Math.abs(pivots.w1End - pivots.w2End) / impulse;
  return { impulse, depth };
}

export function near(price: number, level: number, atrVal: number, k = 0.35): boolean {
  if (!Number.isFinite(price) || !Number.isFinite(level)) return false;
  return Math.abs(price - level) <= Math.max(atrVal * k, Math.abs(level) * 0.002);
}

export function between(price: number, a: number, b: number): boolean {
  return price >= Math.min(a, b) && price <= Math.max(a, b);
}

export function isChop(candles: Candle[]): boolean {
  if (candles.length < 30) return false;
  const a = atr(candles, 14);
  const lastAtr = last(a) ?? 0;
  const prior = a.slice(-40, -14);
  const mean = prior.length ? prior.reduce((s, v) => s + v, 0) / prior.length : lastAtr;
  return mean > 0 && lastAtr < mean * 0.65;
}

export function taggedBand(candles: Candle[], lo: number, hi: number, lookback = 8): boolean {
  const a = Math.min(lo, hi); const b = Math.max(lo, hi);
  return candles.slice(-lookback).some((c) => c.low <= b && c.high >= a);
}

export function reclaimed(candles: Candle[], level: number, bias: "long" | "short", lookback = 6): boolean {
  const slice = candles.slice(-lookback);
  if (slice.length < 3) return false;
  const lastC = slice[slice.length - 1]!;
  if (bias === "long") return slice.some((c) => c.low <= level) && lastC.close > level;
  return slice.some((c) => c.high >= level) && lastC.close < level;
}

export function volumeProfile(candles: Candle[], bins = 24) {
  if (candles.length < 8) return null;
  let lo = Infinity, hi = -Infinity;
  for (const c of candles) { lo = Math.min(lo, c.low); hi = Math.max(hi, c.high); }
  if (!(hi > lo)) return null;
  const width = (hi - lo) / bins;
  const vol = new Array(bins).fill(0) as number[];
  for (const c of candles) {
    const mid = (c.high + c.low + c.close) / 3;
    const i = Math.min(bins - 1, Math.max(0, Math.floor((mid - lo) / width)));
    vol[i] += c.volume || Math.abs(c.close - c.open) || 1;
  }
  let pocIdx = 0;
  for (let i = 1; i < bins; i++) if (vol[i]! > vol[pocIdx]!) pocIdx = i;
  return { poc: lo + (pocIdx + 0.5) * width, hvn: [] as number[], lvn: [] as number[], bins: vol.map((v, i) => ({ price: lo + (i + 0.5) * width, volume: v })) };
}
