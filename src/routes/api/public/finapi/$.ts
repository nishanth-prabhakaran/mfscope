import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-side proxy for finapi.
 *
 * The provider now requires an `X-API-Key` header. That key must never reach
 * the browser, so every client fetch goes through this same-origin passthrough
 * which attaches the key server-side. Read-only: GET requests to a small
 * allow-list of fund/index endpoints only.
 */
const UPSTREAM = "https://api.finapi.upvaly.com/api";

const ALLOWED = [/^mf$/, /^mf\/search$/, /^mf\/scheme-code\/\d+$/, /^mf\/scheme-code\/\d+\/nav$/, /^nifty-indices$/];

export const Route = createFileRoute("/api/public/finapi/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!ALLOWED.some((re) => re.test(path))) {
          return new Response("Not found", { status: 404 });
        }

        const key = process.env["FINAPI_API_KEY"];
        if (!key) return new Response("API key not configured", { status: 500 });

        const search = new URL(request.url).search;
        const res = await fetch(`${UPSTREAM}/${path}${search}`, {
          headers: { Accept: "application/json", "X-API-Key": key },
        });

        const body = await res.text();
        return new Response(body, {
          status: res.status,
          headers: {
            "Content-Type": res.headers.get("content-type") ?? "application/json",
            "Cache-Control": "public, max-age=1800",
          },
        });
      },
    },
  },
});
