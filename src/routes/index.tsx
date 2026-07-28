import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LineChart, Sparkles, TrendingUp, Loader2, AlertTriangle, BarChart3, CalendarIcon, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { FundSearch } from "@/components/comparison/FundSearch";
import { FundChips } from "@/components/comparison/FundChips";
import { RollingReturnsCard } from "@/components/comparison/RollingReturnsCard";
import { DrawdownCard } from "@/components/comparison/DrawdownCard";
import { RiskMetricsCard } from "@/components/comparison/RiskMetricsCard";
import { ReturnsComparisonCard } from "@/components/comparison/ReturnsComparisonCard";
import { NavGrowthCard } from "@/components/comparison/NavGrowthCard";
import { ScoreAndRankCard } from "@/components/comparison/ScoreAndRankCard";
import { CalculatorsCard } from "@/components/comparison/CalculatorsCard";
import { useSchemes } from "@/hooks/useSchemes";
import { useSelection } from "@/hooks/useSelection";
import { useHydrated } from "@/hooks/useHydrated";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AlphaScope · Rolling Returns & Risk Terminal for Indian Mutual Funds" },
      {
        name: "description",
        content:
          "Compare up to 10 Indian mutual funds side-by-side. Rolling CAGR, drawdown, Sharpe, Sortino, SIP & lumpsum backtests — powered by MFAPI.",
      },
      { property: "og:title", content: "AlphaScope · Mutual Fund Research Terminal" },
      {
        property: "og:description",
        content:
          "Rolling returns, consistency scoring and risk analytics for Indian mutual funds. Compare Large Cap, Mid Cap, Flexi Cap, ELSS and more.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const hydrated = useHydrated();
  const { funds, add, remove, clear, has } = useSelection();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const queries = useSchemes(funds.map((f) => f.schemeCode));


  const loading = queries.some((q) => q.isLoading);
  const errored = queries.filter((q) => q.error).length;

  const schemes = useMemo(
    () =>
      funds
        .map((f, i) => {
          const q = queries[i];
          return q?.data ? { code: f.schemeCode, name: f.schemeName, data: q.data } : null;
        })
        .filter((x): x is { code: number; name: string; data: NonNullable<typeof x>["data"] } => !!x),
    [funds, queries],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-brand/25 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-brand-2/20 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/50 glass">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl gradient-brand">
              <LineChart className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold tracking-tight leading-tight">
                Fundlens
              </div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground -mt-0.5">
                Mutual Fund Research Terminal
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> MFAPI · IndexedDB cached</span>
            <span className="rounded-full border border-border/60 px-2.5 py-1 num">
              {funds.length}/10 selected
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-6">
        {/* Hero */}
        <section className="mb-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              Beyond point-to-point returns — rolling CAGR across full history
            </div>
            <h1 className="mt-4 font-display text-4xl md:text-5xl font-semibold leading-[1.05] tracking-tight">
              Research Indian mutual funds like a{" "}
              <span className="text-gradient-brand">portfolio analyst</span>.
            </h1>
            <p className="mt-3 text-muted-foreground max-w-2xl">
              Compare up to 10 funds side-by-side. Rolling returns, consistency scoring, drawdowns,
              Sharpe & Sortino, SIP and lumpsum backtests — all computed live from MFAPI historical NAVs.
            </p>
          </div>
        </section>

        {/* Search + chips */}
        <Card className="p-5 mb-6">
          <FundSearch onPick={add} isSelected={has} disabled={funds.length >= 10} />
          {hydrated && funds.length > 0 && (
            <div className="mt-4">
              <FundChips funds={funds} onRemove={remove} onClear={clear} />
            </div>
          )}
        </Card>

        {/* Empty state */}
        {hydrated && funds.length === 0 && <EmptyState />}

        {/* Loading */}
        {hydrated && funds.length > 0 && loading && (
          <div className="grid gap-5">
            <Card className="p-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm">Fetching NAV history & caching to IndexedDB…</span>
              </div>
              <div className="mt-4 grid gap-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-[280px] w-full" />
              </div>
            </Card>
          </div>
        )}

        {errored > 0 && !loading && (
          <Card className="p-4 mb-4 border-destructive/40 bg-destructive/10 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-destructive-foreground" />
            <span className="text-sm">{errored} fund(s) failed to load. Try again shortly.</span>
          </Card>
        )}

        {/* Dashboard */}
        {hydrated && !loading && schemes.length > 0 && (
          <div className="space-y-6">
            <RollingReturnsCard schemes={schemes} />

            <Tabs defaultValue="risk" className="w-full">
              <TabsList className="w-full overflow-x-auto flex justify-start">
                <TabsTrigger value="risk">Risk Analytics</TabsTrigger>
                <TabsTrigger value="returns">Returns</TabsTrigger>
                <TabsTrigger value="drawdown">Drawdown</TabsTrigger>
                <TabsTrigger value="growth">Growth of ₹100</TabsTrigger>
                <TabsTrigger value="scores">Scores & Ranks</TabsTrigger>
                <TabsTrigger value="calc">Calculators</TabsTrigger>
              </TabsList>
              <TabsContent value="risk" className="mt-4"><RiskMetricsCard schemes={schemes} /></TabsContent>
              <TabsContent value="returns" className="mt-4"><ReturnsComparisonCard schemes={schemes} /></TabsContent>
              <TabsContent value="drawdown" className="mt-4"><DrawdownCard schemes={schemes} /></TabsContent>
              <TabsContent value="growth" className="mt-4"><NavGrowthCard schemes={schemes} /></TabsContent>
              <TabsContent value="scores" className="mt-4"><ScoreAndRankCard schemes={schemes} /></TabsContent>
              <TabsContent value="calc" className="mt-4"><CalculatorsCard schemes={schemes} /></TabsContent>
            </Tabs>
          </div>
        )}

        <footer className="mt-16 pt-8 border-t border-border/40 text-xs text-muted-foreground">
          <p>
            Data source: <a className="underline hover:text-foreground" href="https://api.mfapi.in" target="_blank" rel="noreferrer">MFAPI</a>.
            Calculations for research/education only — not investment advice.
          </p>
        </footer>
      </main>
    </div>
  );
}

function EmptyState() {
  const suggestions = [
    { code: 120503, name: "Parag Parikh Flexi Cap Fund — Direct Growth" },
    { code: 118834, name: "Mirae Asset Large & Midcap Fund — Direct Growth" },
    { code: 118989, name: "Axis Bluechip Fund — Direct Growth" },
    { code: 125497, name: "Quant Small Cap Fund — Direct Growth" },
  ];
  const { add } = useSelection();
  return (
    <Card className="p-8 text-center border-dashed">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <BarChart3 className="h-7 w-7" />
      </div>
      <h3 className="mt-4 font-display text-xl font-semibold">Start by adding 2 or more funds</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Search above by scheme name or AMC. Try a few popular funds to get started:
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button
            key={s.code}
            onClick={() => add({ schemeCode: s.code, schemeName: s.name })}
            className="rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-xs hover:bg-accent/40 hover:border-primary/40 transition-colors"
          >
            + {s.name}
          </button>
        ))}
      </div>
    </Card>
  );
}
