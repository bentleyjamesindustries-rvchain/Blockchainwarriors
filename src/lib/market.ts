import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { atr, ema, last, swingHigh, swingLow } from "./indicators";
import type { LiveMark } from "./live";
import type { Candle, MarketBundle, SymbolId, Timeframe, Ticker, TvRating, TvTech } from "./types";

const Input = z.object({
  symbol: z.enum(["BTC-USD", "DOGE-USD"]),
  tf: z.enum(["1H", "4H", "1D"]),
  lookbackDays: z.number().min(30).max(1500).optional(),
  source: z.enum(["auto", "tradingview", "coingecko", "coinbase", "yahoo"]).optional(),
});

type Granularity = 3600 | 14400 | 86400;
type SourcePref = "auto" | "tradingview" | "coingecko" | "coinbase" | "yahoo";

const TV_TICKER: Record<SymbolId, string> = {
  "BTC-USD": "COINBASE:BTCUSD",
  "DOGE-USD": "COINBASE:DOGEUSD",
};

const CG_ID: Record<SymbolId, string> = {
  "BTC-USD": "bitcoin",
  "DOGE-USD": "dogecoin",
};

const TV_COLS = [
  "close",
  "change",
  "Recommend.All",
  "Recommend.MA",
  "Recommend.Other",
  "RSI",
  "EMA20",
  "EMA50",
  "EMA200",
  "ATR",
] as const;

function gran(tf: Timeframe): Granularity {
  if (tf === "1H") return 3600;
  if (tf === "4H") return 14400;
  return 86400;
}

function yahooInterval(tf: Timeframe): { interval: string; range: string } {
  if (tf === "1H") return { interval: "1h", range: "3mo" };
  if (tf === "4H") return { interval: "1h", range: "6mo" };
  return { interval: "1d", range: "2y" };
}

const cache = new Map<string, { at: number; bundle: MarketBundle }>();
const tvCache = new Map<string, { at: number; tech: TvTech }>();
const TTL = 20_000;
const TV_TTL = 12_000;
const CG_TTL = 90_000;

