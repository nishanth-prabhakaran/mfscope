import type { BenchmarkData, BenchmarkKey, NavRow } from "@/types/mf";
import { benchmarkByKey } from "./benchmarks";
import { fetchWithTimeout } from "./http";

const FINAPI_BASE = "https://api.finapi.upvaly.com/api";

/** finapi requires an API key header; read it at call time, never at module scope. */
function finapiHeaders(): Record<string, string> {
  const key = process.env["FINAPI_API_KEY"];
  return { Accept: "application/json", ...(key ? { "X-API-Key": key } : {}) };
}

interface YahooChartResult {
  chart?: {
    result?: Array<{
      meta?: { symbol?: string; currency?: string };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: (number | null)[] }> };
    }>;
    error?: { description?: string } | null;
  };
}

function yahooUrl(symbol: string): string {
  const encoded = encodeURIComponent(symbol);
  const now = Math.floor(Date.now() / 1000);
  // range=max is unreliable for indices (returns ~1y); use explicit period bounds.
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&period1=0&period2=${now}&includeAdjustedClose=true`;
}

interface FinApiNavResponse {
  data?: { navHistory?: { navDate: string; nav: number | string }[] };
  message?: string;
}

interface FinApiIndexResponse {
  status?: string;
  data?: {
    indexName: string;
    priceDate: string;
    closePrice: number | string;
    triValue: number | string | null;
  }[];
}

/**
 * finapi's NSE index endpoint. Preferred over Yahoo because it serves triValue
 * (Total Return Index), which is the like-for-like comparison against a fund
 * NAV — a NAV reinvests dividends, a price-return index does not, so comparing
 * against price return flatters every fund.
 */
async function fetchFromFinapiIndex(indexName: string): Promise<NavRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const url =
    `${FINAPI_BASE}/nifty-indices` +
    `?indexName=${encodeURIComponent(indexName)}&startDate=1990-01-01&endDate=${today}`;
  const res = await fetchWithTimeout(url, { headers: finapiHeaders() });
  if (!res.ok) throw new Error(`Index fetch failed: ${res.status}`);
  const json = (await res.json()) as FinApiIndexResponse;

  // Guard against the endpoint echoing back a different index than requested.
  const entries = (json.data ?? []).filter(
    (r) => !r.indexName || r.indexName.toUpperCase() === indexName.toUpperCase(),
  );

  // Pick ONE scale for the whole series. TRI (~35,000 for Nifty 50) and price
  // (~23,000) are different scales, so substituting price on days where TRI is
  // missing would splice in a phantom ~30% crash. Use TRI only if it covers
  // effectively the whole series; otherwise fall back to price throughout.
  const triCount = entries.filter((r) => {
    const v = r.triValue == null ? NaN : Number(r.triValue);
    return Number.isFinite(v) && v > 0;
  }).length;
  const useTri = entries.length > 0 && triCount >= entries.length * 0.98;

  const rows: NavRow[] = [];
  for (const r of entries) {
    const raw = useTri ? r.triValue : r.closePrice;
    const value = raw == null ? NaN : Number(raw);
    const [y, m, d] = r.priceDate.split("-").map(Number);
    if (value > 0 && Number.isFinite(y)) rows.push({ t: Date.UTC(y, m - 1, d), nav: value });
  }
  rows.sort((a, b) => a.t - b.t);
  return rows;
}

/** Some NSE indices have no Yahoo history; fall back to a tracking index fund's NAV. */
async function fetchFromProxyFund(code: number): Promise<NavRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetchWithTimeout(
    `${FINAPI_BASE}/mf/scheme-code/${code}/nav?startDate=1990-01-01&endDate=${today}`,
    { headers: finapiHeaders() },
  );
  if (!res.ok) throw new Error(`Benchmark proxy fetch failed: ${res.status}`);
  const json = (await res.json()) as FinApiNavResponse;
  const rows: NavRow[] = [];
  for (const r of json.data?.navHistory ?? []) {
    const [y, m, d] = r.navDate.split("-").map(Number);
    const nav = Number(r.nav);
    if (nav > 0 && Number.isFinite(y)) rows.push({ t: Date.UTC(y, m - 1, d), nav });
  }
  rows.sort((a, b) => a.t - b.t);
  return rows;
}

export async function fetchBenchmarkSeries(key: BenchmarkKey): Promise<BenchmarkData> {
  const bench = benchmarkByKey(key);
  if (!bench) throw new Error("Unknown benchmark " + key);

  // 1. finapi TRI — the accurate source.
  if (bench.finapiIndexName) {
    try {
      const rows = await fetchFromFinapiIndex(bench.finapiIndexName);
      if (rows.length > 30) return { key, label: bench.label, rows };
    } catch {
      // fall through to the proxy/Yahoo paths below
    }
  }

  // 2. Tracking index-fund NAV.
  if (bench.proxySchemeCode) {
    const rows = await fetchFromProxyFund(bench.proxySchemeCode);
    if (rows.length > 30) return { key, label: bench.label, rows };
  }

  const res = await fetchWithTimeout(yahooUrl(bench.yahooSymbol), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Benchmark fetch failed: ${res.status}`);
  const json = (await res.json()) as YahooChartResult;
  const result = json.chart?.result?.[0];
  if (!result || json.chart?.error) {
    throw new Error(json.chart?.error?.description || "No benchmark data returned");
  }
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  // Yahoo timestamps are exchange market-open times (e.g. 03:45 UTC).
  // Fund NAV rows use UTC midnight, so normalize to the same day boundary
  // otherwise chart overlays never line up.
  const byDay = new Map<number, number>();
  for (let i = 0; i < timestamps.length; i++) {
    const nav = closes[i];
    if (nav != null && nav > 0) {
      const d = new Date(timestamps[i] * 1000);
      const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      byDay.set(day, nav);
    }
  }
  const rows: NavRow[] = [...byDay.entries()].map(([t, nav]) => ({ t, nav }));
  rows.sort((a, b) => a.t - b.t);
  return { key, label: bench.label, rows };
}
