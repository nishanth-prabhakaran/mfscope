import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Percent, Info, Search } from "lucide-react";
import { useSchemeList } from "@/hooks/useSchemes";
import { fetchScheme } from "@/lib/finapi";
import { buildUniverse, mapPool, CONCURRENCY } from "@/lib/universe";
import { guessCategory } from "@/lib/categories";
import {
  calculateRollingReturns,
  rollingStats,
  calculateRisk,
  drawdownSeries,
  maxDrawdown,
} from "@/lib/calculators";
import { percentileRank, percentileLabel } from "@/lib/rollingSip";
import type { NormalizedScheme, RollingYears } from "@/types/mf";
import { colorFor, fmtNum, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

const PER_CATEGORY = 20;
const PERIODS: RollingYears[] = [3, 5, 7, 10];

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
}

interface PeerStat {
  code: number;
  category: string;
  rollingMean: number;
  volatility: number;
  maxDD: number;
}

export function CategoryPercentileCard({ schemes }: Props) {
  const { data: list, isLoading: listLoading } = useSchemeList();
  const [run, setRun] = useState(false);
  const [period, setPeriod] = useState<RollingYears>(5);

  // Only categories actually represented in the selection get screened.
  const categories = useMemo(
    () =>
      Array.from(new Set(schemes.map((s) => guessCategory(s.name)).filter(Boolean) as string[])),
    [schemes],
  );

  const universe = useMemo(
    () => (list ? categories.flatMap((c) => buildUniverse(list, c, PER_CATEGORY)) : []),
    [list, categories],
  );

  const peers = useQuery({
    queryKey: ["category-percentile", period, universe.length, categories.join(",")],
    enabled: run && universe.length > 0,
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 12 * 60 * 60 * 1000,
    queryFn: async (): Promise<PeerStat[]> => {
      const loaded = await mapPool(universe, CONCURRENCY, async (u) => {
        const data = await fetchScheme(u.code);
        return { ...u, rows: data.rows };
      });
      const out: PeerStat[] = [];
      for (const item of loaded) {
        if (!item || item.rows.length < 250) continue;
        const series = calculateRollingReturns(item.rows, period);
        if (series.length < 40) continue;
        const stats = rollingStats(series, period);
        const risk = calculateRisk(item.rows, 0.065);
        out.push({
          code: item.code,
          category: item.category,
          rollingMean: stats.mean,
          volatility: risk.volatility,
          maxDD: maxDrawdown(drawdownSeries(item.rows)),
        });
      }
      return out;
    },
  });

  const ranked = useMemo(() => {
    if (!peers.data?.length) return [];
    return schemes.map((s, i) => {
      const cat = guessCategory(s.name);
      const pool = peers.data!.filter((p) => p.category === cat && p.code !== s.code);
      const series = calculateRollingReturns(s.data.rows, period);
      const stats = series.length ? rollingStats(series, period) : null;
      const risk = calculateRisk(s.data.rows, 0.065);
      const dd = maxDrawdown(drawdownSeries(s.data.rows));
      return {
        code: s.code,
        name: s.name,
        i,
        category: cat,
        peerCount: pool.length,
        ret: stats
          ? percentileRank(
              { code: s.code, name: s.name, value: stats.mean },
              pool.map((p) => p.rollingMean),
            )
          : null,
        vol: percentileRank(
          { code: s.code, name: s.name, value: risk.volatility },
          pool.map((p) => p.volatility),
          false,
        ),
        dd: percentileRank(
          { code: s.code, name: s.name, value: dd },
          pool.map((p) => p.maxDD),
        ),
      };
    });
  }, [peers.data, schemes, period]);

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Percent className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold sm:text-lg">Category Percentile</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A raw CAGR means little without a reference point. This ranks each fund against its own
            category on {period}-year rolling returns, volatility and drawdown.
          </p>
        </div>
      </div>

      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "shrink-0 rounded-md px-3 py-2 text-xs transition-colors sm:px-2.5 sm:py-1",
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p}Y
            </button>
          ))}
        </div>
        {!run && (
          <Button
            size="sm"
            variant="outline"
            disabled={listLoading || universe.length === 0}
            onClick={() => setRun(true)}
          >
            <Search className="mr-1.5 h-3.5 w-3.5" />
            {listLoading ? "Loading…" : "Compute ranks"}
          </Button>
        )}
      </div>

      {!run ? (
        <p className="mt-4 rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
          Fetches NAV history for up to {universe.length || PER_CATEGORY} peer funds across{" "}
          {categories.length || 1} categor{categories.length === 1 ? "y" : "ies"}, so it runs only
          on request.
        </p>
      ) : peers.isFetching ? (
        <div className="mt-4 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm">Screening {universe.length} peer funds…</span>
        </div>
      ) : peers.isError ? (
        <p className="mt-4 text-xs text-destructive">Couldn't load peer data. Try again shortly.</p>
      ) : (
        <div className="mt-4 grid min-w-0 gap-2">
          {ranked.map((r) => (
            <div key={r.code} className="min-w-0 rounded-lg border border-border/50 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colorFor(r.i) }}
                />
                <p className="truncate text-sm font-medium">{r.name}</p>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {r.category ?? "Uncategorised"} · vs {r.peerCount} peers
              </p>
              {r.peerCount < 3 ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Too few peers with enough history to rank meaningfully.
                </p>
              ) : (
                <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Rank
                    label={`${period}Y rolling return`}
                    r={r.ret}
                    extra={r.ret ? `${fmtNum(r.ret.value)}%` : "—"}
                  />
                  <Rank label="Volatility" r={r.vol} extra={fmtPct(r.vol.value, 1)} />
                  <Rank label="Max drawdown" r={r.dd} extra={fmtPct(r.dd.value, 1)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Peer set is one fund per AMC per category with enough history, not the full universe, and
          excludes funds that have since closed or merged — so real category medians were lower than
          shown. Past ranking does not persist: today's top-quartile fund frequently isn't
          tomorrow's.
        </span>
      </p>
    </Card>
  );
}

function Rank({
  label,
  r,
  extra,
}: {
  label: string;
  r: { percentile: number; rank: number; outOf: number } | null;
  extra: string;
}) {
  if (!r) return null;
  const tone = percentileLabel(r.percentile);
  return (
    <div className="min-w-0 rounded-md bg-muted/20 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("num mt-0.5 text-sm font-semibold", tone.tone)}>{tone.label}</p>
      <p className="num text-[10px] text-muted-foreground">
        {extra} · #{r.rank} of {r.outOf + 1}
      </p>
    </div>
  );
}
