import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { BenchmarkData, BenchmarkKey } from "@/types/mf";
import { fetchBenchmarkSeries } from "./benchmarkFetch.server";

const benchmarkSchema = z.object({ key: z.string() });

export const fetchBenchmark = createServerFn({ method: "GET" })
  .inputValidator((data) => benchmarkSchema.parse(data))
  .handler(async ({ data }): Promise<BenchmarkData> => {
    return fetchBenchmarkSeries(data.key as BenchmarkKey);
  });
