import { btcLeadFromCandles, scoreConfluence } from "./engine";
import { impulseProj, preferredW2, w2PastOrigin } from "./impulse";
import { last } from "./indicators";
import type {
  Actionable,
  Bias,
  Candle,
  DeskMode,
  DeskSettings,
  MarketBundle,
  Opportunity,
  SymbolId,
  ThesisLock,
  WaveRole,
} from "./types";

interface Swing {
  i: number;
  price: number;
  kind: "h" | "l";
}

function swings(candles: Candle[], k = 4): Swing[] {
  const out: Swing[] = [];
  if (candles.length < k * 2 + 3) return out;
  for (let i = k; i < candles.length - k; i++) {
    const c = candles[i]!;
    let isH = true;
    let isL = true;
    for (let j = i - k; j <= i + k; j++) {
      if (j === i) continue;
      if (candles[j]!.high > c.high) isH = false;
      if (candles[j]!.low < c.low) isL = false;
    }
    if (isH) out.push({ i, price: c.high, kind: "h" });
    if (isL) out.push({ i, price: c.low, kind: "l" });
  }
  return out;
}

function lastPattern(pivots: Swing[], want: Array<"h" | "l">): Swing[] | null {
  const seq: Swing[] = [];
  for (let i = pivots.length - 1; i >= 0 && seq.length < want.length; i--) {
    const p = pivots[i]!;
    const need = want[want.length - 1 - seq.length];
    if (p.kind === need) seq.unshift(p);
  }
  return seq.length === want.length ? seq : null;
}

function makeLock(opts: {
  id: string;
  symbol: SymbolId;
  bias: Bias;
  waveRole: WaveRole;
  w1Start: number;
  w1End: number;
  w2End: number;
  mark: number;
  sitOut: boolean;
  alternate: string;
  notes: string;
  tp1?: number;
  tp2?: number;
  invalidation?: number;
}): ThesisLock {
  const { bias, mark } = opts;
  const p = impulseProj(opts.w1Start, opts.w1End, opts.w2End, mark, bias);
  const invalidation = opts.invalidation ?? p.invalidation;
  const tp1 = opts.tp1 ?? p.tp1;
  const tp2 = opts.tp2 ?? p.tp2;
  const now = Date.now();
  return {
    id: opts.id,
    symbol: opts.symbol,
    bias,
    waveRole: opts.waveRole,
    invalidation,
    tp1,
    tp2,
    pivots: {
      w1Start: opts.w1Start,
      w1End: opts.w1End,
      w2End: opts.w2End,
      confirmation: opts.w1End,
    },
    alternate: opts.alternate,
    sitOut: opts.sitOut,
    diagonalOk: false,
    htfBias: bias,
    notes: opts.notes,
    createdAt: now,
    updatedAt: now,
    state: opts.sitOut ? "WATCH" : "WATCH",
  };
}

function bestLHL(pivots: Swing[]): Swing[] | null {
  let best: Swing[] | null = null;
  let bestScore = -1;
  for (let i = 0; i < pivots.length; i++) {
    if (pivots[i]!.kind !== "l") continue;
    for (let j = i + 1; j < pivots.length; j++) {
      if (pivots[j]!.kind !== "h") continue;
      for (let k = j + 1; k < pivots.length; k++) {
        if (pivots[k]!.kind !== "l") continue;
        const a = pivots[i]!;
        const b = pivots[j]!;
        const c = pivots[k]!;
        if (!(b.price > a.price) || !(c.price < b.price)) continue;
        if (w2PastOrigin(a.price, b.price, c.price, "long")) continue;
        const p = impulseProj(a.price, b.price, c.price, c.price, "long");
        if (!p.valid) continue;
        let s = k;
        if (preferredW2(p.w2Depth)) s += 80;
        else if (p.w2Depth >= 0.382 && p.w2Depth <= 0.95) s += 20;
        if (s >= bestScore) {
          bestScore = s;
          best = [a, b, c];
        }
      }
    }
  }
  return best;
}

