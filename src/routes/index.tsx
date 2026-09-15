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
    void navigate({
      to: "/",
      search: { symbol: next.symbol ?? symbol, mode: next.mode ?? mode },
    });
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
            <button
              key={s}
              type="button"
              onClick={() => go({ symbol: s })}
              className={cn(
                "min-h-11 flex-1 rounded-md text-sm font-medium transition-colors duration-150",
                symbol === s ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "BTC-USD" ? "Bitcoin" : "Dogecoin"}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1 rounded-lg bg-secondary p-1">
          {(
            [
              ["long", "Long"],
              ["short", "Short"],
              ["diamond", "Diamond hand"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => go({ mode: id })}
              className={cn(
                "min-h-11 flex-1 rounded-md text-sm font-medium transition-colors duration-150",
                mode === id ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="font-mono text-3xl tabular-nums tracking-tight md:text-4xl">
            {price ? formatPrice(price, symbol) : "—"}
          </p>
          {bundle?.ticker ? (
            <span className={cn("font-mono text-sm", bundle.ticker.changePct24h >= 0 ? "text-long" : "text-short")}>
              {formatPct(bundle.ticker.changePct24h)}
            </span>
          ) : null}
          <FeedBadge source={bundle?.source} asOf={bundle?.ticker.asOf} />
          {tv ? (
            <Badge variant={tv.recAll >= 0.1 ? "long" : tv.recAll <= -0.1 ? "short" : "wait"}>
              TV {tv.rating} · RSI {tv.rsi.toFixed(0)}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="px-4 pt-4 md:px-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={chart === "desk" ? "secondary" : "ghost"} onClick={() => setChart("desk")}>
            Chart
          </Button>
          <Button size="sm" variant={chart === "tv" ? "secondary" : "ghost"} onClick={() => setChart("tv")}>
            TradingView
          </Button>
          <div className="ml-auto flex gap-1">
            {TIMEFRAMES.map((t) => (
              <Button key={t} size="sm" variant={tf === t ? "secondary" : "ghost"} onClick={() => setTf(t as Timeframe)}>
                {t}
              </Button>
            ))}
          </div>
        </div>
        {chart === "tv" ? (
          <TradingViewFrame symbol={symbol} tf={tf} height={420} />
        ) : (
          <Card className="overflow-hidden p-2">
            <CandleChart candles={bundle?.candles ?? []} lock={selected?.lock} height={380} />
          </Card>
        )}
        <p className="mt-1 text-[0.6875rem] text-muted-foreground">
          {bundle?.candles.length
            ? `${bundle.candles.length} ${tf} candles · ${bundle.source}`
            : "Loading candles…"}
        </p>
      </div>

      <div className="grid gap-6 p-4 md:grid-cols-2 md:p-6">
        <div className="flex flex-col gap-5">
          <PriceTape lock={selected?.lock} price={price} symbol={symbol} />
          <AnalysisDiagram lock={selected?.lock} price={price} symbol={symbol} option={selected} />
        </div>
        <section>
          <h2 className="text-lg font-medium tracking-tight">
            {mode === "diamond" ? "Three dip buys" : mode === "short" ? "Three shorts" : "Three longs"}
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            {mode === "diamond"
              ? "Three buy targets. Accumulate only when price tags the level."
              : mode === "short"
                ? "A short is a bet price goes down. Stop above the idea."
                : "A long is a bet price goes up. Stop under the idea."}
          </p>
          {working.length ? (
            <div className="mb-3 flex flex-col gap-2">
              {working.map((p) => (
                <WorkingTicket
                  key={p.id}
                  pos={p}
                  price={price}
                  onFlatten={() => {
                    flatten(p.lockId, "Manual flatten");
                    toast("Flattened.");
                  }}
                />
              ))}
            </div>
          ) : null}
          <div className="flex flex-col gap-3">
            {ops.map((op) => (
              <TradeCard
                key={op.id}
                op={op}
                selected={selected?.id === op.id}
                onSelect={() => selectOption(op.id)}
                onPaper={() => paper(op)}
              />
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
  const label = source.includes("coinbase") ? "Live Coinbase" : source.includes("tv") ? "Live TV" : "Live";
  return <Badge variant="long">{label}</Badge>;
}

function WorkingTicket({
  pos,
  price,
  onFlatten,
}: {
  pos: PaperPosition;
  price: number;
  onFlatten: () => void;
}) {
  const dir = pos.bias === "long" ? 1 : -1;
  const pnl = (price - pos.entry) * pos.size * dir;
  return (
    <Card className="border-primary/40">
      <CardContent className="flex flex-col gap-2 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Working paper {pos.bias}</p>
          <Badge variant={pnl >= 0 ? "long" : "short"}>{formatUsd(pnl, 0)}</Badge>
        </div>
        <dl className="grid grid-cols-3 gap-2 font-mono text-[0.6875rem]">
          <div>
            <dt className="text-muted-foreground">Entry</dt>
            <dd>{formatPrice(pos.entry, pos.symbol)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Stop</dt>
            <dd>{formatPrice(pos.stop, pos.symbol)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">TP1</dt>
            <dd>{formatPrice(pos.tp1, pos.symbol)}</dd>
          </div>
        </dl>
        <Button size="sm" variant="destructive" onClick={onFlatten}>
          Flatten
        </Button>
      </CardContent>
    </Card>
  );
}

function TradeCard({
  op,
  selected,
  onSelect,
  onPaper,
}: {
  op: Opportunity;
  selected: boolean;
  onSelect: () => void;
  onPaper: () => void;
}) {
  const score = tradeScore(op);
  const rr = Number.isFinite(score.rr) ? score.rr : 0;
  const tone = actionableTone(op.actionable);
  return (
    <Card
      className={cn(
        "flex h-full cursor-pointer flex-col transition-[box-shadow] duration-150",
        selected && "shadow-[0_0_0_1px_rgba(154,171,186,0.5)]",
      )}
      onClick={onSelect}
    >
      <CardContent className="flex flex-1 flex-col gap-3 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-3xl leading-none text-primary">{op.rank}</span>
            <div>
              <p className="text-sm font-medium tracking-tight">{op.title}</p>
              <p className="text-xs text-muted-foreground">
                {op.lock.bias} · score {op.setupScore}{" "}
                <span className="text-muted-foreground/80">(setup quality, not a win-rate)</span>
              </p>
              <p className="mt-1 text-xs text-wait">{op.wave}</p>
            </div>
          </div>
          <Badge variant={tone.badge}>{tone.label}</Badge>
        </div>
        <p className="text-sm text-foreground">{op.thesis}</p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {op.why.map((w) => (
            <li key={w} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-3 gap-2 font-mono text-[0.6875rem]">
          <div>
            <dt className="text-muted-foreground">Stop</dt>
            <dd>{formatPrice(op.lock.invalidation, op.lock.symbol)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">TP1</dt>
            <dd>{formatPrice(op.lock.tp1, op.lock.symbol)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">R:R</dt>
            <dd>{rr.toFixed(1)}</dd>
          </div>
        </dl>
        <p className="text-xs text-wait">Wait for: {op.waitFor}</p>
        <div className="mt-auto pt-1">
          <Button
            size="sm"
            disabled={op.actionable === "sit"}
            onClick={(e) => {
              e.stopPropagation();
              onPaper();
            }}
          >
            {op.mode === "diamond"
              ? op.actionable === "take"
                ? "Paper this buy"
                : op.actionable === "wait"
                  ? "Wait for the buy target"
                  : "Sit"
              : op.actionable === "take"
                ? "Paper this trade"
                : op.actionable === "wait"
                  ? "Paper the wait"
                  : "Sit"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function actionableTone(a: Actionable): { label: string; badge: "long" | "wait" | "short" } {
  if (a === "take") return { label: "Take", badge: "long" };
  if (a === "wait") return { label: "Wait", badge: "wait" };
  return { label: "Sit", badge: "short" };
}