function seedFor(symbol: SymbolId): number {
  let h = 2166136261;
  for (const ch of symbol) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function mulberry32(a: number) {
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function synthCandles(symbol: SymbolId, tf: Timeframe, n = 240): Candle[] {
  const rand = mulberry32(seedFor(symbol) + gran(tf));
  const step = gran(tf);
  const now = Math.floor(Date.now() / 1000);
  const start = now - n * step;
  let px = symbol === "BTC-USD" ? 79_750 : 0.0898;
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const t = start + i * step;
    const drift = symbol === "BTC-USD" ? 0.00025 : 0.00015;
    const shock = rand() > 0.97 ? (rand() - 0.4) * 0.04 : 0;
    const vol = (symbol === "BTC-USD" ? 0.012 : 0.028) * (0.6 + rand());
    const ret = drift + (rand() - 0.48) * vol + shock;
    const open = px;
    const close = Math.max(px * (1 + ret), symbol === "BTC-USD" ? 1000 : 0.00001);
    const high = Math.max(open, close) * (1 + rand() * vol * 0.35);
    const low = Math.min(open, close) * (1 - rand() * vol * 0.35);
    const volume = (symbol === "BTC-USD" ? 1800 : 4_200_000) * (0.4 + rand());
    out.push({ time: t, open, high, low, close, volume });
    px = close;
  }
  const a = out.length - 70;
  const b = out.length - 40;
  const c = out.length - 18;
  if (a > 0) {
    const base = out[a]!.close;
    for (let i = a; i < b; i++) {
      const p = (i - a) / (b - a);
      const target = base * (1 + 0.18 * p);
      const candle = out[i]!;
      candle.open = i === a ? base : out[i - 1]!.close;
      candle.close = target;
      candle.high = Math.max(candle.open, candle.close) * 1.004;
      candle.low = Math.min(candle.open, candle.close) * 0.997;
    }
    const peak = out[b - 1]!.close;
    for (let i = b; i < c; i++) {
      const p = (i - b) / (c - b);
      const target = peak * (1 - 0.55 * p);
      const candle = out[i]!;
      candle.open = out[i - 1]!.close;
      candle.close = target;
      candle.high = Math.max(candle.open, candle.close) * 1.003;
      candle.low = Math.min(candle.open, candle.close) * 0.996;
    }
  }
  return out;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 BlockchainWarriorsPaperDesk/1.0",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export function tvRating(rec: number): TvRating {
  if (rec >= 0.5) return "Strong Buy";
  if (rec >= 0.1) return "Buy";
  if (rec <= -0.5) return "Strong Sell";
  if (rec <= -0.1) return "Sell";
  return "Neutral";
}

function pack(symbol: SymbolId, tf: Timeframe, candles: Candle[], source: string, tv: TvTech | null): MarketBundle {
  const ordered = [...candles].sort((a, b) => a.time - b.time);
  const live = tv?.price && tv.price > 0 ? tv.price : null;
  if (live && ordered.length) {
    const i = ordered.length - 1;
    const c = ordered[i]!;
    ordered[i] = {
      ...c,
      close: live,
      high: Math.max(c.high, live),
      low: Math.min(c.low, live),
    };
  }
  const lastC = last(ordered);
  const dayAgo = (lastC?.time ?? 0) - 86400;
  const ref = [...ordered].reverse().find((c) => c.time <= dayAgo) ?? ordered[Math.max(0, ordered.length - 24)];
  const price = live ?? lastC?.close ?? 0;
  const open24h = ref?.close ?? price;
  const changePct = tv?.changePct != null ? tv.changePct / 100 : open24h ? (price - open24h) / open24h : 0;
  const ticker: Ticker = {
    symbol,
    price,
    open24h,
    change24h: price - open24h,
    changePct24h: changePct,
    source: tv ? `${source}+tv` : source,
    asOf: Date.now(),
  };
  const closes = ordered.map((c) => c.close);
  return {
    symbol,
    tf,
    candles: ordered,
    ticker,
    source: ticker.source,
    ema21: last(ema(closes, 21)),
    ema50: last(ema(closes, 50)),
    atr: last(atr(ordered, 14)),
    swingHigh: swingHigh(ordered, 40),
    swingLow: swingLow(ordered, 40),
    tv,
  };
}

async function fromTradingView(symbol: SymbolId): Promise<TvTech> {
  const hit = tvCache.get(symbol);
  if (hit && Date.now() - hit.at < TV_TTL) return hit.tech;
  const ticker = TV_TICKER[symbol];
  const raw = (await fetchJson("https://scanner.tradingview.com/crypto/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      symbols: { tickers: [ticker], query: { types: [] } },
      columns: [...TV_COLS],
    }),
  })) as { data?: Array<{ s: string; d: number[] }> };
  const row = raw.data?.[0]?.d;
  if (!row || row[0] == null) throw new Error("empty tradingview");
  const recAll = Number(row[2] ?? 0);
  const tech: TvTech = {
    symbol,
    ticker,
    price: Number(row[0]),
    changePct: Number(row[1] ?? 0),
    recAll,
    recMA: Number(row[3] ?? 0),
    recOsc: Number(row[4] ?? 0),
    rsi: Number(row[5] ?? 0),
    ema20: row[6] != null ? Number(row[6]) : null,
    ema50: row[7] != null ? Number(row[7]) : null,
    ema200: row[8] != null ? Number(row[8]) : null,
    atr: row[9] != null ? Number(row[9]) : null,
    rating: tvRating(recAll),
    asOf: Date.now(),
  };
  if (!Number.isFinite(tech.price) || tech.price <= 0) throw new Error("bad tv price");
  tvCache.set(symbol, { at: Date.now(), tech });
  return tech;
}

async function fromCoinGecko(symbol: SymbolId, tf: Timeframe): Promise<Candle[]> {
  const id = CG_ID[symbol];
  const days = tf === "1H" ? 2 : tf === "4H" ? 30 : 90;
  const raw = (await fetchJson(
    `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=${days}`,
  )) as unknown;
  if (!Array.isArray(raw) || raw.length < 10) throw new Error("empty coingecko");
  const candles: Candle[] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const time = Math.floor(Number(row[0]) / 1000);
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    if (!Number.isFinite(close) || !Number.isFinite(time)) continue;
    candles.push({ time, open, high, low, close, volume: 0 });
  }
  if (candles.length < 10) throw new Error("few coingecko");
  if (tf === "1H") return collapse(candles, 3600);
  if (tf === "4H") return collapse(candles, 14400);
  return candles;
}

