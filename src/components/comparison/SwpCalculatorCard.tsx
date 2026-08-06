import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { simulateSWP, projectSWP } from "@/lib/swp";
import { fmtInr, fmtPct, fmtDate, colorFor } from "@/lib/format";
import type { NormalizedScheme } from "@/types/mf";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
}

export function SwpCalculatorCard({ schemes }: Props) {
  const [initial, setInitial] = useState(5000000);
  const [monthlyWithdrawal, setMonthlyWithdrawal] = useState(30000);
  const [annualIncrease, setAnnualIncrease] = useState(6);
  const [years, setYears] = useState(10);
  const [expectedReturn, setExpectedReturn] = useState(10);
  const [inflation, setInflation] = useState(6);

  const endT = useMemo(
    () => (schemes.length
      ? Math.min(...schemes.map((s) => s.data.rows[s.data.rows.length - 1]?.t ?? Date.now()))
      : Date.now()),
    [schemes],
  );
  const startT = useMemo(() => endT - years * 365.25 * 86_400_000, [endT, years]);

  const backtest = useMemo(
    () => schemes.map((s, i) => ({
      i, code: s.code, name: s.name,
      r: simulateSWP(s.data.rows, { initial, monthlyWithdrawal, annualIncrease, startT, endT }),
    })),
    [schemes, initial, monthlyWithdrawal, annualIncrease, startT, endT],
  );

  const proj = useMemo(
    () => projectSWP({ initial, monthlyWithdrawal, annualIncrease, expectedReturn, inflation, years }),
    [initial, monthlyWithdrawal, annualIncrease, expectedReturn, inflation, years],
  );

  return (
    <Card className="p-4 sm:p-5">
      <div>
        <h3 className="font-display text-lg font-semibold">SWP Calculator</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Systematic Withdrawal Plan — how long a corpus lasts while you draw a monthly income from it.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
        <NumberField label="Corpus (₹)" value={initial} onChange={setInitial} step={100000} />
        <NumberField label="Monthly withdrawal (₹)" value={monthlyWithdrawal} onChange={setMonthlyWithdrawal} step={1000} />
        <NumberField label="Annual increase (%)" value={annualIncrease} onChange={setAnnualIncrease} step={1} />
        <NumberField label="Duration (years)" value={years} onChange={setYears} step={1} min={1} max={40} />
        <NumberField label="Expected return (%)" value={expectedReturn} onChange={setExpectedReturn} step={0.5} />
        <NumberField label="Inflation (%)" value={inflation} onChange={setInflation} step={0.5} />
      </div>

      <Tabs defaultValue="projection" className="mt-5">
        <TabsList>
          <TabsTrigger value="projection">Projection</TabsTrigger>
          <TabsTrigger value="backtest" disabled={!schemes.length}>Backtest on funds</TabsTrigger>
        </TabsList>

        <TabsContent value="projection" className="mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Total withdrawn" value={fmtInr(proj.totalWithdrawn)} />
            <Stat label="Balance at end" value={fmtInr(proj.finalBalance)} accent />
            <Stat
              label="Corpus depletes"
              value={proj.depletedInYear ? `Year ${proj.depletedInYear}` : "Survives horizon"}
              tone={proj.depletedInYear ? "destructive" : "success"}
            />
            <Stat label="Sustainable monthly" value={fmtInr(proj.sustainableMonthly)} />
          </div>

          <div className="mt-5 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={proj.rows} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id="swpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v: number) => fmtInr(v)} width={78} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, n: string) => [fmtInr(v), n]}
                  labelFormatter={(l) => `Year ${l}`}
                />
                <Area type="monotone" dataKey="balance" name="Balance" stroke="var(--chart-1)" fill="url(#swpGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="realBalance" name="Balance (today's money)" stroke="var(--chart-3)" fill="none" strokeWidth={2} strokeDasharray="5 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs num">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="text-left font-medium py-2 pr-3">Year</th>
                  <th className="text-right font-medium">Withdrawn</th>
                  <th className="text-right font-medium">Cumulative</th>
                  <th className="text-right font-medium">Balance</th>
                  <th className="text-right font-medium">Real balance</th>
                </tr>
              </thead>
              <tbody>
                {proj.rows.slice(1).map((r) => (
                  <tr key={r.year} className="border-b border-border/30 last:border-0">
                    <td className="py-1.5 pr-3">{r.year}</td>
                    <td className="text-right">{fmtInr(r.withdrawnThisYear)}</td>
                    <td className="text-right">{fmtInr(r.cumulativeWithdrawn)}</td>
                    <td className={`text-right ${r.balance <= 0 ? "text-destructive-foreground" : ""}`}>{fmtInr(r.balance)}</td>
                    <td className="text-right text-muted-foreground">{fmtInr(r.realBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="backtest" className="mt-4">
          <p className="text-[11px] text-muted-foreground mb-3">
            Withdrawals applied monthly against real NAV history over the last {years} year(s).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs num">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="text-left font-medium py-2 pr-3">Fund</th>
                  <th className="text-right font-medium">Withdrawn</th>
                  <th className="text-right font-medium">Balance left</th>
                  <th className="text-right font-medium">Months paid</th>
                  <th className="text-right font-medium">Depleted</th>
                  <th className="text-right font-medium">XIRR</th>
                </tr>
              </thead>
              <tbody>
                {backtest.map((row) => (
                  <tr key={row.code} className="border-b border-border/30 last:border-0">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(row.i) }} />
                        <span className="truncate max-w-[240px]">{row.name}</span>
                      </div>
                    </td>
                    <td className="text-right">{fmtInr(row.r.totalWithdrawn)}</td>
                    <td className={`text-right ${row.r.finalValue >= row.r.invested ? "text-success" : ""}`}>{fmtInr(row.r.finalValue)}</td>
                    <td className="text-right">{row.r.monthsSurvived}</td>
                    <td className="text-right">
                      {row.r.depletedAt ? <span className="text-destructive-foreground">{fmtDate(row.r.depletedAt)}</span> : "—"}
                    </td>
                    <td className="text-right font-medium">{fmtPct(row.r.xirr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function Stat({ label, value, accent, tone }: { label: string; value: string; accent?: boolean; tone?: "success" | "destructive" }) {
  const color = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive-foreground" : accent ? "text-primary" : "";
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
