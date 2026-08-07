export interface SchemeListItem {
  schemeCode: number;
  schemeName: string;
  isinGrowth: string | null;
  isinDivReinvestment: string | null;
}

export interface SchemeMeta {
  fund_house: string;
  scheme_type: string;
  scheme_category: string;
  scheme_code: number;
  scheme_name: string;
  isin_growth: string | null;
  isin_div_reinvestment: string | null;
}

// Normalised NAV row for calculations
export interface NavRow {
  t: number; // unix ms (date at 00:00 UTC)
  nav: number;
}

export interface NormalizedScheme {
  meta: SchemeMeta;
  rows: NavRow[]; // ascending by time
}

export type RollingYears = 1 | 3 | 5 | 7 | 10 | 12 | 15;

export interface RollingStats {
  period: RollingYears;
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
  variance: number;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
  positivePct: number;
  negativePct: number;
  current: number | null;
  bestWindow: { start: number; end: number; value: number } | null;
  worstWindow: { start: number; end: number; value: number } | null;
}

export interface RiskMetrics {
  annualReturn: number;
  cagr: number;
  volatility: number;
  downsideVol: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdown: number;
  avgDrawdown: number;
  ulcerIndex: number;
  skewness: number;
  kurtosis: number;
  var95: number;
  cvar95: number;
  recoveryDays: number | null;
  alpha: number;
  beta: number;
  trackingError: number;
  informationRatio: number;
}

export interface DrawdownPoint {
  t: number;
  dd: number; // negative or 0
  peakT: number; // timestamp of running peak that this dd is measured from
}

// ---------- Benchmarks ----------

export type BenchmarkKey = "nifty50" | "nifty100" | "nifty150midcap" | "nifty250smallcap" | "sensex" | "nifty500" | "niftynext50" | "niftylargemid250";

export interface Benchmark {
  key: BenchmarkKey;
  label: string;
  yahooSymbol: string;
  /** When Yahoo has no history for the index, use this index-fund scheme as a proxy. */
  proxySchemeCode?: number;
  categoryHint: string[];
}

export interface BenchmarkData {
  key: BenchmarkKey;
  label: string;
  rows: NavRow[];
}

export interface AnnualReturn {
  year: number;
  value: number; // total return for the calendar year
}

export interface CorrelationCell {
  codeA: number;
  nameA: string;
  codeB: number;
  nameB: string;
  value: number; // -1..1
  overlap: boolean; // > 0.85
}
