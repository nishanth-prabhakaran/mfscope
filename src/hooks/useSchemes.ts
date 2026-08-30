import { useQuery, useQueries } from "@tanstack/react-query";
import { fetchScheme, fetchSchemeList } from "@/lib/mfapi";

export function useSchemeList() {
  return useQuery({
    queryKey: ["scheme-list"],
    queryFn: fetchSchemeList,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    meta: { errorContext: "Loading the fund list" },
  });
}

export function useSchemes(codes: number[]) {
  return useQueries({
    queries: codes.map((code) => ({
      queryKey: ["scheme", code],
      queryFn: () => fetchScheme(code),
      staleTime: 6 * 60 * 60 * 1000,
      gcTime: 12 * 60 * 60 * 1000,
      meta: { errorContext: "Loading NAV history" },
    })),
  });
}
