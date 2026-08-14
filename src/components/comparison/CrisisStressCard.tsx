import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { HeartCrack, Info } from "lucide-react";
import type { NormalizedScheme, NavRow } from "@/types/mf";
import { stressTestAll, captureRatios, CRISES } from "@/lib/stress";
import { fmtPct, colorFor } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
  benchmarkRows?: NavRow[];
}

function months(days: number): string {
  const m = Math.round(days / 30.44);
  return m >= 12 ? `${(m / 12).toFixed(1)}y` : `${m}m`;
}

export function CrisisStressCard({ schemes, benchmarkRows }: Props) {
  const rows = useMemo(
    () =>
      schemes.map((s, i) => ({
        ...s,
        i,
        results: stressTestAll(s.data.rows),
        capture: benchmarkRows?.length ? captureRatios(s.data.rows, benchmarkRows) : null,
      })),
    [schemes, benchmarkRows],
  );

  if (!schemes.length) {
    return (
      <Card className="p-4 sm:p-5">
        <h3 className="font-display text-base font-semibold sm:text-lg">Crisis Stress Test</h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Add funds to see how they behaved through past market crashes.
        </p>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <HeartCrack className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold sm:text-lg">Crisis Stress Test</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            What actually happened to these funds in past crashes — the fall, and how long it took
            to get back. A max-drawdown number is abstract; this is the same fact made concrete.
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border/50">
              <th className="py-2 pr-3 text-left font-medium">Fund</th>
              {CRISES.map((c) => (
                <th key={c.id} className="px-2 py-2 text-right font-medium" title={c.blurb}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-b border-border/30 last:border-0">
                <td className="py-2 pr-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colorFor(r.i) }}
                    />
                    <span className="max-w-[150px] truncate">{r.name}</span>
                  </span>
                </td>
                {r.results.map((res) => (
                  <td key={res.crisis.id} className="px-2 py-2 text-right">
                    {res.insufficientHistory ? (
                      <span className="text-muted-foreground">n/a</span>
                    ) : (
                      <>
                        <span
                          className={cn(
                            "num block font-medium",
                            res.decline < -0.4
                              ? "text-destructive"
                              : res.decline < -0.2
                                ? "text-warning"
                                : "text-foreground",
                          )}
                        >
                          {fmtPct(res.decline, 1)}
                        </span>
                        <span className="num text-[10px] text-muted-foreground">
                          {res.recovered ? `back in ${months(res.recoveryDays!)}` : "not recovered"}
                        </span>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Capture ratios */}
      {rows.some((r) => r.capture) && (
        <div className="mt-5 min-w-0">
          <h4 className="text-sm font-semibold">Upside / downside capture</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Share of the benchmark's gains captured on its up months, and of its losses suffered on
            its down months. Capturing less of the falls than the rallies is the asymmetry worth
            paying for.
          </p>
          <div className="mt-2 grid min-w-0 gap-2">
            {rows.map((r) =>
              r.capture ? (
                <div
                  key={r.code}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colorFor(r.i) }}
                    />
                    <span className="truncate text-xs">{r.name}</span>
                  </span>
                  <span className="num shrink-0 text-xs">
                    <span className="text-success">{r.capture.upside.toFixed(0)}%</span>
                    <span className="text-muted-foreground"> up · </span>
                    <span
                      className={r.capture.downside > r.capture.upside ? "text-destructive" : ""}
                    >
                      {r.capture.downside.toFixed(0)}%
                    </span>
                    <span className="text-muted-foreground"> down</span>
                  </span>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}

      <p className="mt-4 flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Declines are peak-to-trough within each window, measured on the fund's own NAV. "n/a"
          means the fund did not exist for that episode — a short history is not the same as having
          come through unscathed, and is arguably the bigger unknown.
        </span>
      </p>
    </Card>
  );
}
