import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Crosshair, Info, Search } from "lucide-react";
import { fetchSchemeDetail } from "@/lib/finapiDetail";
import { toWeighted, activeShare, activeShareVerdict } from "@/lib/overlap";
import { guessCategory } from "@/lib/categories";
import type { NormalizedScheme } from "@/types/mf";
import { colorFor } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * finapi exposes fund portfolios but not raw index constituents, so we use a
 * low-tracking-error index fund's disclosed holdings as a stand-in for the
 * index itself. Tracking error on these is a few basis points, far below the
 * precision Active Share needs — the same proxy trick the benchmark loader
 * already uses for indices Yahoo doesn't carry.
 */
interface IndexProxy {
  code: number;
  label: string;
  /** Every token must appear in the fetched fund's name, case-insensitively.
   *  Guards against a scheme code being wrong, reused, or retired — a silently
   *  wrong index produces a confidently wrong Active Share, which is worse than
   *  showing nothing. */
  expect: string[];
}

const NIFTY50: IndexProxy = {
  code: 120716,
  label: "Nifty 50 (via an index fund)",
  expect: ["nifty", "50"],
};
const NIFTY500: IndexProxy = {
  code: 125354,
  label: "Nifty 500 (via an index fund)",
  expect: ["nifty", "500"],
};
const LARGEMID250: IndexProxy = {
  code: 152156,
  label: "Nifty LargeMidcap 250 (via an index fund)",
  expect: ["nifty", "250"],
};

const INDEX_PROXY: Record<string, IndexProxy> = {
  "Large Cap": NIFTY50,
  Index: NIFTY50,
  ELSS: NIFTY50,
  "Flexi Cap": NIFTY500,
  "Multi Cap": NIFTY500,
  Value: NIFTY500,
  Contra: NIFTY500,
  Focused: NIFTY500,
  "Large & Mid Cap": LARGEMID250,
  // Mid Cap deliberately omitted: the nearest available proxy is LargeMidcap
  // 250, whose large-cap half a mid-cap fund would never hold. Comparing against
  // it would inflate Active Share for reasons that have nothing to do with
  // active management. Better to skip than to mislead.
};

/** A plausible index portfolio: right name, and broad enough to be an index. */
function validateProxy(
  proxy: IndexProxy,
  name: string | undefined,
  holdingsCount: number,
): string | null {
  if (!name) return "Could not load the index portfolio.";
  const lower = name.toLowerCase();
  if (!lower.includes("index") && !lower.includes("nifty")) {
    return "The reference fund for this category no longer looks like an index fund.";
  }
  if (!proxy.expect.every((t) => lower.includes(t))) {
    return "The reference fund does not match the expected index.";
  }
  if (holdingsCount < 20) {
    return "The index portfolio looks incomplete.";
  }
  return null;
}

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
}

