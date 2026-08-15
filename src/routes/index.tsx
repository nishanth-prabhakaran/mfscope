import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useMemo, useState } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import {
  Sparkles,
  TrendingUp,
  Loader2,
  AlertTriangle,
  BarChart3,
  CalendarIcon,
  X,
  Share2,
  Check,
} from "lucide-react";
import fundscopeLogo from "@/assets/fundscope-logo.png.asset.json";
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
import { RiskProfilerCard } from "@/components/comparison/RiskProfilerCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ReturnsComparisonCard } from "@/components/comparison/ReturnsComparisonCard";

import { BenchmarkSelector } from "@/components/comparison/BenchmarkSelector";
import { InstallButton } from "@/components/pwa/InstallPrompt";
import { useSchemes } from "@/hooks/useSchemes";
import { useSelection } from "@/hooks/useSelection";
import { useSchemeList } from "@/hooks/useSchemes";
import { useHydrated } from "@/hooks/useHydrated";
import { useBenchmark } from "@/hooks/useBenchmark";
import type { BenchmarkKey, NavRow, RollingYears } from "@/types/mf";

/* Tab contents are code-split: the initial bundle carried every chart, calculator
   and the 900-line deep-dive card even for someone who never opens those tabs. */
const RollingReturnsCard = lazyWithRetry(() =>
  import("@/components/comparison/RollingReturnsCard").then((m) => ({
    default: m.RollingReturnsCard,
  })),
);
const NavGrowthCard = lazyWithRetry(() =>
  import("@/components/comparison/NavGrowthCard").then((m) => ({ default: m.NavGrowthCard })),
);
const RiskMetricsCard = lazyWithRetry(() =>
  import("@/components/comparison/RiskMetricsCard").then((m) => ({ default: m.RiskMetricsCard })),
);
const DrawdownCard = lazyWithRetry(() =>
  import("@/components/comparison/DrawdownCard").then((m) => ({ default: m.DrawdownCard })),
);
const CorrelationMatrixCard = lazyWithRetry(() =>
  import("@/components/comparison/CorrelationMatrixCard").then((m) => ({
    default: m.CorrelationMatrixCard,
  })),
);
const BreakEvenAlphaCard = lazyWithRetry(() =>
  import("@/components/comparison/BreakEvenAlphaCard").then((m) => ({
    default: m.BreakEvenAlphaCard,
  })),
);
const HoldingPeriodCard = lazyWithRetry(() =>
  import("@/components/comparison/HoldingPeriodCard").then((m) => ({
    default: m.HoldingPeriodCard,
  })),
);
const SwitchCostCard = lazyWithRetry(() =>
  import("@/components/comparison/SwitchCostCard").then((m) => ({ default: m.SwitchCostCard })),
);
const CrisisStressCard = lazyWithRetry(() =>
  import("@/components/comparison/CrisisStressCard").then((m) => ({ default: m.CrisisStressCard })),
);
const PostTaxReturnsCard = lazyWithRetry(() =>
  import("@/components/comparison/PostTaxReturnsCard").then((m) => ({
    default: m.PostTaxReturnsCard,
  })),
);
const SectorExposureCard = lazyWithRetry(() =>
  import("@/components/comparison/SectorExposureCard").then((m) => ({
    default: m.SectorExposureCard,
  })),
);
const ActiveShareCard = lazyWithRetry(() =>
  import("@/components/comparison/ActiveShareCard").then((m) => ({ default: m.ActiveShareCard })),
);
const PortfolioOverlapCard = lazyWithRetry(() =>
  import("@/components/comparison/PortfolioOverlapCard").then((m) => ({
    default: m.PortfolioOverlapCard,
  })),
);
const CostComparisonCard = lazyWithRetry(() =>
  import("@/components/comparison/CostComparisonCard").then((m) => ({
    default: m.CostComparisonCard,
  })),
);
const AnnualReturnsCard = lazyWithRetry(() =>
  import("@/components/comparison/AnnualReturnsCard").then((m) => ({
    default: m.AnnualReturnsCard,
  })),
);
const BenchmarkComparisonCard = lazyWithRetry(() =>
  import("@/components/comparison/BenchmarkComparisonCard").then((m) => ({
    default: m.BenchmarkComparisonCard,
  })),
);
const ScoreAndRankCard = lazyWithRetry(() =>
  import("@/components/comparison/ScoreAndRankCard").then((m) => ({ default: m.ScoreAndRankCard })),
);
const CategoryPercentileCard = lazyWithRetry(() =>
  import("@/components/comparison/CategoryPercentileCard").then((m) => ({
    default: m.CategoryPercentileCard,
  })),
);
const PortfolioModeCard = lazyWithRetry(() =>
  import("@/components/comparison/PortfolioModeCard").then((m) => ({
    default: m.PortfolioModeCard,
  })),
);
const CalculatorsCard = lazyWithRetry(() =>
  import("@/components/comparison/CalculatorsCard").then((m) => ({ default: m.CalculatorsCard })),
);
const GoalPlannerCard = lazyWithRetry(() =>
  import("@/components/comparison/GoalPlannerCard").then((m) => ({ default: m.GoalPlannerCard })),
);
const ProjectionCalculatorCard = lazyWithRetry(() =>
  import("@/components/comparison/ProjectionCalculatorCard").then((m) => ({
    default: m.ProjectionCalculatorCard,
  })),
);
const SwpCalculatorCard = lazyWithRetry(() =>
  import("@/components/comparison/SwpCalculatorCard").then((m) => ({
    default: m.SwpCalculatorCard,
  })),
);
const RetirementCalculatorCard = lazyWithRetry(() =>
  import("@/components/comparison/RetirementCalculatorCard").then((m) => ({
    default: m.RetirementCalculatorCard,
  })),
);
const RollingSipCard = lazyWithRetry(() =>
  import("@/components/comparison/RollingSipCard").then((m) => ({ default: m.RollingSipCard })),
);
const FundDeepDiveCard = lazyWithRetry(() =>
  import("@/components/comparison/FundDeepDiveCard").then((m) => ({ default: m.FundDeepDiveCard })),
);
const TopFundsCard = lazyWithRetry(() =>
  import("@/components/comparison/TopFundsCard").then((m) => ({ default: m.TopFundsCard })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FundScope · Rolling Returns & Risk Terminal for Indian Mutual Funds" },
      {
        name: "description",
        content:
          "Compare up to 10 Indian mutual funds side-by-side. Rolling CAGR, drawdown, Sharpe, Sortino, SIP & lumpsum backtests — powered by FinAPI.",
      },
      { property: "og:title", content: "FundScope · Mutual Fund Research Terminal" },
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

/** Keeps tab height stable while a split chunk loads, so content doesn't jump. */
function CardSkeleton() {
  return (
    <div className="min-h-[220px] animate-pulse rounded-xl border border-border/50 bg-card/40" />
  );
}

function Home() {
  const hydrated = useHydrated();
  const { funds, add, remove, clear, has, shareUrl, hydrateNames } = useSelection();
  // A shared link carries only scheme codes, so swap in real names once the
  // scheme list arrives — otherwise the chips read "Scheme 120716".
  const schemeListQuery = useSchemeList();
  useEffect(() => {
    const list = schemeListQuery.data;
    if (!list?.length) return;
    const byCode = new Map(list.map((x) => [x.schemeCode, x.schemeName]));
    hydrateNames((code) => byCode.get(code));
  }, [schemeListQuery.data, hydrateNames]);
  const [copied, setCopied] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [benchmarkKey, setBenchmarkKey] = useState<BenchmarkKey | undefined>(undefined);
  // Shared by the Rolling Returns chart and Risk Analytics so both use the same window.
  const [rollingPeriod, setRollingPeriod] = useState<RollingYears>(3);
  const queries = useSchemes(funds.map((f) => f.schemeCode));
  const benchmarkQuery = useBenchmark(benchmarkKey);

  const loading = queries.some((q) => q.isLoading) || benchmarkQuery.isLoading;
  const errored = queries.filter((q) => q.error).length + (benchmarkQuery.error ? 1 : 0);

  const startT = startDate ? startDate.getTime() : null;
  const MIN_ROWS = 30;

  const { schemes, excluded, earliestCommon } = useMemo(() => {
    const kept: Array<{
      code: number;
      name: string;
      data: NonNullable<(typeof queries)[number]["data"]>;
    }> = [];
    const skipped: Array<{
      code: number;
      name: string;
      inception: number | null;
      reason: "no-data" | "too-few";
    }> = [];
    let maxFirst = 0;
    let anyLoaded = false;

    funds.forEach((f, i) => {
      const q = queries[i];
      if (!q?.data) return;
      anyLoaded = true;
      const full = q.data;
      const inception = full.rows[0]?.t ?? null;
      if (inception != null) maxFirst = Math.max(maxFirst, inception);
      const rows = startT ? full.rows.filter((r) => r.t >= startT) : full.rows;
      if (!rows.length) {
        skipped.push({ code: f.schemeCode, name: f.schemeName, inception, reason: "no-data" });
        return;
      }
      if (rows.length < MIN_ROWS) {
        skipped.push({ code: f.schemeCode, name: f.schemeName, inception, reason: "too-few" });
        return;
      }
      kept.push({ code: f.schemeCode, name: f.schemeName, data: { ...full, rows } });
    });

    return {
      schemes: kept,
      excluded: skipped,
      earliestCommon: anyLoaded && maxFirst ? new Date(maxFirst) : null,
    };
  }, [funds, queries, startT]);

  const benchmarkRows: NavRow[] | undefined = useMemo(() => {
    if (!benchmarkQuery.data) return undefined;
    return startT
      ? benchmarkQuery.data.rows.filter((r) => r.t >= startT)
      : benchmarkQuery.data.rows;
  }, [benchmarkQuery.data, startT]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient background */}
      <div className="ambient pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-brand/25 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-brand-2/20 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/50 glass">
        <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
              <img
                src={fundscopeLogo.url}
                alt="FundScope"
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
                loading="eager"
              />
            </div>
            <div className="min-w-0">
              <div className="font-display truncate text-base sm:text-lg font-semibold tracking-tight leading-tight">
                FundScope
              </div>
              <div className="truncate text-[9px] sm:text-[10px] uppercase tracking-[0.16em] text-muted-foreground -mt-0.5">
                Indian Mutual Fund Research Terminal
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground sm:gap-4">
            <span className="hidden lg:flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> FinAPI · IndexedDB cached
            </span>
            <span className="rounded-full border border-border/60 px-2 py-1 num text-[11px] sm:px-2.5 sm:text-xs">
              {hydrated ? `${funds.length}/10` : "0/10"}
              <span className="hidden sm:inline"> selected</span>
            </span>
            {hydrated && funds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={async () => {
                  const url = shareUrl();
                  try {
                    if (navigator.share)
                      await navigator.share({ title: "FundScope comparison", url });
                    else await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    /* user dismissed the share sheet */
                  }
                }}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
              </Button>
            )}
            <ThemeToggle />
            <InstallButton className="h-8 gap-1.5 px-2.5 text-xs" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-3 py-5 pb-32 sm:px-4 sm:py-8 sm:pb-12 md:px-6">
        {/* Hero */}
        <section className="mb-5 sm:mb-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-start gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-[11px] sm:text-xs text-muted-foreground">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Beyond point-to-point returns — rolling CAGR across full history
            </div>
            <h1 className="mt-3 font-display text-[1.75rem] leading-[1.1] sm:text-4xl md:text-5xl font-semibold sm:leading-[1.05] tracking-tight">
              Research Indian mutual funds like a{" "}
              <span className="text-gradient-brand">portfolio analyst</span>.
            </h1>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-2xl">
              Compare up to 10 funds side-by-side. Rolling returns, consistency scoring, drawdowns,
              Sharpe & Sortino, SIP and lumpsum backtests — all computed live from FinAPI historical
              NAVs.
            </p>
          </div>
        </section>

        {/* Risk profiler — first decision aid for new investors */}
        {hydrated && (
          <div className="mb-4">
            <RiskProfilerCard
              schemes={schemes}
              onAdd={add}
              isSelected={has}
              canAdd={funds.length < 10}
            />
          </div>
        )}

        {/* Search + chips */}
        <Card className="p-3.5 sm:p-5 mb-5 sm:mb-6">
          <FundSearch onPick={add} isSelected={has} disabled={funds.length >= 10} />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Analysis start date
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 justify-start text-left font-normal gap-2",
                    !startDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {startDate ? format(startDate, "dd MMM yyyy") : "Optional — use full history"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  captionLayout="dropdown"
                  fromYear={2000}
                  toYear={new Date().getFullYear()}
                  disabled={(d) => d > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {startDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStartDate(undefined)}
                className="h-8 gap-1 text-xs text-muted-foreground"
              >
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
            <div className="w-full sm:ml-auto sm:w-auto">
              <BenchmarkSelector
                value={benchmarkKey}
                onChange={setBenchmarkKey}
                fundNames={funds.map((f) => f.schemeName)}
              />
            </div>
          </div>

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
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm">{errored} fund(s) failed to load. Try again shortly.</span>
          </Card>
        )}

        {hydrated && !loading && excluded.length > 0 && (
          <Card className="p-4 mb-4 border-amber-500/40 bg-amber-500/10">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-warning shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {excluded.length} fund{excluded.length > 1 ? "s" : ""} excluded from analysis
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {startDate
                    ? "These funds have insufficient NAV history after your chosen start date."
                    : "These funds don't have enough NAV history to compute reliable metrics."}
                </div>
                <ul className="mt-2 space-y-1 text-xs">
                  {excluded.map((e) => (
                    <li
                      key={e.code}
                      className="flex flex-wrap items-center gap-x-2 text-muted-foreground"
                    >
                      <span className="text-foreground/90 truncate max-w-[220px] sm:max-w-[420px]">
                        {e.name}
                      </span>
                      {e.inception && (
                        <span className="num">
                          · inception {format(new Date(e.inception), "dd MMM yyyy")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {startDate && earliestCommon && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setStartDate(earliestCommon)}
                    >
                      Use earliest common date ({format(earliestCommon, "dd MMM yyyy")})
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setStartDate(undefined)}
                    >
                      Clear start date
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Dashboard */}
        {hydrated && !loading && schemes.length > 0 && (
          <div className="space-y-6">
            <Suspense fallback={<CardSkeleton />}>
              <RollingReturnsCard
                schemes={schemes}
                benchmarkRows={benchmarkRows}
                benchmarkLabel={benchmarkQuery.data?.label}
                period={rollingPeriod}
                onPeriodChange={setRollingPeriod}
              />
            </Suspense>

            <Tabs defaultValue="risk" className="w-full">
              <TabsList className="w-full flex justify-start overflow-x-auto whitespace-nowrap [&>*]:shrink-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <TabsTrigger value="deepdive">Fund Deep Dive</TabsTrigger>
                <TabsTrigger value="risk">Risk Analytics</TabsTrigger>

                <TabsTrigger value="benchmark">vs Benchmark</TabsTrigger>
                <TabsTrigger value="returns">Returns</TabsTrigger>
                <TabsTrigger value="drawdown">Drawdown</TabsTrigger>
                <TabsTrigger value="growth">Growth of ₹100</TabsTrigger>
                <TabsTrigger value="scores">Scores & Ranks</TabsTrigger>
                <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
                <TabsTrigger value="calc">Calculators</TabsTrigger>
                <TabsTrigger value="diversify">Diversify</TabsTrigger>
                <TabsTrigger value="costs">Costs</TabsTrigger>
                <TabsTrigger value="annual">Annual</TabsTrigger>
              </TabsList>
              <TabsContent value="deepdive" className="mt-4">
                <Suspense fallback={<CardSkeleton />}>
                  <FundDeepDiveCard
                    schemes={schemes.map((s) => ({ code: s.code, name: s.name }))}
                    onAdd={(code, name) => add({ schemeCode: code, schemeName: name })}
                    isSelected={has}
                    canAdd={funds.length < 10}
                  />
                </Suspense>
              </TabsContent>
              <TabsContent value="risk" className="mt-4">
                <Suspense fallback={<CardSkeleton />}>
                  <div className="grid gap-5">
                    <RiskMetricsCard
                      schemes={schemes}
                      benchmarkRows={benchmarkRows}
                      windowYears={rollingPeriod}
                    />
                    <CrisisStressCard schemes={schemes} benchmarkRows={benchmarkRows} />
                    <HoldingPeriodCard schemes={schemes} />
                  </div>
                </Suspense>
              </TabsContent>

              <TabsContent value="benchmark" className="mt-4">
                <Suspense fallback={<CardSkeleton />}>
                  <BenchmarkComparisonCard
                    schemes={schemes}
                    benchmarkRows={benchmarkRows}
                    benchmarkLabel={benchmarkQuery.data?.label}
                  />
                </Suspense>
              </TabsContent>
              <TabsContent value="returns" className="mt-4">
                <Suspense fallback={<CardSkeleton />}>
                  <ReturnsComparisonCard schemes={schemes} benchmarkRows={benchmarkRows} />
                </Suspense>
              </TabsContent>
              <TabsContent value="drawdown" className="mt-4">
                <Suspense fallback={<CardSkeleton />}>
                  <DrawdownCard
                    schemes={schemes}
                    benchmarkRows={benchmarkRows}
                    benchmarkLabel={benchmarkQuery.data?.label}
                  />
                </Suspense>
              </TabsContent>
              <TabsContent value="growth" className="mt-4">
                <Suspense fallback={<CardSkeleton />}>
                  <NavGrowthCard
                    schemes={schemes}
                    benchmarkRows={benchmarkRows}
                    benchmarkLabel={benchmarkQuery.data?.label}
                  />
                </Suspense>
              </TabsContent>
              <TabsContent value="scores" className="mt-4">
                <Suspense fallback={<CardSkeleton />}>
                  <div className="space-y-6">
                    <ScoreAndRankCard schemes={schemes} benchmarkRows={benchmarkRows} />
                    <CategoryPercentileCard schemes={schemes} />
                    <TopFundsCard onAdd={add} isSelected={has} canAdd={funds.length < 10} />
                  </div>
                </Suspense>
              </TabsContent>
              <TabsContent value="portfolio" className="mt-4">
                <Suspense fallback={<CardSkeleton />}>
                  <PortfolioModeCard schemes={schemes} />
                </Suspense>
              </TabsContent>
              <TabsContent value="calc" className="mt-4">
                <Suspense fallback={<CardSkeleton />}>
                  <Tabs defaultValue="backtest" className="w-full">
                    <TabsList className="w-full flex justify-start overflow-x-auto whitespace-nowrap [&>*]:shrink-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <TabsTrigger value="backtest">SIP / Lumpsum Backtest</TabsTrigger>
                      <TabsTrigger value="goal">Goal Planner</TabsTrigger>
                      <TabsTrigger value="projection">Investment Projection</TabsTrigger>
                      <TabsTrigger value="swp">SWP</TabsTrigger>
                      <TabsTrigger value="retirement">Retirement</TabsTrigger>
                      <TabsTrigger value="rollingsip">Rolling SIP</TabsTrigger>
                      <TabsTrigger value="switch">Switch Cost</TabsTrigger>
                    </TabsList>
                    <TabsContent value="backtest" className="mt-4">
                      <CalculatorsCard schemes={schemes} />
                    </TabsContent>
                    <TabsContent value="goal" className="mt-4">
                      <Suspense fallback={<CardSkeleton />}>
                        <GoalPlannerCard schemes={schemes} />
                      </Suspense>
                    </TabsContent>
                    <TabsContent value="projection" className="mt-4">
                      <Suspense fallback={<CardSkeleton />}>
                        <ProjectionCalculatorCard schemes={schemes} />
                      </Suspense>
                    </TabsContent>
                    <TabsContent value="swp" className="mt-4">
                      <Suspense fallback={<CardSkeleton />}>
                        <SwpCalculatorCard schemes={schemes} />
                      </Suspense>
                    </TabsContent>
                    <TabsContent value="retirement" className="mt-4">
                      <Suspense fallback={<CardSkeleton />}>
                        <RetirementCalculatorCard />
                      </Suspense>
                    </TabsContent>
                    <TabsContent value="rollingsip" className="mt-4">
                      <Suspense fallback={<CardSkeleton />}>
                        <RollingSipCard schemes={schemes} />
                      </Suspense>
                    </TabsContent>
                    <TabsContent value="switch" className="mt-4">
                      <Suspense fallback={<CardSkeleton />}>
                        <SwitchCostCard />
                      </Suspense>
                    </TabsContent>
                  </Tabs>
                </Suspense>
              </TabsContent>

              <TabsContent value="diversify" className="mt-4">
                <Suspense fallback={<CardSkeleton />}>
                  <div className="grid gap-5">
                    <PortfolioOverlapCard schemes={schemes} />
                    <ActiveShareCard schemes={schemes} />
                    <SectorExposureCard schemes={schemes} />
                    <CorrelationMatrixCard schemes={schemes} />
                  </div>
                </Suspense>
              </TabsContent>
              <TabsContent value="costs" className="mt-4">
                <Suspense fallback={<CardSkeleton />}>
                  <div className="grid gap-5">
                    <CostComparisonCard schemes={schemes} />
                    <PostTaxReturnsCard schemes={schemes} />
                    <BreakEvenAlphaCard schemes={schemes} />
                  </div>
                </Suspense>
              </TabsContent>
              <TabsContent value="annual" className="mt-4">
                <Suspense fallback={<CardSkeleton />}>
                  <AnnualReturnsCard schemes={schemes} />
                </Suspense>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Standalone planners when nothing is selected */}
        {hydrated && !loading && schemes.length === 0 && (
          <div className="space-y-6">
            <Suspense fallback={<CardSkeleton />}>
              <TopFundsCard onAdd={add} isSelected={has} canAdd={funds.length < 10} />
              <GoalPlannerCard schemes={[]} />
              <ProjectionCalculatorCard schemes={[]} />
              <SwpCalculatorCard schemes={[]} />
              <RetirementCalculatorCard />
              {/* Takes manual inputs only, so it works with nothing selected. */}
              <SwitchCostCard />
            </Suspense>
          </div>
        )}

        <footer className="mt-16 border-t border-border/40 pt-8 text-xs text-muted-foreground">
          <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
            <h4 className="text-sm font-semibold text-foreground">Important disclaimer</h4>
            <div className="mt-2 space-y-2 leading-relaxed">
              <p>
                Everything on FundScope — scores, rankings, percentiles, risk bands, suitability
                verdicts and the suggested shortlist — is computed from{" "}
                <strong>historical NAV and index data</strong>. Past performance does not indicate
                future results, and no figure here is a forecast.
              </p>
              <p>
                This is a research and education tool, <strong>not investment advice</strong> and
                not a recommendation to buy, sell or hold any scheme. It is not personalised
                financial advice. FundScope is not a SEBI-registered investment adviser or research
                analyst, and no output should be treated as a substitute for advice from one.
              </p>
              <p>
                The risk profiler reflects only what you self-report in a short questionnaire; it
                cannot account for your full financial position, liabilities, taxes or goals.
                Screens cover funds currently open for investment, so schemes that closed or merged
                after poor performance are absent and historical averages read better than reality.
                Expense ratios, exit loads, taxation and tracking error are not fully modelled. Data
                is sourced from third parties and may contain errors or lag.
              </p>
              <p>
                Mutual fund investments are subject to market risks. Read all scheme-related
                documents carefully. Verify any figure against the official Scheme Information
                Document and consult a SEBI-registered adviser before investing.
              </p>
            </div>
          </div>
          <p className="mt-4">
            Data source:{" "}
            <a
              className="underline hover:text-foreground"
              href="https://finapi.upvaly.com"
              target="_blank"
              rel="noreferrer"
            >
              FinAPI
            </a>
            . Index values shown are Total Return (TRI) where available.
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
    <Card className="p-5 sm:p-8 text-center border-dashed">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <BarChart3 className="h-7 w-7" />
      </div>
      <h3 className="mt-4 font-display text-xl font-semibold">Start by adding 2 or more funds</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Search above by scheme name or AMC. Try a few popular funds to get started:
      </p>
      <p className="mx-auto mt-3 max-w-prose text-xs leading-relaxed text-muted-foreground">
        Adding funds unlocks the full dashboard — rolling returns, risk analytics, crisis stress
        tests, portfolio overlap, sector exposure, costs and taxes, and fund-specific calculators.
        The planners below work without selecting anything.
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
