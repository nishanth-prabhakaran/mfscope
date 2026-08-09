import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card } from "@/components/ui/card";
import type { NormalizedScheme, NavRow } from "@/types/mf";
import { colorFor, fmtDateShort, fmtNum } from "@/lib/format";
import { findNavAt } from "@/lib/calculators";

const BENCH_COLOR = "var(--series-bench)";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
  benchmarkRows?: NavRow[];
  benchmarkLabel?: string;
}

/** Normalise every fund to 100 at earliest common date for a fair growth-of-100 view. */
export function NavGrowthCard({ schemes, benchmarkRows, benchmarkLabel }: Props) {
  const { chartData, commonStart } = useMemo(() => {
    if (!schemes.length) return { chartData: [] as Record<string, number | string>[], commonStart: 0 };
    const commonStart = Math.max(...schemes.map((s) => s.data.rows[0]?.t ?? 0));
    const bases = schemes.map((s) => s.data.rows.find((r) => r.t >= commonStart)?.nav ?? 1);
    const benchBase = benchmarkRows?.length ? (findNavAt(benchmarkRows, commonStart)?.nav ?? benchmarkRows.find((r) => r.t >= commonStart)?.nav ?? 0) : 0;
    const times = new Set<number>();
    for (const s of schemes) for (const r of s.data.rows) if (r.t >= commonStart) times.add(r.t);
    const sorted = [...times].sort((a, b) => a - b);
    const stride = Math.max(1, Math.floor(sorted.length / 500));
    const sampled = sorted.filter((_, i) => i % stride === 0);
    const lastIdx: number[] = schemes.map(() => 0);
    const chartData = sampled.map((t) => {
      const row: Record<string, number | string> = { t, date: fmtDateShort(t) };
      schemes.forEach((s, i) => {
        const rows = s.data.rows;
        while (lastIdx[i] < rows.length - 1 && rows[lastIdx[i] + 1].t <= t) lastIdx[i]++;
        const nav = rows[lastIdx[i]]?.nav;
        if (nav && bases[i]) row[`s${s.code}`] = +((nav / bases[i]) * 100).toFixed(2);
      });
      if (benchmarkRows && benchBase) {
        const b = findNavAt(benchmarkRows, t);
        if (b) row.bench = +((b.nav / benchBase) * 100).toFixed(2);
      }
      return row;
    });
    return { chartData, commonStart };
  }, [schemes, benchmarkRows]);

  return (
    <Card className="p-4 sm:p-5">
      <div>
        <h3 className="font-display text-base sm:text-lg font-semibold">Growth of ₹100</h3>
        <p className="text-xs text-muted-foreground mt-0.5">NAV rebased to 100 at the earliest common date.</p>
      </div>
      <div className="mt-4 h-[250px] sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.35} />
            <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} minTickGap={40} />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={54} />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div style={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, padding: "8px 10px", minWidth: 220 }}>
                    <div className="text-[11px] text-muted-foreground">Rebased ₹100 measured</div>
                    <div className="text-foreground font-medium">
                      {fmtDateShort(commonStart)} → {label}
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      {payload.map((p) => (
                        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color as string }} />
                            <span className="text-foreground/90 truncate">{p.name}</span>
                          </span>
                          <span className="num font-medium">₹{fmtNum(p.value as number)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
            />

            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span className="text-muted-foreground">{v}</span>} />
            {schemes.map((s, i) => (
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
            ))}
            {benchmarkRows && benchmarkRows.length > 0 && (
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
      </div>
    </Card>
  );
}
