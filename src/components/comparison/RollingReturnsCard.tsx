import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Card } from "@/components/ui/card";
import { calculateRollingReturns, rollingStats } from "@/lib/calculators";
import type { NormalizedScheme, RollingYears, RollingStats, NavRow } from "@/types/mf";
import { colorFor, csvEscape, downloadFile, fmtDateShort, fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Download, FileImage, Eye, EyeOff } from "lucide-react";
import { toPng } from "html-to-image";

const PERIODS: RollingYears[] = [1, 3, 5, 7, 10, 12, 15];
const AVG_COLOR = "#f5b642";
const MED_COLOR = "#22d3ee";
const BENCH_COLOR = "#a78bfa";

function median(arr: number[]) {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}


interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
  benchmarkRows?: NavRow[];
  benchmarkLabel?: string;
}

export function RollingReturnsCard({ schemes, benchmarkRows, benchmarkLabel }: Props) {
  const [period, setPeriod] = useState<RollingYears>(3);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [showPeer, setShowPeer] = useState(true);
  const chartRef = useMemo(() => ({ current: null as HTMLDivElement | null }), []);

  const rolling = useMemo(() => {
    return schemes.map((s) => ({
      ...s,
      series: calculateRollingReturns(s.data.rows, period),
    }));
  }, [schemes, period]);

  const stats: (RollingStats & { code: number; name: string })[] = useMemo(() => {
    return rolling.map((r) => ({ ...rollingStats(r.series, period), code: r.code, name: r.name }));
  }, [rolling, period]);

  const benchSeries = useMemo(
    () => (benchmarkRows && benchmarkRows.length ? calculateRollingReturns(benchmarkRows, period) : []),
    [benchmarkRows, period],
  );

  // Build unified chart data by date. Sample to keep it fast.
  const chartData = useMemo(() => {
    const times = new Set<number>();
    for (const r of rolling) for (const p of r.series) times.add(p.t);
    const sorted = [...times].sort((a, b) => a - b);
    const stride = Math.max(1, Math.floor(sorted.length / 400));
    const sampled = sorted.filter((_, i) => i % stride === 0);
    const visible = rolling.filter((r) => !hidden.has(r.code));
    const benchMap = new Map(benchSeries.map((p) => [p.t, p.cagr * 100]));
    return sampled.map((t) => {
      const row: Record<string, number | string> = { t, date: fmtDateShort(t) };
      for (const r of rolling) {
        const p = r.series.find((x) => x.t === t);
        if (p) row[`s${r.code}`] = +(p.cagr * 100).toFixed(2);
      }
      // Peer aggregates across currently visible funds (need >=2)
      const vals: number[] = [];
      for (const r of visible) {
        const p = r.series.find((x) => x.t === t);
        if (p) vals.push(p.cagr * 100);
      }
      if (vals.length >= 2) {
        row.peerAvg = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
        row.peerMed = +median(vals).toFixed(2);
      }
      // Benchmark rolling CAGR at nearest available window (within 10 days)
      if (benchMap.size) {
        let bv = benchMap.get(t);
        if (bv == null) {
          for (let d = 1; d <= 10 && bv == null; d++) {
            bv = benchMap.get(t - d * 86_400_000) ?? benchMap.get(t + d * 86_400_000);
          }
        }
        if (bv != null) row.bench = +bv.toFixed(2);
      }
      return row;
    });
  }, [rolling, hidden, benchSeries]);


  // Peer aggregate summary stats
  const peerStats = useMemo(() => {
    const avgs = chartData.map((r) => r.peerAvg).filter((v): v is number => typeof v === "number");
    const meds = chartData.map((r) => r.peerMed).filter((v): v is number => typeof v === "number");
    const s = (arr: number[]) => {
      if (!arr.length) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      const med = sorted[Math.floor(sorted.length / 2)];
      return { count: arr.length, min: sorted[0], max: sorted[sorted.length - 1], mean, median: med, current: arr[arr.length - 1] };
    };
    return { avg: s(avgs), med: s(meds) };
  }, [chartData]);


  const toggle = (code: number) => {
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(code)) n.delete(code); else n.add(code);
      return n;
    });
  };

  const exportCsv = () => {
    const header = ["Date", ...schemes.map((s) => s.name)].map(csvEscape).join(",");
    const rows = chartData.map((r) => {
      const vals = schemes.map((s) => {
        const v = r[`s${s.code}`];
        return typeof v === "number" ? v : "";
      });
      return [r.date, ...vals].map(csvEscape).join(",");
    });
    downloadFile(`rolling-${period}y-returns.csv`, [header, ...rows].join("\n"), "text/csv");
  };

  const exportPng = async () => {
    if (!chartRef.current) return;
    const dataUrl = await toPng(chartRef.current, { backgroundColor: "#0f1420", pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = dataUrl; a.download = `rolling-${period}y-returns.png`; a.click();
  };

  return (
    <Card className="p-5 card-glow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">Rolling CAGR Returns</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every possible {period}-year rolling window across the full NAV history.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-lg border border-border/60 p-1 bg-card/60">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}Y
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowPeer((v) => !v)}
            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
              showPeer ? "border-border/60 bg-accent/40 text-foreground" : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
            title="Overlay peer average & median across your selected funds"
          >
            {showPeer ? "Peer lines: On" : "Peer lines: Off"}
          </button>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={exportPng}><FileImage className="h-3.5 w-3.5" /> PNG</Button>
        </div>
      </div>

      <div ref={(el) => { chartRef.current = el; }} className="mt-4 h-[380px] w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Not enough history for a {period}-year rolling window.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.35} />
              <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} minTickGap={40} />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
                width={54}
              />
              <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="2 4" />
              <Tooltip
                cursor={{ stroke: "var(--border)" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const endT = (payload[0]?.payload?.t as number) ?? 0;
                  const startT = endT - period * 365.25 * 86_400_000;
                  return (
                    <div style={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, padding: "8px 10px", minWidth: 220 }}>
                      <div className="text-[11px] text-muted-foreground">
                        {period}Y window measured
                      </div>
                      <div className="text-foreground font-medium">
                        {fmtDateShort(startT)} → {label}
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        {payload.map((p) => (
                          <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 truncate max-w-[200px]" style={{ color: p.color as string }}>
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color as string }} />
                              <span className="text-foreground/90 truncate">{p.name}</span>
                            </span>
                            <span className="num font-medium">{(p.value as number).toFixed(2)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }}
              />

              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => <span className="text-muted-foreground">{value}</span>}
              />
              {schemes.map((s, i) => (
                !hidden.has(s.code) && (
                  <Line
                    key={s.code}
                    type="monotone"
                    dataKey={`s${s.code}`}
                    name={s.name}
                    stroke={colorFor(i)}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                  />
                )
              ))}
              {showPeer && schemes.length >= 2 && (
                <Line
                  type="monotone"
                  dataKey="peerAvg"
                  name="Peer Average"
                  stroke={AVG_COLOR}
                  strokeWidth={2.2}
                  strokeDasharray="6 4"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              )}
              {showPeer && schemes.length >= 2 && (
                <Line
                  type="monotone"
                  dataKey="peerMed"
                  name="Peer Median"
                  stroke={MED_COLOR}
                  strokeWidth={2.2}
                  strokeDasharray="2 4"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              )}
              {benchmarkRows && benchmarkRows.length > 0 && benchSeries.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="bench"
                  name={benchmarkLabel ? `${benchmarkLabel} (Benchmark)` : "Benchmark"}
                  stroke={BENCH_COLOR}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend / show-hide */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {schemes.map((s, i) => {
          const isHidden = hidden.has(s.code);
          return (
            <button
              key={s.code}
              onClick={() => toggle(s.code)}
              className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                isHidden ? "opacity-40 border-border/40" : "border-border/60 hover:bg-accent/40"
              }`}
            >
              {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(i) }} />
              <span className="truncate max-w-[220px]">{s.name}</span>
            </button>
          );
        })}
      </div>

      {/* Rolling statistics table */}
      <div className="mt-5 overflow-x-auto -mx-2 px-2">
        <table className="w-full text-xs num">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border/60">
              <th className="text-left font-medium py-2 pr-3">Fund</th>
              <th className="text-right font-medium">Windows</th>
              <th className="text-right font-medium">Min</th>
              <th className="text-right font-medium">Avg</th>
              <th className="text-right font-medium">Median</th>
              <th className="text-right font-medium">Max</th>
              <th className="text-right font-medium">Std σ</th>
              <th className="text-right font-medium">P5</th>
              <th className="text-right font-medium">P25</th>
              <th className="text-right font-medium">P75</th>
              <th className="text-right font-medium">P95</th>
              <th className="text-right font-medium">Pos %</th>
              <th className="text-right font-medium">Current</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr key={s.code} className="border-b border-border/30 last:border-0">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(i) }} />
                    <span className="truncate max-w-[220px]">{s.name}</span>
                  </div>
                </td>
                <td className="text-right">{s.count}</td>
                <td className="text-right text-destructive-foreground/90">{fmtNum(s.min)}%</td>
                <td className="text-right">{fmtNum(s.mean)}%</td>
                <td className="text-right">{fmtNum(s.median)}%</td>
                <td className="text-right text-success">{fmtNum(s.max)}%</td>
                <td className="text-right">{fmtNum(s.std)}</td>
                <td className="text-right">{fmtNum(s.p5)}%</td>
                <td className="text-right">{fmtNum(s.p25)}%</td>
                <td className="text-right">{fmtNum(s.p75)}%</td>
                <td className="text-right">{fmtNum(s.p95)}%</td>
                <td className="text-right">{fmtNum(s.positivePct, 1)}%</td>
                <td className="text-right font-medium">{s.current == null ? "—" : `${fmtNum(s.current)}%`}</td>
              </tr>
            ))}
            {showPeer && schemes.length >= 2 && peerStats.avg && (
              <tr className="border-t border-border/60 bg-accent/10">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-4 rounded-sm" style={{ backgroundColor: AVG_COLOR }} />
                    <span className="text-muted-foreground">Peer Average</span>
                  </div>
                </td>
                <td className="text-right">{peerStats.avg.count}</td>
                <td className="text-right">{fmtNum(peerStats.avg.min)}%</td>
                <td className="text-right">{fmtNum(peerStats.avg.mean)}%</td>
                <td className="text-right">{fmtNum(peerStats.avg.median)}%</td>
                <td className="text-right">{fmtNum(peerStats.avg.max)}%</td>
                <td className="text-right">—</td>
                <td className="text-right">—</td>
                <td className="text-right">—</td>
                <td className="text-right">—</td>
                <td className="text-right">—</td>
                <td className="text-right">—</td>
                <td className="text-right font-medium">{fmtNum(peerStats.avg.current)}%</td>
              </tr>
            )}
            {showPeer && schemes.length >= 2 && peerStats.med && (
              <tr className="bg-accent/10">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-4 rounded-sm" style={{ backgroundColor: MED_COLOR }} />
                    <span className="text-muted-foreground">Peer Median</span>
                  </div>
                </td>
                <td className="text-right">{peerStats.med.count}</td>
                <td className="text-right">{fmtNum(peerStats.med.min)}%</td>
                <td className="text-right">{fmtNum(peerStats.med.mean)}%</td>
                <td className="text-right">{fmtNum(peerStats.med.median)}%</td>
                <td className="text-right">{fmtNum(peerStats.med.max)}%</td>
                <td className="text-right">—</td>
                <td className="text-right">—</td>
                <td className="text-right">—</td>
                <td className="text-right">—</td>
                <td className="text-right">—</td>
                <td className="text-right">—</td>
                <td className="text-right font-medium">{fmtNum(peerStats.med.current)}%</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
