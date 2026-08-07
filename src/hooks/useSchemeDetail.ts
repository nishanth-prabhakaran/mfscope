import { useQuery } from "@tanstack/react-query";
import { fetchSchemeDetail } from "@/lib/finapiDetail";

export function useSchemeDetail(code: number | null) {
  return useQuery({
    queryKey: ["scheme-detail", code],
    queryFn: () => fetchSchemeDetail(code as number),
    enabled: code != null,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });
}
