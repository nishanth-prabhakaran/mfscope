import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
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