function bestHLH(pivots: Swing[]): Swing[] | null {
  let best: Swing[] | null = null;
  let bestScore = -1;
  for (let i = 0; i < pivots.length; i++) {
    if (pivots[i]!.kind !== "h") continue;
    for (let j = i + 1; j < pivots.length; j++) {
      if (pivots[j]!.kind !== "l") continue;
      for (let k = j + 1; k < pivots.length; k++) {
        if (pivots[k]!.kind !== "h") continue;
        const a = pivots[i]!;
        const b = pivots[j]!;
        const c = pivots[k]!;
        if (!(b.price < a.price) || !(c.price > b.price)) continue;
        if (w2PastOrigin(a.price, b.price, c.price, "short")) continue;
        const p = impulseProj(a.price, b.price, c.price, c.price, "short");
        if (!p.valid) continue;
        let s = k;
        if (preferredW2(p.w2Depth)) s += 80;
        else if (p.w2Depth >= 0.382 && p.w2Depth <= 0.95) s += 20;
        if (s >= bestScore) {
          bestScore = s;
          best = [a, b, c];
        }
      }
    }
  }
  return best;
}

function impulseLong(symbol: SymbolId, candles: Candle[]): ThesisLock | null {
  const mark = last(candles)?.close;
  if (!mark) return null;
  const piv = swings(candles);
  const pat = bestLHL(piv) ?? lastPattern(piv, ["l", "h", "l"]);
  if (!pat) return null;
  const [a, b, c] = pat;
  if (!a || !b || !c) return null;
  if (!(b.price > a.price) || !(c.price < b.price)) return null;
  if (w2PastOrigin(a.price, b.price, c.price, "long")) return null;
  return makeLock({
    id: `opt_${symbol}_impulse`,
    symbol,
    bias: "long",
    waveRole: 3,
    w1Start: a.price,
    w1End: b.price,
    w2End: c.price,
    mark,
    sitOut: false,
    alternate:
      "Alt: this advance is ABC of a larger 4, not a 3. A break of the W2 low kills the impulse and we stand down.",
    notes: "Bot scan: last L-H-L as a candidate 1-2 into a 3.",
  });
}

function impulseShort(symbol: SymbolId, candles: Candle[]): ThesisLock | null {
  const mark = last(candles)?.close;
  if (!mark) return null;
  const piv = swings(candles);
  const pat = bestHLH(piv) ?? lastPattern(piv, ["h", "l", "h"]);
  if (!pat) return null;
  const [a, b, c] = pat;
  if (!a || !b || !c) return null;
  if (!(b.price < a.price) || !(c.price > b.price)) return null;
  if (w2PastOrigin(a.price, b.price, c.price, "short")) return null;
  return makeLock({
    id: `opt_${symbol}_fade`,
    symbol,
    bias: "short",
    waveRole: 5,
    w1Start: a.price,
    w1End: b.price,
    w2End: c.price,
    mark,
    sitOut: false,
    alternate:
      "Alt: the pop is still a 3, not a finished 5. If price closes through the last high, the fade is wrong — flatten.",
    notes: "Bot scan: last H-L-H as a candidate late-5 / ABC-C fade.",
  });
}

function scoreOf(
  lock: ThesisLock,
  candles: Candle[],
  btc: Candle[],
  settings: DeskSettings,
  equity: number,
) {
  const price = last(candles)?.close ?? 0;
  return scoreConfluence({
    lock,
    candles,
    htf: candles,
    btc: btc.length ? btc : candles,
    settings,
    price,
    equity,
  });
}

function setupScore(total: number, rr: number, canArm: boolean, sit: boolean): number {
  let n = 28 + total * 7;
  if (rr >= 2) n += 10;
  if (canArm) n += 12;
  if (sit) n -= 18;
  return Math.max(8, Math.min(92, Math.round(n)));
}

