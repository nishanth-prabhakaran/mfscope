import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { toastApiError } from "./lib/apiErrors";

/** Opt a query into a friendlier label via `meta: { errorContext: "…" }`. */
function contextOf(meta: unknown): string | undefined {
  const c = (meta as { errorContext?: unknown } | undefined)?.errorContext;
  return typeof c === "string" ? c : undefined;
}

export const getRouter = () => {
  // One place where every failed data call surfaces to the user. Individual
  // cards no longer need their own error plumbing to stay honest about failures.
  const notify = (error: unknown, meta: unknown, key: string) => {
    if (typeof window === "undefined") return; // no toasts during SSR
    toastApiError(error, contextOf(meta), key);
  };

  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Stale cached data is already on screen; a toast would be noise.
        if (query.state.data !== undefined) return;
        notify(error, query.meta, `query:${String(query.queryKey[0])}`);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        notify(error, mutation.meta, "mutation");
      },
    }),
    defaultOptions: {
      queries: {
        // A screen can fan out to 60 fund fetches; refetching all of them every
        // time the user tabs away and back is pure waste and can trip provider
        // rate limits. The data is daily NAV — it does not change on focus.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        // fetchWithTimeout already retries transient network/5xx failures, so
        // this layer only needs one more attempt for anything that slipped past.
        retry: 1,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        // NAV updates once daily; treat data as fresh for an hour by default so
        // remounting a card doesn't refire a request.
        staleTime: 60 * 60 * 1000,
        gcTime: 12 * 60 * 60 * 1000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
