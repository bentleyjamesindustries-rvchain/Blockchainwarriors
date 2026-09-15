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
    const tr = prev
      ? Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close))
      : c.high - c.low;
    trs.push(tr);
  }
  return sma(trs, period);
}

export function last<T>(arr: T[]): T | null {
  return arr.length ? arr[arr.length - 1]! : null;
}

export function swingHigh(candles: Candle[], lookback = 20): number | null {
  if (!candles.length) return null;
  const slice = candles.slice(-lookback);
  return slice.reduce((m, c) => Math.max(m, c.high), -Infinity);
}

export function swingLow(candles: Candle[], lookback = 20): number | null {
  if (!candles.length) return null;
  const slice = candles.slice(-lookback);
  return slice.reduce((m, c) => Math.min(m, c.low), Infinity);
}

export function returnN(candles: Candle[], n: number): number {
  if (candles.length < n + 1) return 0;
  const a = candles[candles.length - 1 - n]!.close;
  const b = candles[candles.length - 1]!.close;
  if (a === 0) return 0;
  return (b - a) / a;
}

export function adxLike(candles: Candle[], period = 14): number {
  if (candles.length < period + 2) return 0;
  let up = 0;
  let down = 0;
  const slice = candles.slice(-period - 1);
  for (let i = 1; i < slice.length; i++) {
    const dp = slice[i]!.high - slice[i - 1]!.high;
    const dm = slice[i - 1]!.low - slice[i]!.low;
    if (dp > dm && dp > 0) up += dp;
    if (dm > dp && dm > 0) down += dm;
  }
  const sum = up + down;
  if (sum === 0) return 0;
  return Math.abs(up - down) / sum;
}

export function isChop(candles: Candle[]): boolean {
  if (candles.length < 30) return false;
  const a = atr(candles, 14);
  const lastAtr = last(a) ?? 0;
  const prior = a.slice(-40, -14);
  const mean = prior.length ? prior.reduce((s, v) => s + v, 0) / prior.length : lastAtr;
  const compressed = mean > 0 && lastAtr < mean * 0.65;
  const trend = adxLike(candles, 14);
  return compressed && trend < 0.18;
}

export interface VolumeProfile {
  poc: number;
  hvn: number[];
  lvn: number[];
  bins: { price: number; volume: number }[];
}

export function volumeProfile(candles: Candle[], bins = 24): VolumeProfile | null {
  if (candles.length < 8) return null;
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of candles) {
    lo = Math.min(lo, c.low);
    hi = Math.max(hi, c.high);
  }
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
  const mean = vol.reduce((s, v) => s + v, 0) / bins;
  const hvn: number[] = [];
  const lvn: number[] = [];
  const rows: { price: number; volume: number }[] = [];
  for (let i = 0; i < bins; i++) {
    const price = lo + (i + 0.5) * width;
    rows.push({ price, volume: vol[i]! });
    if (vol[i]! >= mean * 1.35) hvn.push(price);
    if (vol[i]! <= mean * 0.45) lvn.push(price);
  }
  return { poc: lo + (pocIdx + 0.5) * width, hvn, lvn, bins: rows };
}

export function fibRetrace(start: number, end: number, ratio: number): number {
  return end - (end - start) * ratio;
}

export function measuredImpulse(pivots: { w1Start: number; w1End: number; w2End: number }) {
  const impulse = Math.abs(pivots.w1End - pivots.w1Start);
  const depth = impulse === 0 ? 0 : Math.abs(pivots.w1End - pivots.w2End) / impulse;
  return { impulse, depth };
}

/** Impulse channel: origin (W1 start) → W2 end, parallel through W1 end. */
export function impulseChannel(p: { w1Start: number; w1End: number; w2End: number }) {
  const lowerA = p.w1Start;
  const lowerB = p.w2End;
  const offset = p.w1End - p.w1Start;
  return {
    baseA: lowerA,
    baseB: lowerB,
    parallelA: lowerA + offset,
    parallelB: lowerB + offset,
    medianA: lowerA + offset / 2,
    medianB: lowerB + offset / 2,
  };
}

/** Andrews pitchfork from A=W1 start, B=W1 end, C=W2 end. */
export function pitchfork(p: { w1Start: number; w1End: number; w2End: number }) {
  const mid = (p.w1End + p.w2End) / 2;
  return {
    medianStart: p.w1Start,
    medianEnd: mid,
    upper: p.w1End,
    lower: p.w2End,
  };
}

export function near(price: number, level: number, atrVal: number, k = 0.35): boolean {
  if (!Number.isFinite(price) || !Number.isFinite(level)) return false;
  const tol = Math.max(atrVal * k, Math.abs(level) * 0.002);
  return Math.abs(price - level) <= tol;
}

export function between(price: number, a: number, b: number): boolean {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return price >= lo && price <= hi;
}

export function closesAbove(candles: Candle[], level: number, n = 1): boolean {
  const slice = candles.slice(-n);
  return slice.length > 0 && slice.every((c) => c.close > level);
}

export function closesBelow(candles: Candle[], level: number, n = 1): boolean {
  const slice = candles.slice(-n);
  return slice.length > 0 && slice.every((c) => c.close < level);
}

export function taggedBand(candles: Candle[], lo: number, hi: number, lookback = 8): boolean {
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  return candles.slice(-lookback).some((c) => c.low <= b && c.high >= a);
}

export function reclaimed(candles: Candle[], level: number, bias: "long" | "short", lookback = 6): boolean {
  const slice = candles.slice(-lookback);
  if (slice.length < 3) return false;
  if (bias === "long") {
    const dipped = slice.some((c) => c.low <= level);
    const lastC = slice[slice.length - 1]!;
    return dipped && lastC.close > level;
  }
  const tagged = slice.some((c) => c.high >= level);
  const lastC = slice[slice.length - 1]!;
  return tagged && lastC.close < level;
}
