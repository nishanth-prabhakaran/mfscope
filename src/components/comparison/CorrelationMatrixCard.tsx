import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { correlationMatrix, stressCorrelationMatrix } from "@/lib/calculators";
import { fmtPct } from "@/lib/format";
import type { NormalizedScheme } from "@/types/mf";
import { GitMerge, AlertTriangle } from "lucide-react";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
}

export function CorrelationMatrixCard({ schemes }: Props) {
  const matrix = correlationMatrix(schemes);
  // Correlations converge in a crash, so the full-period figure flatters
  // diversification. Show what actually happened on the worst days.
  const stress = stressCorrelationMatrix(schemes);
  const stressBy = new Map(stress.map((m) => [`${m.codeA}-${m.codeB}`, m.value]));
  const overlaps = matrix.filter((m) => m.overlap);
  const worstGap = stress.reduce((best, m) => {
    const normal = matrix.find((n) => n.codeA === m.codeA && n.codeB === m.codeB);
    const gap = normal ? m.value - normal.value : 0;
    return gap > best ? gap : best;
  }, 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitMerge className="h-4 w-4 text-primary" />
            Diversification Overlap
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pairwise correlation of daily returns. Values above 0.85 suggest high overlap.
            {stress.length > 0 &&
              " The stress column covers the worst 10% of days — diversification is judged by that number, not the average one."}
          </p>
        </div>
        {overlaps.length > 0 && (
          <Badge variant="destructive" className="shrink-0 gap-1">
            <AlertTriangle className="h-3 w-3" />
            {overlaps.length} overlap
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {worstGap > 0.1 && (
          <p className="mb-3 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs leading-relaxed">
            One pair correlates {fmtPct(worstGap, 2)} more tightly during the worst 10% of days than
            it does overall. Diversification that disappears in a crash is not diversification —
            these funds fall together precisely when you would need them not to.
          </p>
        )}
        {matrix.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Add at least two funds to see correlations.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="sticky left-0 z-10 bg-card py-2 pr-4 text-left font-medium text-muted-foreground">
                    Pair
                  </th>
                  <th className="py-2 pr-4 text-right font-medium text-muted-foreground">
                    Overall
                  </th>
                  {stress.length > 0 && (
                    <th className="py-2 pr-4 text-right font-medium text-muted-foreground">
                      In a crash
                    </th>
                  )}
                  <th className="py-2 text-left font-medium text-muted-foreground">Signal</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((m) => {
                  // Judge on the stress figure when we have it: a pair that only
                  // decouples in calm markets is not really diversifying.
                  const stressVal = stressBy.get(`${m.codeA}-${m.codeB}`);
                  const abs = Math.abs(stressVal ?? m.value);
                  const variant = abs > 0.85 ? "destructive" : abs > 0.65 ? "default" : "secondary";
                  return (
                    <tr
                      key={`${m.codeA}-${m.codeB}`}
                      className="border-b border-border/30 last:border-0"
                    >
                      <td className="sticky left-0 z-10 bg-card py-2.5 pr-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="max-w-[130px] truncate font-medium sm:max-w-[220px]">
                            {m.nameA}
                          </span>
                          <span className="max-w-[130px] truncate text-xs text-muted-foreground sm:max-w-[220px]">
                            {m.nameB}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{fmtPct(m.value, 2)}</td>
                      {stress.length > 0 && (
                        <td className="py-2.5 pr-4 text-right tabular-nums">
                          {(() => {
                            const sv = stressBy.get(`${m.codeA}-${m.codeB}`);
                            if (sv == null) return <span className="text-muted-foreground">—</span>;
                            return (
                              <span className={sv > 0.85 ? "text-destructive" : undefined}>
                                {fmtPct(sv, 2)}
                              </span>
                            );
                          })()}
                        </td>
                      )}
                      <td className="py-2.5">
                        <Badge variant={variant} className="text-[10px]">
                          {abs > 0.85 ? "High overlap" : abs > 0.65 ? "Moderate" : "Diversified"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
