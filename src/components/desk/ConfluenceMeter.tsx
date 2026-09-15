import { cn } from "@/lib/utils";
import type { ConfluenceResult } from "@/lib/types";

const STATUS = {
  pass: "border-long/40 bg-long/10 text-long",
  fail: "border-short/40 bg-short/10 text-short",
  hard_fail: "border-short/60 bg-short/15 text-short",
  neutral: "border-border bg-secondary text-muted-foreground",
};

export function ConfluenceMeter({ score }: { score: ConfluenceResult }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Confluence</p>
          <p className="font-mono text-2xl tabular-nums">
            {score.total.toFixed(1)}
            <span className="ml-1 text-sm text-muted-foreground">hits</span>
          </p>
        </div>
        <p className="max-w-xs text-right text-xs text-muted-foreground">
          {score.hardFail
            ? score.hardReasons[0]
            : score.canArm
              ? "Filters pass. Waiting first retrace."
              : "Not yet a pitch — keep the alert, not the order."}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {score.chips.map((c) => (
          <span
            key={c.slug}
            title={`${c.note} · affects ${c.affects.join(", ")}`}
            className={cn(
              "rounded-full border px-2 py-1 text-[0.6875rem] tracking-wide uppercase",
              STATUS[c.status],
            )}
          >
            {c.name}
          </span>
        ))}
      </div>
    </div>
  );
}
