import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Check, Search, Info } from "lucide-react";
import { useSchemeList } from "@/hooks/useSchemes";
import { fetchScheme } from "@/lib/finapi";
import { buildUniverse, mapPool, CONCURRENCY } from "@/lib/universe";
import {
  analyseFundRisk,
  isSuggestable,
  SUITABLE_CATEGORIES,
  BANDS,
  type ProfileResult,
  type FundRisk,
} from "@/lib/riskProfile";
import {
  calculateRollingReturns,
  rollingStats,
  calculateRisk,
  calculateConsistencyScore,
  calculateOverallScore,
  drawdownSeries,
  maxDrawdown,
} from "@/lib/calculators";
import { fmtPct } from "@/lib/format";

/** Per-category cap — several categories are screened, so keep each one small. */
const PER_CATEGORY = 14;
/** Hard ceiling on NAV fetches for one screen run, across all categories. */
const TOTAL_CAP = 60;
const MAX_RESULTS = 8;

interface Props {
  profile: ProfileResult;
  onAdd?: (f: { schemeCode: number; schemeName: string }) => void;
  isSelected?: (code: number) => boolean;
  canAdd?: boolean;
}

interface Suggestion {
  code: number;
  name: string;
  amc: string;
  overall: number;
  consistency: number;
  fund: FundRisk;
}

export function ProfileSuggestionsCard({ profile, onAdd, isSelected, canAdd = true }: Props) {
  const { data: list, isLoading: listLoading } = useSchemeList();
  const [run, setRun] = useState(false);

  const categories = SUITABLE_CATEGORIES[profile.band];

  const universe = useMemo(() => {
    if (!list) return [];
    // Interleave categories so the global cap doesn't starve the later ones.
    const perCat = categories.map((c) => buildUniverse(list, c, PER_CATEGORY));
    const merged: ReturnType<typeof buildUniverse> = [];
    for (let i = 0; i < PER_CATEGORY; i++) {
      for (const bucket of perCat) if (bucket[i]) merged.push(bucket[i]);
    }
    return merged.slice(0, TOTAL_CAP);
  }, [list, categories]);

  const screen = useQuery({
    queryKey: ["profile-suggestions", profile.band, profile.horizonWindow, universe.length],
    enabled: run && universe.length > 0,
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 12 * 60 * 60 * 1000,
    queryFn: async (): Promise<Suggestion[]> => {
      const loaded = await mapPool(universe, CONCURRENCY, async (u) => {
        const data = await fetchScheme(u.code);
        return { ...u, rows: data.rows };
      });

      const out: Suggestion[] = [];
      for (const item of loaded) {
        if (!item || item.rows.length < 250) continue;

        // Re-band from realised behaviour — the category was only a search hint.
        const fund = analyseFundRisk(item.name, item.rows, profile.horizonWindow);
        if (!isSuggestable(fund.band, profile.band)) continue;

        const series = calculateRollingReturns(item.rows, profile.horizonWindow);
        if (series.length < 60) continue;
        const stats = rollingStats(series, profile.horizonWindow);
        const risk = calculateRisk(item.rows, 0.065);
        const maxDD = maxDrawdown(drawdownSeries(item.rows));

        const consistency = calculateConsistencyScore({
          rollingStd: stats.std,
          volatility: risk.volatility,
          maxDD,
          sharpe: risk.sharpe,
          sortino: risk.sortino,
          positivePct: stats.positivePct,
          recoveryDays: risk.recoveryDays,
        });
        const overall = calculateOverallScore({
          rollingMean: stats.mean,
          consistency,
          maxDD,
          sharpe: risk.sharpe,
          sortino: risk.sortino,
          volatility: risk.volatility,
          alpha: 0,
        });

        out.push({ code: item.code, name: item.name, amc: item.amc, overall, consistency, fund });
      }

      // One per AMC keeps the shortlist varied rather than five funds from one house.
      const perAmc = new Map<string, Suggestion>();
      for (const s of out.sort((a, b) => b.overall - a.overall)) {
        if (!perAmc.has(s.amc)) perAmc.set(s.amc, s);
      }
      return Array.from(perAmc.values()).slice(0, MAX_RESULTS);
    },
  });

  const rows = screen.data ?? [];

  if (!run) {
    return (
      <div className="mt-4 min-w-0 overflow-hidden rounded-lg border border-dashed border-border/60 p-3">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium">Don't know where to start?</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Screen {categories.join(", ")} funds and shortlist those whose actual behaviour fits a{" "}
              {BANDS[profile.band].label} profile.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={listLoading || universe.length === 0}
            onClick={() => setRun(true)}
          >
            <Search className="mr-1.5 h-3.5 w-3.5" />
            {listLoading ? "Loading funds…" : "Show shortlist"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 min-w-0 overflow-hidden rounded-lg border border-border/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Shortlist to research</p>
        {screen.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
      </div>

      {screen.isFetching && (
        <p className="mt-1 text-xs text-muted-foreground">
          Screening {universe.length} funds across {categories.length} categories…
        </p>
      )}

      {screen.isError && (
        <p className="mt-2 text-xs text-destructive">Couldn't load fund data. Try again shortly.</p>
      )}

      {!screen.isFetching && !screen.isError && rows.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          No funds in these categories had enough history to screen reliably over a{" "}
          {profile.horizonWindow}-year window.
        </p>
      )}

      {rows.length > 0 && (
        <>
          <div className="mt-3 grid min-w-0 gap-2">
            {rows.map((s) => {
              const selected = isSelected?.(s.code) ?? false;
              return (
                <div
                  key={s.code}
                  className="flex min-w-0 items-start justify-between gap-3 overflow-hidden rounded-lg border border-border/50 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {s.fund.category ?? "Fund"} · {BANDS[s.fund.band].label}
                    </p>
                    <div className="mt-1.5 flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span className="num">Volatility {fmtPct(s.fund.volatility, 1)}</span>
                      <span className="num">Worst fall {fmtPct(s.fund.maxDrawdown, 1)}</span>
                      {s.fund.worstAtHorizon != null && (
                        <span className="num">
                          Worst {s.fund.horizonWindow}Y {s.fund.worstAtHorizon.toFixed(1)}%
                        </span>
                      )}
                      {s.fund.positivePctAtHorizon != null && (
                        <span className="num">
                          {s.fund.positivePctAtHorizon.toFixed(0)}% windows positive
                        </span>
                      )}
                    </div>
                  </div>
                  {onAdd && (
                    <Button
                      size="sm"
                      variant={selected ? "ghost" : "outline"}
                      className="shrink-0"
                      disabled={selected || !canAdd}
                      onClick={() => onAdd({ schemeCode: s.code, schemeName: s.name })}
                    >
                      {selected ? (
                        <>
                          <Check className="mr-1 h-3.5 w-3.5" /> Added
                        </>
                      ) : (
                        <>
                          <Plus className="mr-1 h-3.5 w-3.5" /> Compare
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-3 flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              A starting point for your own research, not a recommendation and not ranked by which
              is "best". Screens only funds open today, so funds that closed or merged after poor
              performance never appear. Check expense ratio, manager tenure and holdings before
              investing — the Costs and Diversify tabs cover the first two.
            </span>
          </p>
        </>
      )}
    </div>
  );
}
