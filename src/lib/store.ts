import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  channelBreakAgainst,
  entryTriggered,
  hitTp,
  riskPctFor,
  scoreConfluence,
  shouldStop,
} from "./engine";
import { todayKey } from "./format";
import { uid } from "./utils";
import {
  DEFAULT_SETTINGS,
  type Candle,
  type ConfluenceResult,
  type DailyStats,
  type DeskSettings,
  type JournalEntry,
  type MarketBundle,
  type Opportunity,
  type PaperPosition,
  type SymbolId,
  type ThesisLock,
  type Timeframe,
  type TvTech,
} from "./types";
import type { LiveMark } from "./live";

const STARTING = DEFAULT_SETTINGS.paperEquityStart;

interface DeskState {
  hydrated: boolean;
  disclaimerAccepted: boolean;
  settings: DeskSettings;
  equity: number;
  locks: ThesisLock[];
  opportunities: Opportunity[];
  selectedId: string | null;
  positions: PaperPosition[];
  journal: JournalEntry[];
  daily: DailyStats;
  markets: Partial<Record<SymbolId, MarketBundle>>;
  tf: Timeframe;
  sitOutGlobal: boolean;
  setHydrated: () => void;
  acceptDisclaimer: () => void;
  setSettings: (patch: Partial<DeskSettings>) => void;
  setCategory: (slug: string, on: boolean) => void;
  setTf: (tf: Timeframe) => void;
  setSitOutGlobal: (v: boolean) => void;
  ingestMarket: (bundle: MarketBundle) => void;
  patchLive: (tech: TvTech) => void;
  setMark: (mark: LiveMark) => void;
  setCandles: (symbol: SymbolId, candles: Candle[]) => void;
  upsertLock: (lock: ThesisLock) => void;
  applyScan: (ops: Opportunity[]) => void;
  selectOption: (id: string) => void;
  replaceSampleLocks: (locks: ThesisLock[]) => void;
  deleteLock: (id: string) => void;
  setLockState: (id: string, state: ThesisLock["state"]) => void;
  flatten: (lockId: string, reason: string, price?: number) => void;
  arm: (lockId: string) => { ok: boolean; reason: string };
  simulateFill: (lockId: string) => { ok: boolean; reason: string };
  tick: () => void;
  resetPaper: () => void;
}

function sourceRank(src: string | undefined): number {
  const s = src ?? "";
  if (s.includes("coinbase")) return 4;
  if (s.includes("yahoo")) return 3;
  if (s.includes("tv")) return 2;
  if (s.includes("coingecko")) return 1;
  if (s.includes("demo")) return 0;
  return 2;
}

function emptyDaily(): DailyStats {
  return { date: todayKey(), realizedPnl: 0, trades: 0 };
}

function rollDaily(d: DailyStats): DailyStats {
  return d.date === todayKey() ? d : emptyDaily();
}

function markPrice(markets: DeskState["markets"], symbol: SymbolId): number {
  return markets[symbol]?.ticker.price ?? 0;
}

function candlesOf(markets: DeskState["markets"], symbol: SymbolId): Candle[] {
  return markets[symbol]?.candles ?? [];
}

export function evaluateLock(
  lock: ThesisLock,
  state: Pick<DeskState, "markets" | "settings" | "equity" | "sitOutGlobal">,
): ConfluenceResult {
  const candles = candlesOf(state.markets, lock.symbol);
  const btc = candlesOf(state.markets, "BTC-USD");
  const price = markPrice(state.markets, lock.symbol);
  const lockAdj = state.sitOutGlobal ? { ...lock, sitOut: true } : lock;
  return scoreConfluence({
    lock: lockAdj,
    candles,
    htf: candles,
    btc: btc.length ? btc : candles,
    settings: state.settings,
    price,
    equity: state.equity,
  });
}

function openPosition(lock: ThesisLock, price: number, equity: number, settings: DeskSettings, tags: string[]): PaperPosition {
  const riskAmount = equity * (riskPctFor(settings, lock.symbol) / 100);
  const stopDistance = Math.abs(price - lock.invalidation);
  const size = stopDistance > 0 ? riskAmount / stopDistance : 0;
  return {
    id: uid("pos"),
    lockId: lock.id,
    symbol: lock.symbol,
    bias: lock.bias,
    waveRole: lock.waveRole,
    entry: price,
    stop: lock.invalidation,
    tp1: lock.tp1,
    tp2: lock.tp2,
    size,
    riskAmount,
    openedAt: Date.now(),
    tp1Filled: false,
    tags,
  };
}

