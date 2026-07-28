import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { BenchmarkData, BenchmarkKey } from "@/types/mf";
import { fetchBenchmarkFromYahoo } from "./benchmarkFetch.server";

const benchmarkSchema = z.object({ key: z.string() });

export const fetchBenchmark = createServerFn({ method: "GET" })
  .inputValidator((data) => benchmarkSchema.parse(data))
  .handler(async ({ data }): Promise<BenchmarkData> => {
    return fetchBenchmarkFromYahoo(data.key as BenchmarkKey);
  });
