import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarRange, Info } from "lucide-react";
import type { NormalizedScheme, RollingYears } from "@/types/mf";
import { rollingSip } from "@/lib/rollingSip";
import { fmtInr, fmtNum, colorFor } from "@/lib/format";
import { cn } from "@/lib/utils";

const PERIODS: RollingYears[] = [3, 5, 7, 10, 12, 15];

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
}

function monthLabel(t: number) {
  return new Date(t).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function RollingSipCard({ schemes }: Props) {
  const [run, setRun] = useState(false);
  const [years, setYears] = useState<RollingYears>(5);
  const [monthly, setMonthly] = useState(10000);

  const results = useMemo(() => {
    if (!run) return [];
    return schemes.map((s, i) => ({
      ...s,
      i,
      stats: rollingSip(s.data.rows, years, monthly),
    }));
  }, [run, schemes, years, monthly]);

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <CalendarRange className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold sm:text-lg">Rolling SIP Returns</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Every other SIP figure here assumes one start date, which bakes in luck. This runs a{" "}
            {years}-year SIP starting in <em>every</em> month of the fund's history to show the
            range you could actually have got.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setYears(p)}
              className={cn(
                "shrink-0 rounded-md px-3 py-2 text-xs transition-colors sm:px-2.5 sm:py-1",
                years === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p}Y
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Monthly
          <Input
            type="number"
            value={monthly}
            step={1000}
            onChange={(e) => setMonthly(Math.max(500, Number(e.target.value) || 0))}
            className="num h-8 w-28 text-xs"
          />
        </label>
        {!run && (
          <Button size="sm" variant="outline" onClick={() => setRun(true)}>
            Run analysis
          </Button>
        )}
      </div>

      {!run ? (
        <p className="mt-4 rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
          Runs hundreds of SIP simulations per fund, so it's off by default. Pick a period and
          amount, then run.
        </p>
      ) : (
        <div className="mt-4 grid min-w-0 gap-3">
          {results.map((r) =>
            r.stats.count === 0 ? (
              <div
                key={r.code}
                className="min-w-0 rounded-lg border border-border/50 px-3 py-2.5 text-xs"
              >
                <p className="truncate font-medium">{r.name}</p>
                <p className="mt-1 text-muted-foreground">
                  Less than {years} years of history — no complete SIP window to measure.
                </p>
              </div>
            ) : (
              <div key={r.code} className="min-w-0 rounded-lg border border-border/50 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colorFor(r.i) }}
                  />
                  <p className="truncate text-sm font-medium">{r.name}</p>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {r.stats.count} starting months tested
                </p>

                <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                  <Stat label="Median XIRR" value={`${fmtNum(r.stats.medianXirr)}%`} accent />
                  <Stat
                    label="25th–75th"
                    value={`${fmtNum(r.stats.p25, 1)}–${fmtNum(r.stats.p75, 1)}%`}
                  />
                  <Stat
                    label="Worst start"
                    value={`${fmtNum(r.stats.worst!.xirr * 100)}%`}
                    sub={monthLabel(r.stats.worst!.startT)}
                    tone="text-destructive"
                  />
                  <Stat
                    label="Best start"
                    value={`${fmtNum(r.stats.best!.xirr * 100)}%`}
                    sub={monthLabel(r.stats.best!.startT)}
                    tone="text-success"
                  />
                </div>

                <p className="mt-2 text-[11px] text-muted-foreground">
                  {fmtNum(r.stats.positivePct, 0)}% of start months ended positive. On{" "}
                  {fmtInr(monthly)}/month, the worst window turned {fmtInr(r.stats.worst!.invested)}{" "}
                  into {fmtInr(r.stats.worst!.value)}.
                </p>
              </div>
            ),
          )}
        </div>
      )}

      <p className="mt-4 flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Historical simulation on past NAVs. It shows the spread of outcomes that already happened,
          which is a better guide than any single start date — but it is not a prediction of future
          SIP returns.
        </span>
      </p>
    </Card>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("num mt-0.5 font-medium", tone, accent && "text-gradient-brand")}>{value}</p>
      {sub && <p className="truncate text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
