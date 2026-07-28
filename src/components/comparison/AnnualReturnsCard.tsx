import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { annualReturns } from "@/lib/calculators";
import { fmtPct, colorFor } from "@/lib/format";
import type { NormalizedScheme } from "@/types/mf";
import { CalendarDays } from "lucide-react";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
}

export function AnnualReturnsCard({ schemes }: Props) {
  const yearsSet = new Set<number>();
  const byCode = new Map<number, Map<number, number>>();
  for (const s of schemes) {
    const map = new Map<number, number>();
    annualReturns(s.data.rows).forEach((a) => {
      yearsSet.add(a.year);
      map.set(a.year, a.value);
    });
    byCode.set(s.code, map);
  }
  const years = Array.from(yearsSet).sort((a, b) => a - b);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-primary" />
          Calendar Year Returns
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Year-by-year performance grid. Green/red intensity reflects return magnitude.
        </p>
      </CardHeader>
      <CardContent>
        {years.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Insufficient history for annual returns.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-2 pr-4 text-left font-medium text-muted-foreground min-w-[200px]">Fund</th>
                  {years.map((y) => (
                    <th key={y} className="py-2 px-2 text-right font-medium text-muted-foreground tabular-nums">
                      {y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schemes.map((s, idx) => (
                  <tr key={s.code} className="border-b border-border/30 last:border-0">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: colorFor(idx) }} />
                        <span className="truncate max-w-[220px] font-medium">{s.name}</span>
                      </div>
                    </td>
                    {years.map((y) => {
                      const v = byCode.get(s.code)?.get(y);
                      const pct = v == null ? null : v * 100;
                      const bg = pct == null
                        ? undefined
                        : pct >= 0
                          ? `rgba(34, 197, 94, ${Math.min(Math.max(pct / 40, 0.08), 0.35)})`
                          : `rgba(239, 68, 68, ${Math.min(Math.max(Math.abs(pct) / 25, 0.08), 0.35)})`;
                      return (
                        <td
                          key={y}
                          className="py-2.5 px-2 text-right tabular-nums"
                          style={{ background: bg }}
                        >
                          {v == null ? "—" : fmtPct(v, 1)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
