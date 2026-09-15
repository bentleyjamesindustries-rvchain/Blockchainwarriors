import type { Candle, SymbolId, Timeframe } from "./types";

export interface LiveMark {
  symbol: SymbolId;
  price: number;
  open24h: number;
  changePct24h: number;
  source: string;
  asOf: number;
}

async function stats(product: SymbolId): Promise<LiveMark> {
  const [tickRes, statRes] = await Promise.all([
    fetch(`https://api.exchange.coinbase.com/products/${product}/ticker`, {
      headers: { accept: "application/json" },
    }),
    fetch(`https://api.exchange.coinbase.com/products/${product}/stats`, {
      headers: { accept: "application/json" },
    }),
  ]);
  if (!tickRes.ok) throw new Error(`coinbase ticker ${tickRes.status}`);
  const tick = (await tickRes.json()) as { price?: string };
  const price = Number(tick.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error("bad coinbase last");
  let open24h = price;
  if (statRes.ok) {
    const raw = (await statRes.json()) as { open?: string };
    const o = Number(raw.open);
    if (Number.isFinite(o) && o > 0) open24h = o;
  }
  return {
    symbol: product,
    price,
    open24h,
    changePct24h: open24h ? (price - open24h) / open24h : 0,
    source: "coinbase",
    asOf: Date.now(),
  };
}

export async function fetchLiveMarks(): Promise<{ btc: LiveMark; doge: LiveMark }> {
  const [btc, doge] = await Promise.all([stats("BTC-USD"), stats("DOGE-USD")]);
  return { btc, doge };
}

function gran(tf: Timeframe): 3600 | 14400 | 86400 {
  if (tf === "1H") return 3600;
  if (tf === "4H") return 14400;
  return 86400;
}

export async function fetchLiveCandles(symbol: SymbolId, tf: Timeframe): Promise<Candle[]> {
  const g = gran(tf);
  const res = await fetch(`https://api.exchange.coinbase.com/products/${symbol}/candles?granularity=${g}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`coinbase candles ${res.status}`);
  const raw = (await res.json()) as number[][];
  if (!Array.isArray(raw) || raw.length < 2) throw new Error("empty candles");
  return raw
    .map((row) => ({
      time: Number(row[0]),
      low: Number(row[1]),
      high: Number(row[2]),
      open: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5] ?? 0),
    }))
    .filter((c) => Number.isFinite(c.close) && Number.isFinite(c.time))
    .sort((a, b) => a.time - b.time);
}