async function fromCoinGeckoPrice(symbol: SymbolId): Promise<{ price: number; changePct: number }> {
  const id = CG_ID[symbol];
  const raw = (await fetchJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`,
  )) as Record<string, { usd?: number; usd_24h_change?: number }>;
  const price = raw[id]?.usd;
  if (!price) throw new Error("empty cg price");
  return { price, changePct: raw[id]?.usd_24h_change ?? 0 };
}

async function fromCoinbase(symbol: SymbolId, tf: Timeframe, lookbackDays: number): Promise<Candle[]> {
  const g = gran(tf);
  const end = Math.floor(Date.now() / 1000);
  const start = end - Math.min(lookbackDays, 400) * 86400;
  const product = symbol;
  const url = `https://api.exchange.coinbase.com/products/${product}/candles?granularity=${g}&start=${new Date(start * 1000).toISOString()}&end=${new Date(end * 1000).toISOString()}`;
  const raw = (await fetchJson(url)) as number[][];
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("empty coinbase");
  return raw
    .map((row) => ({
      time: Number(row[0]),
      low: Number(row[1]),
      high: Number(row[2]),
      open: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    }))
    .filter((c) => Number.isFinite(c.close));
}

async function fromYahoo(symbol: SymbolId, tf: Timeframe): Promise<Candle[]> {
  const { interval, range } = yahooInterval(tf);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
  const json = (await fetchJson(url)) as {
    chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ open?: number[]; high?: number[]; low?: number[]; close?: number[]; volume?: number[] }> } }> };
  };
  const result = json.chart?.result?.[0];
  const ts = result?.timestamp;
  const q = result?.indicators?.quote?.[0];
  if (!ts || !q?.close) throw new Error("empty yahoo");
  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const close = q.close[i];
    const open = q.open?.[i];
    const high = q.high?.[i];
    const low = q.low?.[i];
    if (close == null || open == null || high == null || low == null) continue;
    candles.push({
      time: ts[i]!,
      open,
      high,
      low,
      close,
      volume: q.volume?.[i] ?? 0,
    });
  }
  if (tf === "4H") return collapse(candles, 4 * 3600);
  return candles;
}

function collapse(candles: Candle[], bucket: number): Candle[] {
  const map = new Map<number, Candle>();
  for (const c of candles) {
    const t = Math.floor(c.time / bucket) * bucket;
    const prev = map.get(t);
    if (!prev) {
      map.set(t, { ...c, time: t });
    } else {
      prev.high = Math.max(prev.high, c.high);
      prev.low = Math.min(prev.low, c.low);
      prev.close = c.close;
      prev.volume += c.volume;
    }
  }
  return [...map.values()].sort((a, b) => a.time - b.time);
}

async function loadTv(symbol: SymbolId): Promise<TvTech | null> {
  try {
    return await fromTradingView(symbol);
  } catch {
    return null;
  }
}

