import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { correlationMatrix } from "@/lib/calculators";
import { fmtPct } from "@/lib/format";
import type { NormalizedScheme } from "@/types/mf";
import { GitMerge, AlertTriangle } from "lucide-react";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
}

export function CorrelationMatrixCard({ schemes }: Props) {
  const matrix = correlationMatrix(schemes);
  const overlaps = matrix.filter((m) => m.overlap);

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
        {matrix.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Add at least two funds to see correlations.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-2 pr-4 text-left font-medium text-muted-foreground">Pair</th>
                  <th className="py-2 pr-4 text-right font-medium text-muted-foreground">Correlation</th>
                  <th className="py-2 text-left font-medium text-muted-foreground">Signal</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((m) => {
                  const abs = Math.abs(m.value);
                  const tone = abs > 0.85 ? "destructive" : abs > 0.65 ? "warning" : "success";
                  return (
                    <tr key={`${m.codeA}-${m.codeB}`} className="border-b border-border/30 last:border-0">
                      <td className="py-2.5 pr-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="truncate max-w-[220px] font-medium">{m.nameA}</span>
                          <span className="truncate max-w-[220px] text-xs text-muted-foreground">{m.nameB}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        {formatPct(m.value, 2)}
                      </td>
                      <td className="py-2.5">
                        <Badge variant={tone} className="text-[10px]">
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
