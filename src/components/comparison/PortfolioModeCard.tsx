import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { buildPortfolioSeries, equalWeights, normalizeWeights, type Rebalance } from "@/lib/portfolio";
import { calculateRisk, drawdownSeries, maxDrawdown, periodReturn, simulateSIP, RETURN_PERIODS } from "@/lib/calculators";
import { fmtInr, fmtPct, fmtNum, fmtDate, fmtDateShort, colorFor } from "@/lib/format";
import type { NormalizedScheme } from "@/types/mf";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
}

const MODES: { key: Rebalance; label: string }[] = [
  { key: "none", label: "No rebalance" },
  { key: "annual", label: "Annual" },
  { key: "quarterly", label: "Quarterly" },
];

export function PortfolioModeCard({ schemes }: Props) {
  const [weights, setWeights] = useState<number[]>(() => equalWeights(schemes.length || 1));
  const [rebalance, setRebalance] = useState<Rebalance>("annual");
  const [monthlySip, setMonthlySip] = useState(10000);

  useEffect(() => {
    setWeights((prev) => (prev.length === schemes.length ? prev : equalWeights(schemes.length || 1)));
  }, [schemes.length]);

  const total = weights.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const norm = useMemo(() => normalizeWeights(weights), [weights]);

  const holdings = useMemo(
    () => schemes.map((s, i) => ({ code: s.code, name: s.name, data: s.data, weight: norm[i] ?? 0 })),
    [schemes, norm],
  );

  const series = useMemo(() => buildPortfolioSeries(holdings, rebalance), [holdings, rebalance]);

  const risk = useMemo(() => (series ? calculateRisk(series.rows) : null), [series]);
  const mdd = useMemo(() => (series ? maxDrawdown(drawdownSeries(series.rows)) : 0), [series]);

  const sip = useMemo(
    () => (series ? simulateSIP(series.rows, monthlySip, series.startT, series.endT) : null),
    [series, monthlySip],
  );

  const chartData = useMemo(() => {
    if (!series) return [];
    const base = series.rows[0].nav;
    const dd = drawdownSeries(series.rows);
    return series.rows.map((r, i) => ({ t: r.t, value: (r.nav / base) * 100, dd: (dd[i]?.dd ?? 0) * 100 }));
  }, [series]);

  const perFund = useMemo(
    () => schemes.map((s, i) => ({
      i, code: s.code, name: s.name,
      weight: norm[i] ?? 0,
      final: series?.finalWeights.find((f) => f.code === s.code)?.weight ?? 0,
      cagr: periodReturn(s.data.rows, "inception"),
    })),
    [schemes, norm, series],
  );

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">Portfolio Mode</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Blend the selected funds into one portfolio, set allocations and see combined returns, risk and drawdown.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {MODES.map((m) => (
            <Button
              key={m.key}
              size="sm"
              variant={rebalance === m.key ? "secondary" : "ghost"}
              className="h-7 text-xs"
              onClick={() => setRebalance(m.key)}
            >
              {m.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Allocation editor */}
      <div className="mt-4 space-y-2">
        {schemes.map((s, i) => (
          <div key={s.code} className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: colorFor(i) }} />
            <span className="text-xs truncate flex-1 min-w-0">{s.name}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={weights[i] ?? 0}
              onChange={(e) => setWeights((w) => w.map((v, j) => (j === i ? Number(e.target.value) : v)))}
              className="w-28 sm:w-48 accent-[var(--primary)]"
            />
            <Input
              type="number"
              value={Math.round((weights[i] ?? 0) * 100) / 100}
              min={0}
              max={100}
              onChange={(e) => setWeights((w) => w.map((v, j) => (j === i ? Number(e.target.value) || 0 : v)))}
              className="h-8 w-20 num text-xs"
            />
            <span className="text-[11px] text-muted-foreground w-12 text-right num">{fmtNum(norm[i] ?? 0, 1)}%</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1">
          <span className={`text-[11px] ${Math.abs(total - 100) > 0.5 ? "text-warning" : "text-muted-foreground"}`}>
            Entered total: {fmtNum(total, 1)}% {Math.abs(total - 100) > 0.5 && "— normalised to 100% for the analysis"}
          </span>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setWeights(equalWeights(schemes.length))}>
            Equal weight
          </Button>
        </div>
      </div>

      {!series && (
        <p className="text-xs text-muted-foreground mt-6">
          Not enough overlapping NAV history across the selected funds to build a portfolio.
        </p>
      )}

      {series && risk && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <Stat label="Portfolio CAGR" value={fmtPct(risk.cagr)} accent />
            <Stat label="Volatility" value={fmtPct(risk.volatility)} />
            <Stat label="Sharpe" value={fmtNum(risk.sharpe)} />
            <Stat label="Sortino" value={fmtNum(risk.sortino)} />
            <Stat label="Max drawdown" value={fmtPct(mdd)} tone="destructive" />
            <Stat label="Calmar" value={fmtNum(risk.calmar)} />
            <Stat label="Common history" value={`${fmtDateShort(series.startT)} → ${fmtDateShort(series.endT)}`} />
            <Stat label="Rebalances" value={`${series.rebalanceCount}`} />
          </div>

          <div className="mt-6 h-[240px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id="pfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="t" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v: number) => fmtDateShort(v)} minTickGap={40} />
                <YAxis yAxisId="v" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={60} />
                <YAxis yAxisId="d" orientation="right" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={50} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, n: string) => [n === "Drawdown" ? `${v.toFixed(2)}%` : v.toFixed(2), n]}
                  labelFormatter={(l: number) => fmtDate(l)}
                />
                <Area yAxisId="v" type="monotone" dataKey="value" name="Growth of ₹100" stroke="var(--chart-1)" fill="url(#pfGrad)" strokeWidth={2} dot={false} />
                <Line yAxisId="d" type="monotone" dataKey="dd" name="Drawdown" stroke="var(--chart-4)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium mb-2">Allocation drift & fund CAGR</h4>
              <table className="w-full text-xs num">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="text-left font-medium py-2 pr-3">Fund</th>
                    <th className="text-right font-medium">Target</th>
                    <th className="text-right font-medium">End weight</th>
                    <th className="text-right font-medium">Fund CAGR</th>
                  </tr>
                </thead>
                <tbody>
                  {perFund.map((f) => (
                    <tr key={f.code} className="border-b border-border/30 last:border-0">
                      <td className="py-1.5 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(f.i) }} />
                          <span className="truncate max-w-[200px]">{f.name}</span>
                        </div>
                      </td>
                      <td className="text-right">{fmtNum(f.weight, 1)}%</td>
                      <td className="text-right">{fmtNum(f.final, 1)}%</td>
                      <td className="text-right">{fmtPct(f.cagr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Portfolio returns</h4>
              <table className="w-full text-xs num">
                <tbody>
                  {RETURN_PERIODS.map((p) => {
                    const v = periodReturn(series.rows, p.months);
                    if (v == null) return null;
                    return (
                      <tr key={p.label} className="border-b border-border/30 last:border-0">
                        <td className="py-1.5 text-muted-foreground">{p.label}</td>
                        <td className={`text-right font-medium ${v >= 0 ? "text-success" : "text-destructive-foreground"}`}>{fmtPct(v)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {sip && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">SIP on this portfolio</h4>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={monthlySip}
                      step={1000}
                      onChange={(e) => setMonthlySip(Number(e.target.value) || 0)}
                      className="h-9 w-32 num text-xs"
                    />
                    <span className="text-[11px] text-muted-foreground">per month, full common history</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <Stat label="Invested" value={fmtInr(sip.totalInvested)} />
                    <Stat label="Value" value={fmtInr(sip.currentValue)} />
                    <Stat label="Profit" value={fmtInr(sip.profit)} tone={sip.profit >= 0 ? "success" : "destructive"} />
                    <Stat label="XIRR" value={fmtPct(sip.xirr)} accent />
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function Stat({ label, value, accent, tone }: { label: string; value: string; accent?: boolean; tone?: "success" | "destructive" }) {
  const color = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive-foreground" : accent ? "text-primary" : "";
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`num text-sm font-semibold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}
