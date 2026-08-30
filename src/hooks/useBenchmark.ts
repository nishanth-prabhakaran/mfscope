import { useQuery } from "@tanstack/react-query";
import type { BenchmarkKey } from "@/types/mf";
import { getBenchmark } from "@/lib/benchmarkData";

export function useBenchmark(key: BenchmarkKey | undefined) {
  return useQuery({
    queryKey: ["benchmark", key],
    queryFn: async () => {
      if (!key) return null;
      return getBenchmark(key);
    },
    enabled: !!key,
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    meta: { errorContext: "Loading benchmark index" },
  });
}
