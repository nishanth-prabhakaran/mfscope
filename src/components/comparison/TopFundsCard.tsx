import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Loader2, Plus, Check, RefreshCw } from "lucide-react";
import { fetchScheme } from "@/lib/finapi";
import { useSchemeList } from "@/hooks/useSchemes";
import { CATEGORIES } from "@/lib/categories";
import {
  calculateRisk,
  calculateRollingReturns,
  rollingStats,
  calculateConsistencyScore,
  calculateOverallScore,
  starRating,
  scoreLabel,
  drawdownSeries,
  maxDrawdown,
} from "@/lib/calculators";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MetricInfo } from "@/components/comparison/MetricInfo";
import type { RollingYears } from "@/types/mf";
import { buildUniverse, mapPool, CONCURRENCY, UNIVERSE_CAP } from "@/lib/universe";

const PERIODS: RollingYears[] = [1, 3, 5, 7, 10, 12, 15];

interface Props {
  onAdd?: (f: { schemeCode: number; schemeName: string }) => void;
  isSelected?: (code: number) => boolean;
  canAdd?: boolean;
}

interface Ranked {
  code: number;
  name: string;
  amc: string;
  overall: number;
  consistency: number;
  rollingMean: number;
  rollingMin: number;
  positivePct: number;
  sharpe: number;
  sortino: number;
  volatility: number;
  maxDD: number;
  windows: number;
}

