import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { periodReturn, RETURN_PERIODS } from "@/lib/calculators";
import type { NormalizedScheme } from "@/types/mf";
import { colorFor, fmtPct } from "@/lib/format";
import { MetricGlossaryButton, MetricInfo, RankLegend } from "./MetricInfo";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
  benchmarkRows?: import("@/types/mf").NavRow[];
}

export function ReturnsComparisonCard({ schemes, benchmarkRows }: Props) {
  const rows = useMemo(() =>
    schemes.map((s, i) => ({
      ...s, i,
      values: RETURN_PERIODS.map((p) => ({ label: p.label, v: periodReturn(s.data.rows, p.months) })),
    })), [schemes]);

  // best + second best fund code for each period
  const ranksByPeriod = useMemo(() => RETURN_PERIODS.map((_, pi) => {
    const sorted = rows
      .map((r) => ({ code: r.code, v: r.values[pi].v }))
      .filter((x): x is { code: number; v: number } => x.v != null && Number.isFinite(x.v))
      .sort((a, b) => b.v - a.v);
    return { best: sorted[0]?.code ?? -1, second: sorted[1]?.code ?? -1 };
  }), [rows]);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <h3 className="font-display text-base sm:text-lg font-semibold flex items-center gap-1.5">
            Point-to-Point Returns
            <MetricInfo id="periodReturn" />
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Trailing returns across standard periods (CAGR for ≥1Y).</p>
          <RankLegend className="mt-2" />
        </div>
        <MetricGlossaryButton />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs num">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border/60">
              <th className="text-left font-medium py-2 pr-3">Fund</th>
              {RETURN_PERIODS.map((p) => (
                <th key={p.label} className="text-right font-medium py-2 pl-3">{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-b border-border/30 last:border-0">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(r.i) }} />
                    <span className="truncate max-w-[240px]">{r.name}</span>
                  </div>
                </td>
                {r.values.map((v, i) => {
                  const isBest = ranksByPeriod[i].best === r.code && v.v != null;
                  const isSecond = ranksByPeriod[i].second === r.code && v.v != null;
                  const positive = v.v != null && v.v >= 0;
                  return (
                    <td
                      key={v.label}
                      className={`text-right py-2 pl-3 ${
                        isBest
                          ? "text-success font-semibold"
                          : isSecond
                            ? "text-info font-medium"
                            : positive ? "" : "text-destructive-foreground"
                      }`}
                    >
                      {fmtPct(v.v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

