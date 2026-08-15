import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Landmark, Info, Loader2 } from "lucide-react";
import { fetchSchemeDetail } from "@/lib/finapiDetail";
import { classifyForTax, postTaxCagr, SLAB_OPTIONS, type TaxAssetClass } from "@/lib/tax";
import { calculateCAGR } from "@/lib/calculators";
import type { NormalizedScheme } from "@/types/mf";
import { fmtPct, colorFor } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
  /** Horizon from the risk profile, when available. */
  defaultYears?: number;
}

const CLASS_LABEL: Record<TaxAssetClass, string> = {
  equity: "Equity",
  "hybrid-equity": "Hybrid (equity-taxed)",
  debt: "Debt",
  "hybrid-debt": "Hybrid (debt-taxed)",
  "gold-intl": "Gold / International",
};

export function PostTaxReturnsCard({ schemes, defaultYears = 10 }: Props) {
  const [slab, setSlab] = useState(0.3);
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
      schemes.map((s, i) => {
        const d = details[i]?.data;
        const assetClass = classifyForTax(d?.schemeCategory, s.name);

        // Use the fund's own realised CAGR over the chosen horizon where it has
        // enough history, so the tax figure reflects this fund rather than an
        // assumed market return.
        const navs = s.data.rows;
        const last = navs[navs.length - 1];
        const cutoff = last.t - years * 365.25 * 86_400_000;
        const startRow = navs.find((r) => r.t >= cutoff);
        const hasHistory = startRow != null && startRow.t < last.t;
        const preTax = hasHistory
          ? calculateCAGR(startRow.nav, last.nav, (last.t - startRow.t) / (365.25 * 86_400_000))
          : null;

        const projected = preTax != null ? postTaxCagr(preTax, years, assetClass, slab) : null;

        return {
          code: s.code,
          name: s.name,
          i,
          assetClass,
          exitLoad: d?.exitLoadMessage?.trim() || null,
          preTax,
          projected,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schemes, details.map((d) => d.dataUpdatedAt).join(","), slab, years],
  );

  if (loading) {
    return (
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm">Loading scheme details…</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Landmark className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold sm:text-lg">Post-tax Returns</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Every other return figure here is pre-tax. This is what would actually be left after tax
            on redemption, on the rules in force since July 2024.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Your tax slab
          <select
            value={slab}
            onChange={(e) => setSlab(Number(e.target.value))}
            className="h-8 rounded-md border border-border/60 bg-background px-2 text-xs"
          >
            {SLAB_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Held for
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

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[460px] text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border/50">
              <th className="sticky left-0 z-10 bg-card py-2 pr-3 text-left font-medium">Fund</th>
              <th className="px-2 py-2 text-left font-medium">Taxed as</th>
              <th className="px-2 py-2 text-right font-medium">Pre-tax</th>
              <th className="px-2 py-2 text-right font-medium">Post-tax</th>
              <th className="py-2 pl-2 text-right font-medium">Tax drag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-b border-border/30 last:border-0">
                <td className="sticky left-0 z-10 bg-card py-2 pr-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colorFor(r.i) }}
                    />
                    <span className="max-w-[110px] truncate sm:max-w-[160px]">{r.name}</span>
                  </span>
                </td>
                <td className="px-2 py-2 text-muted-foreground">{CLASS_LABEL[r.assetClass]}</td>
                <td className="num px-2 py-2 text-right">
                  {r.preTax != null ? fmtPct(r.preTax, 2) : "—"}
                </td>
                <td className="num px-2 py-2 text-right font-medium">
                  {r.projected ? fmtPct(r.projected.postTax, 2) : "—"}
                </td>
                <td
                  className={cn(
                    "num py-2 pl-2 text-right",
                    r.projected && r.projected.drag > 0.015 ? "text-destructive" : "text-warning",
                  )}
                >
                  {r.projected ? `−${(r.projected.drag * 100).toFixed(2)}pp` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.some((r) => r.projected) && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {rows.find((r) => r.projected)?.projected &&
            `Basis: ${rows.find((r) => r.projected)!.projected!.basis}.`}{" "}
          Tax is charged once on redemption, so a longer hold spreads it over more years — one
          reason switching funds frequently is expensive even when the new fund is better.
        </p>
      )}

      {rows.some((r) => r.exitLoad) && (
        <div className="mt-4 min-w-0">
          <h4 className="text-sm font-semibold">Exit load</h4>
          <div className="mt-1.5 grid min-w-0 gap-1.5">
            {rows
              .filter((r) => r.exitLoad)
              .map((r) => (
                <div
                  key={r.code}
                  className="min-w-0 rounded-md border border-border/50 px-2.5 py-1.5"
                >
                  <p className="truncate text-[11px] font-medium">{r.name}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {r.exitLoad}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      <p className="mt-4 flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Illustrative, not tax advice. Assumes a lump sum held for the full period and redeemed in
          one go; surcharge, cess, loss set-off and pre-2018 grandfathering are not modelled, and a
          SIP would have each instalment taxed by its own holding period. The pre-tax figure is this
          fund's own realised CAGR over the period, so it is history, not a forecast. Confirm with a
          tax adviser.
        </span>
      </p>
    </Card>
  );
}
