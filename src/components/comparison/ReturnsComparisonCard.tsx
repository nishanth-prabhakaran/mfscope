import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { periodReturn, RETURN_PERIODS } from "@/lib/calculators";
import type { NormalizedScheme } from "@/types/mf";
import { colorFor, fmtPct } from "@/lib/format";

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

  const bestByPeriod = RETURN_PERIODS.map((_, pi) => {
    let bestV = -Infinity, bestCode = -1;
    for (const r of rows) {
      const v = r.values[pi].v;
      if (v != null && v > bestV) { bestV = v; bestCode = r.code; }
    }
    return bestCode;
  });

  return (
    <Card className="p-5">
      <div>
        <h3 className="font-display text-lg font-semibold">Point-to-Point Returns</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Trailing returns across standard periods (CAGR for ≥1Y).</p>
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
                  const isBest = bestByPeriod[i] === r.code && v.v != null;
                  const positive = v.v != null && v.v >= 0;
                  return (
                    <td
                      key={v.label}
                      className={`text-right py-2 pl-3 ${
                        isBest ? "text-success font-semibold" : positive ? "" : "text-destructive-foreground"
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
