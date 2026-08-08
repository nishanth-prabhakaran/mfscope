import { get, set } from "idb-keyval";

const API_BASE = "https://finapi.upvaly.com/api";
const KEY = (code: number) => `finapi:detail:${code}:v1`;
const TTL = 12 * 60 * 60 * 1000;

export interface DetailRollingRow {
  timeframe: string;
  averageReturn?: number;
  medianReturn?: number;
  minReturn?: number;
  minPeriod?: string;
  maxReturn?: number;
  maxPeriod?: string;
  standardDeviation?: number;
  downsideDeviation?: number;
  positiveRatio?: number;
  negativeRatio?: number;
  consistencyScore?: number;
}

export interface DetailRankRow {
  timeframe: string;
  annualizedReturn?: number;
  categoryAverage?: number;
  rankInCategory?: string;
}

export interface RiskTimeframe {
  timeframe: string;
  value?: string;
  categoryAverage?: string;
  categoryMin?: string;
  categoryMax?: string;
  conclusion?: string;
}

export interface RiskMetricBlock {
  info?: string;
  timeframes?: RiskTimeframe[];
}

export interface HoldingRow {
  name: string;
  marketValue?: string;
  weightage?: string;
  change1M?: string;
}

export interface SectorRow {
  sector: string;
  marketValue?: string;
  weightage?: string;
  change1M?: string;
}

export interface PeerRow {
  schemeCode: string;
  schemeName: string;
  schemeNameShort?: string;
  aum?: string;
  expenseRatio?: string;
  portfolioTurnover?: string;
  standardDeviation?: string;
  returns?: Record<string, string>;
}

export interface AmcFundRow {
  schemeCode: string;
  schemeName: string;
  schemeShortName?: string;
  aum?: string;
  returns?: Record<string, string>;
}

export interface SchemeDetail {
  schemeCode: string;
  schemeName: string;
  schemeCategory?: string;
  schemeCategoryLabel?: string;
  schemeStructure?: string;
  schemeRisk?: string;
  planName?: string;
  optionName?: string;
  benchmarkIndex?: string;
  inceptionDate?: string;
  aum?: string;
  expenseRatio?: string;
  exitLoadMessage?: string;
  portfolioTurnover?: string;
  standardDeviation?: string;
  morningStarRating?: number;
  companyName?: string;
  fundHouse?: string;
  schemeFundManagers?: string;
  latestNav?: number;
  latestNavDate?: string;
  previousNav?: number;
  previousNavDate?: string;
  "52WeekLowNav"?: number;
  "52WeekLowNavDate"?: string;
  "52WeekHighNav"?: number;
  "52WeekHighNavDate"?: string;
  cagr?: Record<string, string>;
  rollingReturns?: DetailRollingRow[];
  ranks?: DetailRankRow[];
  portfolio?: {
    assetAllocation?: Record<string, string>;
    marketCapWeightage?: Record<string, string>;
    concentration?: Record<string, string | number>;
  };
  fundamentals?: Record<string, string>;
  riskMetrics?: Record<string, RiskMetricBlock>;
  holdings?: HoldingRow[];
  sectors?: SectorRow[];
  peers?: PeerRow[];
  moreFundsFromAmc?: { companyName?: string; schemeList?: AmcFundRow[] };
}

interface Cached<T> {
  at: number;
  data: T;
}

export async function fetchSchemeDetail(code: number): Promise<SchemeDetail> {
  const key = KEY(code);
  const hit = await get<Cached<SchemeDetail>>(key).catch(() => null);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const res = await fetch(`${API_BASE}/mf/scheme-code/${code}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Failed to load fund details");
  const json = (await res.json()) as { data?: SchemeDetail; message?: string };
  if (!json.data) throw new Error(json.message || "Fund details unavailable");
  await set(key, { at: Date.now(), data: json.data } satisfies Cached<SchemeDetail>).catch(
    () => {},
  );
  return json.data;
}

/** Order timeframes sensibly: 1W, 1M, 3M, 6M, YTD, 1Y, 2Y ... */
const ORDER = [
  "1W",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "2Y",
  "3Y",
  "5Y",
  "7Y",
  "10Y",
  "12Y",
  "15Y",
  "20Y",
];
export function sortTimeframes<T extends { timeframe: string }>(rows: T[] | undefined): T[] {
  return [...(rows ?? [])].sort((a, b) => {
    const ia = ORDER.indexOf(a.timeframe.toUpperCase());
    const ib = ORDER.indexOf(b.timeframe.toUpperCase());
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

export function num(v: string | number | undefined | null): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function stripHtml(s: string | undefined): string {
  return (s ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function prettyMetricName(key: string): string {
  const map: Record<string, string> = {
    returns: "Returns",
    riskStandardDeviation: "Volatility (Std Dev)",
    sharpRatio: "Sharpe Ratio",
    sharpeRatio: "Sharpe Ratio",
    sortinoRatio: "Sortino Ratio",
    alpha: "Alpha",
    beta: "Beta",
    rSquared: "R-Squared",
    treynorRatio: "Treynor Ratio",
  };
  if (map[key]) return map[key];
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}
