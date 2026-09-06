import type { BenchmarkData, BenchmarkKey, NavRow } from "@/types/mf";
import { benchmarkByKey } from "./benchmarks";
import { fetchWithTimeout } from "./http";

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

// ---------------------------------------------------------------- BharatStock

const BHARAT_BASE = "https://bharatstockapi.com/v1";

interface BharatPricePoint {
  trade_date: string;
  close?: number | null;
}
interface BharatPricesResponse {
  data?: BharatPricePoint[];
  pagination?: { page: number; page_size: number; total_items: number; total_pages: number };
}

/**
 * Official NSE end-of-day levels for an index. Paginated (max 1000/page) and
 * returned newest-first, so pages are walked until exhausted and then sorted
 * ascending like every other NAV series in the app.
 */
async function fetchFromBharat(indexName: string): Promise<NavRow[]> {
  const key = process.env["BHARATSTOCK_API_KEY"];
  if (!key) return [];

  const rows: NavRow[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 20) {
    const url = `${BHARAT_BASE}/indices/${encodeURIComponent(indexName)}/prices?from=1990-01-01&page_size=1000&page=${page}`;
    const res = await fetchWithTimeout(url, {
      headers: { Accept: "application/json", "X-API-Key": key },
      timeoutMs: 20_000,
    });
    if (!res.ok) throw new Error(`Index fetch failed: ${res.status}`);
    const json = (await res.json()) as BharatPricesResponse;
    for (const p of json.data ?? []) {
      const close = p.close;
      if (close == null || !(close > 0)) continue;
      const [y, m, d] = p.trade_date.split("-").map(Number);
      if (!Number.isFinite(y)) continue;
      rows.push({ t: Date.UTC(y, m - 1, d), nav: close });
    }
    totalPages = json.pagination?.total_pages ?? 1;
    page += 1;
  }

  rows.sort((a, b) => a.t - b.t);
  return rows;
}

/**
 * BharatStock carries a few years of history. Older history comes from the
 * legacy source (index-fund NAV or Yahoo), chain-linked at the first
 * overlapping date so the two series join without a jump in level.
 */
function spliceHistory(recent: NavRow[], older: NavRow[]): NavRow[] {
  if (!recent.length) return older;
  if (!older.length) return recent;

  const start = recent[0].t;
  const head = older.filter((r) => r.t < start);
  if (!head.length) return recent;

  // Scale the older series onto the recent one using the closest older point
  // to the junction.
  const anchorOld = head[head.length - 1];
  const anchorNew = recent[0];
  if (!(anchorOld.nav > 0)) return recent;
  const factor = anchorNew.nav / anchorOld.nav;

  return [...head.map((r) => ({ t: r.t, nav: r.nav * factor })), ...recent];
}

/** Some NSE indices have no upstream history; fall back to a tracking index fund's NAV. */
async function fetchFromProxyFund(code: number): Promise<NavRow[]> {
  const res = await fetchWithTimeout(`https://api.mfapi.in/mf/${code}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Benchmark proxy fetch failed: ${res.status}`);
  const json = (await res.json()) as { data?: { date: string; nav: string }[] };
  const rows: NavRow[] = [];
  for (const r of json.data ?? []) {
    const [d, m, y] = r.date.split("-").map(Number);
    const nav = Number(r.nav);
    if (nav > 0 && Number.isFinite(y)) rows.push({ t: Date.UTC(y, m - 1, d), nav });
  }
  rows.sort((a, b) => a.t - b.t);
  return rows;
}

async function fetchFromYahoo(symbol: string): Promise<NavRow[]> {
  const res = await fetchWithTimeout(yahooUrl(symbol), {
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
  return rows;
}

/** Longer-running history used to extend (or replace) the BharatStock series. */
async function fetchLegacySeries(
  proxySchemeCode: number | undefined,
  yahooSymbol: string,
): Promise<NavRow[]> {
  if (proxySchemeCode) {
    const rows = await fetchFromProxyFund(proxySchemeCode).catch(() => [] as NavRow[]);
    if (rows.length > 30) return rows;
  }
  return fetchFromYahoo(yahooSymbol).catch(() => [] as NavRow[]);
}

export async function fetchBenchmarkSeries(key: BenchmarkKey): Promise<BenchmarkData> {
  const bench = benchmarkByKey(key);
  if (!bench) throw new Error("Unknown benchmark " + key);

  const [bharatRows, legacyRows] = await Promise.all([
    bench.bharatIndexName
      ? fetchFromBharat(bench.bharatIndexName).catch(() => [] as NavRow[])
      : Promise.resolve([] as NavRow[]),
    fetchLegacySeries(bench.proxySchemeCode, bench.yahooSymbol),
  ]);

  const rows = bharatRows.length > 30 ? spliceHistory(bharatRows, legacyRows) : legacyRows;
  if (!rows.length) throw new Error("No benchmark data available for " + bench.label);

  return { key, label: bench.label, rows };
}
