import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { PieChart as PieIcon, Info, Loader2, AlertTriangle } from "lucide-react";
import { fetchSchemeDetail, num } from "@/lib/finapiDetail";
import type { NormalizedScheme } from "@/types/mf";
import { colorFor } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
}

interface SectorExposure {
  sector: string;
  weight: number;
  fundCount: number;
}

export function SectorExposureCard({ schemes }: Props) {
  const details = useQueries({
    queries: schemes.map((s) => ({
      queryKey: ["scheme-detail", s.code],
      queryFn: () => fetchSchemeDetail(s.code),
      staleTime: 6 * 60 * 60 * 1000,
      retry: 1,
    })),
  });

  const loading = details.some((d) => d.isLoading);

  const { exposure, covered } = useMemo(() => {
    const withSectors = details.filter((d) => d.data?.sectors?.length);
    if (!withSectors.length) return { exposure: [] as SectorExposure[], covered: 0 };

    const share = 1 / withSectors.length;
    const map = new Map<string, { weight: number; funds: number }>();
    for (const d of withSectors) {
      for (const row of d.data!.sectors!) {
        const w = num(row.weightage);
        const name = row.sector?.trim();
        if (w == null || w <= 0 || !name) continue;
        const prev = map.get(name);
        if (prev) {
          prev.weight += w * share;
          prev.funds += 1;
        } else {
          map.set(name, { weight: w * share, funds: 1 });
        }
      }
    }
    const out = Array.from(map.entries())
      .map(([sector, v]) => ({ sector, weight: v.weight, fundCount: v.funds }))
      .sort((a, b) => b.weight - a.weight);
    return { exposure: out, covered: withSectors.length };
  }, [details]);

  // Herfindahl index over sector weights — one number for "how concentrated".
  const hhi = useMemo(() => {
    const total = exposure.reduce((a, s) => a + s.weight, 0);
    if (!total) return 0;
    return exposure.reduce((a, s) => a + Math.pow((s.weight / total) * 100, 2), 0);
  }, [exposure]);

  const top = exposure[0];

  if (loading) {
    return (
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm">Loading sector data…</span>
        </div>
      </Card>
    );
  }

  if (!exposure.length) {
    return (
      <Card className="p-4 sm:p-5">
        <h3 className="font-display text-base font-semibold sm:text-lg">Sector Exposure</h3>
        <p className="mt-2 text-xs text-muted-foreground">
          No sector data available for the selected funds.
        </p>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <PieIcon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold sm:text-lg">Sector Exposure</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Combined across your selection, equal-weighted. Holding several funds that all lean on
            the same sector concentrates risk that each fund alone looks diversified against.
          </p>
        </div>
      </div>

      {top && top.weight > 30 && (
        <div className="mt-3 flex gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs leading-relaxed">
            <span className="num font-medium">{top.weight.toFixed(1)}%</span> of your combined
            portfolio sits in {top.sector}. A downturn in that one sector would move most of your
            money at once.
          </p>
        </div>
      )}

      <div className="mt-4 grid min-w-0 gap-1.5">
        {exposure.slice(0, 12).map((s, i) => (
          <div key={s.sector} className="min-w-0">
            <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
              <span className="truncate">{s.sector}</span>
              <span className="num shrink-0 text-muted-foreground">
                {s.weight.toFixed(1)}% · {s.fundCount}/{covered} funds
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, s.weight * 2)}%`,
                  backgroundColor: colorFor(i),
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs">
        <span className="text-muted-foreground">Sector concentration (HHI): </span>
        <span
          className={cn(
            "num font-semibold",
            hhi > 2500 ? "text-destructive" : hhi > 1500 ? "text-warning" : "text-success",
          )}
        >
          {hhi.toFixed(0)}
        </span>
        <span className="text-muted-foreground">
          {" "}
          —{" "}
          {hhi > 2500
            ? "highly concentrated"
            : hhi > 1500
              ? "moderately concentrated"
              : "well spread"}
          . Below 1500 is generally considered diversified; above 2500, concentrated.
        </span>
      </div>

      <p className="mt-4 flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Based on the latest disclosed portfolios, which funds publish monthly and with a lag.
          Equal-weighted across the {covered} selected fund{covered === 1 ? "" : "s"} with sector
          data — if you hold unequal amounts, your real exposure differs.
        </span>
      </p>
    </Card>
  );
}
