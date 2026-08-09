import type { Benchmark, BenchmarkKey } from "@/types/mf";

/**
 * Benchmarks resolve in this order (see benchmarkFetch.server.ts):
 *   1. finapi /api/nifty-indices  — true TRI, matches how funds are measured
 *   2. proxy index-fund NAV       — for indices finapi/Yahoo don't carry
 *   3. Yahoo Finance              — price-return only, last resort
 *
 * Labels say "TRI" only where a total-return series is actually available,
 * since comparing a fund's NAV (which includes dividends) against a
 * price-return index systematically overstates outperformance.
 */
export const BENCHMARKS: Benchmark[] = [
  {
    key: "nifty50",
    label: "Nifty 50 TRI",
    yahooSymbol: "^NSEI",
    finapiIndexName: "NIFTY 50",
    categoryHint: ["large cap", "bluechip", "index"],
  },
  {
    key: "nifty100",
    label: "Nifty 100 TRI",
    yahooSymbol: "^CNX100",
    finapiIndexName: "NIFTY 100",
    categoryHint: ["large cap", "mid cap", "large & mid"],
  },
  {
    key: "nifty150midcap",
    label: "Nifty Midcap 150 TRI",
    yahooSymbol: "^CNXMID",
    finapiIndexName: "NIFTY MIDCAP 150",
    categoryHint: ["mid cap"],
  },
  {
    key: "niftylargemid250",
    label: "Nifty LargeMidcap 250 TRI",
    yahooSymbol: "NIFTY_LARGEMID250.NS",
    finapiIndexName: "NIFTY LARGEMIDCAP 250",
    proxySchemeCode: 152156,
    categoryHint: ["large & mid", "large and mid"],
  },
  {
    key: "nifty250smallcap",
    label: "Nifty Smallcap 250 TRI",
    yahooSymbol: "^CNXSMALL",
    finapiIndexName: "NIFTY SMALLCAP 250",
    categoryHint: ["small cap"],
  },
  {
    key: "nifty500",
    label: "Nifty 500 TRI",
    yahooSymbol: "^CRSLDX",
    finapiIndexName: "NIFTY 500",
    categoryHint: ["multi cap", "flexi cap"],
  },
  {
    key: "niftynext50",
    label: "Nifty Next 50 TRI",
    yahooSymbol: "^NX50",
    finapiIndexName: "NIFTY NEXT 50",
    categoryHint: ["large cap"],
  },
  // Sensex is a BSE index, so the NSE-oriented finapi endpoint has no entry
  // for it. Stays on Yahoo, hence price return rather than TRI.
  { key: "sensex", label: "Sensex", yahooSymbol: "^BSESN", categoryHint: ["large cap", "index"] },
];

export function benchmarkByKey(key: BenchmarkKey): Benchmark | undefined {
  return BENCHMARKS.find((b) => b.key === key);
}

export function defaultBenchmarkFor(fundName: string): BenchmarkKey {
  const lower = fundName.toLowerCase();
  if (lower.includes("small cap")) return "nifty250smallcap";
  if (lower.includes("mid cap")) return "nifty150midcap";
  if (
    lower.includes("large & mid") ||
    lower.includes("large and mid") ||
    lower.includes("largemid")
  )
    return "niftylargemid250";
  if (
    lower.includes("flexi cap") ||
    lower.includes("multi cap") ||
    lower.includes("value") ||
    lower.includes("balanced")
  )
    return "nifty500";
  return "nifty50";
}
