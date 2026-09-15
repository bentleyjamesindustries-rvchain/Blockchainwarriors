import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { formatPrice, formatR, formatTime, formatUsd } from "@/lib/format";
import { useDeskStore } from "@/lib/store";
import { displaySymbol } from "@/lib/types";

export const Route = createFileRoute("/journal")({ component: JournalPage });

function JournalPage() {
  const journal = useDeskStore((s) => s.journal);
  const reset = useDeskStore((s) => s.resetPaper);

  function exportCsv() {
    const header = [
      "closed",
      "symbol",
      "bias",
      "wave",
      "entry",
      "exit",
      "size",
      "pnl",
      "r",
      "reason",
      "tags",
      "notes",
    ];
    const rows = journal.map((j) =>
      [
        new Date(j.closedAt).toISOString(),
        j.symbol,
        j.bias,
        j.waveRole,
        j.entry,
        j.exit,
        j.size,
        j.pnl,
        j.rMultiple,
        j.reason,
        j.confluenceTags.join("|"),
        j.notes.replaceAll(",", ";"),
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "warriors-journal.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const wins = journal.filter((j) => j.pnl > 0).length;
  const wr = journal.length ? wins / journal.length : 0;
  const avgR = journal.length ? journal.reduce((s, j) => s + j.rMultiple, 0) / journal.length : 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-widest text-muted-foreground uppercase">Paper book</p>
          <h1 className="text-2xl font-medium tracking-tight">Journal</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!journal.length}>
            Export CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset paper book
          </Button>
        </div>
      </header>
      <p className="font-mono text-sm text-muted-foreground">
        {journal.length} fills · win { (wr * 100).toFixed(0)}% · avg {avgR.toFixed(2)}R
      </p>
      {journal.length === 0 ? (
        <p className="text-sm text-muted-foreground">No fills yet. Arm a lock on the chart desk and wait for reclaim, or paper-fill to rehearse the lifecycle.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-secondary text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Symbol</th>
                <th className="px-3 py-2 font-medium">Side</th>
                <th className="px-3 py-2 font-medium">Entry</th>
                <th className="px-3 py-2 font-medium">Exit</th>
                <th className="px-3 py-2 font-medium">PnL</th>
                <th className="px-3 py-2 font-medium">R</th>
                <th className="px-3 py-2 font-medium">Why</th>
              </tr>
            </thead>
            <tbody>
              {journal.map((j) => (
                <tr key={j.id} className="border-t border-border">
                  <td className="px-3 py-2 text-xs text-muted-foreground">{formatTime(j.closedAt)}</td>
                  <td className="px-3 py-2">{displaySymbol(j.symbol)}</td>
                  <td className="px-3 py-2">
                    {j.bias}
                  </td>
                  <td className="px-3 py-2 font-mono">{formatPrice(j.entry, j.symbol)}</td>
                  <td className="px-3 py-2 font-mono">{formatPrice(j.exit, j.symbol)}</td>
                  <td className={j.pnl >= 0 ? "px-3 py-2 text-long" : "px-3 py-2 text-short"}>{formatUsd(j.pnl)}</td>
                  <td className="px-3 py-2 font-mono">{formatR(j.rMultiple)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{j.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