export function TopFundsCard({ onAdd, isSelected, canAdd = true }: Props) {
  const { data: list, isLoading: listLoading } = useSchemeList();
  const [category, setCategory] = useState<string>("Flexi Cap");
  const [period, setPeriod] = useState<RollingYears>(3);
  const [run, setRun] = useState(false);

  const universe = useMemo(() => buildUniverse(list, category), [list, category]);

  const screen = useQuery({
    queryKey: ["top-funds", category, period, universe.map((u) => u.code).join(",")],
    enabled: run && universe.length > 0,
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 12 * 60 * 60 * 1000,
    queryFn: async (): Promise<Ranked[]> => {
      const loaded = await mapPool(universe, CONCURRENCY, async (u) => {
        const data = await fetchScheme(u.code);
        return { ...u, rows: data.rows };
      });

      const ranked: Ranked[] = [];
      for (const item of loaded) {
        if (!item || item.rows.length < 250) continue;
        const series = calculateRollingReturns(item.rows, period);
        if (series.length < 60) continue; // needs a meaningful rolling sample
        const stats = rollingStats(series, period);
        const risk = calculateRisk(item.rows, 0.065);
        const maxDD = maxDrawdown(drawdownSeries(item.rows));
        const consistency = calculateConsistencyScore({
          rollingStd: stats.std,
          volatility: risk.volatility,
          maxDD,
          sharpe: risk.sharpe,
          sortino: risk.sortino,
          positivePct: stats.positivePct,
          recoveryDays: risk.recoveryDays,
        });
        const overall = calculateOverallScore({
          rollingMean: stats.mean,
          consistency,
          maxDD,
          sharpe: risk.sharpe,
          sortino: risk.sortino,
          volatility: risk.volatility,
          alpha: 0,
        });
        ranked.push({
          code: item.code,
          name: item.name,
          amc: item.amc,
          overall,
          consistency,
          rollingMean: stats.mean,
          rollingMin: stats.min,
          positivePct: stats.positivePct,
          sharpe: risk.sharpe,
          sortino: risk.sortino,
          volatility: risk.volatility,
          maxDD,
          windows: stats.count,
        });
      }
      return ranked.sort((a, b) => b.overall - a.overall).slice(0, 10);
    },
  });

  const rows = screen.data ?? [];

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-display text-base sm:text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary shrink-0" /> Top 10 Funds
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ranked on {period}-year rolling CAGR, consistency, Sharpe/Sortino, volatility and
            drawdown — computed live from NAV history of one scheme per AMC in the chosen category.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {run && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => screen.refetch()}
              disabled={screen.isFetching}
              className="gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", screen.isFetching && "animate-spin")} />{" "}
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Rolling period
          </div>
          <div className="-mx-4 mt-1.5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-2 text-xs transition-colors sm:py-1.5",
                  period === p
                    ? "bg-primary/15 border-primary/50 text-primary font-medium"
                    : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/30",
                )}
              >
                {p}Y
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Category</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  category === c
                    ? "bg-primary/15 border-primary/50 text-primary font-medium"
                    : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/30",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!run && (
        <div className="mt-5 rounded-xl border border-dashed border-border/60 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Screens up to {universe.length || UNIVERSE_CAP} {category} Direct Growth funds. The
            first run downloads their NAV history (cached locally afterwards).
          </p>
          <Button
            className="mt-3"
            size="sm"
            onClick={() => setRun(true)}
            disabled={listLoading || !universe.length}
          >
            {listLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trophy className="h-4 w-4" />
            )}
            Rank {category} funds
          </Button>
        </div>
      )}

      {run && screen.isFetching && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Screening {universe.length} {category} funds on {period}Y rolling returns…
        </div>
      )}

      {run && !screen.isFetching && screen.error && (
        <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          Could not complete the screen. Try again.
        </div>
      )}

      {run && !screen.isFetching && !screen.error && rows.length === 0 && (
        <div className="mt-5 rounded-xl border border-border/60 p-4 text-sm text-muted-foreground">
          No fund in {category} has enough history for a {period}-year rolling window. Try a shorter
          period.
        </div>
      )}

      {rows.length > 0 && !screen.isFetching && (
        <div className="mt-5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[760px] text-xs num">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="py-2 pr-2 text-left font-medium">#</th>
                <th className="py-2 pr-3 text-left font-medium min-w-[220px]">Fund</th>
                <th className="py-2 px-2 text-right font-medium">Score</th>
                <th className="py-2 px-2 text-right font-medium">Avg {period}Y</th>
                <th className="py-2 px-2 text-right font-medium">Min {period}Y</th>
                <th className="py-2 px-2 text-right font-medium">Consistency</th>
                <th className="py-2 px-2 text-right font-medium">
                  <span className="inline-flex items-center gap-1">
                    Sharpe <MetricInfo id="sharpe" />
                  </span>
                </th>
                <th className="py-2 px-2 text-right font-medium">
                  <span className="inline-flex items-center gap-1">
                    Sortino <MetricInfo id="sortino" />
                  </span>
                </th>
                <th className="py-2 px-2 text-right font-medium">Vol</th>
                <th className="py-2 px-2 text-right font-medium">Max DD</th>
                {onAdd && <th className="py-2 pl-2 text-right font-medium">Compare</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const label = scoreLabel(r.overall);
                const picked = isSelected?.(r.code) ?? false;
                return (
                  <tr key={r.code} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5 pr-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-2.5 pr-3">
                      <div className="font-sans max-w-[320px] truncate text-foreground">
                        {r.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <Badge variant="outline" className="font-sans text-[10px]">
                          {r.amc}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {"★".repeat(starRating(r.overall))}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <div
                        className={cn(
                          "font-medium",
                          i === 0 ? "text-success" : i === 1 ? "text-info" : "",
                        )}
                      >
                        {fmtNum(r.overall, 1)}
                      </div>
                      <div className="font-sans text-[10px] text-muted-foreground">
                        {label.label}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right">{fmtNum(r.rollingMean, 2)}%</td>
                    <td className="py-2.5 px-2 text-right">{fmtNum(r.rollingMin, 2)}%</td>
                    <td className="py-2.5 px-2 text-right">{fmtNum(r.consistency, 1)}</td>
                    <td className="py-2.5 px-2 text-right">{fmtNum(r.sharpe, 2)}</td>
                    <td className="py-2.5 px-2 text-right">{fmtNum(r.sortino, 2)}</td>
                    <td className="py-2.5 px-2 text-right">{fmtNum(r.volatility * 100, 2)}%</td>
                    <td className="py-2.5 px-2 text-right text-destructive-foreground">
                      {fmtNum(r.maxDD * 100, 2)}%
                    </td>
                    {onAdd && (
                      <td className="py-2.5 pl-2 text-right">
                        <Button
                          size="sm"
                          variant={picked ? "secondary" : "outline"}
                          className="h-7 gap-1 font-sans text-[11px]"
                          disabled={picked || !canAdd}
                          onClick={() => onAdd({ schemeCode: r.code, schemeName: r.name })}
                        >
                          {picked ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          {picked ? "Added" : "Add"}
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Universe: one representative Direct Growth scheme per AMC in {category} (max{" "}
          {UNIVERSE_CAP}), each needing at least 60 rolling {period}Y windows. Research only — not
          investment advice.
        </p>
      )}
    </Card>
  );
}
