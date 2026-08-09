import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { projectInvestment, scenarioReturns } from "@/lib/planning";
import { calculateRisk } from "@/lib/calculators";
import type { NormalizedScheme } from "@/types/mf";
import { fmtInr, fmtNum, fmtPct } from "@/lib/format";
import { Button } from "@/components/ui/button";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
}

export function ProjectionCalculatorCard({ schemes }: Props) {
  const [lumpsum, setLumpsum] = useState(100000);
  const [monthly, setMonthly] = useState(10000);
  const [stepUp, setStepUp] = useState(10);
  const [years, setYears] = useState(15);
  const [expectedReturn, setExpectedReturn] = useState(12);
  const [inflation, setInflation] = useState(6);

  const fundCagrs = useMemo(
    () => schemes.map((s) => ({ name: s.name, cagr: calculateRisk(s.data.rows).cagr })),
    [schemes],
  );

  const base = useMemo(
    () => projectInvestment({ lumpsum, monthly, stepUp, years, expectedReturn, inflation }),
    [lumpsum, monthly, stepUp, years, expectedReturn, inflation],
  );

  const scenarios = useMemo(
    () => scenarioReturns(expectedReturn).map((s) => ({
      ...s,
      r: projectInvestment({ lumpsum, monthly, stepUp, years, expectedReturn: s.rate, inflation }),
    })),
    [lumpsum, monthly, stepUp, years, expectedReturn, inflation],
  );

  const chartData = useMemo(
    () => base.rows.map((row, i) => ({
      year: row.year,
      invested: row.invested,
      value: row.value,
      real: row.realValue,
      low: scenarios[0].r.rows[i]?.value ?? null,
      high: scenarios[2].r.rows[i]?.value ?? null,
    })),
    [base, scenarios],
  );

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <h3 className="font-display text-base sm:text-lg font-semibold">Investment Projection</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Project a lumpsum + step-up SIP forward, with conservative / base / optimistic scenarios and inflation-adjusted value.
          </p>
        </div>
        {fundCagrs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {fundCagrs.slice(0, 4).map((f) => (
              <Button
                key={f.name}
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setExpectedReturn(Number((f.cagr * 100).toFixed(1)))}
                title={`Use ${f.name} historical CAGR`}
              >
                {f.name.split(" ").slice(0, 3).join(" ")} · {fmtPct(f.cagr, 1)}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4">
        <NumberField label="Lumpsum (₹)" value={lumpsum} onChange={setLumpsum} step={10000} />
        <NumberField label="Monthly SIP (₹)" value={monthly} onChange={setMonthly} step={1000} />
        <NumberField label="SIP step-up (%/yr)" value={stepUp} onChange={setStepUp} step={1} />
        <NumberField label="Duration (years)" value={years} onChange={setYears} step={1} min={1} max={40} />
        <NumberField label="Expected return (%)" value={expectedReturn} onChange={setExpectedReturn} step={0.5} />
        <NumberField label="Inflation (%)" value={inflation} onChange={setInflation} step={0.5} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
        <Stat label="Total invested" value={fmtInr(base.totalInvested)} />
        <Stat label="Projected value" value={fmtInr(base.finalValue)} accent />
        <Stat label="Wealth gained" value={fmtInr(base.totalGains)} tone="success" />
        <Stat label={`Value in today's ₹`} value={fmtInr(base.realValue)} />
        <Stat label="Multiple" value={`${fmtNum(base.multiple, 2)}x`} />
      </div>

      <div className="mt-6 h-[250px] sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v: number) => `Y${v}`} />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v: number) => fmtInr(v)} width={78} />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number, n: string) => [fmtInr(v), n]}
              labelFormatter={(l) => `Year ${l}`}
            />
            <Area type="monotone" dataKey="high" name="Optimistic" stroke="var(--chart-4)" fill="none" strokeDasharray="4 4" strokeWidth={1.5} />
            <Area type="monotone" dataKey="value" name="Base case" stroke="var(--chart-2)" fill="url(#projGrad)" strokeWidth={2.5} />
            <Area type="monotone" dataKey="low" name="Conservative" stroke="var(--chart-5)" fill="none" strokeDasharray="4 4" strokeWidth={1.5} />
            <Area type="monotone" dataKey="invested" name="Invested" stroke="var(--muted-foreground)" fill="none" strokeWidth={1.5} />
            <Area type="monotone" dataKey="real" name="Inflation-adjusted" stroke="var(--series-alt)" fill="none" strokeDasharray="2 3" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-xs num">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border/60">
              <th className="text-left font-medium py-2 pr-3">Scenario</th>
              <th className="text-right font-medium">Return</th>
              <th className="text-right font-medium">Invested</th>
              <th className="text-right font-medium">Final value</th>
              <th className="text-right font-medium">Gains</th>
              <th className="text-right font-medium">In today's ₹</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={s.label} className="border-b border-border/30 last:border-0">
                <td className="py-2 pr-3">{s.label}</td>
                <td className="text-right">{fmtNum(s.rate, 1)}%</td>
                <td className="text-right">{fmtInr(s.r.totalInvested)}</td>
                <td className="text-right font-medium">{fmtInr(s.r.finalValue)}</td>
                <td className="text-right text-success">{fmtInr(s.r.totalGains)}</td>
                <td className="text-right">{fmtInr(s.r.realValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        Illustrative projections based on assumed constant returns; actual mutual fund returns vary and are not guaranteed.
      </p>
    </Card>
  );
}

function Stat({ label, value, accent, tone }: { label: string; value: string; accent?: boolean; tone?: "success" | "destructive" }) {
  const color = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : accent ? "text-primary" : "";
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`num text-base font-semibold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function NumberField({
  label, value, onChange, step = 1, min, max,
}: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <div>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 h-10 num"
      />
    </div>
  );
}
