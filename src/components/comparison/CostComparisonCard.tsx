import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, IndianRupee, Info } from "lucide-react";
import { fetchSchemeDetail, num } from "@/lib/finapiDetail";
import { projectCost } from "@/lib/overlap";
import type { NormalizedScheme } from "@/types/mf";
import { fmtInr, colorFor } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
  /** Horizon from the risk profile, when the questionnaire has been completed. */
  defaultYears?: number;
}

const GROSS_RETURN = 0.12;

export function CostComparisonCard({ schemes, defaultYears = 10 }: Props) {
  const [amount, setAmount] = useState(1_000_000);
  const [years, setYears] = useState(defaultYears);

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
          const d = details[i]?.data;
          const er = num(d?.expenseRatio);
          const aum = num(d?.aum);
          return {
            code: s.code,
            name: s.name,
            i,
            er,
            aum,
            managers: d?.schemeFundManagers?.trim() || null,
            cost: er != null ? projectCost(er, amount, years, GROSS_RETURN) : null,
          };
        })
        .sort((a, b) => (a.er ?? Infinity) - (b.er ?? Infinity)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schemes, details.map((d) => d.dataUpdatedAt).join(","), amount, years],
  );

  const priced = rows.filter((r) => r.er != null && r.cost);
  const spread =
    priced.length >= 2
      ? priced[priced.length - 1].cost!.dragRupees - priced[0].cost!.dragRupees
      : null;

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
          <IndianRupee className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold sm:text-lg">Cost & Size</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Fees compound too. This shows what the expense ratio actually costs over your horizon,
            not just the headline percentage.
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
          Years
          <Input
            type="number"
            value={years}
            min={1}
            max={40}
            onChange={(e) => setYears(Math.min(40, Math.max(1, Number(e.target.value) || 1)))}
            className="num h-8 w-20 text-xs"
          />
        </label>
      </div>

      {spread != null && spread > 0 && (
        <div className="mt-3 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs leading-relaxed">
          Across these funds, the gap between the cheapest and priciest is{" "}
          <span className="num font-semibold text-foreground">{fmtInr(spread)}</span> over {years}{" "}
          years on {fmtInr(amount)} — purely from fees, before any difference in performance.
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border/50">
              <th className="py-2 pr-3 text-left font-medium">Fund</th>
              <th className="py-2 px-2 text-right font-medium">Expense</th>
              <th className="py-2 px-2 text-right font-medium">AUM (Cr)</th>
              <th className="py-2 pl-2 text-right font-medium">Fees over {years}y</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.code} className="border-b border-border/30 last:border-0">
                <td className="py-2 pr-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colorFor(r.i) }}
                    />
                    <span className="max-w-[180px] truncate">{r.name}</span>
                  </span>
                </td>
                <td
                  className={cn(
                    "num py-2 px-2 text-right",
                    idx === 0 && r.er != null && "font-semibold text-success",
                  )}
                >
                  {r.er != null ? `${r.er.toFixed(2)}%` : "—"}
                </td>
                <td className="num py-2 px-2 text-right text-muted-foreground">
                  {r.aum != null
                    ? r.aum.toLocaleString("en-IN", { maximumFractionDigits: 0 })
                    : "—"}
                </td>
                <td className="num py-2 pl-2 text-right">
                  {r.cost ? fmtInr(r.cost.dragRupees) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Fee figures assume a {(GROSS_RETURN * 100).toFixed(0)}% gross annual return and a lump sum
          held for the full period; they are illustrative, not a forecast. A higher expense ratio
          can still be worth paying if the fund earns it back — compare this against the returns and
          risk tabs rather than reading it alone.
        </span>
      </p>
    </Card>
  );
}
