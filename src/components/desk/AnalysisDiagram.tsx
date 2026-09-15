import { impulseChannel } from "@/lib/indicators";
import { formatPrice } from "@/lib/format";
import type { Opportunity, SymbolId, ThesisLock } from "@/lib/types";

export function AnalysisDiagram({
  lock, price, symbol, option,
}: {
  lock: ThesisLock | undefined;
  price: number;
  symbol: SymbolId;
  option?: Opportunity;
}) {
  if (!lock || !price) {
    return <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Mapping the last swing.</div>;
  }
  const long = lock.bias === "long";
  const origin = lock.pivots.w1Start;
  const high = lock.pivots.w1End;
  const dip = lock.pivots.w2End;
  const ch = impulseChannel(lock.pivots);
  const prices = [origin, high, dip, price, lock.invalidation, lock.tp1];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const x = (i: number) => 36 + i * 52;
  const y = (p: number) => 150 - ((p - min) / span) * 120;
  const points = [
    { x: x(0), y: y(origin), label: "Origin" },
    { x: x(1), y: y(high), label: long ? "High" : "Low" },
    { x: x(2), y: y(dip), label: "Dip" },
    { x: x(3), y: y(price), label: "Now" },
    { x: x(4), y: y(lock.tp1), label: "Target" },
  ];
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const dead = long ? price < lock.invalidation : price > lock.invalidation;
  const chasing = long ? price > high : price < high;
  const phase = dead ? "Price already took out the stop. This idea is done." : chasing ? "Price already ran. Wait for a pullback — don't chase." : "Last push and dip mapped. Looking for the dip to hold.";
  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-5">
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Analysis</p>
      <p className="mt-1 text-sm font-medium tracking-tight">{long ? "Long" : "Short"} · stop {formatPrice(lock.invalidation, symbol)}</p>
      <svg viewBox="0 0 300 180" className="mt-3 h-44 w-full" role="img" aria-label="Price path with current price">
        <line x1="28" y1={y(ch.baseA)} x2="280" y2={y(ch.baseB)} stroke="#3d6d8c" strokeWidth="1" opacity="0.7" />
        <line x1="28" y1={y(ch.parallelA)} x2="280" y2={y(ch.parallelB)} stroke="#3d6d8c" strokeWidth="1" opacity="0.7" />
        <line x1="28" y1={y(lock.invalidation)} x2="280" y2={y(lock.invalidation)} stroke="#c45c4a" strokeDasharray="4 4" strokeWidth="1" />
        <line x1="28" y1={y(lock.tp1)} x2="280" y2={y(lock.tp1)} stroke="#3f9d72" strokeDasharray="4 4" strokeWidth="1" />
        <path d={d} fill="none" stroke="#9aabba" strokeWidth="2" />
        {points.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r={p.label === "Now" ? 5 : 3} fill={p.label === "Now" ? "#e6e4dc" : "#9aabba"} />
            <text x={p.x} y={p.y - 8} textAnchor="middle" fill="#8b9088" fontSize="9">{p.label}</text>
          </g>
        ))}
      </svg>
      <p className="text-sm text-muted-foreground">{phase}</p>
      {option ? <p className="mt-2 text-sm text-foreground">{option.thesis}</p> : null}
    </div>
  );
}
