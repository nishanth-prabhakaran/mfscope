import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { compareToBenchmark, relativeStrengthSeries } from "@/lib/calculators";
import type { NavRow, NormalizedScheme } from "@/types/mf";
import { colorFor, fmtDateShort, fmtNum, fmtPct, fmtPctRaw } from "@/lib/format";
import { MetricGlossaryButton, MetricInfo, RankLegend } from "./MetricInfo";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
  benchmarkRows?: NavRow[];
  benchmarkLabel?: string;
}

export function BenchmarkComparisonCard({ schemes, benchmarkRows, benchmarkLabel }: Props) {
  const rows = useMemo(() => {
    if (!benchmarkRows?.length) return [];
    return schemes.map((s, i) => ({
      i, code: s.code, name: s.name,
      c: compareToBenchmark(s.data.rows, benchmarkRows),
    }));
  }, [schemes, benchmarkRows]);

  const chartData = useMemo(() => {
    if (!benchmarkRows?.length) return [];
    const map = new Map<number, Record<string, number>>();
    schemes.forEach((s, i) => {
      for (const p of relativeStrengthSeries(s.data.rows, benchmarkRows)) {
        const e = map.get(p.t) ?? { t: p.t };
        e[`f${i}`] = p.rel;
        map.set(p.t, e);
      }
    });
    return [...map.values()].sort((a, b) => a.t - b.t);
  }, [schemes, benchmarkRows]);

  if (!benchmarkRows?.length) {
    return (
      <Card className="p-4 sm:p-5">
        <h3 className="font-display text-base sm:text-lg font-semibold">vs Benchmark</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Pick a benchmark index above to see alpha, beta, capture ratios and outperformance for each fund.
        </p>
      </Card>
    );
  }

  const rank = (key: "fundCagr" | "excessCagr" | "alpha" | "informationRatio" | "upCapture" | "battingAverage" | "downCapture", higherBetter = true) => {
    const sorted = rows
      .filter((r) => r.c && Number.isFinite(r.c[key] as number))
      .map((r) => ({ code: r.code, v: r.c![key] as number }))
      .sort((a, b) => (higherBetter ? b.v - a.v : a.v - b.v));
    return { best: sorted[0]?.code ?? -1, second: sorted[1]?.code ?? -1 };
  };
  const cls = (r: { best: number; second: number }, code: number) =>
    r.best === code ? "text-success font-semibold" : r.second === code ? "text-info font-medium" : "";

  const rFund = rank("fundCagr");
  const rExcess = rank("excessCagr");
  const rAlpha = rank("alpha");
  const rIR = rank("informationRatio");
  const rUp = rank("upCapture");
  const rDown = rank("downCapture", false);
  const rBat = rank("battingAverage");

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <h3 className="font-display text-base sm:text-lg font-semibold">
            vs Benchmark {benchmarkLabel ? <span className="text-muted-foreground font-normal">· {benchmarkLabel}</span> : null}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Measured over each fund&apos;s overlapping history with the index. Alpha and beta are annualised; capture ratios use monthly returns.
          </p>
          <RankLegend className="mt-2" />
        </div>
        <MetricGlossaryButton />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs num">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border/60">
              <th className="text-left font-medium py-2 pr-3">Fund</th>
              <th className="text-right font-medium"><span className="inline-flex items-center gap-1">Fund CAGR<MetricInfo id="fundCagr" /></span></th>
              <th className="text-right font-medium"><span className="inline-flex items-center gap-1">Index CAGR<MetricInfo id="benchCagr" /></span></th>
              <th className="text-right font-medium"><span className="inline-flex items-center gap-1">Excess<MetricInfo id="excessCagr" /></span></th>
              <th className="text-right font-medium"><span className="inline-flex items-center gap-1">Alpha<MetricInfo id="alpha" /></span></th>
              <th className="text-right font-medium"><span className="inline-flex items-center gap-1">Beta<MetricInfo id="beta" /></span></th>
              <th className="text-right font-medium"><span className="inline-flex items-center gap-1">R²<MetricInfo id="rSquared" /></span></th>
              <th className="text-right font-medium"><span className="inline-flex items-center gap-1">Tracking Err<MetricInfo id="trackingError" /></span></th>
              <th className="text-right font-medium"><span className="inline-flex items-center gap-1">Info Ratio<MetricInfo id="informationRatio" /></span></th>
              <th className="text-right font-medium"><span className="inline-flex items-center gap-1">Up capture<MetricInfo id="upCapture" /></span></th>
              <th className="text-right font-medium"><span className="inline-flex items-center gap-1">Down capture<MetricInfo id="downCapture" /></span></th>
              <th className="text-right font-medium"><span className="inline-flex items-center gap-1">Batting avg<MetricInfo id="battingAverage" /></span></th>
              <th className="text-right font-medium"><span className="inline-flex items-center gap-1">Years beaten<MetricInfo id="outperformYears" /></span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code} className="border-b border-border/30 last:border-0">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(row.i) }} />
                    <span className="truncate max-w-[240px]">{row.name}</span>
                  </div>
                </td>
                {row.c ? (
                  <>
                    <td className={`text-right ${cls(rFund, row.code)}`}>{fmtPct(row.c.fundCagr)}</td>
                    <td className="text-right text-muted-foreground">{fmtPct(row.c.benchCagr)}</td>
                    <td className={`text-right font-medium ${cls(rExcess, row.code) || (row.c.excessCagr >= 0 ? "text-success" : "text-destructive")}`}>
                      {fmtPct(row.c.excessCagr)}
                    </td>
                    <td className={`text-right ${cls(rAlpha, row.code) || (row.c.alpha >= 0 ? "text-success" : "text-destructive")}`}>{fmtPct(row.c.alpha)}</td>
                    <td className="text-right">{fmtNum(row.c.beta)}</td>
                    <td className="text-right">{fmtNum(row.c.rSquared)}</td>
                    <td className="text-right">{fmtPct(row.c.trackingError)}</td>
                    <td className={`text-right ${cls(rIR, row.code)}`}>{fmtNum(row.c.informationRatio)}</td>
                    <td className={`text-right ${cls(rUp, row.code)}`}>{fmtPctRaw(row.c.upCapture, 0)}</td>
                    <td className={`text-right ${cls(rDown, row.code)}`}>{fmtPctRaw(row.c.downCapture, 0)}</td>
                    <td className={`text-right ${cls(rBat, row.code)}`}>{fmtPctRaw(row.c.battingAverage, 0)}</td>
                    <td className="text-right">{row.c.totalYears ? `${row.c.outperformYears}/${row.c.totalYears}` : "—"}</td>
                  </>
                ) : (
                  <td colSpan={12} className="text-right text-muted-foreground">Not enough overlapping history</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      <div className="mt-6">
        <div className="text-xs text-muted-foreground mb-2">
          Relative strength — fund vs index, rebased to 100. Rising = beating the index.
        </div>
        <div className="h-[240px] sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time"
                tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v: number) => fmtDateShort(v)} />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={52} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(l: number) => fmtDateShort(l)}
                formatter={(v: number, n: string) => {
                  const idx = Number(String(n).replace("f", ""));
                  return [fmtNum(v, 1), schemes[idx]?.name ?? n];
                }}
              />
              <ReferenceLine y={100} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
              {schemes.map((s, i) => (
                <Line key={s.code} type="monotone" dataKey={`f${i}`} stroke={colorFor(i)} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
