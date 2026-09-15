export const SYMBOLS = ["BTC-USD", "DOGE-USD"] as const;
export type SymbolId = (typeof SYMBOLS)[number];

export const TIMEFRAMES = ["1H", "4H", "1D"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export type Bias = "long" | "short";
export type WaveRole = 3 | 5;
export type TradeState = "IDLE" | "WATCH" | "ARMED" | "ENTRY" | "MANAGE" | "FLAT";
export type EntryMode = "reclaim" | "limit_zone";
export type DataSource = "auto" | "tradingview" | "coingecko" | "coinbase" | "yahoo";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Ticker {
  symbol: SymbolId;
  price: number;
  open24h: number;
  change24h: number;
  changePct24h: number;
  source: string;
  asOf: number;
}

export type TvRating = "Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell";

export interface TvTech {
  symbol: SymbolId;
  ticker: string;
  price: number;
  changePct: number;
  recAll: number;
  recMA: number;
  recOsc: number;
  rsi: number;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  atr: number | null;
  rating: TvRating;
  asOf: number;
}

export interface Pivots {
  w1Start: number;
  w1End: number;
  w2End: number;
  confirmation: number;
}

export interface ThesisLock {
  id: string;
  symbol: SymbolId;
  bias: Bias;
  waveRole: WaveRole;
  invalidation: number;
  tp1: number;
  tp2: number;
  pivots: Pivots;
  alternate: string;
  sitOut: boolean;
  diagonalOk: boolean;
  htfBias: Bias;
  notes: string;
  createdAt: number;
  updatedAt: number;
  state: TradeState;
}

export interface PaperPosition {
  id: string;
  lockId: string;
  symbol: SymbolId;
  bias: Bias;
  waveRole: WaveRole;
  entry: number;
  stop: number;
  tp1: number;
  tp2: number;
  size: number;
  riskAmount: number;
  openedAt: number;
  tp1Filled: boolean;
  tags: string[];
}

export interface JournalEntry {
  id: string;
  lockId: string;
  symbol: SymbolId;
  bias: Bias;
  waveRole: WaveRole;
  entry: number;
  exit: number;
  size: number;
  pnl: number;
  rMultiple: number;
  reason: string;
  confluenceTags: string[];
  notes: string;
  openedAt: number;
  closedAt: number;
}

export interface CategoryToggles {
  [slug: string]: boolean;
}

export interface DeskSettings {
  riskPct: number;
  dogeRiskPct: number;
  minRr: number;
  entryMode: EntryMode;
  lookbackDays: number;
  paperEquityStart: number;
  dataSource: DataSource;
  confluenceMin: number;
  dailyLossPct: number;
  maxTradesPerDay: number;
  enableBtcLead: boolean;
  btcLeadFreefallRet: number;
  categories: CategoryToggles;
}

export const DESK_MODES = ["long", "short", "diamond"] as const;
export type DeskMode = (typeof DESK_MODES)[number];

export type Actionable = "take" | "wait" | "sit";

export interface Opportunity {
  id: string;
  rank: 1 | 2 | 3;
  mode: DeskMode;
  title: string;
  summary: string;
  wave: string;
  why: string[];
  waitFor: string;
  setupScore: number;
  actionable: Actionable;
  lock: ThesisLock;
  thesis: string;
}

export interface DailyStats {
  date: string;
  realizedPnl: number;
  trades: number;
}

export interface BtcLead {
  ok: boolean;
  blocked: boolean;
  freefall: boolean;
  weak: boolean;
  ret20: number;
  note: string;
}

export type ChipStatus = "pass" | "fail" | "neutral" | "hard_fail";

export interface ConfluenceChip {
  slug: string;
  name: string;
  status: ChipStatus;
  score: number;
  note: string;
  affects: Array<"confluence" | "gate" | "checklist">;
}

export interface ConfluenceResult {
  total: number;
  chips: ConfluenceChip[];
  hardFail: boolean;
  hardReasons: string[];
  canArm: boolean;
  inZone: boolean;
  impulseConfirmed: boolean;
  chop: boolean;
  rr: number;
  size: number;
  stopDistance: number;
  riskAmount: number;
}

export interface MarketBundle {
  symbol: SymbolId;
  tf: Timeframe;
  candles: Candle[];
  ticker: Ticker;
  source: string;
  ema21: number | null;
  ema50: number | null;
  atr: number | null;
  swingHigh: number | null;
  swingLow: number | null;
  tv: TvTech | null;
}

export type Affects = "confluence" | "gate" | "checklist";

export interface Skill {
  id: number;
  title: string;
  summary: string;
  citations: string[];
  affects: Affects[];
}

export interface SkillCategory {
  slug: string;
  name: string;
  blurb: string;
  skills: Skill[];
}

export const DEFAULT_CATEGORIES: CategoryToggles = {
  invalidation_road_maps: true,
  impulse_wave_3_5: true,
  wave_2_depth_50_786: true,
  wave_4_vegas_38_2: true,
  golden_zone_fib_confluence: true,
  algo_polls_front_run: true,
  median_andrews_schiff: true,
  diagonals_overlap: true,
  channels_structure: true,
  corrective_abc_wxy_triangle: true,
  patience_sit_out_r_r: true,
  multi_tf_fractal_dual_pair: true,
  btc_lead_alts: true,
  general_crypto_ta: true,
};

export const DEFAULT_SETTINGS: DeskSettings = {
  riskPct: 1,
  dogeRiskPct: 0.75,
  minRr: 2,
  entryMode: "reclaim",
  lookbackDays: 730,
  paperEquityStart: 100_000,
  dataSource: "auto",
  confluenceMin: 2,
  dailyLossPct: 3,
  maxTradesPerDay: 6,
  enableBtcLead: true,
  btcLeadFreefallRet: -0.12,
  categories: { ...DEFAULT_CATEGORIES },
};

export function displaySymbol(id: SymbolId): string {
  return id === "BTC-USD" ? "BTC/USD" : "DOGE/USD";
}

export function coinbaseProduct(id: SymbolId): string {
  return id;
}
