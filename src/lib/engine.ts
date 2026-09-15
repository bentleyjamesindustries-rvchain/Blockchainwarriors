import {
  adxLike,
  atr,
  between,
  closesAbove,
  closesBelow,
  ema,
  fibRetrace,
  impulseChannel,
  isChop,
  last,
  near,
  pitchfork,
  reclaimed,
  returnN,
  taggedBand,
  volumeProfile,
} from "./indicators";
import type {
  Bias,
  BtcLead,
  Candle,
  ConfluenceChip,
  ConfluenceResult,
  DeskSettings,
  ThesisLock,
} from "./types";
import { lockGeometry, preferredW2, w2PastOrigin } from "./impulse";

export function btcLeadFromCandles(
  btc: Candle[],
  settings: DeskSettings,
): BtcLead {
  const ret20 = returnN(btc, Math.min(20, Math.max(2, btc.length - 1)));
  const closes = btc.map((c) => c.close);
  const e50 = ema(closes, 50);
  const lastClose = last(closes) ?? 0;
  const lastE50 = last(e50) ?? lastClose;
  const e50Prev = e50[Math.max(0, e50.length - 11)] ?? lastE50;
  const freefall = ret20 <= settings.btcLeadFreefallRet;
  const weak = lastClose < lastE50 && lastE50 < e50Prev;
  const blocked = freefall || weak;
  let note = "BTC regime OK — alts may take the pitch.";
  if (freefall) note = `BTC freefall (${(ret20 * 100).toFixed(1)}% / 20 bars) — alts sit.`;
  else if (weak) note = "BTC below a falling EMA50 — weak regime, alts wait.";
  return { ok: !blocked, blocked, freefall, weak, ret20, note };
}

export function fibBand(lock: ThesisLock): { lo: number; hi: number; mid: number; gz: number; fifty: number } {
  const start = lock.pivots.w2End;
  const end = lock.pivots.confirmation || lock.pivots.w1End;
  const fifty = fibRetrace(start, end, 0.5);
  const gz = fibRetrace(start, end, 0.618);
  return {
    lo: Math.min(fifty, gz),
    hi: Math.max(fifty, gz),
    mid: (fifty + gz) / 2,
    gz,
    fifty,
  };
}

export function overlapWave1(lock: ThesisLock, price: number): boolean {
  if (lock.bias === "long") {
    return price <= lock.pivots.w1Start;
  }
  return price >= lock.pivots.w1Start;
}

export function impulseConfirmed(lock: ThesisLock, candles: Candle[]): boolean {
  if (!candles.length) return false;
  const level = lock.pivots.confirmation;
  if (lock.bias === "long") return closesAbove(candles, level, 1) || last(candles)!.high > level;
  return closesBelow(candles, level, 1) || last(candles)!.low < level;
}

export function rrAt(lock: ThesisLock, entry: number): number {
  const risk = Math.abs(entry - lock.invalidation);
  const reward = Math.abs(lock.tp1 - entry);
  if (risk <= 0) return 0;
  return reward / risk;
}

export function riskPctFor(settings: DeskSettings, symbol: ThesisLock["symbol"]): number {
  return symbol === "DOGE-USD" ? (settings.dogeRiskPct ?? 0.75) : settings.riskPct;
}

export function positionSize(equity: number, riskPct: number, entry: number, stop: number): {
  size: number;
  riskAmount: number;
  stopDistance: number;
} {
  const stopDistance = Math.abs(entry - stop);
  const riskAmount = equity * (riskPct / 100);
  const size = stopDistance > 0 ? riskAmount / stopDistance : 0;
  return { size, riskAmount, stopDistance };
}

function chip(
  slug: string,
  name: string,
  status: ConfluenceChip["status"],
  score: number,
  note: string,
  affects: ConfluenceChip["affects"],
): ConfluenceChip {
  return { slug, name, status, score, note, affects };
}

