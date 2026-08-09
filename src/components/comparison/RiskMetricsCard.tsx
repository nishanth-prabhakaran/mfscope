import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { calculateRisk } from "@/lib/calculators";
import type { NormalizedScheme, NavRow, RollingYears } from "@/types/mf";
import { colorFor, fmtNum, fmtPct } from "@/lib/format";
import { MetricGlossaryButton, MetricInfo, RankLegend } from "./MetricInfo";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
  benchmarkRows?: import("@/types/mf").NavRow[];
  /** Trailing window (years) selected on the Rolling Returns chart. */
  windowYears: RollingYears;
}

/** Minimum NAV points calculateRisk needs before it returns meaningful numbers. */
const MIN_RISK_ROWS = 30;

/** Slice to the trailing `years` window, measured back from the series' last NAV date. */
function trailingWindow(rows: NavRow[], years: RollingYears): NavRow[] {
  if (!rows.length) return rows;
  const endT = rows[rows.length - 1].t;
  const startT = endT - years * 365.25 * 86_400_000;
  const sliced = rows.filter((r) => r.t >= startT);
  return sliced.length >= MIN_RISK_ROWS ? sliced : rows;
}

export function RiskMetricsCard({ schemes, benchmarkRows, windowYears }: Props) {
  const windowedBenchmark = useMemo(
    () => (benchmarkRows?.length ? trailingWindow(benchmarkRows, windowYears) : benchmarkRows),
    [benchmarkRows, windowYears],
  );

  const rows = useMemo(
    () =>
      schemes.map((s, i) => {
        const windowed = trailingWindow(s.data.rows, windowYears);
        // A fund younger than the selected window falls back to its full history.
        const truncated = windowed.length < s.data.rows.length;
        return {
          ...s,
          i,
          truncated,
          risk: calculateRisk(windowed, 0.065, windowedBenchmark),
        };
      }),
    [schemes, windowedBenchmark, windowYears],
  );

  const partialCoverage = rows.some((r) => !r.truncated);

  const metrics: Array<{
    key: keyof ReturnType<typeof calculateRisk>;
    label: string;
    fmt: (v: number) => string;
    higherBetter?: boolean;
  }> = [
    { key: "cagr", label: "CAGR", fmt: (v) => fmtPct(v), higherBetter: true },
    { key: "annualReturn", label: "Annualized Return", fmt: (v) => fmtPct(v), higherBetter: true },
    { key: "volatility", label: "Volatility", fmt: (v) => fmtPct(v), higherBetter: false },
    { key: "downsideVol", label: "Downside Vol", fmt: (v) => fmtPct(v), higherBetter: false },
    { key: "sharpe", label: "Sharpe", fmt: (v) => fmtNum(v), higherBetter: true },
    { key: "sortino", label: "Sortino", fmt: (v) => fmtNum(v), higherBetter: true },
    { key: "calmar", label: "Calmar", fmt: (v) => fmtNum(v), higherBetter: true },
    { key: "maxDrawdown", label: "Max Drawdown", fmt: (v) => fmtPct(v), higherBetter: true },
    { key: "avgDrawdown", label: "Avg Drawdown", fmt: (v) => fmtPct(v), higherBetter: true },
    { key: "ulcerIndex", label: "Ulcer Index", fmt: (v) => fmtNum(v), higherBetter: false },
    { key: "skewness", label: "Skewness", fmt: (v) => fmtNum(v) },
    { key: "kurtosis", label: "Kurtosis", fmt: (v) => fmtNum(v) },
    { key: "var95", label: "VaR (95%)", fmt: (v) => fmtPct(v), higherBetter: false },
    { key: "cvar95", label: "CVaR (95%)", fmt: (v) => fmtPct(v), higherBetter: false },
  ];

  /** Returns fund codes ranked best → second best for a metric. */
  const rankOf = (
    key: keyof ReturnType<typeof calculateRisk>,
    higherBetter?: boolean,
  ): { best: number; second: number } => {
    if (higherBetter == null) return { best: -1, second: -1 };
    const sorted = rows
      .map((r) => ({ code: r.code, v: r.risk[key] as number }))
      .filter((x) => Number.isFinite(x.v))
      .sort((a, b) => (higherBetter ? b.v - a.v : a.v - b.v));
    return { best: sorted[0]?.code ?? -1, second: sorted[1]?.code ?? -1 };
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <h3 className="font-display text-base sm:text-lg font-semibold">Risk Analytics</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Trailing {windowYears}-year risk-adjusted metrics on daily NAV (risk-free = 6.5%).
            Follows the rolling window selected on the Rolling Returns chart.
          </p>
          {partialCoverage && (
            <p className="text-xs text-muted-foreground mt-1">
              Funds with less than {windowYears} years of history fall back to their full available
              history.
            </p>
          )}
          <RankLegend className="mt-2" />
        </div>
        <MetricGlossaryButton />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs num">
          <thead className="text-muted-foreground sticky top-0 bg-card/95">
            <tr className="border-b border-border/60">
              <th className="text-left font-medium py-2 pr-3">Metric</th>
              {rows.map((r) => (
                <th key={r.code} className="text-right font-medium py-2 pl-3">
                  <div className="flex items-center justify-end gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: colorFor(r.i) }}
                    />
                    <span className="truncate max-w-[200px]">{r.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const rank = rankOf(m.key, m.higherBetter);
              return (
                <tr key={m.key} className="border-b border-border/30 last:border-0">
                  <td className="py-2 pr-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {m.label}
                      <MetricInfo id={m.key as string} />
                    </span>
                  </td>
                  {rows.map((r) => {
                    const v = r.risk[m.key] as number;
                    const isBest = r.code === rank.best;
                    const isSecond = r.code === rank.second;
                    return (
                      <td
                        key={r.code}
                        className={`text-right py-2 pl-3 ${isBest ? "text-success font-medium" : isSecond ? "text-info" : ""}`}
                      >
                        {m.fmt(v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