async function loadBundle(
  symbol: SymbolId,
  tf: Timeframe,
  lookbackDays: number,
  source: SourcePref,
): Promise<MarketBundle> {
  const key = `${symbol}:${tf}:${source}:v2`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (source === "coingecko" ? CG_TTL : TTL)) return hit.bundle;

  const tv = source === "yahoo" || source === "coinbase" ? null : await loadTv(symbol);

  const attempts: Array<() => Promise<MarketBundle>> = [];
  const wantCg = source === "auto" || source === "coingecko" || source === "tradingview";
  const wantCb = source === "auto" || source === "coinbase" || source === "tradingview";
  const wantYh = source === "auto" || source === "yahoo" || source === "tradingview";

  if (wantCb) attempts.push(async () => pack(symbol, tf, await fromCoinbase(symbol, tf, lookbackDays), "coinbase", tv));
  if (wantYh) attempts.push(async () => pack(symbol, tf, await fromYahoo(symbol, tf), "yahoo", tv));
  if (wantCg) attempts.push(async () => pack(symbol, tf, await fromCoinGecko(symbol, tf), "coingecko", tv));
  attempts.push(async () => pack(symbol, tf, synthCandles(symbol, tf), "demo", tv));

  let lastErr: unknown;
  for (const run of attempts) {
    try {
      const bundle = await run();
      if (bundle.candles.length < 20) throw new Error("too few candles");
      cache.set(key, { at: Date.now(), bundle });
      return bundle;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("market fetch failed");
}

export function demoBundle(symbol: SymbolId, tf: Timeframe): MarketBundle {
  return pack(symbol, tf, synthCandles(symbol, tf), "demo", null);
}

export const fetchMarket = createServerFn({ method: "POST" })
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<MarketBundle> => {
    return loadBundle(data.symbol, data.tf, data.lookbackDays ?? 400, data.source ?? "auto");
  });

export const fetchUniverse = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        tf: z.enum(["1H", "4H", "1D"]).optional(),
        lookbackDays: z.number().optional(),
        source: z.enum(["auto", "tradingview", "coingecko", "coinbase", "yahoo"]).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }): Promise<{ btc: MarketBundle; doge: MarketBundle }> => {
    const tf = data.tf ?? "1D";
    const lookbackDays = data.lookbackDays ?? 400;
    const source = data.source ?? "auto";
    const [btc, doge] = await Promise.all([
      loadBundle("BTC-USD", tf, lookbackDays, source),
      loadBundle("DOGE-USD", tf, lookbackDays, source),
    ]);
    return { btc, doge };
  });

async function cbMark(symbol: SymbolId): Promise<LiveMark> {
  const tick = (await fetchJson(`https://api.exchange.coinbase.com/products/${symbol}/ticker`)) as { price?: string };
  const price = Number(tick.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error("bad coinbase last");
  let open24h = price;
  try {
    const stats = (await fetchJson(`https://api.exchange.coinbase.com/products/${symbol}/stats`)) as { open?: string };
    const o = Number(stats.open);
    if (Number.isFinite(o) && o > 0) open24h = o;
  } catch {
    /* last is enough */
  }
  return {
    symbol,
    price,
    open24h,
    changePct24h: open24h ? (price - open24h) / open24h : 0,
    source: "coinbase",
    asOf: Date.now(),
  };
}

export const fetchLiveTickers = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ btc: LiveMark; doge: LiveMark }> => {
    const [btc, doge] = await Promise.all([cbMark("BTC-USD"), cbMark("DOGE-USD")]);
    return { btc, doge };
  },
);

export const fetchQuotes = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ btc: TvTech | null; doge: TvTech | null }> => {
    const [btc, doge] = await Promise.all([loadTv("BTC-USD"), loadTv("DOGE-USD")]);
    if (!btc) {
      try {
        const p = await fromCoinGeckoPrice("BTC-USD");
        const fallback: TvTech = {
          symbol: "BTC-USD",
          ticker: "COINGECKO:BTC",
          price: p.price,
          changePct: p.changePct,
          recAll: 0,
          recMA: 0,
          recOsc: 0,
          rsi: 50,
          ema20: null,
          ema50: null,
          ema200: null,
          atr: null,
          rating: "Neutral",
          asOf: Date.now(),
        };
        return { btc: fallback, doge: await loadTv("DOGE-USD") };
      } catch {
        /* keep null */
      }
    }
    if (!doge) {
      try {
        const p = await fromCoinGeckoPrice("DOGE-USD");
        return {
          btc,
          doge: {
            symbol: "DOGE-USD",
            ticker: "COINGECKO:DOGE",
            price: p.price,
            changePct: p.changePct,
            recAll: 0,
            recMA: 0,
            recOsc: 0,
            rsi: 50,
            ema20: null,
            ema50: null,
            ema200: null,
            atr: null,
            rating: "Neutral",
            asOf: Date.now(),
          },
        };
      } catch {
        /* keep null */
      }
    }
    return { btc, doge };
  },
);
