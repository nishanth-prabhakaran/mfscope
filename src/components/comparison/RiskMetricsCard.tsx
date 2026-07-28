import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { calculateRisk } from "@/lib/calculators";
import type { NormalizedScheme } from "@/types/mf";
import { colorFor, fmtNum, fmtPct } from "@/lib/format";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
  benchmarkRows?: import("@/types/mf").NavRow[];
}

export function RiskMetricsCard({ schemes, benchmarkRows }: Props) {
  const rows = useMemo(() => schemes.map((s, i) => ({ ...s, i, risk: calculateRisk(s.data.rows, 0.065, benchmarkRows) })), [schemes, benchmarkRows]);

  const metrics: Array<{ key: keyof ReturnType<typeof calculateRisk>; label: string; fmt: (v: number) => string; higherBetter?: boolean }> = [
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

  const bestOf = (key: keyof ReturnType<typeof calculateRisk>, higherBetter?: boolean): number | null => {
    if (higherBetter == null) return null;
    let best = -Infinity, worst = Infinity, bestCode = -1;
    for (const r of rows) {
      const v = r.risk[key] as number;
      if (!Number.isFinite(v)) continue;
      if (higherBetter ? v > best : v < worst) { best = higherBetter ? v : best; worst = higherBetter ? worst : v; bestCode = r.code; }
    }
    return bestCode;
  };

  return (
    <Card className="p-5">
      <div>
        <h3 className="font-display text-lg font-semibold">Risk Analytics</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Full-history risk-adjusted metrics on daily NAV (risk-free = 6.5%).
        </p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs num">
          <thead className="text-muted-foreground sticky top-0 bg-card/95">
            <tr className="border-b border-border/60">
              <th className="text-left font-medium py-2 pr-3">Metric</th>
              {rows.map((r) => (
                <th key={r.code} className="text-right font-medium py-2 pl-3">
                  <div className="flex items-center justify-end gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(r.i) }} />
                    <span className="truncate max-w-[200px]">{r.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const bestCode = bestOf(m.key, m.higherBetter);
              return (
                <tr key={m.key} className="border-b border-border/30 last:border-0">
                  <td className="py-2 pr-3 text-muted-foreground">{m.label}</td>
                  {rows.map((r) => {
                    const v = r.risk[m.key] as number;
                    const isBest = r.code === bestCode;
                    return (
                      <td key={r.code} className={`text-right py-2 pl-3 ${isBest ? "text-success font-medium" : ""}`}>
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
