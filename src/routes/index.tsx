import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AnalysisDiagram } from "@/components/desk/AnalysisDiagram";
import { CandleChart } from "@/components/desk/CandleChart";
import { PriceTape } from "@/components/desk/PriceTape";
import { TradingViewFrame } from "@/components/desk/TradingViewFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPct, formatPrice, formatUsd } from "@/lib/format";
import { opsFor } from "@/lib/scan";
import { evaluateLock, useDeskStore } from "@/lib/store";
import {
  TIMEFRAMES,
  type Actionable,
  type DeskMode,
  type Opportunity,
  type PaperPosition,
  type SymbolId,
  type Timeframe,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Search = { symbol?: SymbolId; mode?: DeskMode };

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>): Search => {
    const search: Search = {};
    if (raw.symbol === "DOGE-USD" || raw.symbol === "BTC-USD") search.symbol = raw.symbol;
    if (raw.mode === "long" || raw.mode === "short" || raw.mode === "diamond") search.mode = raw.mode;
    return search;
  },
  component: DeskHome,
});

function tradeScore(op: Opportunity) {
  try {
    return evaluateLock(op.lock, useDeskStore.getState());
  } catch {
    return { rr: 0 };
  }
}

function DeskHome() {
  const search = Route.useSearch();
  const symbol: SymbolId = search.symbol === "DOGE-USD" ? "DOGE-USD" : "BTC-USD";
  const mode: DeskMode = search.mode === "short" || search.mode === "diamond" ? search.mode : "long";
  const navigate = useNavigate();
  const [chart, setChart] = useState<"tv" | "desk">("desk");
  const setTf = useDeskStore((s) => s.setTf);
  const bundle = useDeskStore((s) => s.markets[symbol]);
  const allOps = useDeskStore((s) => s.opportunities);
  const selectedId = useDeskStore((s) => s.selectedId);
  const selectOption = useDeskStore((s) => s.selectOption);
  const simulateFill = useDeskStore((s) => s.simulateFill);
  const flatten = useDeskStore((s) => s.flatten);
  const positions = useDeskStore((s) => s.positions);
  const tf = useDeskStore((s) => s.tf);
  const ops = opsFor(allOps, symbol, mode);
  const selected = ops.find((o) => o.id === selectedId) ?? ops[0];
  const working = positions.filter((p) => p.symbol === symbol);
  const price = bundle?.ticker.price ?? 0;
  const tv = bundle?.tv;

  function go(next: { symbol?: SymbolId; mode?: DeskMode }) {
    void navigate({ to: "/", search: { symbol: next.symbol ?? symbol, mode: next.mode ?? mode } });
  }

  function paper(op: Opportunity) {
    selectOption(op.id);
    if (op.actionable === "sit") {
      toast.error("This is a sit. Waiting is the trade.");
      return;
    }
    const r = simulateFill(op.lock.id);
    r.ok ? toast(r.reason) : toast.error(r.reason);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col">
      <div className="sticky top-14 z-30 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm md:px-6">
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {(["BTC-USD", "DOGE-USD"] as const).map((s) => (
            <button key={s} type="button" onClick={() => go({ symbol: s })} className={cn("min-h-11 flex-1 rounded-md text-sm font-medium", symbol === s ? "bg-background text-foreground" : "text-muted-foreground")}>
              {s === "BTC-USD" ? "Bitcoin" : "Dogecoin"}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1 rounded-lg bg-secondary p-1">
          {([["long", "Long"], ["short", "Short"], ["diamond", "Diamond hand"]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => go({ mode: id })} className={cn("min-h-11 flex-1 rounded-md text-sm font-medium", mode === id ? "bg-background text-foreground" : "text-muted-foreground")}>
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="font-mono text-3xl tabular-nums tracking-tight md:text-4xl">{price ? formatPrice(price, symbol) : "—"}</p>
          {bundle?.ticker ? <span className={cn("font-mono text-sm", bundle.ticker.changePct24h >= 0 ? "text-long" : "text-short")}>{formatPct(bundle.ticker.changePct24h)}</span> : null}
          <FeedBadge source={bundle?.source} asOf={bundle?.ticker.asOf} />
        </div>
      </div>
      <div className="px-4 pt-4 md:px-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={chart === "desk" ? "secondary" : "ghost"} onClick={() => setChart("desk")}>Chart</Button>
          <Button size="sm" variant={chart === "tv" ? "secondary" : "ghost"} onClick={() => setChart("tv")}>TradingView</Button>
          <div className="ml-auto flex gap-1">
            {TIMEFRAMES.map((t) => (
              <Button key={t} size="sm" variant={tf === t ? "secondary" : "ghost"} onClick={() => setTf(t as Timeframe)}>{t}</Button>
            ))}
          </div>
        </div>
        {chart === "tv" ? <TradingViewFrame symbol={symbol} tf={tf} height={420} /> : <Card className="overflow-hidden p-2"><CandleChart candles={bundle?.candles ?? []} lock={selected?.lock} height={380} /></Card>}
      </div>
      <div className="grid gap-6 p-4 md:grid-cols-2 md:p-6">
        <div className="flex flex-col gap-5">
          <PriceTape lock={selected?.lock} price={price} symbol={symbol} />
          <AnalysisDiagram lock={selected?.lock} price={price} symbol={symbol} option={selected} />
        </div>
        <section>
          <h2 className="text-lg font-medium tracking-tight">{mode === "diamond" ? "Three dip buys" : mode === "short" ? "Three shorts" : "Three longs"}</h2>
          <div className="mt-3 flex flex-col gap-3">
            {ops.map((op) => (
              <TradeCard key={op.id} op={op} selected={selected?.id === op.id} onSelect={() => selectOption(op.id)} onPaper={() => paper(op)} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function FeedBadge({ source, asOf }: { source?: string; asOf?: number }) {
  const age = asOf ? Date.now() - asOf : Number.POSITIVE_INFINITY;
  const demo = !source || source === "demo" || source.startsWith("demo");
  if (demo) return <Badge variant="wait">Demo tape</Badge>;
  if (age > 120_000) return <Badge variant="wait">Reconnecting…</Badge>;
  const label = source.includes("coinbase") ? "Live Coinbase" : "Live";
  return <Badge variant="long">{label}</Badge>;
}

function TradeCard({ op, selected, onSelect, onPaper }: { op: Opportunity; selected: boolean; onSelect: () => void; onPaper: () => void }) {
  const score = tradeScore(op);
  const rr = Number.isFinite(score.rr) ? score.rr : 0;
  const tone = op.actionable === "take" ? { label: "Take", badge: "long" as const } : op.actionable === "wait" ? { label: "Wait", badge: "wait" as const } : { label: "Sit", badge: "short" as const };
  return (
    <Card className={cn("flex cursor-pointer flex-col", selected && "shadow-[0_0_0_1px_rgba(154,171,186,0.5)]")} onClick={onSelect}>
      <CardContent className="flex flex-1 flex-col gap-3 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-3xl leading-none text-primary">{op.rank}</span>
            <div>
              <p className="text-sm font-medium tracking-tight">{op.title}</p>
              <p className="text-xs text-muted-foreground">{op.lock.bias} · score {op.setupScore} (setup quality, not a win-rate)</p>
              <p className="mt-1 text-xs text-wait">{op.wave}</p>
            </div>
          </div>
          <Badge variant={tone.badge}>{tone.label}</Badge>
        </div>
        <p className="text-sm text-foreground">{op.thesis}</p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {op.why.map((w) => (
            <li key={w} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" /><span>{w}</span></li>
          ))}
        </ul>
        <dl className="grid grid-cols-3 gap-2 font-mono text-[0.6875rem]">
          <div><dt className="text-muted-foreground">Stop</dt><dd>{formatPrice(op.lock.invalidation, op.lock.symbol)}</dd></div>
          <div><dt className="text-muted-foreground">TP1</dt><dd>{formatPrice(op.lock.tp1, op.lock.symbol)}</dd></div>
          <div><dt className="text-muted-foreground">R:R</dt><dd>{rr.toFixed(1)}</dd></div>
        </dl>
        <p className="text-xs text-wait">Wait for: {op.waitFor}</p>
        <Button size="sm" disabled={op.actionable === "sit"} onClick={(e) => { e.stopPropagation(); onPaper(); }}>
          {op.actionable === "sit" ? "Sit" : op.mode === "diamond" ? "Paper this buy" : "Paper this trade"}
        </Button>
      </CardContent>
    </Card>
  );
}