function money(symbol: SymbolId, n: number): string {
  if (symbol === "DOGE-USD") return n >= 1 ? n.toFixed(4) : n.toFixed(5);
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function near(px: number, level: number, pct = 0.012): boolean {
  if (level <= 0) return false;
  return Math.abs(px - level) / level <= pct;
}

function op(partial: Omit<Opportunity, "rank"> & { rank: 1 | 2 | 3 }): Opportunity {
  return partial;
}

function scanBook(
  symbol: SymbolId,
  candles: Candle[],
  btcCandles: Candle[],
  settings: DeskSettings,
  equity: number,
  leadBlocked: boolean,
): Opportunity[] {
  const mark = last(candles)?.close ?? 0;
  const name = symbol === "BTC-USD" ? "Bitcoin" : "Dogecoin";
  const longStruct = impulseLong(symbol, candles);
  const shortStruct = impulseShort(symbol, candles);
  const origin = longStruct?.pivots.w1Start ?? mark * 0.88;
  const high = longStruct?.pivots.w1End ?? mark * 1.04;
  const dip = longStruct?.pivots.w2End ?? mark * 0.94;
  const shortHigh = shortStruct?.pivots.w2End ?? high;
  const shortLow = shortStruct?.pivots.w1End ?? dip;
  const sitLead = symbol === "DOGE-USD" && settings.enableBtcLead && leadBlocked;
  const pull = origin + (high - origin) * 0.5;
  const deep = origin + (high - origin) * 0.382;
  const firstDip = Math.max(dip, pull);

  function score(lock: ThesisLock) {
    return scoreOf(lock, candles, btcCandles, settings, equity);
  }

  const longs: Opportunity[] = [];
  {
    const lock = makeLock({
      id: `opt_${symbol}_long_1`,
      symbol,
      bias: "long",
      waveRole: 3,
      w1Start: origin,
      w1End: high,
      w2End: dip,
      mark,
      sitOut: sitLead,
      alternate: "If the dip breaks, this long is wrong.",
      notes: "long-1",
    });
    const sc = score(lock);
    const chasing = mark > high;
    const inDip = mark <= firstDip * 1.01 && mark >= lock.invalidation;
    let actionable: Actionable = sitLead ? "sit" : chasing ? "wait" : inDip && !sc.hardFail ? "take" : "wait";
    longs.push(
      op({
        id: lock.id,
        rank: 1,
        mode: "long",
        title: `${name} long — dip hold`,
        summary: "Buy the dip of the last push. Stop under the dip.",
        wave: "Possible wave 3 if this dip is a wave 2. Alternate: the push was ABC, not a 1.",
        thesis: sitLead
          ? `${name} wants a dip-hold long, but Bitcoin is weak. Sit.`
          : `${name} last ran ${money(symbol, origin)} → ${money(symbol, high)}, then dipped to ${money(symbol, dip)}. If that dip is a wave 2, the next push is a possible wave 3. Stop ${money(symbol, lock.invalidation)}. First target ${money(symbol, lock.tp1)} (~${sc.rr.toFixed(1)}R).`,
        why: [
          sitLead ? "Bitcoin is not leading." : `Dip hold at ${money(symbol, dip)}.`,
          `Stop ${money(symbol, lock.invalidation)} · target ${money(symbol, lock.tp1)}`,
          chasing ? "Already through the last high — wait a pullback." : inDip ? "Price is in the dip zone." : "Wait for the dip.",
        ],
        waitFor: sitLead ? "Bitcoin to firm up." : `Pullback toward ${money(symbol, dip)}.`,
        setupScore: setupScore(sc.total, sc.rr, actionable === "take", sitLead),
        actionable,
        lock,
      }),
    );
  }
  {
    const lock = makeLock({
      id: `opt_${symbol}_long_2`,
      symbol,
      bias: "long",
      waveRole: 3,
      w1Start: origin,
      w1End: high,
      w2End: dip,
      mark,
      sitOut: sitLead,
      alternate: "Failed reclaim is a fake-out — flatten.",
      notes: "long-2",
      invalidation: dip * 0.985,
      tp1: high + (high - dip) * 0.5,
      tp2: high + (high - dip) * 1.2,
    });
    const sc = score(lock);
    const reclaiming = mark >= high * 0.995 && mark <= high * 1.03;
    const actionable: Actionable = sitLead ? "sit" : sc.hardFail ? "wait" : reclaiming ? "take" : "wait";
    longs.push(
      op({
        id: lock.id,
        rank: 2,
        mode: "long",
        title: `${name} long — reclaim`,
        summary: "Only after price takes back the last high.",
        wave: "Possible wave 3 confirmation — price taking out the wave 1 high. Alternate: fake break.",
        thesis: `If ${name} reclaims ${money(symbol, high)}, that is a possible wave 3 through the wave 1 high. Stop under ${money(symbol, lock.invalidation)}. Target ${money(symbol, lock.tp1)}. No reclaim, no trade.`,
        why: [
          `Needs a hold above ${money(symbol, high)}.`,
          `Stop ${money(symbol, lock.invalidation)} · target ${money(symbol, lock.tp1)}`,
          reclaiming ? "Reclaim is printing now." : "Not reclaimed yet.",
        ],
        waitFor: `A hold above ${money(symbol, high)}.`,
        setupScore: setupScore(sc.total * 0.9, sc.rr, actionable === "take", sitLead),
        actionable,
        lock,
      }),
    );
  }
  {
    const lock = makeLock({
      id: `opt_${symbol}_long_3`,
      symbol,
      bias: "long",
      waveRole: 3,
      w1Start: origin,
      w1End: high,
      w2End: dip,
      mark,
      sitOut: true,
      alternate: "Chasing is the wrong ticket.",
      notes: "long-3",
    });
    longs.push(
      op({
        id: lock.id,
        rank: 3,
        mode: "long",
        title: `${name} long — sit the chase`,
        summary: "Same side, not this print.",
        wave: "Possible late wave 3 or early wave 5 — too extended to buy. Alternate: the 3 already ran.",
        thesis: `Buying ${name} up here is chasing a possible wave 3 that already printed. Sit until a dip (possible wave 4) or a clean reclaim. Stop if you were in: ${money(symbol, lock.invalidation)}.`,
        why: ["This print is late.", "The live longs are option 1 (dip) or 2 (reclaim)."],
        waitFor: "A dip or a reclaim — not this candle.",
        setupScore: 18,
        actionable: "sit",
        lock,
      }),
    );
  }

  const shorts: Opportunity[] = [];
  {
    const lock = makeLock({
      id: `opt_${symbol}_short_1`,
      symbol,
      bias: "short",
      waveRole: 5,
      w1Start: shortHigh,
      w1End: shortLow,
      w2End: shortHigh,
      mark,
      sitOut: false,
      alternate: "If the high breaks, this fade is wrong.",
      notes: "short-1",
      invalidation: shortHigh * 1.015,
      tp1: dip,
      tp2: origin,
    });
    const sc = score(lock);
    const atHigh = near(mark, shortHigh, 0.015) || mark > shortHigh * 0.99;
    const stillUp = mark > dip && mark < shortHigh * 0.97;
    const actionable: Actionable = sc.hardFail ? "wait" : atHigh ? "wait" : stillUp ? "sit" : "wait";
    const take = !sc.hardFail && mark >= shortHigh * 0.985 && mark <= shortHigh * 1.008;
    shorts.push(
      op({
        id: lock.id,
        rank: 1,
        mode: "short",
        title: `${name} short — fade the high`,
        summary: "Only if the last high is failing.",
        wave: "Possible finished wave 5 or ABC-C at the high. Alternate: still a live wave 3.",
        thesis: `If ${money(symbol, shortHigh)} is a finished 5 (or C), the fade is the short. Stop ${money(symbol, lock.invalidation)}. Cover ${money(symbol, lock.tp1)}. A close through the high means the 3 is still live.`,
        why: [
          `Works only if ${money(symbol, shortHigh)} fails.`,
          `Stop ${money(symbol, lock.invalidation)} · cover ${money(symbol, lock.tp1)}`,
          take ? "Price is stalling at the high." : "No failed high yet.",
        ],
        waitFor: `A failed push through ${money(symbol, shortHigh)}.`,
        setupScore: setupScore(sc.total * 0.85, sc.rr, take, false),
        actionable: take ? "take" : actionable,
        lock,
      }),
    );
  }
  {
    const lock = makeLock({
      id: `opt_${symbol}_short_2`,
      symbol,
      bias: "short",
      waveRole: 5,
      w1Start: shortHigh,
      w1End: shortLow,
      w2End: shortHigh,
      mark,
      sitOut: false,
      alternate: "Dip hold resumes the long.",
      notes: "short-2",
      invalidation: dip * 1.02,
      tp1: origin,
      tp2: origin * 0.94,
    });
    const sc = score(lock);
    const broken = mark < dip;
    const actionable: Actionable = sc.hardFail ? "wait" : broken ? "take" : "wait";
    shorts.push(
      op({
        id: lock.id,
        rank: 2,
        mode: "short",
        title: `${name} short — dip break`,
        summary: "Short only after the dip gives way.",
        wave: "Possible impulse invalid — wave 2 broke. Next idea is a bearish 1-2. Alternate: shakeout.",
        thesis: `If ${name} loses ${money(symbol, dip)}, the bullish 1-2 is wrong. That break can start a down move. Stop ${money(symbol, lock.invalidation)}. Cover ${money(symbol, lock.tp1)}.`,
        why: [
          `Needs a break of ${money(symbol, dip)}.`,
          `Stop ${money(symbol, lock.invalidation)} · cover ${money(symbol, lock.tp1)}`,
          broken ? "Dip is broken." : "Dip is still holding — sit the short.",
        ],
        waitFor: `A break of ${money(symbol, dip)}.`,
        setupScore: setupScore(sc.total * 0.8, sc.rr, actionable === "take", false),
        actionable,
        lock,
      }),
    );
  }
  {
    const lock = makeLock({
      id: `opt_${symbol}_short_3`,
      symbol,
      bias: "short",
      waveRole: 5,
      w1Start: shortHigh,
      w1End: shortLow,
      w2End: shortHigh,
      mark,
      sitOut: true,
      alternate: "Uptrend still intact.",
      notes: "short-3",
    });
    shorts.push(
      op({
        id: lock.id,
        rank: 3,
        mode: "short",
        title: `${name} short — sit`,
        summary: "Don't fade a live push.",
        wave: "Possible live wave 3 — do not fade it. Alternate waits for a failed 5.",
        thesis: `No short while ${money(symbol, dip)} holds as a possible wave 2. Fading a live 3 is the wrong count. Wait for a failed high or a lost dip.`,
        why: [`Dip ${money(symbol, dip)} still counts as support.`, "Fading strength is how accounts get run over."],
        waitFor: "A failed high or a lost dip.",
        setupScore: 16,
        actionable: "sit",
        lock,
      }),
    );
  }

  const diamonds: Opportunity[] = [];
  const d1Px = firstDip;
  const d2Px = Math.min(deep, dip);
  const d3Px = origin * 1.01;
  {
    const lock = makeLock({
      id: `opt_${symbol}_diamond_1`,
      symbol,
      bias: "long",
      waveRole: 3,
      w1Start: origin,
      w1End: high,
      w2End: dip,
      mark,
      sitOut: sitLead,
      alternate: "If origin breaks, accumulation is wrong.",
      notes: "diamond-1",
      invalidation: d1Px * 0.97,
      tp1: high,
      tp2: high + (high - dip) * 0.4,
    });
    const sc = score(lock);
    const inBand = mark <= d1Px * 1.015 && mark >= lock.invalidation;
    const actionable: Actionable = sitLead ? "sit" : mark > high ? "wait" : inBand && !sc.hardFail ? "take" : "wait";
    diamonds.push(
      op({
        id: lock.id,
        rank: 1,
        mode: "diamond",
        title: `${name} buy target 1 — first dip`,
        summary: "Accumulate lot 1. Buy only at this dip. Never chase.",
        wave: "Possible wave 2 retrace. First accumulation pocket. Alternate: still wave 4 of a larger 3.",
        thesis: sitLead
          ? `Accumulation in ${name} waits on Bitcoin.`
          : `Buy target 1: ${name} around ${money(symbol, d1Px)}. That is the first dip of the last push. Stop ${money(symbol, lock.invalidation)}. If it never tags, do not buy.`,
        why: [
          `Buy at ${money(symbol, d1Px)} — not above it.`,
          `Stop ${money(symbol, lock.invalidation)} · first harvest ${money(symbol, lock.tp1)}`,
          inBand ? "Price is at buy target 1." : "Wait for this price. Do not chase.",
        ],
        waitFor: `Price tags ${money(symbol, d1Px)}.`,
        setupScore: setupScore(sc.total, sc.rr, actionable === "take", sitLead),
        actionable,
        lock,
      }),
    );
  }
  {
    const lock = makeLock({
      id: `opt_${symbol}_diamond_2`,
      symbol,
      bias: "long",
      waveRole: 3,
      w1Start: origin,
      w1End: high,
      w2End: dip,
      mark,
      sitOut: sitLead,
      alternate: "Deeper dip that loses origin is a failed bag.",
      notes: "diamond-2",
      invalidation: d2Px * 0.96,
      tp1: firstDip,
      tp2: high,
    });
    const sc = score(lock);
    const inBand = mark <= d2Px * 1.02 && mark >= lock.invalidation;
    const actionable: Actionable = sitLead ? "sit" : inBand && !sc.hardFail ? "take" : "wait";
    diamonds.push(
      op({
        id: lock.id,
        rank: 2,
        mode: "diamond",
        title: `${name} buy target 2 — deeper dip`,
        summary: "Accumulate lot 2. Only if it gets cheaper.",
        wave: "Possible deep wave 2. Second lot only. Alternate: the 2 is becoming a deeper correction.",
        thesis: `Buy target 2: ${name} around ${money(symbol, d2Px)}. Second lot only at this price or lower. Stop ${money(symbol, lock.invalidation)}. First bounce ${money(symbol, lock.tp1)}.`,
        why: [
          `Buy at ${money(symbol, d2Px)} — not above it.`,
          `Stop ${money(symbol, lock.invalidation)} · bounce ${money(symbol, lock.tp1)}`,
          inBand ? "Price is at buy target 2." : "Not at this target yet.",
        ],
        waitFor: `Price tags ${money(symbol, d2Px)}.`,
        setupScore: setupScore(sc.total * 0.9, sc.rr, actionable === "take", sitLead),
        actionable,
        lock,
      }),
    );
  }
  {
    const lock = makeLock({
      id: `opt_${symbol}_diamond_3`,
      symbol,
      bias: "long",
      waveRole: 3,
      w1Start: origin,
      w1End: high,
      w2End: dip,
      mark,
      sitOut: sitLead,
      alternate: "A break of origin ends the bag.",
      notes: "diamond-3",
      invalidation: origin * 0.978,
      tp1: d2Px,
      tp2: firstDip,
    });
    const sc = score(lock);
    const inBand = mark <= d3Px * 1.02 && mark >= lock.invalidation;
    const actionable: Actionable = sitLead ? "sit" : inBand && !sc.hardFail ? "take" : "sit";
    diamonds.push(
      op({
        id: lock.id,
        rank: 3,
        mode: "diamond",
        title: `${name} buy target 3 — washout`,
        summary: "Accumulate lot 3. Panic dip only. Never buy a breakdown.",
        wave: "Possible origin test / end of wave 2. If origin breaks, the bullish count is invalid.",
        thesis: `Buy target 3: ${name} around ${money(symbol, d3Px)}, only if the origin still holds. Stop ${money(symbol, lock.invalidation)}. If origin breaks, accumulation is wrong — no more adds.`,
        why: [
          `Buy at ${money(symbol, d3Px)} — last lot.`,
          `Origin must hold. Stop ${money(symbol, lock.invalidation)}.`,
          inBand ? "Price is at buy target 3." : "Do not buy until it gets this cheap.",
        ],
        waitFor: `Price tags ${money(symbol, d3Px)} and origin holds.`,
        setupScore: setupScore(sc.total * 0.7, sc.rr, actionable === "take", true),
        actionable,
        lock,
      }),
    );
  }

  return [...longs, ...shorts, ...diamonds];
}

export function scanOpportunities(
  btc: MarketBundle | undefined,
  doge: MarketBundle | undefined,
  settings: DeskSettings,
  equity: number,
): Opportunity[] {
  const btcC = btc?.candles ?? [];
  const dogeC = doge?.candles ?? [];
  const lead = btcLeadFromCandles(btcC, settings);
  const btcOps = scanBook("BTC-USD", btcC, btcC, settings, equity, lead.blocked);
  const dogeOps = scanBook("DOGE-USD", dogeC, btcC, settings, equity, lead.blocked);

  const stamp = (ops: Opportunity[], bundle?: MarketBundle) => {
    const tv = bundle?.tv;
    if (!tv) return ops;
    return ops.map((o) => {
      const aligned = (o.lock.bias === "long" && tv.recAll >= 0) || (o.lock.bias === "short" && tv.recAll < 0);
      return {
        ...o,
        why: [`Tape ${tv.rating} · RSI ${tv.rsi.toFixed(0)}`, ...o.why],
        thesis: `${o.thesis}`,
        setupScore: Math.max(8, Math.min(92, o.setupScore + (aligned ? 6 : -6))),
      };
    });
  };

  return [...stamp(btcOps, btc), ...stamp(dogeOps, doge)];
}

export function opsFor(ops: Opportunity[], symbol: SymbolId, mode: DeskMode): Opportunity[] {
  return ops.filter((o) => o.lock.symbol === symbol && o.mode === mode).slice(0, 3);
}
