import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Loader2, Layers, AlertTriangle, Info } from "lucide-react";
import { fetchSchemeDetail } from "@/lib/finapiDetail";
import {
  toWeighted,
  allOverlaps,
  combinedExposure,
  overlapTone,
  type FundHoldings,
} from "@/lib/overlap";
import type { NormalizedScheme } from "@/types/mf";
import { colorFor } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
}

export function PortfolioOverlapCard({ schemes }: Props) {
  const details = useQueries({
    queries: schemes.map((s) => ({
      queryKey: ["scheme-detail", s.code],
      queryFn: () => fetchSchemeDetail(s.code),
      staleTime: 6 * 60 * 60 * 1000,
      retry: 1,
    })),
  });

  const loading = details.some((d) => d.isLoading);

  const funds: FundHoldings[] = useMemo(
    () =>
      schemes.map((s, i) => ({
        code: s.code,
        name: s.name,
        holdings: toWeighted(details[i]?.data?.holdings),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schemes, details.map((d) => d.dataUpdatedAt).join(",")],
  );

  const withHoldings = funds.filter((f) => f.holdings.length);
  const missing = funds.filter((f) => !f.holdings.length);

  const pairs = useMemo(() => allOverlaps(funds), [funds]);
  const combined = useMemo(() => combinedExposure(funds).slice(0, 12), [funds]);

  if (loading) {
    return (
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm">Loading portfolio holdings…</span>
        </div>
      </Card>
    );
  }

  if (withHoldings.length < 2) {
    return (
      <Card className="p-4 sm:p-5">
        <h3 className="font-display text-base font-semibold sm:text-lg">Portfolio Overlap</h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Holdings data is available for {withHoldings.length} of the selected funds. At least two
          are needed to measure overlap.
        </p>
      </Card>
    );
  }

  const worst = pairs[0];

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Layers className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold sm:text-lg">Portfolio Overlap</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How much of these funds is the same stocks. Measured from actual holdings as the sum of
            the smaller weight in each shared position.
          </p>
        </div>
      </div>

      {worst && worst.overlapPct >= 50 && (
        <div className="mt-3 flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs leading-relaxed">
            <span className="font-medium">{worst.overlapPct.toFixed(0)}% overlap</span> between two
            of your funds. Holding both gives you far less diversification than it appears — you are
            largely buying the same portfolio twice, while paying two expense ratios.
          </p>
        </div>
      )}

      {/* Pairwise overlap */}
      <div className="mt-4 grid min-w-0 gap-2">
        {pairs.map((p) => {
          const tone = overlapTone(p.overlapPct);
          return (
            <div
              key={`${p.codeA}-${p.codeB}`}
              className="min-w-0 rounded-lg border border-border/50 px-3 py-2.5"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 text-xs">
                  <p className="truncate">{p.nameA}</p>
                  <p className="truncate text-muted-foreground">{p.nameB}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn("num text-sm font-semibold", tone.tone)}>
                    {p.overlapPct.toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-muted-foreground">{tone.label}</p>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    p.overlapPct >= 70
                      ? "bg-destructive"
                      : p.overlapPct >= 50
                        ? "bg-amber-400"
                        : "bg-primary",
                  )}
                  style={{ width: `${Math.min(100, p.overlapPct)}%` }}
                />
              </div>
              {p.topShared.length > 0 && (
                <p className="mt-2 truncate text-[11px] text-muted-foreground">
                  Shared:{" "}
                  {p.topShared
                    .slice(0, 4)
                    .map((s) => s.name)
                    .join(", ")}
                  {p.sharedCount > 4 ? ` +${p.sharedCount - 4} more` : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* True combined exposure */}
      {combined.length > 0 && (
        <div className="mt-5 min-w-0">
          <h4 className="text-sm font-semibold">Your true combined exposure</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Equal-weighting the selected funds. No single fund shows you this.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[300px] text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/50">
                  <th className="py-1.5 pr-3 text-left font-medium">Stock</th>
                  <th className="py-1.5 px-2 text-right font-medium">Weight</th>
                  <th className="py-1.5 pl-2 text-right font-medium">In funds</th>
                </tr>
              </thead>
              <tbody>
                {combined.map((c, i) => (
                  <tr key={c.name} className="border-b border-border/30 last:border-0">
                    <td className="py-1.5 pr-3">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: colorFor(i) }}
                        />
                        <span className="truncate">{c.name}</span>
                      </span>
                    </td>
                    <td className="num py-1.5 px-2 text-right">{c.weight.toFixed(2)}%</td>
                    <td className="num py-1.5 pl-2 text-right text-muted-foreground">
                      {c.fundCount}/{withHoldings.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Based on the latest disclosed portfolios, which funds publish monthly and with a lag —
          actual holdings today will differ. Cash, TREPS and receivables are excluded.
          {missing.length > 0 &&
            ` No holdings data for ${missing.length} selected fund(s), so they are omitted.`}
        </span>
      </p>
    </Card>
  );
}
