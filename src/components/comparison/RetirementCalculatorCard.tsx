import { useMemo, useState } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { calculateRetirement } from "@/lib/planning";
import { fmtInr } from "@/lib/format";
import { ChevronDown } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function RetirementCalculatorCard() {
  const [currentAge, setCurrentAge] = usePersistentState("retirement.current-age", 30);
  const [retirementAge, setRetirementAge] = usePersistentState("retirement.retire-age", 60);
  const [lifeExpectancy, setLifeExpectancy] = usePersistentState("retirement.life-expectancy", 85);
  const [monthlyExpenseToday, setMonthlyExpenseToday] = usePersistentState("retirement.monthly-expense", 50000);
  const [inflation, setInflation] = usePersistentState("retirement.inflation", 6);
  const [preReturn, setPreReturn] = usePersistentState("retirement.pre-return", 12);
  const [postReturn, setPostReturn] = usePersistentState("retirement.post-return", 8);
  const [existingCorpus, setExistingCorpus] = usePersistentState("retirement.existing-corpus", 500000);
  const [currentMonthlySip, setCurrentMonthlySip] = usePersistentState("retirement.current-sip", 15000);
  const [sipStepUp, setSipStepUp] = usePersistentState("retirement.sip-step-up", 5);

  // Optional advanced inputs (empty = not used)
  const [postInflationStr, setPostInflationStr] = usePersistentState("retirement.post-inflation", "");
  const [pensionStr, setPensionStr] = usePersistentState("retirement.pension", "");
  const [bequestStr, setBequestStr] = usePersistentState("retirement.bequest", "");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const optional = useMemo(() => ({
    postInflation: postInflationStr.trim() === "" ? undefined : Number(postInflationStr) || undefined,
    pensionIncomeToday: pensionStr.trim() === "" ? undefined : Number(pensionStr) || undefined,
    bequestToday: bequestStr.trim() === "" ? undefined : Number(bequestStr) || undefined,
  }), [postInflationStr, pensionStr, bequestStr]);

  const r = useMemo(() => calculateRetirement({
    currentAge, retirementAge, lifeExpectancy, monthlyExpenseToday, inflation,
    preReturn, postReturn, existingCorpus, currentMonthlySip, sipStepUp,
    ...optional,
  }), [currentAge, retirementAge, lifeExpectancy, monthlyExpenseToday, inflation,
    preReturn, postReturn, existingCorpus, currentMonthlySip, sipStepUp, optional]);

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

      <button
        type="button"
        onClick={() => setShowAdvanced((s) => !s)}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        {showAdvanced ? "Hide optional settings" : "Optional settings (pension, legacy, post-retirement inflation)"}
      </button>
      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2 rounded-lg border border-border/60 bg-card/50 p-3">
          <OptionalNumberField
            label="Post-retirement inflation (%)"
            placeholder={`Same as pre (${inflation}%)`}
            value={postInflationStr}
            onChange={setPostInflationStr}
            step={0.5}
          />
          <OptionalNumberField
            label="Pension / rent in retirement (₹/mo, today's ₹)"
            placeholder="e.g. 15000"
            value={pensionStr}
            onChange={setPensionStr}
            step={1000}
          />
          <OptionalNumberField
            label="Legacy to leave (₹, today's money)"
            placeholder="e.g. 5000000"
            value={bequestStr}
            onChange={setBequestStr}
            step={100000}
          />
          <p className="sm:col-span-3 text-[11px] text-muted-foreground">
            Pension reduces what the corpus must fund each year; the legacy target is added to the corpus needed at retirement
            (inflated to end of life, discounted back at the post-retirement return).
          </p>
        </div>
      )}

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
        {optional.pensionIncomeToday ? (
          <Stat label={`Pension income at ${retirementAge} (₹/yr)`} value={fmtInr(r.pensionAtRetirement)} />
        ) : null}
        {optional.bequestToday ? (
          <Stat label={`Legacy target at ${lifeExpectancy}`} value={fmtInr(r.bequestAtEnd)} />
        ) : null}
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

      <Tabs defaultValue="accumulation" className="mt-6">
        <TabsList>
          <TabsTrigger value="accumulation">Year-by-year growth</TabsTrigger>
          <TabsTrigger value="drawdown">Retirement years</TabsTrigger>
        </TabsList>

        <TabsContent value="accumulation" className="mt-3">
          <p className="text-[11px] text-muted-foreground mb-2">
            Every year from age {currentAge} to {retirementAge}: the SIP running that year, what you invest, the corpus you build,
            what you should have by then to stay on track, and what your expenses look like at that age.
          </p>
          <div className="overflow-auto max-h-[380px] rounded-lg border border-border/60">
            <table className="w-full text-xs num min-w-[620px]">
              <thead className="text-muted-foreground sticky top-0 bg-card z-10">
                <tr className="border-b border-border/60">
                  <th className="text-left font-medium py-2 px-3">Age</th>
                  <th className="text-right font-medium">Monthly SIP</th>
                  <th className="text-right font-medium">Invested (yr)</th>
                  <th className="text-right font-medium">Total invested</th>
                  <th className="text-right font-medium">Corpus</th>
                  <th className="text-right font-medium">Required</th>
                  <th className="text-right font-medium">On track</th>
                  <th className="text-right font-medium pr-3">Expense (₹/mo)</th>
                </tr>
              </thead>
              <tbody>
                {r.schedule.map((row) => (
                  <tr key={row.age} className="border-b border-border/30 last:border-0">
                    <td className="py-1.5 px-3 font-medium">{row.age}</td>
                    <td className="text-right">{fmtInr(row.monthlySip)}</td>
                    <td className="text-right">{fmtInr(row.annualInvested)}</td>
                    <td className="text-right">{fmtInr(row.totalInvested)}</td>
                    <td className="text-right font-medium">{fmtInr(row.corpus)}</td>
                    <td className="text-right">{fmtInr(row.required)}</td>
                    <td className={`text-right ${row.progressPct >= 100 ? "text-success" : "text-destructive"}`}>
                      {row.progressPct.toFixed(0)}%
                    </td>
                    <td className="text-right pr-3">{fmtInr(row.monthlyExpenseThen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="drawdown" className="mt-3">
          <p className="text-[11px] text-muted-foreground mb-2">
            From age {retirementAge} to {lifeExpectancy}: what you spend each year, the pension that covers part of it,
            what the corpus actually funds, and how long the money lasts.
          </p>
          <div className="overflow-auto max-h-[380px] rounded-lg border border-border/60">
            <table className="w-full text-xs num min-w-[560px]">
              <thead className="text-muted-foreground sticky top-0 bg-card z-10">
                <tr className="border-b border-border/60">
                  <th className="text-left font-medium py-2 px-3">Age</th>
                  <th className="text-right font-medium">Expense (₹/yr)</th>
                  {optional.pensionIncomeToday ? <th className="text-right font-medium">Pension (₹/yr)</th> : null}
                  <th className="text-right font-medium">Corpus funds</th>
                  <th className="text-right font-medium">Corpus start</th>
                  <th className="text-right font-medium pr-3">Corpus end</th>
                </tr>
              </thead>
              <tbody>
                {r.drawdownSchedule.map((row) => (
                  <tr key={row.age} className={`border-b border-border/30 last:border-0 ${row.corpusEnd <= 0 ? "opacity-60" : ""}`}>
                    <td className="py-1.5 px-3 font-medium">{row.age}</td>
                    <td className="text-right">{fmtInr(row.grossExpense)}</td>
                    {optional.pensionIncomeToday ? <td className="text-right">{fmtInr(row.pension)}</td> : null}
                    <td className="text-right font-medium">{fmtInr(row.netWithdrawal)}</td>
                    <td className="text-right">{fmtInr(row.corpusStart)}</td>
                    <td className={`text-right pr-3 ${row.corpusEnd <= 0 ? "text-destructive" : ""}`}>{fmtInr(row.corpusEnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-[11px] text-muted-foreground mt-3">
        Assumes SIPs invested monthly, expenses withdrawn annually at the start of each retirement year and indexed to inflation
        (pension, if entered, offsets the withdrawal). Projections are illustrative, not guaranteed returns.
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

function OptionalNumberField({
  label, value, onChange, placeholder, step = 1,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; step?: number }) {
  return (
    <div>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        placeholder={placeholder}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 num"
      />
    </div>
  );
}
