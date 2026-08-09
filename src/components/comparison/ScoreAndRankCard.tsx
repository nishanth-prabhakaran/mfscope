import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  calculateRisk, calculateRollingReturns, rollingStats,
  calculateConsistencyScore, calculateOverallScore, scoreLabel, starRating,
  drawdownSeries, maxDrawdown,
} from "@/lib/calculators";
import type { NormalizedScheme } from "@/types/mf";
import { colorFor, fmtNum } from "@/lib/format";
import { Star, Trophy, Shield, TrendingUp, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
  benchmarkRows?: import("@/types/mf").NavRow[];
}

interface Scored {
  code: number; name: string; i: number;
  overall: number; consistency: number; risk: ReturnType<typeof calculateRisk>;
  rollingMean: number; rollingStd: number; positivePct: number; maxDD: number;
}

export function ScoreAndRankCard({ schemes, benchmarkRows }: Props) {
  const scored: Scored[] = useMemo(() => schemes.map((s, i) => {
    const risk = calculateRisk(s.data.rows, 0.065, benchmarkRows);
    // Prefer 5Y rolling; fall back to 3Y then 1Y.
    const long = calculateRollingReturns(s.data.rows, 5);
    const src = long.length ? long : calculateRollingReturns(s.data.rows, 3);
    const chosenPeriod = long.length ? 5 : 3;
    const finalSrc = src.length ? src : calculateRollingReturns(s.data.rows, 1);
    const period = src.length ? chosenPeriod : 1;
    const stats = rollingStats(finalSrc, period as 1 | 3 | 5);
    const maxDD = maxDrawdown(drawdownSeries(s.data.rows));

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

    return {
      code: s.code, name: s.name, i,
      overall, consistency, risk,
      rollingMean: stats.mean, rollingStd: stats.std,
      positivePct: stats.positivePct, maxDD,
    };
  }), [schemes]);

  const ranked = [...scored].sort((a, b) => b.overall - a.overall);

  const rankBy = {
    return: [...scored].sort((a, b) => b.rollingMean - a.rollingMean)[0]?.code,
    risk: [...scored].sort((a, b) => a.risk.volatility - b.risk.volatility)[0]?.code,
    sharpe: [...scored].sort((a, b) => b.risk.sharpe - a.risk.sharpe)[0]?.code,
    dd: [...scored].sort((a, b) => b.maxDD - a.maxDD)[0]?.code, // less negative = better
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-4 sm:p-5">
        <div>
          <h3 className="font-display text-base sm:text-lg font-semibold">Fund Rating & Consistency</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Weighted score across rolling returns, drawdown, Sharpe, Sortino, volatility & consistency.
          </p>
        </div>
        <div className="mt-4 space-y-4">
          {ranked.map((s, rank) => {
            const label = scoreLabel(s.overall);
            const consLabel = scoreLabel(s.consistency);
            const stars = starRating(s.overall);
            return (
              <div key={s.code} className="rounded-xl border border-border/60 bg-card/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-mono text-sm font-semibold">
                      #{rank + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(s.i) }} />
                        <div className="font-medium truncate">{s.name}</div>
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        {[0, 1, 2, 3, 4].map((n) => (
                          <Star
                            key={n}
                            className={`h-3.5 w-3.5 ${n < stars ? "fill-warning text-warning" : "text-muted-foreground/40"}`}
                          />
                        ))}
                        <span className="ml-2 text-xs text-muted-foreground">{label.label}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-display font-semibold text-gradient-brand num">{s.overall}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-muted-foreground">Consistency</span>
                      <span className="num font-medium">{s.consistency}/100 · {consLabel.label}</span>
                    </div>
                    <Progress value={s.consistency} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-muted-foreground">Overall</span>
                      <span className="num font-medium">{s.overall}/100</span>
                    </div>
                    <Progress value={s.overall} className="h-1.5" />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] num text-muted-foreground sm:grid-cols-4">
                  <Metric label="Rolling μ" value={`${fmtNum(s.rollingMean)}%`} />
                  <Metric label="Sharpe" value={fmtNum(s.risk.sharpe)} />
                  <Metric label="Sortino" value={fmtNum(s.risk.sortino)} />
                  <Metric label="Max DD" value={`${fmtNum(s.maxDD * 100)}%`} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div>
          <h3 className="font-display text-base sm:text-lg font-semibold">Fund Rankings</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Winner in each dimension.</p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3">
          <RankRow
            icon={<TrendingUp className="h-4 w-4" />}
            label="Highest Rolling Return"
            fund={scored.find((s) => s.code === rankBy.return)}
            value={(s) => `${fmtNum(s.rollingMean)}%`}
          />
          <RankRow
            icon={<Shield className="h-4 w-4" />}
            label="Lowest Volatility"
            fund={scored.find((s) => s.code === rankBy.risk)}
            value={(s) => `${fmtNum(s.risk.volatility * 100)}%`}
          />
          <RankRow
            icon={<Activity className="h-4 w-4" />}
            label="Highest Sharpe"
            fund={scored.find((s) => s.code === rankBy.sharpe)}
            value={(s) => fmtNum(s.risk.sharpe)}
          />
          <RankRow
            icon={<Shield className="h-4 w-4" />}
            label="Lowest Drawdown"
            fund={scored.find((s) => s.code === rankBy.dd)}
            value={(s) => `${fmtNum(s.maxDD * 100)}%`}
          />
          <RankRow
            icon={<Trophy className="h-4 w-4" />}
            label="Best Overall Score"
            fund={ranked[0]}
            value={(s) => `${s.overall}/100`}
          />
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide">{label}</div>
      <div className="text-foreground text-xs num">{value}</div>
    </div>
  );
}

function RankRow({
  icon, label, fund, value,
}: {
  icon: React.ReactNode; label: string;
  fund?: Scored; value: (s: Scored) => string;
}) {
  if (!fund) return null;
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="flex items-center gap-2 mt-0.5 min-w-0">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorFor(fund.i) }} />
            <span className="text-sm truncate">{fund.name}</span>
          </div>
        </div>
      </div>
      <div className="text-sm font-mono font-semibold text-gradient-brand">{value(fund)}</div>
    </div>
  );
}
