import { fibBand } from "@/lib/engine";
import { formatPrice } from "@/lib/format";
import type { SymbolId, ThesisLock } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Level { id: string; label: string; price: number; kind: "inv" | "fib" | "now" | "tp"; }

export function PriceTape({ lock, price, symbol }: { lock: ThesisLock | undefined; price: number; symbol: SymbolId }) {
  if (!lock || !price) return <p className="text-sm text-muted-foreground">Waiting on a live mark.</p>;
  const band = fibBand(lock);
  const levels: Level[] = [
    { id: "tp2", label: "Target 2", price: lock.tp2, kind: "tp" },
    { id: "tp1", label: "Target 1", price: lock.tp1, kind: "tp" },
    { id: "now", label: "You are here", price, kind: "now" },
    { id: "fifty", label: "Pullback", price: band.fifty, kind: "fib" },
    { id: "gz", label: "Deep pullback", price: band.gz, kind: "fib" },
    { id: "inv", label: "Stop", price: lock.invalidation, kind: "inv" },
  ].sort((a, b) => b.price - a.price);
  const long = lock.bias === "long";
  const vsInv = long ? price - lock.invalidation : lock.invalidation - price;
  const vsTp = long ? lock.tp1 - price : price - lock.tp1;
  const dead = vsInv < 0;
  return (
    <div>
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Where price is</p>
      <p className="mt-1 text-sm text-muted-foreground">{dead ? "On the wrong side of the stop — this count is dead." : `${formatPrice(Math.abs(vsInv), symbol)} to the stop · ${formatPrice(Math.abs(vsTp), symbol)} to first target`}</p>
      <ol className="mt-3 divide-y divide-border rounded-lg border border-border">
        {levels.map((lv) => (
          <li key={lv.id} className={cn("flex items-center justify-between gap-3 px-3 py-2", lv.kind === "now" && "bg-secondary")}>
            <span className={cn("text-sm", lv.kind === "now" && "font-medium", lv.kind === "inv" && "text-short", lv.kind === "tp" && "text-long", lv.kind === "fib" && "text-muted-foreground")}>{lv.label}</span>
            <span className="font-mono text-sm tabular-nums">{formatPrice(lv.price, symbol)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