function closePosition(
  pos: PaperPosition,
  exit: number,
  reason: string,
): JournalEntry {
  const dir = pos.bias === "long" ? 1 : -1;
  const pnl = (exit - pos.entry) * pos.size * dir;
  const rMultiple = pos.riskAmount > 0 ? pnl / pos.riskAmount : 0;
  return {
    id: uid("j"),
    lockId: pos.lockId,
    symbol: pos.symbol,
    bias: pos.bias,
    waveRole: pos.waveRole,
    entry: pos.entry,
    exit,
    size: pos.size,
    pnl,
    rMultiple,
    reason,
    confluenceTags: pos.tags,
    notes: "",
    openedAt: pos.openedAt,
    closedAt: Date.now(),
  };
}

export const useDeskStore = create<DeskState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      disclaimerAccepted: false,
      settings: DEFAULT_SETTINGS,
      equity: STARTING,
      locks: [],
      opportunities: [],
      selectedId: null,
      positions: [],
      journal: [],
      daily: emptyDaily(),
      markets: {},
      tf: "1D",
      sitOutGlobal: false,
      setHydrated: () => set({ hydrated: true }),
      acceptDisclaimer: () => set({ disclaimerAccepted: true }),
      setSettings: (patch) =>
        set((s) => {
          const settings = { ...s.settings, ...patch };
          return { settings };
        }),
      setCategory: (slug, on) =>
        set((s) => ({
          settings: {
            ...s.settings,
            categories: { ...s.settings.categories, [slug]: on },
          },
        })),
      setTf: (tf) => set({ tf }),
      setSitOutGlobal: (v) => set({ sitOutGlobal: v }),
      ingestMarket: (bundle) =>
        set((s) => {
          const prev = s.markets[bundle.symbol];
          if (prev && sourceRank(prev.source) > 0 && sourceRank(bundle.source) === 0) return {};
          const keepCandles =
            prev &&
            prev.candles.length > bundle.candles.length * 1.15 &&
            sourceRank(prev.source) >= sourceRank(bundle.source);
          const candles = keepCandles ? prev.candles : bundle.candles;
          const live = prev?.ticker.asOf && Date.now() - prev.ticker.asOf < 30_000 ? prev.ticker.price : null;
          const patched =
            live && candles.length
              ? candles.map((c, i) =>
                  i === candles.length - 1
                    ? { ...c, close: live, high: Math.max(c.high, live), low: Math.min(c.low, live) }
                    : c,
                )
              : candles;
          return {
            markets: {
              ...s.markets,
              [bundle.symbol]: {
                ...bundle,
                candles: patched,
                tv: bundle.tv ?? prev?.tv ?? null,
                ticker: live && prev ? prev.ticker : bundle.ticker,
                source: keepCandles ? prev!.source : bundle.source,
              },
            },
          };
        }),
      setMark: (mark) =>
        set((s) => {
          const prev = s.markets[mark.symbol];
          if (!prev) {
            return {
              markets: {
                ...s.markets,
                [mark.symbol]: {
                  symbol: mark.symbol,
                  tf: s.tf,
                  candles: [],
                  ticker: {
                    symbol: mark.symbol,
                    price: mark.price,
                    open24h: mark.open24h,
                    change24h: mark.price - mark.open24h,
                    changePct24h: mark.changePct24h,
                    source: mark.source,
                    asOf: mark.asOf,
                  },
                  source: mark.source,
                  ema21: null,
                  ema50: null,
                  atr: null,
                  swingHigh: null,
                  swingLow: null,
                  tv: null,
                },
              },
            };
          }
          const candles = prev.candles.length
            ? prev.candles.map((c, i) =>
                i === prev.candles.length - 1
                  ? { ...c, close: mark.price, high: Math.max(c.high, mark.price), low: Math.min(c.low, mark.price) }
                  : c,
              )
            : prev.candles;
          return {
            markets: {
              ...s.markets,
              [mark.symbol]: {
                ...prev,
                candles,
                ticker: {
                  ...prev.ticker,
                  price: mark.price,
                  open24h: mark.open24h,
                  change24h: mark.price - mark.open24h,
                  changePct24h: mark.changePct24h,
                  source: mark.source,
                  asOf: mark.asOf,
                },
              },
            },
          };
        }),
      setCandles: (symbol, candles) =>
        set((s) => {
          const prev = s.markets[symbol];
          const ordered = [...candles].sort((a, b) => a.time - b.time);
          if (ordered.length < 2) return {};
          const live = prev?.ticker.price;
          if (live && live > 0) {
            const i = ordered.length - 1;
            const c = ordered[i]!;
            ordered[i] = {
              ...c,
              close: live,
              high: Math.max(c.high, live),
              low: Math.min(c.low, live),
            };
          }
          if (!prev) {
            const lastC = ordered[ordered.length - 1]!;
            return {
              markets: {
                ...s.markets,
                [symbol]: {
                  symbol,
                  tf: s.tf,
                  candles: ordered,
                  ticker: {
                    symbol,
                    price: lastC.close,
                    open24h: lastC.open,
                    change24h: lastC.close - lastC.open,
                    changePct24h: lastC.open ? (lastC.close - lastC.open) / lastC.open : 0,
                    source: "coinbase",
                    asOf: Date.now(),
                  },
                  source: "coinbase",
                  ema21: null,
                  ema50: null,
                  atr: null,
                  swingHigh: null,
                  swingLow: null,
                  tv: null,
                },
              },
            };
          }
          return {
            markets: {
              ...s.markets,
              [symbol]: {
                ...prev,
                candles: ordered,
                source: prev.source === "demo" ? "coinbase" : prev.source,
              },
            },
          };
        }),
      patchLive: (tech) =>
        set((s) => {
          const prev = s.markets[tech.symbol];
          if (!prev) return {};
          return {
            markets: {
              ...s.markets,
              [tech.symbol]: {
                ...prev,
                tv: tech,
              },
            },
          };
        }),
      upsertLock: (lock) =>
        set((s) => {
          const idx = s.locks.findIndex((l) => l.id === lock.id);
          const next = [...s.locks];
          const saved = { ...lock, updatedAt: Date.now(), state: lock.state === "IDLE" ? "WATCH" : lock.state };
          if (idx >= 0) next[idx] = { ...next[idx]!, ...saved };
          else next.push(saved);
          return { locks: next };
        }),
      applyScan: (ops) =>
        set((s) => {
          const live = new Set(s.positions.map((p) => p.lockId));
          const posLocks = s.locks.filter((l) => live.has(l.id));
          const selectedId =
            s.selectedId && ops.some((o) => o.id === s.selectedId) ? s.selectedId : (ops[0]?.id ?? null);
          return {
            opportunities: ops,
            selectedId,
            locks: [...ops.map((o) => o.lock), ...posLocks],
            positions: s.positions,
          };
        }),
      selectOption: (id) => set({ selectedId: id }),
      replaceSampleLocks: (locks) =>
        set((s) => {
          if (s.positions.length > 0) return {};
          return { locks };
        }),
      deleteLock: (id) =>
        set((s) => ({
          locks: s.locks.filter((l) => l.id !== id),
          positions: s.positions.filter((p) => p.lockId !== id),
        })),
      setLockState: (id, state) =>
        set((s) => ({
          locks: s.locks.map((l) => (l.id === id ? { ...l, state, updatedAt: Date.now() } : l)),
        })),
      flatten: (lockId, reason, price) => {
        const s = get();
        const pos = s.positions.find((p) => p.lockId === lockId);
        const lock = s.locks.find((l) => l.id === lockId);
        if (!pos || !lock) {
          set({
            locks: s.locks.map((l) => (l.id === lockId ? { ...l, state: "FLAT" } : l)),
          });
          return;
        }
        const px = price ?? markPrice(s.markets, pos.symbol);
        const entry = closePosition(pos, px, reason);
        const daily = rollDaily(s.daily);
        set({
          positions: s.positions.filter((p) => p.id !== pos.id),
          journal: [entry, ...s.journal],
          equity: s.equity + entry.pnl,
          daily: { ...daily, realizedPnl: daily.realizedPnl + entry.pnl, trades: daily.trades + 1 },
          locks: s.locks.map((l) => (l.id === lockId ? { ...l, state: "FLAT" } : l)),
        });
      },
      arm: (lockId) => {
        const s = get();
        const lock = s.locks.find((l) => l.id === lockId);
        if (!lock) return { ok: false, reason: "No lock." };
        const score = evaluateLock(lock, s);
        if (lock.symbol === "DOGE-USD" && lock.bias === "long") {
          const blocked = score.chips.find((c) => c.slug === "btc_lead_alts" && c.status === "hard_fail");
          if (blocked) return { ok: false, reason: blocked.note };
        }
        if (score.hardFail) return { ok: false, reason: score.hardReasons[0] ?? "Hard gate failed." };
        if (!score.canArm) return { ok: false, reason: "Filters have not passed yet. Wait for the pitch." };
        set({
          locks: s.locks.map((l) => (l.id === lockId ? { ...l, state: "ARMED" } : l)),
        });
        return { ok: true, reason: "Armed. Waiting first-retrace trigger." };
      },
      simulateFill: (lockId) => {
        const s = get();
        const lock = s.locks.find((l) => l.id === lockId);
        if (!lock) return { ok: false, reason: "No lock." };
        if (s.positions.some((p) => p.lockId === lockId)) return { ok: false, reason: "Already in." };
        const daily = rollDaily(s.daily);
        if (daily.trades >= s.settings.maxTradesPerDay) return { ok: false, reason: "Max trades kill switch." };
        if (daily.realizedPnl <= -(s.settings.dailyLossPct / 100) * s.equity) {
          return { ok: false, reason: "Daily loss kill switch." };
        }
        const score = evaluateLock(lock, s);
        if (lock.symbol === "DOGE-USD" && lock.bias === "long") {
          const blocked = score.chips.find((c) => c.slug === "btc_lead_alts" && c.status === "hard_fail");
          if (blocked) return { ok: false, reason: blocked.note };
        }
        const price = markPrice(s.markets, lock.symbol);
        if (!price) return { ok: false, reason: "No mark price." };
        const tags: string[] = [];
        const fillLock: ThesisLock = {
          ...lock,
          id: uid("fill"),
          state: "MANAGE",
          updatedAt: Date.now(),
        };
        const pos = openPosition(fillLock, price, s.equity, s.settings, tags);
        set({
          positions: [...s.positions, pos],
          locks: [...s.locks, fillLock],
          daily,
        });
        return { ok: true, reason: `Paper fill at ${price}.` };
      },
      tick: () => {
        const s = get();
        const daily = rollDaily(s.daily);
        let equity = s.equity;
        let locks = [...s.locks];
        let positions = [...s.positions];
        const journal = [...s.journal];
        let d = { ...daily };

        const kill =
          d.trades >= s.settings.maxTradesPerDay ||
          d.realizedPnl <= -(s.settings.dailyLossPct / 100) * equity;

        for (const lock of locks) {
          const price = markPrice(s.markets, lock.symbol);
          if (!price) continue;
          const score = evaluateLock(lock, { ...s, equity });
          const pos = positions.find((p) => p.lockId === lock.id);

          if (pos) {
            if (shouldStop(lock, price)) {
              const entry = closePosition(pos, lock.invalidation, "Invalidation");
              journal.unshift(entry);
              equity += entry.pnl;
              d = { ...d, realizedPnl: d.realizedPnl + entry.pnl, trades: d.trades + 1 };
              positions = positions.filter((p) => p.id !== pos.id);
              locks = locks.map((l) => (l.id === lock.id ? { ...l, state: "FLAT" } : l));
              continue;
            }
            if (!pos.tp1Filled && hitTp(lock, price, 1)) {
              const half = { ...pos, size: pos.size * 0.5, tp1Filled: true };
              const scaled = closePosition({ ...pos, size: pos.size * 0.5 }, lock.tp1, "TP1 scale");
              journal.unshift(scaled);
              equity += scaled.pnl;
              d = { ...d, realizedPnl: d.realizedPnl + scaled.pnl };
              positions = positions.map((p) => (p.id === pos.id ? half : p));
            }
            const live = positions.find((p) => p.id === pos.id);
            if (live && hitTp(lock, price, 2)) {
              const entry = closePosition(live, lock.tp2, "TP2 target");
              journal.unshift(entry);
              equity += entry.pnl;
              d = { ...d, realizedPnl: d.realizedPnl + entry.pnl, trades: d.trades + 1 };
              positions = positions.filter((p) => p.id !== live.id);
              locks = locks.map((l) => (l.id === lock.id ? { ...l, state: "FLAT" } : l));
              continue;
            }
            if (live && channelBreakAgainst(lock, candlesOf(s.markets, lock.symbol))) {
              const px = price;
              const entry = closePosition(live, px, "Channel break");
              journal.unshift(entry);
              equity += entry.pnl;
              d = { ...d, realizedPnl: d.realizedPnl + entry.pnl, trades: d.trades + 1 };
              positions = positions.filter((p) => p.id !== live.id);
              locks = locks.map((l) => (l.id === lock.id ? { ...l, state: "FLAT" } : l));
              continue;
            }
            locks = locks.map((l) => (l.id === lock.id ? { ...l, state: "MANAGE" } : l));
            continue;
          }

          if (lock.id.startsWith("opt_")) continue;
          if (lock.state === "FLAT" || lock.state === "IDLE") continue;
          if (lock.sitOut || s.sitOutGlobal) {
            locks = locks.map((l) => (l.id === lock.id ? { ...l, state: "WATCH" } : l));
            continue;
          }
          if (score.canArm && lock.state === "WATCH") {
            locks = locks.map((l) => (l.id === lock.id ? { ...l, state: "ARMED" } : l));
          } else if (!score.canArm && lock.state === "ARMED") {
            locks = locks.map((l) => (l.id === lock.id ? { ...l, state: "WATCH" } : l));
          }
          const armed = locks.find((l) => l.id === lock.id);
          if (armed?.state === "ARMED" && !kill && entryTriggered(armed, candlesOf(s.markets, lock.symbol), s.settings, score)) {
            const tags: string[] = [];
            positions.push(openPosition(armed, price, equity, s.settings, tags));
            locks = locks.map((l) => (l.id === lock.id ? { ...l, state: "ENTRY" } : l));
          }
        }

        set({ equity, locks, positions, journal, daily: d });
      },
      resetPaper: () =>
        set({
          equity: get().settings.paperEquityStart,
          positions: [],
          journal: [],
          daily: emptyDaily(),
          locks: get().locks.map((l) => ({ ...l, state: "WATCH" })),
        }),
    }),
    {
      name: "bw-paper-desk",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
      skipHydration: true,
      version: 6,
      migrate: (persisted) => {
        const p = persisted as Record<string, unknown>;
        const settings = {
          ...DEFAULT_SETTINGS,
          ...((p.settings as DeskSettings | undefined) ?? {}),
        };
        if (typeof settings.dogeRiskPct !== "number") settings.dogeRiskPct = 0.75;
        const positions = Array.isArray(p.positions) ? (p.positions as PaperPosition[]) : [];
        const open = new Set(positions.map((x) => x.lockId));
        const locks = Array.isArray(p.locks) ? (p.locks as ThesisLock[]) : [];
        return {
          ...p,
          settings,
          locks: locks.filter((l) => open.has(l.id)),
          positions,
          selectedId: null,
        };
      },
      partialize: (s) => ({
        disclaimerAccepted: s.disclaimerAccepted,
        settings: s.settings,
        equity: s.equity,
        locks: s.locks.filter((l) => s.positions.some((p) => p.lockId === l.id)),
        selectedId: s.selectedId,
        positions: s.positions,
        journal: s.journal,
        daily: s.daily,
        tf: s.tf,
        sitOutGlobal: s.sitOutGlobal,
      }),
    },
  ),
);

export function openRisk(positions: PaperPosition[]): number {
  return positions.reduce((s, p) => s + p.riskAmount, 0);
}

export function unrealized(positions: PaperPosition[], markets: DeskState["markets"]): number {
  return positions.reduce((s, p) => {
    const px = markPrice(markets, p.symbol);
    const dir = p.bias === "long" ? 1 : -1;
    return s + (px - p.entry) * p.size * dir;
  }, 0);
}
