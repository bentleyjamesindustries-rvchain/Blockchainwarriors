import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Settings2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DISCLAIMER, MOTTO } from "@/lib/rules";
import { scanOpportunities } from "@/lib/scan";
import { fetchUniverse, fetchQuotes, fetchLiveTickers, demoBundle } from "@/lib/market";
import { fetchLiveMarks, fetchLiveCandles } from "@/lib/live";
import { openRisk, unrealized, useDeskStore } from "@/lib/store";
import { formatPct, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DisclaimerModal } from "./DisclaimerModal";

const NAV: Array<{
  to: "/" | "/journal" | "/settings" | "/about";
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { to: "/", label: "Desk", icon: LayoutDashboard },
  { to: "/journal", label: "Journal", icon: ClipboardList },
  { to: "/settings", label: "Settings", icon: Settings2 },
  { to: "/about", label: "About", icon: CircleHelp },
];

function applyUniverse(
  btc: ReturnType<typeof demoBundle>,
  doge: ReturnType<typeof demoBundle>,
) {
  const s = useDeskStore.getState();
  s.ingestMarket(btc);
  s.ingestMarket(doge);
  rescan();
  useDeskStore.getState().tick();
}

function rescan() {
  try {
    const s = useDeskStore.getState();
    s.applyScan(scanOpportunities(s.markets["BTC-USD"], s.markets["DOGE-USD"], s.settings, s.equity));
  } catch {
    /* keep last scan */
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const setHydrated = useDeskStore((s) => s.setHydrated);
  const tf = useDeskStore((s) => s.tf);
  const lookbackDays = useDeskStore((s) => s.settings.lookbackDays);
  const source = useDeskStore((s) => s.settings.dataSource);
  const equity = useDeskStore((s) => s.equity);
  const positions = useDeskStore((s) => s.positions);
  const markets = useDeskStore((s) => s.markets);
  const daily = useDeskStore((s) => s.daily);
  const btc = markets["BTC-USD"]?.ticker;
  const btcTv = markets["BTC-USD"]?.tv;

  useEffect(() => {
    let done = false;
    const mark = () => {
      if (done) return;
      done = true;
      setHydrated();
    };
    try {
      void Promise.resolve(useDeskStore.persist.rehydrate()).then(mark, () => {
        try {
          window.localStorage.removeItem("bw-paper-desk");
        } catch {
          /* private mode */
        }
        mark();
      });
    } catch {
      mark();
    }
    const t = window.setTimeout(mark, 400);
    return () => window.clearTimeout(t);
  }, [setHydrated]);

  useEffect(() => {
    const s = useDeskStore.getState();
    if (!s.markets["BTC-USD"]?.candles.length) {
      applyUniverse(demoBundle("BTC-USD", s.tf), demoBundle("DOGE-USD", s.tf));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const applyMarks = (live: Awaited<ReturnType<typeof fetchLiveMarks>>) => {
      const s = useDeskStore.getState();
      s.setMark(live.btc);
      s.setMark(live.doge);
      rescan();
    };
    const marks = async () => {
      try {
        const live = await fetchLiveMarks();
        if (!alive) return;
        applyMarks(live);
      } catch {
        try {
          const live = await fetchLiveTickers();
          if (!alive) return;
          applyMarks(live);
        } catch {
          /* keep last */
        }
      }
    };
    const clientCandles = async () => {
      try {
        const [btc, doge] = await Promise.all([
          fetchLiveCandles("BTC-USD", tf),
          fetchLiveCandles("DOGE-USD", tf),
        ]);
        if (!alive) return;
        const s = useDeskStore.getState();
        s.setCandles("BTC-USD", btc);
        s.setCandles("DOGE-USD", doge);
        rescan();
      } catch {
        /* universe fallback below */
      }
    };
    const load = async () => {
      try {
        const uni = await fetchUniverse({ data: { tf, lookbackDays, source } });
        if (!alive) return;
        applyUniverse(uni.btc, uni.doge);
      } catch {
        if (!alive) return;
        const s = useDeskStore.getState();
        if (s.markets["BTC-USD"]?.candles.length) return;
        applyUniverse(demoBundle("BTC-USD", tf), demoBundle("DOGE-USD", tf));
      }
    };
    const quotes = async () => {
      try {
        const q = await fetchQuotes();
        if (!alive) return;
        const s = useDeskStore.getState();
        if (q.btc) s.patchLive(q.btc);
        if (q.doge) s.patchLive(q.doge);
        rescan();
      } catch {
        /* keep last tick */
      }
    };
    void marks();
    void clientCandles();
    void load().then(() => void quotes());
    const markId = window.setInterval(() => void marks(), 8_000);
    const candleId = window.setInterval(() => void clientCandles(), 45_000);
    const candlesId = window.setInterval(() => void load(), 90_000);
    const quotesId = window.setInterval(() => void quotes(), 20_000);
    return () => {
      alive = false;
      window.clearInterval(markId);
      window.clearInterval(candleId);
      window.clearInterval(candlesId);
      window.clearInterval(quotesId);
    };
  }, [tf, lookbackDays, source]);

  const uPnl = unrealized(positions, markets);
  const risk = openRisk(positions);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <DisclaimerModal />
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur-sm md:px-5">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <BrandMark />
            <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <Link to="/" className="flex items-center gap-2">
          <BrandMark compact />
        </Link>
        <div className="ml-auto flex items-center gap-4 font-mono text-xs tabular-nums">
          {btc ? (
            <span className="hidden sm:flex items-center gap-2">
              <span className="rounded-sm bg-long/15 px-1.5 py-0.5 text-[0.625rem] tracking-wide text-long uppercase">
                {markets["BTC-USD"]?.source === "demo" ? "Demo" : "Live"}
              </span>
              <span className="text-muted-foreground">BTC</span>
              <span>{btc.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
              <span className={btc.changePct24h >= 0 ? "text-long" : "text-short"}>
                {formatPct(btc.changePct24h)}
              </span>
              {btcTv ? <span className="hidden lg:inline text-muted-foreground">{btcTv.rating}</span> : null}
            </span>
          ) : null}
          <span className="hidden md:flex items-center gap-2">
            <span className="text-muted-foreground">Eq</span>
            <span>{formatUsd(equity + uPnl, 0)}</span>
          </span>
          <span className="hidden lg:flex items-center gap-2">
            <span className="text-muted-foreground">Risk</span>
            <span>{formatUsd(risk, 0)}</span>
          </span>
          <span className={cn("hidden lg:inline", daily.realizedPnl >= 0 ? "text-long" : "text-short")}>
            {formatUsd(daily.realizedPnl, 0)} today
          </span>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-48 shrink-0 border-r border-border p-3 md:block">
          <NavList pathname={pathname} />
        </aside>
        <main className="min-w-0 flex-1 pb-24 md:pb-0">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 md:hidden">
        <ul className="grid grid-cols-4">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            return (
              <li key={n.label}>
                <Link
                  to={n.to}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 text-[0.625rem] uppercase tracking-wide",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <footer className="hidden border-t border-border px-5 py-3 text-[0.6875rem] text-muted-foreground md:block">
        {DISCLAIMER} {MOTTO}
      </footer>
    </div>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-sm border border-border bg-card font-mono text-xs text-primary">
        BW
      </span>
      {compact ? (
        <span className="flex flex-col leading-none">
          <span className="text-sm font-medium tracking-tight">Blockchain Warriors</span>
          <span className="text-[0.625rem] tracking-widest text-muted-foreground uppercase">Paper Desk</span>
        </span>
      ) : (
        <span className="text-sm font-medium">Blockchain Warriors</span>
      )}
    </span>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="mt-6 flex flex-col gap-1">
      {NAV.map((n) => {
        const Icon = n.icon;
        const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
        return (
          <li key={n.label}>
            <Link
              to={n.to}
              onClick={onNavigate}
              className={cn(
                "flex min-h-10 items-center gap-2 rounded-md px-3 text-sm",
                active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {n.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
