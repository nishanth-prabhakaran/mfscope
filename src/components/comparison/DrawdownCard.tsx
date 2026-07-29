import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, Line } from "recharts";
import { Card } from "@/components/ui/card";
import { drawdownSeries, maxDrawdown, longestRecoveryDays, mean } from "@/lib/calculators";
import type { NormalizedScheme, NavRow } from "@/types/mf";
import { colorFor, fmtDateShort, fmtNum, fmtPct } from "@/lib/format";

const AVG_COLOR = "#f5b642";
const MED_COLOR = "#22d3ee";
const BENCH_COLOR = "#a78bfa";

function medianOf(arr: number[]) {
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

export function DrawdownCard({ schemes, benchmarkRows, benchmarkLabel }: Props) {
  const [showPeer, setShowPeer] = useState(true);
  const dd = useMemo(() => schemes.map((s) => {
    const series = drawdownSeries(s.data.rows);
    return {
      ...s,
      series,
      max: maxDrawdown(series),
      avg: mean(series.map((p) => p.dd).filter((v) => v < 0)),
      current: series[series.length - 1]?.dd ?? 0,
      recovery: longestRecoveryDays(s.data.rows),
    };
  }), [schemes]);

  const chartData = useMemo(() => {
    const times = new Set<number>();
    for (const r of dd) for (const p of r.series) times.add(p.t);
    const sorted = [...times].sort((a, b) => a - b);
    const stride = Math.max(1, Math.floor(sorted.length / 400));
    const sampled = sorted.filter((_, i) => i % stride === 0);
    return sampled.map((t) => {
      const row: Record<string, number | string> = { t, date: fmtDateShort(t) };
      const vals: number[] = [];
      for (const r of dd) {
        const p = r.series.find((x) => x.t === t);
        if (p) {
          row[`s${r.code}`] = +(p.dd * 100).toFixed(2);
          row[`peak${r.code}`] = p.peakT;
          vals.push(p.dd * 100);
        }
      }
      if (vals.length >= 2) {
        row.peerAvg = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
        row.peerMed = +medianOf(vals).toFixed(2);
      }
      return row;
    });
  }, [dd]);

  const peer = useMemo(() => {
    const avgs = chartData.map((r) => r.peerAvg).filter((v): v is number => typeof v === "number");
    const meds = chartData.map((r) => r.peerMed).filter((v): v is number => typeof v === "number");
    const summ = (arr: number[]) => arr.length ? {
      max: Math.min(...arr) / 100,
      current: arr[arr.length - 1] / 100,
      avg: arr.filter((v) => v < 0).reduce((a, b) => a + b, 0) / (arr.filter((v) => v < 0).length || 1) / 100,
    } : null;
    return { avg: summ(avgs), med: summ(meds) };
  }, [chartData]);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">Drawdown Analysis</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            How deep and how long each fund fell from its peak.
          </p>
        </div>
        <button
          onClick={() => setShowPeer((v) => !v)}
          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
            showPeer ? "border-border/60 bg-accent/40 text-foreground" : "border-border/40 text-muted-foreground hover:text-foreground"
          }`}
          title="Overlay peer average & median drawdown across your selected funds"
        >
          {showPeer ? "Peer lines: On" : "Peer lines: Off"}
        </button>
      </div>

      <div className="mt-4 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
            <defs>
              {schemes.map((s, i) => (
                <linearGradient key={s.code} id={`dd-${s.code}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorFor(i)} stopOpacity={0.05} />
                  <stop offset="100%" stopColor={colorFor(i)} stopOpacity={0.35} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.35} />
            <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} minTickGap={40} />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={(v) => `${v}%`} width={54} />
            <ReferenceLine y={0} stroke="var(--muted-foreground)" />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as Record<string, number | string> | undefined;
                return (
                  <div style={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, padding: "8px 10px", minWidth: 240 }}>
                    <div className="text-[11px] text-muted-foreground">Drawdown as of</div>
                    <div className="text-foreground font-medium">{label}</div>
                    <div className="mt-1.5 space-y-1">
                      {payload.map((p) => {
                        const key = String(p.dataKey);
                        const code = key.startsWith("s") ? key.slice(1) : null;
                        const peakT = code ? (row?.[`peak${code}`] as number | undefined) : undefined;
                        return (
                          <div key={key} className="flex flex-col">
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color as string }} />
                                <span className="text-foreground/90 truncate">{p.name}</span>
                              </span>
                              <span className="num font-medium">{(p.value as number).toFixed(2)}%</span>
                            </div>
                            {peakT ? (
                              <div className="text-[10px] text-muted-foreground pl-3.5">
                                from peak {fmtDateShort(peakT)} → {label}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }}
            />

            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span className="text-muted-foreground">{v}</span>} />
            {schemes.map((s, i) => (
              <Area
                key={s.code}
                type="monotone"
                dataKey={`s${s.code}`}
                name={s.name}
                stroke={colorFor(i)}
                strokeWidth={1.5}
                fill={`url(#dd-${s.code})`}
                isAnimationActive={false}
                connectNulls
              />
            ))}
            {showPeer && schemes.length >= 2 && (
              <Line type="monotone" dataKey="peerAvg" name="Peer Average" stroke={AVG_COLOR} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} connectNulls />
            )}
            {showPeer && schemes.length >= 2 && (
              <Line type="monotone" dataKey="peerMed" name="Peer Median" stroke={MED_COLOR} strokeWidth={2} strokeDasharray="2 4" dot={false} isAnimationActive={false} connectNulls />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-xs num">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border/60">
              <th className="text-left font-medium py-2">Fund</th>
              <th className="text-right font-medium">Max Drawdown</th>
              <th className="text-right font-medium">Current DD</th>
              <th className="text-right font-medium">Avg DD</th>
              <th className="text-right font-medium">Longest Recovery</th>
            </tr>
          </thead>
          <tbody>
            {dd.map((s, i) => (
              <tr key={s.code} className="border-b border-border/30 last:border-0">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(i) }} />
                    <span className="truncate max-w-[280px]">{s.name}</span>
                  </div>
                </td>
                <td className="text-right text-destructive-foreground">{fmtPct(s.max)}</td>
                <td className="text-right">{fmtPct(s.current)}</td>
                <td className="text-right">{fmtPct(s.avg)}</td>
                <td className="text-right">{s.recovery ? `${fmtNum(s.recovery / 30, 1)} months` : "—"}</td>
              </tr>
            ))}
            {showPeer && schemes.length >= 2 && peer.avg && (
              <tr className="border-t border-border/60 bg-accent/10">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-4 rounded-sm" style={{ backgroundColor: AVG_COLOR }} />
                    <span className="text-muted-foreground">Peer Average</span>
                  </div>
                </td>
                <td className="text-right">{fmtPct(peer.avg.max)}</td>
                <td className="text-right">{fmtPct(peer.avg.current)}</td>
                <td className="text-right">{fmtPct(peer.avg.avg)}</td>
                <td className="text-right">—</td>
              </tr>
            )}
            {showPeer && schemes.length >= 2 && peer.med && (
              <tr className="bg-accent/10">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-4 rounded-sm" style={{ backgroundColor: MED_COLOR }} />
                    <span className="text-muted-foreground">Peer Median</span>
                  </div>
                </td>
                <td className="text-right">{fmtPct(peer.med.max)}</td>
                <td className="text-right">{fmtPct(peer.med.current)}</td>
                <td className="text-right">{fmtPct(peer.med.avg)}</td>
                <td className="text-right">—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
