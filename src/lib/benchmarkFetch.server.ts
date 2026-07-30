import type { BenchmarkData, BenchmarkKey, NavRow } from "@/types/mf";
import { benchmarkByKey } from "./benchmarks";

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
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=max&includeAdjustedClose=true`;
}

export async function fetchBenchmarkFromYahoo(key: BenchmarkKey): Promise<BenchmarkData> {
  const bench = benchmarkByKey(key);
  if (!bench) throw new Error("Unknown benchmark " + key);

  const res = await fetch(yahooUrl(bench.yahooSymbol), {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
