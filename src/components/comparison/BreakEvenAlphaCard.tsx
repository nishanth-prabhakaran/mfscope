import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Target, Info, Loader2 } from "lucide-react";
import { fetchSchemeDetail, num } from "@/lib/finapiDetail";
import { breakEvenAlpha, INDEX_FUND_TER } from "@/lib/decisions";
import type { NormalizedScheme } from "@/types/mf";
import { fmtInr, colorFor } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
  defaultYears?: number;
}

export function BreakEvenAlphaCard({ schemes, defaultYears = 10 }: Props) {
  const [years, setYears] = useState(defaultYears);
  const [amount, setAmount] = useState(1_000_000);

  const details = useQueries({
    queries: schemes.map((s) => ({
      queryKey: ["scheme-detail", s.code],
      queryFn: () => fetchSchemeDetail(s.code),
      staleTime: 6 * 60 * 60 * 1000,
      retry: 1,
    })),
  });

  const loading = details.some((d) => d.isLoading);

  const rows = useMemo(
    () =>
      schemes
        .map((s, i) => {
          const ter = num(details[i]?.data?.expenseRatio);
          return {
            code: s.code,
            name: s.name,
            i,
            ter,
            result: ter != null ? breakEvenAlpha(ter, years, amount) : null,
          };
        })
        .sort((a, b) => (a.ter ?? Infinity) - (b.ter ?? Infinity)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schemes, details.map((d) => d.dataUpdatedAt).join(","), years, amount],
  );

  if (loading) {
    return (
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm">Loading expense ratios…</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Target className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold sm:text-lg">Break-even Alpha</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How far each fund must beat its index, every year, purely to leave you no worse off than
            a cheap index fund charging {INDEX_FUND_TER}%.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Amount
          <Input
            type="number"
            value={amount}
            step={100000}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
            className="num h-8 w-32 text-xs"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Over
          <Input
            type="number"
            value={years}
            min={1}
            max={40}
            onChange={(e) => setYears(Math.min(40, Math.max(1, Number(e.target.value) || 1)))}
            className="num h-8 w-20 text-xs"
          />
          years
        </label>
      </div>

      <div className="mt-4 grid min-w-0 gap-2">
        {rows.map((r) => (
          <div key={r.code} className="min-w-0 rounded-lg border border-border/50 px-3 py-2.5">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colorFor(r.i) }}
                />
                <span className="truncate text-sm">{r.name}</span>
              </span>
              {r.result ? (
                <span
                  className={cn(
                    "num shrink-0 text-sm font-semibold",
                    r.result.requiredAlpha > 1.2
                      ? "text-destructive"
                      : r.result.requiredAlpha > 0.6
                        ? "text-warning"
                        : "text-success",
                  )}
                >
                  +{r.result.requiredAlpha.toFixed(2)}pp/yr
                </span>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">no fee data</span>
              )}
            </div>
            {r.result && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                Charges <span className="num">{r.ter!.toFixed(2)}%</span>. If it merely matches the
                index gross, you end up <span className="num">{fmtInr(r.result.shortfall)}</span>{" "}
                behind over {years} years on {fmtInr(amount)}.
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="mt-4 flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          A high bar is not automatically a bad fund — some do clear it, and consistently. But this
          is the hurdle the fund has to clear before its manager has added anything, and it applies
          every year, not just the good ones.
        </span>
      </p>
    </Card>
  );
}