export function scoreConfluence(opts: {
  lock: ThesisLock;
  candles: Candle[];
  htf: Candle[];
  btc: Candle[];
  settings: DeskSettings;
  price: number;
  equity: number;
}): ConfluenceResult {
  const { lock, candles, htf, btc, settings, price, equity } = opts;
  const enabled = settings.categories;
  const on = (slug: string) => enabled[slug] !== false;
  const a = last(atr(candles, 14)) ?? Math.abs(price) * 0.01;
  const band = fibBand(lock);
  const ch = impulseChannel(lock.pivots);
  const fork = pitchfork(lock.pivots);
  const vp = volumeProfile(candles.slice(-80));
  const chop = isChop(candles);
  const lead = btcLeadFromCandles(btc, settings);
  const impulse = impulseConfirmed(lock, candles);
  const inZone = between(price, band.lo - a * 0.15, band.hi + a * 0.15);
  const rr = rrAt(lock, price);
  const sizing = positionSize(equity, riskPctFor(settings, lock.symbol), price, lock.invalidation);
  const geo = lockGeometry(lock, price);

  const chips: ConfluenceChip[] = [];
  const hardReasons: string[] = [];
  let total = 0;

  const add = (c: ConfluenceChip) => {
    chips.push(c);
    if (c.status !== "hard_fail") total += c.score;
    if (c.status === "hard_fail") hardReasons.push(c.note);
  };

  if (!geo.valid || w2PastOrigin(lock.pivots.w1Start, lock.pivots.w1End, lock.pivots.w2End, lock.bias)) {
    add(chip("invalidation_road_maps", "Invalidation", "hard_fail", 0, "Count is invalid — stand down.", ["gate"]));
  } else if (lock.bias === "long" && lock.tp1 <= lock.pivots.w1End) {
    add(chip("impulse_wave_3_5", "Structure", "hard_fail", 0, "Projected continuation does not clear the prior high.", ["gate"]));
  } else if (lock.bias === "short" && lock.tp1 >= lock.pivots.w1End) {
    add(chip("impulse_wave_3_5", "Structure", "hard_fail", 0, "Projected continuation does not clear the prior low.", ["gate"]));
  }

  if (on("invalidation_road_maps")) {
    const hasAlt = lock.alternate.trim().length >= 8;
    const hasInv = lock.invalidation > 0;
    if (!hasInv) {
      add(chip("invalidation_road_maps", "Invalidation", "hard_fail", 0, "No invalidation locked.", ["gate"]));
    } else if (!hasAlt) {
      add(chip("invalidation_road_maps", "Invalidation", "hard_fail", 0, "Alternate count missing — write the other road.", ["gate", "checklist"]));
    } else {
      add(chip("invalidation_road_maps", "Invalidation", "pass", 1, "Invalidation + alternate on the ticket.", ["gate", "checklist"]));
    }
  }

  if (on("impulse_wave_3_5")) {
    const roleOk = lock.waveRole === 3 || lock.waveRole === 5;
    if (!roleOk) {
      add(chip("impulse_wave_3_5", "Structure", "hard_fail", 0, "Not a continuation setup.", ["gate"]));
    } else if (impulse) {
      add(chip("impulse_wave_3_5", "Structure", "pass", 1, "Continuation has printed.", ["confluence", "gate"]));
    } else {
      add(chip("impulse_wave_3_5", "Structure", "neutral", 0.25, "Waiting on a close through the last swing.", ["confluence"]));
    }
  }

  if (on("wave_2_depth_50_786")) {
    const ok = preferredW2(geo.w2Depth);
    add(
      chip(
        "wave_2_depth_50_786",
        "Retrace",
        ok ? "pass" : geo.w2Depth > 0.887 ? "fail" : "neutral",
        ok ? 1 : geo.w2Depth >= 0.382 && geo.w2Depth < 0.5 ? 0.4 : 0,
        ok ? "Retrace is in the high-probability pocket." : "Retrace is shallow or stretched.",
        ["confluence"],
      ),
    );
  }

  if (on("wave_4_vegas_38_2")) {
    const vegas = last(ema(candles.map((c) => c.close), 21));
    const inW4 = lock.waveRole === 5 && geo.w2Depth >= 0.236 && geo.w2Depth <= 0.5;
    const nearVegas = vegas != null && near(price, vegas, a, 0.5);
    const score = (inW4 ? 0.7 : 0) + (nearVegas ? 0.4 : 0);
    add(
      chip(
        "wave_4_vegas_38_2",
        "Pullback",
        score >= 0.7 ? "pass" : nearVegas ? "neutral" : "fail",
        score,
        inW4 ? "Pullback depth fits a continuation pause." : nearVegas ? "Holding the guide MA." : "Not a typical pause pocket.",
        ["confluence"],
      ),
    );
  }

  if (on("golden_zone_fib_confluence")) {
    const inGz = between(price, band.lo, band.hi) || taggedBand(candles, band.lo, band.hi, 6);
    const hvnBonus = vp ? vp.hvn.some((h) => near(h, band.gz, a, 0.6) || near(h, band.fifty, a, 0.6)) : false;
    const score = (inGz ? 1 : 0) + (hvnBonus ? 0.5 : 0);
    add(
      chip(
        "golden_zone_fib_confluence",
        "Golden zone",
        inGz ? "pass" : "neutral",
        score,
        inGz
          ? hvnBonus
            ? "Price in 0.50–GZ with HVN stack."
            : "Price reacting in the 0.50–0.618 band."
          : "Waiting for the 0.50 / golden tag — no blind limit.",
        ["confluence", "checklist"],
      ),
    );
  }

  if (on("algo_polls_front_run")) {
    const at50 = near(price, band.fifty, a, 0.4);
    const at65 = near(price, fibRetrace(lock.pivots.w2End, lock.pivots.w1End, 0.65), a, 0.4);
    const score = (at50 ? 0.7 : 0) + (at65 ? 0.4 : 0);
    add(
      chip(
        "algo_polls_front_run",
        "Algo polls",
        score >= 0.7 ? "pass" : score > 0 ? "neutral" : "fail",
        score,
        at50 ? "Front-run / tag of the 50." : at65 ? "Hovering the 65 flip." : "No algo 50/65 tag yet.",
        ["confluence"],
      ),
    );
  }

  if (on("median_andrews_schiff")) {
    const med = (fork.medianStart + fork.medianEnd) / 2;
    const tagged = near(price, med, a, 0.7) || near(price, fork.medianEnd, a, 0.55);
    add(
      chip(
        "median_andrews_schiff",
        "Median",
        tagged ? "pass" : "neutral",
        tagged ? 1 : 0.15,
        tagged ? "Price is on the median path of this swing." : "Median not tagged — the three pivots still frame the path.",
        ["confluence"],
      ),
    );
  }

  if (on("diagonals_overlap")) {
    const overlapped = overlapWave1(lock, lock.bias === "long" ? Math.min(price, lock.pivots.w2End) : Math.max(price, lock.pivots.w2End));
    if (overlapped && !lock.diagonalOk) {
      add(chip("diagonals_overlap", "Overlap", "hard_fail", 0, "Pullback took out the origin — this count is dead.", ["gate"]));
    } else if (overlapped && lock.diagonalOk) {
      add(chip("diagonals_overlap", "Overlap", "neutral", 0.2, "Overlap allowed — size down.", ["gate"]));
    } else {
      add(chip("diagonals_overlap", "Overlap", "pass", 0.8, "Pullback held above the origin.", ["confluence"]));
    }
  }

  if (on("channels_structure")) {
    const lo = Math.min(ch.baseA, ch.baseB);
    const hi = Math.max(ch.parallelA, ch.parallelB);
    const inside = price >= lo && price <= hi;
    const penetrated =
      lock.bias === "long" ? last(candles)?.high != null && last(candles)!.high > hi : last(candles)?.low != null && last(candles)!.low < lo;
    add(
      chip(
        "channels_structure",
        "Channel",
        penetrated && lock.waveRole === 3 ? "pass" : inside ? "pass" : "fail",
        penetrated ? 1 : inside ? 0.7 : 0,
        penetrated ? "Thrust through the channel — 3 hallmark." : inside ? "Still inside the impulse channel." : "Price left the channel — impulse may be done.",
        ["confluence", "gate"],
      ),
    );
  }

  if (on("corrective_abc_wxy_triangle")) {
    const range = candles.slice(-24);
    const hi = range.reduce((m, c) => Math.max(m, c.high), -Infinity);
    const lo = range.reduce((m, c) => Math.min(m, c.low), Infinity);
    const mid = last(candles)?.close ?? price;
    const coiled = hi > lo && (hi - lo) / mid < 0.06 && adxLike(candles, 14) < 0.16;
    add(
      chip(
        "corrective_abc_wxy_triangle",
        "Corrective",
        coiled ? "fail" : "pass",
        coiled ? 0 : 0.4,
        coiled ? "Triangle/range mush — sit lean." : "Not a stuck triangle on this window.",
        ["gate", "checklist"],
      ),
    );
  }

  if (on("patience_sit_out_r_r")) {
    if (lock.sitOut) {
      add(chip("patience_sit_out_r_r", "Sit-out", "hard_fail", 0, "Human sit-out is on. Wait for the pitch.", ["gate"]));
    } else if (chop) {
      add(chip("patience_sit_out_r_r", "Sit-out", "hard_fail", 0, "Chop flag (compressed ATR, no trend). No edge.", ["gate"]));
    } else if (rr < settings.minRr) {
      add(chip("patience_sit_out_r_r", "R:R", "hard_fail", 0, `R:R ${rr.toFixed(2)} < min ${settings.minRr}. Pass.`, ["gate"]));
    } else {
      add(chip("patience_sit_out_r_r", "R:R", "pass", 0.8, `R:R ${rr.toFixed(2)} to TP1. Edge is open.`, ["gate"]));
    }
  }

  if (on("multi_tf_fractal_dual_pair")) {
    const htfCloses = htf.map((c) => c.close);
    const htfEma = last(ema(htfCloses, 21));
    const htfPx = last(htfCloses);
    const aligned =
      htfPx != null &&
      htfEma != null &&
      ((lock.htfBias === "long" && htfPx >= htfEma) || (lock.htfBias === "short" && htfPx <= htfEma));
    add(
      chip(
        "multi_tf_fractal_dual_pair",
        "Multi-TF",
        aligned ? "pass" : "neutral",
        aligned ? 0.7 : 0.15,
        aligned ? "LTF thesis sits inside HTF map." : "HTF not aligned — tactical size only.",
        ["confluence", "checklist"],
      ),
    );
  }

  if (on("btc_lead_alts")) {
    if (lock.symbol === "BTC-USD") {
      add(chip("btc_lead_alts", "BTC lead", "pass", 0.5, "BTC never waits on alts.", ["gate"]));
    } else if (settings.enableBtcLead && lock.bias === "long" && lead.blocked) {
      add(chip("btc_lead_alts", "BTC lead", "hard_fail", 0, lead.note, ["gate"]));
    } else if (lock.bias === "long" && !lead.ok) {
      add(chip("btc_lead_alts", "BTC lead", "fail", 0, lead.note, ["gate"]));
    } else {
      add(chip("btc_lead_alts", "BTC lead", "pass", 1, lead.note, ["gate"]));
    }
  }

  if (on("general_crypto_ta")) {
    const sh = candles.slice(-20).reduce((m, c) => Math.max(m, c.high), -Infinity);
    const chasingAth = lock.bias === "long" && price >= sh * 0.995;
    const pocket = vp ? !near(price, vp.poc, a, 0.15) : true;
    const score = (chasingAth ? 0 : 0.5) + (pocket ? 0.4 : 0);
    add(
      chip(
        "general_crypto_ta",
        "Structure",
        chasingAth ? "fail" : "pass",
        score,
        chasingAth ? "Don't chase ATH / breakout. Wait the retrace." : pocket ? "Not camping dead-center POC." : "Sitting on POC — wait an edge.",
        ["confluence", "gate"],
      ),
    );
  }

  const hardFail = chips.some((c) => c.status === "hard_fail");
  const canArm =
    !hardFail &&
    !lock.sitOut &&
    impulse &&
    rr >= settings.minRr &&
    total >= settings.confluenceMin &&
    (lock.symbol !== "DOGE-USD" || lock.bias !== "long" || !lead.blocked || !settings.enableBtcLead);

  return {
    total,
    chips,
    hardFail,
    hardReasons,
    canArm,
    inZone,
    impulseConfirmed: impulse,
    chop,
    rr,
    size: sizing.size,
    stopDistance: sizing.stopDistance,
    riskAmount: sizing.riskAmount,
  };
}

