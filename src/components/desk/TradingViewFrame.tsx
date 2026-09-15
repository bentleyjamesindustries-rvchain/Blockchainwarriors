import { useMemo } from "react";
import type { SymbolId, Timeframe } from "@/lib/types";

const TV_SYMBOL: Record<SymbolId, string> = { "BTC-USD": "COINBASE:BTCUSD", "DOGE-USD": "COINBASE:DOGEUSD" };
function tvInterval(tf: Timeframe): string {
  if (tf === "1H") return "60";
  if (tf === "4H") return "240";
  return "D";
}
export function TradingViewFrame({ symbol, tf, height = 460 }: { symbol: SymbolId; tf: Timeframe; height?: number }) {
  const src = useMemo(() => {
    const params = new URLSearchParams({
      symbol: TV_SYMBOL[symbol], interval: tvInterval(tf), theme: "dark", style: "1", locale: "en",
      timezone: "America/New_York", toolbarbg: "07080a", hideideas: "1", withdateranges: "1",
    });
    return `https://www.tradingview.com/widgetembed/?${params.toString()}`;
  }, [symbol, tf]);
  return <iframe title={`TradingView ${symbol}`} src={src} className="w-full rounded-lg border border-border bg-background" style={{ height }} loading="lazy" tabIndex={-1} referrerPolicy="origin-when-cross-origin" allow="clipboard-write" />;
}
