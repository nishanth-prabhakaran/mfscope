import type { Benchmark, BenchmarkKey } from "@/types/mf";

export const BENCHMARKS: Benchmark[] = [
  { key: "nifty50", label: "Nifty 50 TRI", yahooSymbol: "^NSEI", categoryHint: ["large cap", "bluechip", "index"] },
  { key: "nifty100", label: "Nifty 100", yahooSymbol: "^CNX100", categoryHint: ["large cap", "mid cap", "large & mid"] },
  { key: "nifty150midcap", label: "Nifty Midcap 150", yahooSymbol: "^CNXMID", categoryHint: ["mid cap"] },
  { key: "niftylargemid250", label: "Nifty LargeMidcap 250 (index fund proxy)", yahooSymbol: "NIFTY_LARGEMID250.NS", mfapiProxyCode: 152156, categoryHint: ["large & mid", "large and mid"] },
  { key: "nifty250smallcap", label: "Nifty Smallcap 250", yahooSymbol: "^CNXSMALL", categoryHint: ["small cap"] },
  { key: "nifty500", label: "Nifty 500", yahooSymbol: "^CRSLDX", categoryHint: ["multi cap", "flexi cap"] },
  { key: "niftynext50", label: "Nifty Next 50", yahooSymbol: "^NX50", categoryHint: ["large cap"] },
  { key: "sensex", label: "Sensex", yahooSymbol: "^BSESN", categoryHint: ["large cap", "index"] },
];

export function benchmarkByKey(key: BenchmarkKey): Benchmark | undefined {
  return BENCHMARKS.find((b) => b.key === key);
}

export function defaultBenchmarkFor(fundName: string): BenchmarkKey {
  const lower = fundName.toLowerCase();
  if (lower.includes("small cap")) return "nifty250smallcap";
  if (lower.includes("mid cap")) return "nifty150midcap";
  if (lower.includes("large & mid") || lower.includes("large and mid") || lower.includes("largemid")) return "niftylargemid250";
  if (lower.includes("flexi cap") || lower.includes("multi cap") || lower.includes("value") || lower.includes("balanced")) return "nifty500";
  return "nifty50";
}
