import { get, set } from "idb-keyval";
import type { BenchmarkData, BenchmarkKey } from "@/types/mf";
import { fetchBenchmark } from "./benchmarkFetch.functions";

const BENCH_KEY = (key: BenchmarkKey) => `benchmark:${key}:v1`;
const BENCH_TTL = 24 * 60 * 60 * 1000;

interface Cached<T> { at: number; data: T }

export async function getBenchmark(key: BenchmarkKey): Promise<BenchmarkData> {
  const cached = await get<Cached<BenchmarkData>>(BENCH_KEY(key)).catch(() => null);
  if (cached && Date.now() - cached.at < BENCH_TTL) return cached.data;
  const data = await fetchBenchmark({ data: { key } });
  await set(BENCH_KEY(key), { at: Date.now(), data } satisfies Cached<BenchmarkData>).catch(() => {});
  return data;
}
