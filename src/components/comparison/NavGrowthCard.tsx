import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card } from "@/components/ui/card";
import type { NormalizedScheme } from "@/types/mf";
import { colorFor, fmtDateShort, fmtNum } from "@/lib/format";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
}

/** Normalise every fund to 100 at earliest common date for a fair growth-of-100 view. */
export function NavGrowthCard({ schemes }: Props) {
  const chartData = useMemo(() => {
    if (!schemes.length) return [];
    const commonStart = Math.max(...schemes.map((s) => s.data.rows[0]?.t ?? 0));
    const bases = schemes.map((s) => s.data.rows.find((r) => r.t >= commonStart)?.nav ?? 1);
    // Union of times >= commonStart
    const times = new Set<number>();
    for (const s of schemes) for (const r of s.data.rows) if (r.t >= commonStart) times.add(r.t);
    const sorted = [...times].sort((a, b) => a - b);
    const stride = Math.max(1, Math.floor(sorted.length / 500));
    const sampled = sorted.filter((_, i) => i % stride === 0);
    // Prep index maps
    const lastIdx: number[] = schemes.map(() => 0);
    return sampled.map((t) => {
      const row: Record<string, number | string> = { t, date: fmtDateShort(t) };
      schemes.forEach((s, i) => {
        const rows = s.data.rows;
        while (lastIdx[i] < rows.length - 1 && rows[lastIdx[i] + 1].t <= t) lastIdx[i]++;
        const nav = rows[lastIdx[i]]?.nav;
        if (nav && bases[i]) row[`s${s.code}`] = +((nav / bases[i]) * 100).toFixed(2);
      });
      return row;
    });
  }, [schemes]);

  return (
    <Card className="p-5">
      <div>
        <h3 className="font-display text-lg font-semibold">Growth of ₹100</h3>
        <p className="text-xs text-muted-foreground mt-0.5">NAV rebased to 100 at the earliest common date.</p>
      </div>
      <div className="mt-4 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.35} />
            <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} minTickGap={40} />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={54} />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
              formatter={(v: number, name) => [fmtNum(v), name]}
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
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
