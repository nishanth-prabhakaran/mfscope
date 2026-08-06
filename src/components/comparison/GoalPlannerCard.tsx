import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { calculateGoal, GOAL_PRESETS } from "@/lib/goals";
import { calculateRisk } from "@/lib/calculators";
import { fmtInr, fmtNum, fmtPct } from "@/lib/format";
import type { NormalizedScheme } from "@/types/mf";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
}

export function GoalPlannerCard({ schemes }: Props) {
  const [goalName, setGoalName] = useState("Child's education");
  const [targetToday, setTargetToday] = useState(2500000);
  const [years, setYears] = useState(15);
  const [inflation, setInflation] = useState(8);
  const [expectedReturn, setExpectedReturn] = useState(12);
  const [currentSavings, setCurrentSavings] = useState(200000);
  const [currentMonthlySip, setCurrentMonthlySip] = useState(10000);
  const [sipStepUp, setSipStepUp] = useState(10);

  const fundCagrs = useMemo(
    () => schemes.map((s) => ({ name: s.name, cagr: calculateRisk(s.data.rows).cagr })),
    [schemes],
  );

  const res = useMemo(
    () => calculateGoal({ goalName, targetToday, years, inflation, expectedReturn, currentSavings, currentMonthlySip, sipStepUp }),
    [goalName, targetToday, years, inflation, expectedReturn, currentSavings, currentMonthlySip, sipStepUp],
  );

  const onTrack = res.gap <= 0;
  const trackPct = Math.max(0, Math.min(1, res.onTrackPct));

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">Goal-based SIP Planner</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Set a goal in today's cost, and see the inflation-adjusted target plus the monthly SIP needed to get there.
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

      <div className="mt-4 flex flex-wrap gap-1.5">
        {GOAL_PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => {
              setGoalName(p.name);
              setTargetToday(p.targetToday);
              setYears(p.years);
              setInflation(p.inflation);
            }}
            className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${
              goalName === p.name
                ? "bg-primary/15 border-primary/50 text-primary font-medium"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/30"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <div className="col-span-2 md:col-span-1">
          <Label className="text-[11px] text-muted-foreground">Goal name</Label>
          <Input value={goalName} onChange={(e) => setGoalName(e.target.value)} className="mt-1 h-10" />
        </div>
        <NumberField label="Goal cost today (₹)" value={targetToday} onChange={setTargetToday} step={50000} />
        <NumberField label="Years to goal" value={years} onChange={setYears} step={1} min={1} max={40} />
        <NumberField label="Cost inflation (%)" value={inflation} onChange={setInflation} step={0.5} />
        <NumberField label="Expected return (%)" value={expectedReturn} onChange={setExpectedReturn} step={0.5} />
        <NumberField label="Already saved (₹)" value={currentSavings} onChange={setCurrentSavings} step={10000} />
        <NumberField label="Current SIP (₹/mo)" value={currentMonthlySip} onChange={setCurrentMonthlySip} step={1000} />
        <NumberField label="SIP step-up (%/yr)" value={sipStepUp} onChange={setSipStepUp} step={1} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
        <Stat label={`Target in ${years} yrs`} value={fmtInr(res.targetAtGoal)} accent />
        <Stat label="Projected corpus" value={fmtInr(res.projectedCorpus)} />
        <Stat
          label={onTrack ? "Surplus" : "Shortfall"}
          value={fmtInr(Math.abs(res.gap))}
          tone={onTrack ? "success" : "destructive"}
        />
        <Stat label="Required SIP (level)" value={`${fmtInr(res.requiredMonthlySip)}/mo`} />
      </div>

      <div className="mt-4 rounded-lg border border-border/60 bg-card/50 p-3.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">On track</span>
          <span className={`num font-semibold ${onTrack ? "text-success" : "text-amber-400"}`}>
            {fmtNum(res.onTrackPct * 100, 0)}%
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full ${onTrack ? "bg-success" : "bg-amber-400"}`}
            style={{ width: `${trackPct * 100}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2.5">
          {onTrack ? (
            <>Your current plan reaches this goal{res.achievedInYears !== null ? ` in about ${res.achievedInYears} years` : ""}.</>
          ) : (
            <>
              Increase your SIP by <span className="text-foreground font-medium num">{fmtInr(res.additionalMonthlySip)}/mo</span>{" "}
              (or start at <span className="text-foreground font-medium num">{fmtInr(res.requiredStepUpSip)}/mo</span> with a {sipStepUp}% annual step-up),
              or invest <span className="text-foreground font-medium num">{fmtInr(res.requiredLumpsumToday)}</span> as a lumpsum today.
            </>
          )}
        </p>
      </div>

      <div className="mt-5 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={res.rows} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="goalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `Y${v}`} />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={64} tickFormatter={(v) => fmtInr(Number(v))} />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
              formatter={(v: number, n: string) => [fmtInr(v), n]}
              labelFormatter={(l) => `Year ${l}`}
            />
            <Area type="monotone" dataKey="projected" name="Projected corpus" stroke="var(--chart-2)" fill="url(#goalGrad)" strokeWidth={2} />
            <Line type="monotone" dataKey="invested" name="Invested" stroke="var(--chart-3)" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="target" name="Goal cost" stroke="var(--chart-5)" dot={false} strokeWidth={2} strokeDasharray="5 4" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        Illustrative only. Assumes constant returns and steady inflation; actual mutual fund returns vary and are not guaranteed.
      </p>
    </Card>
  );
}

function Stat({ label, value, accent, tone }: { label: string; value: string; accent?: boolean; tone?: "success" | "destructive" }) {
  const color = tone === "success" ? "text-success" : tone === "destructive" ? "text-amber-400" : accent ? "text-primary" : "";
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
