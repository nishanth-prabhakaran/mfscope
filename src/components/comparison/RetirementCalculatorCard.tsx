import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { calculateRetirement } from "@/lib/planning";
import { fmtInr } from "@/lib/format";

export function RetirementCalculatorCard() {
  const [currentAge, setCurrentAge] = useState(30);
  const [retirementAge, setRetirementAge] = useState(60);
  const [lifeExpectancy, setLifeExpectancy] = useState(85);
  const [monthlyExpenseToday, setMonthlyExpenseToday] = useState(50000);
  const [inflation, setInflation] = useState(6);
  const [preReturn, setPreReturn] = useState(12);
  const [postReturn, setPostReturn] = useState(8);
  const [existingCorpus, setExistingCorpus] = useState(500000);
  const [currentMonthlySip, setCurrentMonthlySip] = useState(15000);
  const [sipStepUp, setSipStepUp] = useState(5);

  const r = useMemo(() => calculateRetirement({
    currentAge, retirementAge, lifeExpectancy, monthlyExpenseToday, inflation,
    preReturn, postReturn, existingCorpus, currentMonthlySip, sipStepUp,
  }), [currentAge, retirementAge, lifeExpectancy, monthlyExpenseToday, inflation,
    preReturn, postReturn, existingCorpus, currentMonthlySip, sipStepUp]);

  const chartData = useMemo(() => [
    ...r.corpusPath.map((p) => ({ age: p.age, accumulation: p.projected, required: p.required, retirement: null as number | null })),
    ...r.drawdownPath.slice(1).map((p) => ({ age: p.age, accumulation: null as number | null, required: null as number | null, retirement: p.corpus })),
  ], [r]);

  return (
    <Card className="p-4 sm:p-5">
      <div>
        <h3 className="font-display text-base sm:text-lg font-semibold">Retirement Calculator</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          NISM-style planning: inflation-indexed expenses, corpus required at retirement, and the SIP needed to get there.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
        <NumberField label="Current age" value={currentAge} onChange={setCurrentAge} min={18} max={70} />
        <NumberField label="Retirement age" value={retirementAge} onChange={setRetirementAge} min={30} max={80} />
        <NumberField label="Life expectancy" value={lifeExpectancy} onChange={setLifeExpectancy} min={60} max={110} />
        <NumberField label="Monthly expense today (₹)" value={monthlyExpenseToday} onChange={setMonthlyExpenseToday} step={5000} />
        <NumberField label="Inflation (%)" value={inflation} onChange={setInflation} step={0.5} />
        <NumberField label="Return pre-retirement (%)" value={preReturn} onChange={setPreReturn} step={0.5} />
        <NumberField label="Return post-retirement (%)" value={postReturn} onChange={setPostReturn} step={0.5} />
        <NumberField label="Existing corpus (₹)" value={existingCorpus} onChange={setExistingCorpus} step={50000} />
        <NumberField label="Current monthly SIP (₹)" value={currentMonthlySip} onChange={setCurrentMonthlySip} step={1000} />
        <NumberField label="SIP step-up (%/yr)" value={sipStepUp} onChange={setSipStepUp} step={1} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
        <Stat label={`Monthly expense at ${retirementAge}`} value={fmtInr(r.monthlyExpenseAtRetirement)} />
        <Stat label="Corpus required" value={fmtInr(r.corpusRequired)} accent />
        <Stat label="Projected corpus" value={fmtInr(r.projectedCorpus)} />
        <Stat
          label={r.surplus ? "Surplus" : "Shortfall"}
          value={fmtInr(Math.abs(r.gap))}
          tone={r.surplus ? "success" : "destructive"}
        />
        <Stat label="Required monthly SIP" value={fmtInr(r.requiredMonthlySip)} />
        <Stat label="Additional SIP needed" value={fmtInr(r.additionalMonthlySip)} tone={r.additionalMonthlySip > 0 ? "destructive" : "success"} />
        <Stat label="Years to retire" value={`${r.yearsToRetire}`} />
        <Stat label="Corpus lasts till age" value={r.corpusLastsTillAge != null ? `${r.corpusLastsTillAge}` : "—"} />
      </div>

      <div className="mt-6 h-[250px] sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
            <XAxis dataKey="age" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v: number) => fmtInr(v)} width={78} />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number, n: string) => [fmtInr(v), n]}
              labelFormatter={(l) => `Age ${l}`}
            />
            <Area type="monotone" dataKey="accumulation" name="Accumulation" stroke="var(--chart-1)" fill="url(#accGrad)" strokeWidth={2} connectNulls={false} />
            <Area type="monotone" dataKey="retirement" name="Retirement drawdown" stroke="var(--chart-3)" fill="url(#retGrad)" strokeWidth={2} connectNulls={false} />
            <Line type="monotone" dataKey="required" name="On-track path" stroke="var(--series-alt)" strokeDasharray="5 4" strokeWidth={2} dot={false} connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        Assumes SIPs invested monthly, expenses withdrawn annually at the start of each retirement year and indexed to inflation.
        Projections are illustrative, not guaranteed returns.
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
