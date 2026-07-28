import { createServerFn } from "@tanstack/react-start";
import type { BenchmarkData, BenchmarkKey } from "@/types/mf";
import { fetchBenchmarkFromYahoo } from "./benchmarkFetch.server";

export const fetchBenchmark = createServerFn({ method: "GET" })
  .handler(async ({ data }: { data: { key: BenchmarkKey } }): Promise<BenchmarkData> => {
    return fetchBenchmarkFromYahoo(data.key);
  });
