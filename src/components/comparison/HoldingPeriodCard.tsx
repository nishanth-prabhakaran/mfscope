import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Hourglass, Info } from "lucide-react";
import { holdingPeriodProfile } from "@/lib/decisions";
import type { NormalizedScheme } from "@/types/mf";
import { colorFor } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
}

export function HoldingPeriodCard({ schemes }: Props) {
  const rows = useMemo(
    () => schemes.map((s, i) => ({ ...s, i, profile: holdingPeriodProfile(s.data.rows, 10) })),
    [schemes],
  );

  const withData = rows.filter((r) => r.profile.rows.length);

  if (!withData.length) {
    return (
      <Card className="p-4 sm:p-5">
        <h3 className="font-display text-base font-semibold sm:text-lg">Minimum Holding Period</h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Not enough NAV history in the selected funds to measure this.
        </p>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Hourglass className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold sm:text-lg">
            Minimum Holding Period
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Taking every possible start date in each fund's history, how often a given holding
            length ended in profit. The honest answer to "how long do I need to leave this alone?"
          </p>
        </div>
      </div>

      <div className="mt-4 grid min-w-0 gap-4">
        {withData.map((r) => (
          <div key={r.code} className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: colorFor(r.i) }}
              />
              <p className="truncate text-sm font-medium">{r.name}</p>
            </div>

            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {r.profile.safeYears != null ? (
                <>
                  No {r.profile.safeYears}-year holding period in this fund's history has lost
                  money.
                  {r.profile.mostlySafeYears != null &&
                    r.profile.mostlySafeYears < r.profile.safeYears &&
                    ` At ${r.profile.mostlySafeYears} years, 95% ended positive.`}
                </>
              ) : r.profile.mostlySafeYears != null ? (
                <>
                  At {r.profile.mostlySafeYears} years, 95% of holding periods ended positive — but
                  some still lost money at every length measured.
                </>
              ) : (
                <>Losses occurred at every holding length in the record so far.</>
              )}
            </p>

            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[320px] text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <th className="py-1.5 pr-3 text-left font-medium">Held for</th>
                    <th className="px-2 py-1.5 text-right font-medium">Ended positive</th>
                    <th className="px-2 py-1.5 text-right font-medium">Worst outcome</th>
                    <th className="py-1.5 pl-2 text-right font-medium">Worst /yr</th>
                  </tr>
                </thead>
                <tbody>
                  {r.profile.rows.map((p) => (
                    <tr key={p.years} className="border-b border-border/30 last:border-0">
                      <td className="py-1.5 pr-3">{p.years}y</td>
                      <td
                        className={cn(
                          "num px-2 py-1.5 text-right font-medium",
                          p.positivePct >= 100
                            ? "text-success"
                            : p.positivePct >= 90
                              ? "text-foreground"
                              : "text-warning",
                        )}
                      >
                        {p.positivePct.toFixed(0)}%
                      </td>
                      <td
                        className={cn(
                          "num px-2 py-1.5 text-right",
                          p.worstTotal < 0 ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {p.worstTotal >= 0 ? "+" : ""}
                        {p.worstTotal.toFixed(1)}%
                      </td>
                      <td className="num py-1.5 pl-2 text-right text-muted-foreground">
                        {p.worst >= 0 ? "+" : ""}
                        {p.worst.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Based only on the periods this fund has actually lived through, which may not include its
          worst possible one — a fund launched after 2009 has never been tested by 2008. A clean
          record is reassuring, not a guarantee.
        </span>
      </p>
    </Card>
  );
}