export function ActiveShareCard({ schemes }: Props) {
  const [run, setRun] = useState(false);

  const targets = useMemo(
    () =>
      schemes.map((s) => {
        const cat = guessCategory(s.name);
        return { ...s, category: cat, proxy: cat ? INDEX_PROXY[cat] : undefined };
      }),
    [schemes],
  );

  const proxyCodes = useMemo(
    () => Array.from(new Set(targets.map((t) => t.proxy?.code).filter(Boolean) as number[])),
    [targets],
  );

  const fundDetails = useQueries({
    queries: targets.map((t) => ({
      queryKey: ["scheme-detail", t.code],
      queryFn: () => fetchSchemeDetail(t.code),
      enabled: run,
      staleTime: 6 * 60 * 60 * 1000,
      retry: 1,
    })),
  });

  const proxyQuery = useQuery({
    queryKey: ["active-share-proxies", proxyCodes.join(",")],
    enabled: run && proxyCodes.length > 0,
    staleTime: 12 * 60 * 60 * 1000,
    queryFn: async () => {
      const byCode = new Map<number, IndexProxy>();
      for (const t of targets) if (t.proxy) byCode.set(t.proxy.code, t.proxy);

      const entries = await Promise.all(
        proxyCodes.map(async (code) => {
          const proxy = byCode.get(code)!;
          try {
            const d = await fetchSchemeDetail(code);
            const holdings = toWeighted(d.holdings);
            const problem = validateProxy(proxy, d.schemeName, holdings.length);
            // Reject rather than compare against something unverified.
            if (problem) return [code, { holdings: [], problem }] as const;
            return [code, { holdings, problem: null as string | null }] as const;
          } catch {
            return [
              code,
              { holdings: [], problem: "Could not load the index portfolio." },
            ] as const;
          }
        }),
      );
      return Object.fromEntries(entries) as Record<
        number,
        { holdings: ReturnType<typeof toWeighted>; problem: string | null }
      >;
    },
  });

  const loading = run && (fundDetails.some((d) => d.isLoading) || proxyQuery.isLoading);

  const rows = useMemo(() => {
    if (!run || !proxyQuery.data) return [];
    return targets.map((t, i) => {
      const fundHoldings = toWeighted(fundDetails[i]?.data?.holdings);
      const entry = t.proxy ? proxyQuery.data![t.proxy.code] : undefined;
      return {
        ...t,
        i,
        problem: entry?.problem ?? null,
        result: entry?.holdings.length ? activeShare(fundHoldings, entry.holdings) : null,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, targets, proxyQuery.data, fundDetails.map((d) => d.dataUpdatedAt).join(",")]);

  const unsupported = targets.filter((t) => !t.proxy);

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Crosshair className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold sm:text-lg">Active Share</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How much of the portfolio actually differs from its index. A fund charging active fees
            while largely mirroring the index is a closet indexer.
          </p>
        </div>
      </div>

      {!run ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 text-xs text-muted-foreground">
            Fetches the index portfolio to compare against, so it runs on request.
          </p>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => setRun(true)}>
            <Search className="mr-1.5 h-3.5 w-3.5" /> Compute
          </Button>
        </div>
      ) : loading ? (
        <div className="mt-4 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm">Loading portfolios…</span>
        </div>
      ) : (
        <div className="mt-4 grid min-w-0 gap-2">
          {rows.map((r) => {
            if (!r.result) {
              return (
                <div
                  key={r.code}
                  className="min-w-0 rounded-lg border border-border/50 px-3 py-2.5 text-xs"
                >
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="mt-1 text-muted-foreground">
                    {r.problem
                      ? `${r.problem} Active Share is hidden rather than shown against the wrong index.`
                      : r.proxy
                        ? "Holdings unavailable for this fund."
                        : `No comparable index for ${r.category ?? "this category"} — Active Share isn't meaningful here.`}
                  </p>
                </div>
              );
            }
            const v = activeShareVerdict(r.result.activeShare);
            return (
              <div key={r.code} className="min-w-0 rounded-lg border border-border/50 px-3 py-2.5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: colorFor(r.i) }}
                      />
                      <p className="truncate text-sm font-medium">{r.name}</p>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      vs {r.proxy!.label}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("num text-sm font-semibold", v.tone)}>
                      {r.result.activeShare.toFixed(1)}%
                    </p>
                    <p className={cn("text-[11px]", v.tone)}>{v.label}</p>
                  </div>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      r.result.activeShare < 20
                        ? "bg-info"
                        : r.result.activeShare < 60
                          ? "bg-warning"
                          : "bg-success",
                    )}
                    style={{ width: `${Math.min(100, r.result.activeShare)}%` }}
                  />
                </div>

                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{v.note}</p>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="num">
                    Off-index holdings {r.result.offBenchmarkPct.toFixed(1)}%
                  </span>
                  <span className="num">
                    Index names not held {r.result.missingPct.toFixed(1)}%
                  </span>
                  <span className="num">{r.result.fundHoldings} stocks</span>
                </div>

                {r.result.topDeviations.length > 0 && (
                  <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
                    Biggest bets:{" "}
                    {r.result.topDeviations
                      .slice(0, 3)
                      .map((d) => `${d.name} ${d.diff > 0 ? "+" : ""}${d.diff.toFixed(1)}%`)
                      .join(", ")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Index composition is taken from a low-tracking-error index fund's disclosed portfolio,
          since raw index constituents aren't available — close, but not the official index. High
          Active Share means different, not better: it raises the odds of both outperformance and
          underperformance.
          {unsupported.length > 0 &&
            ` ${unsupported.length} selected fund(s) have no comparable index and are skipped.`}
        </span>
      </p>
    </Card>
  );
}