export function entryTriggered(
  lock: ThesisLock,
  candles: Candle[],
  settings: DeskSettings,
  score: ConfluenceResult,
): boolean {
  if (!score.canArm) return false;
  const band = fibBand(lock);
  const level = (band.fifty + band.gz) / 2;
  if (settings.entryMode === "limit_zone") {
    return score.inZone;
  }
  return reclaimed(candles, level, lock.bias, 10) || (score.inZone && reclaimed(candles, band.fifty, lock.bias, 8));
}

export function shouldStop(lock: ThesisLock, price: number): boolean {
  return lock.bias === "long" ? price <= lock.invalidation : price >= lock.invalidation;
}

export function hitTp(lock: ThesisLock, price: number, which: 1 | 2): boolean {
  const tp = which === 1 ? lock.tp1 : lock.tp2;
  return lock.bias === "long" ? price >= tp : price <= tp;
}

export function channelBreakAgainst(lock: ThesisLock, candles: Candle[]): boolean {
  const ch = impulseChannel(lock.pivots);
  const lastC = last(candles);
  if (!lastC) return false;
  if (lock.bias === "long") return lastC.close < Math.min(ch.baseA, ch.baseB);
  return lastC.close > Math.max(ch.parallelA, ch.parallelB);
}

export function emaRegime(candles: Candle[]): { ema21: number | null; ema50: number | null; bias: Bias | "chop" } {
  const closes = candles.map((c) => c.close);
  const e21 = last(ema(closes, 21));
  const e50 = last(ema(closes, 50));
  const px = last(closes);
  let bias: Bias | "chop" = "chop";
  if (px != null && e21 != null && e50 != null) {
    if (px > e21 && e21 > e50) bias = "long";
    else if (px < e21 && e21 < e50) bias = "short";
  }
  return { ema21: e21, ema50: e50, bias };
}
