import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Microscope, Star, AlertTriangle, Plus, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend,
} from "recharts";
import { useSchemeDetail } from "@/hooks/useSchemeDetail";
import {
  num,
  sortTimeframes,
  stripHtml,
  prettyMetricName,
  type RiskMetricBlock,
} from "@/lib/finapiDetail";
import { fmtNum, fmtPctRaw, colorFor } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  schemes: { code: number; name: string }[];
  onAdd?: (code: number, name: string) => void;
  isSelected?: (code: number) => boolean;
  canAdd?: boolean;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function AllocBar({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {data.map((d, i) => (
          <div
            key={d.label}
            style={{ width: `${(d.value / total) * 100}%`, background: colorFor(i) }}
            title={`${d.label}: ${d.value}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {data.map((d, i) => (
          <span key={d.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: colorFor(i) }} />
            {d.label} <span className="tabular-nums text-foreground">{fmtNum(d.value)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function RiskBlock({ name, block }: { name: string; block: RiskMetricBlock }) {
  const rows = block.timeframes ?? [];
  if (!rows.length) return null;
  const info = stripHtml(block.info);
  return (
    <div className="rounded-lg border border-border/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <h4 className="text-sm font-semibold">{prettyMetricName(name)}</h4>
        {info && (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label={`About ${prettyMetricName(name)}`}>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 text-xs leading-relaxed">{info}</PopoverContent>
          </Popover>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground">
              <th className="py-1.5 pr-3 text-left font-medium">Period</th>
              <th className="py-1.5 px-2 text-right font-medium">Fund</th>
              <th className="py-1.5 px-2 text-right font-medium">Cat avg</th>
              <th className="py-1.5 px-2 text-right font-medium">Cat range</th>
              <th className="py-1.5 pl-2 text-left font-medium">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = num(r.value);
              const avg = num(r.categoryAverage);
              const better = v != null && avg != null ? v >= avg : null;
              return (
                <tr key={r.timeframe} className="border-b border-border/30 last:border-0">
                  <td className="py-1.5 pr-3 uppercase">{r.timeframe}</td>
                  <td
                    className={cn(
                      "py-1.5 px-2 text-right font-semibold tabular-nums",
                      better === true && "text-success",
                      better === false && "text-muted-foreground",
                    )}
                  >
                    {r.value ?? "—"}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                    {r.categoryAverage ?? "—"}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                    {r.categoryMin ?? "—"} – {r.categoryMax ?? "—"}
                  </td>
                  <td className="py-1.5 pl-2 text-muted-foreground">{r.conclusion ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FundDeepDiveCard({ schemes, onAdd, isSelected, canAdd }: Props) {
  const [code, setCode] = useState<number | null>(schemes[0]?.code ?? null);
  const active = schemes.find((s) => s.code === code) ?? schemes[0];
  const activeCode = active?.code ?? null;
  const { data, isLoading, isError, error } = useSchemeDetail(activeCode);

  const rankData = useMemo(
    () =>
      sortTimeframes(data?.ranks).map((r) => ({
        timeframe: r.timeframe,
        fund: r.annualizedReturn ?? null,
        category: r.categoryAverage ?? null,
        rank: r.rankInCategory ?? "—",
      })),
    [data],
  );

  const alloc = useMemo(() => {
    const a = data?.portfolio?.assetAllocation;
    if (!a) return [];
    return [
      { label: "Equity", value: num(a.equityAllocation) ?? 0 },
      { label: "Debt", value: num(a.debtAllocation) ?? 0 },
      { label: "Cash", value: num(a.cashAllocation) ?? 0 },
      { label: "Other", value: num(a.otherAllocation) ?? 0 },
    ].filter((d) => d.value > 0);
  }, [data]);

  const mcap = useMemo(() => {
    const m = data?.portfolio?.marketCapWeightage;
    if (!m) return [];
    return Object.entries(m)
      .map(([k, v]) => ({ label: prettyMetricName(k), value: num(v) ?? 0 }))
      .filter((d) => d.value > 0);
  }, [data]);

  if (!schemes.length) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Microscope className="h-4 w-4 text-primary" />
            Fund Deep Dive
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Full factsheet from FinAPI — portfolio, holdings, category ranks, peer set and fund-house lineup.
          </p>
        </div>
        <Select value={activeCode ? String(activeCode) : ""} onValueChange={(v) => setCode(Number(v))}>
          <SelectTrigger className="w-full sm:w-[320px]">
            <SelectValue placeholder="Pick a fund" />
          </SelectTrigger>
          <SelectContent>
            {schemes.map((s) => (
              <SelectItem key={s.code} value={String(s.code)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {isError && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
            <div>
              <p className="font-medium">Factsheet unavailable for this scheme</p>
              <p className="text-xs text-muted-foreground">
                {(error as Error)?.message ?? "The data source did not return details."} NAV-based analytics in
                other tabs still work.
              </p>
            </div>
          </div>
        )}

        {data && (
          <div className="space-y-5">
            {/* Identity */}
            <div className="rounded-lg border border-border/50 bg-card/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold sm:text-base">{data.schemeName}</h3>
                {data.morningStarRating ? (
                  <span className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "h-3.5 w-3.5",
                          i < (data.morningStarRating ?? 0)
                            ? "fill-warning text-warning"
                            : "text-muted-foreground/40",
                        )}
                      />
                    ))}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[data.schemeCategoryLabel, data.schemeStructure, data.schemeRisk, data.planName, data.optionName]
                  .filter(Boolean)
                  .map((t) => (
                    <Badge key={t as string} variant="secondary" className="text-[11px]">
                      {t}
                    </Badge>
                  ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {data.fundHouse} · Managed by {data.schemeFundManagers || "—"} · Benchmark:{" "}
                {data.benchmarkIndex || "—"}
              </p>
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Stat
                label="Latest NAV"
                value={data.latestNav != null ? `₹${fmtNum(data.latestNav, 4)}` : "—"}
                hint={data.latestNavDate}
              />
              <Stat label="AUM (₹ Cr)" value={data.aum ?? "—"} />
              <Stat label="Expense ratio" value={data.expenseRatio ? `${data.expenseRatio}%` : "—"} />
              <Stat label="Exit load" value={data.exitLoadMessage ?? "—"} />
              <Stat label="Inception" value={data.inceptionDate ?? "—"} />
              <Stat
                label="Portfolio turnover"
                value={data.portfolioTurnover ? `${data.portfolioTurnover}%` : "—"}
              />
              <Stat
                label="52W high"
                value={data["52WeekHighNav"] != null ? `₹${fmtNum(data["52WeekHighNav"], 2)}` : "—"}
                hint={data["52WeekHighNavDate"]}
              />
              <Stat
                label="52W low"
                value={data["52WeekLowNav"] != null ? `₹${fmtNum(data["52WeekLowNav"], 2)}` : "—"}
                hint={data["52WeekLowNavDate"]}
              />
            </div>

            <Tabs defaultValue="perf" className="w-full">
              <TabsList className="w-full flex justify-start overflow-x-auto whitespace-nowrap [&>*]:shrink-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <TabsTrigger value="perf">Performance & Rank</TabsTrigger>
                <TabsTrigger value="risk">Risk vs Category</TabsTrigger>
                <TabsTrigger value="port">Portfolio</TabsTrigger>
                <TabsTrigger value="hold">Holdings</TabsTrigger>
                <TabsTrigger value="peers">Peers</TabsTrigger>
                <TabsTrigger value="amc">From this AMC</TabsTrigger>
              </TabsList>

              {/* Performance */}
              <TabsContent value="perf" className="mt-4 space-y-4">
                {rankData.length > 0 ? (
                  <>
                    <div className="h-[240px] w-full sm:h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rankData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.35} />
                          <XAxis
                            dataKey="timeframe"
                            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                            stroke="var(--border)"
                          />
                          <YAxis
                            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                            stroke="var(--border)"
                          />
                          <Tooltip
                            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                            contentStyle={{
                              background: "var(--popover)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              fontSize: 12,
                              color: "var(--popover-foreground)",
                            }}
                            labelStyle={{ color: "var(--popover-foreground)", fontWeight: 600, marginBottom: 4 }}
                            itemStyle={{ color: "var(--popover-foreground)" }}
                            formatter={(v: number, n: string) => [`${fmtNum(v)}%`, n === "fund" ? "Fund" : "Category avg"]}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: 11 }}
                            formatter={(v) => (
                              <span className="text-muted-foreground">{v === "fund" ? "Fund" : "Category avg"}</span>
                            )}
                          />
                          <Bar dataKey="fund" name="fund" radius={[3, 3, 0, 0]}>
                            {rankData.map((d, i) => (
                              <Cell
                                key={i}
                                fill={
                                  d.category != null && d.fund != null && d.fund >= d.category
                                    ? "var(--success)"
                                    : "var(--primary)"
                                }
                              />
                            ))}
                          </Bar>
                          <Bar
                            dataKey="category"
                            name="category"
                            fill="var(--muted-foreground)"
                            opacity={0.6}
                            radius={[3, 3, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-border/50 text-muted-foreground">
                            <th className="py-2 pr-3 text-left font-medium">Period</th>
                            <th className="py-2 px-2 text-right font-medium">Fund</th>
                            <th className="py-2 px-2 text-right font-medium">Category avg</th>
                            <th className="py-2 pl-2 text-right font-medium">Rank in category</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rankData.map((r) => (
                            <tr key={r.timeframe} className="border-b border-border/30 last:border-0">
                              <td className="py-2 pr-3 uppercase">{r.timeframe}</td>
                              <td
                                className={cn(
                                  "py-2 px-2 text-right font-semibold tabular-nums",
                                  r.fund != null && r.category != null && r.fund >= r.category
                                    ? "text-success"
                                    : "text-foreground",
                                )}
                              >
                                {r.fund != null ? fmtPctRaw(r.fund) : "—"}
                              </td>
                              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                                {r.category != null ? fmtPctRaw(r.category) : "—"}
                              </td>
                              <td className="py-2 pl-2 text-right tabular-nums">#{r.rank}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">No category rank data published.</p>
                )}

                {data.rollingReturns?.length ? (
                  <div className="overflow-x-auto">
                    <h4 className="mb-2 text-sm font-semibold">Published rolling-return stats</h4>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground">
                          <th className="py-1.5 pr-3 text-left font-medium">Window</th>
                          <th className="py-1.5 px-2 text-right font-medium">Avg</th>
                          <th className="py-1.5 px-2 text-right font-medium">Median</th>
                          <th className="py-1.5 px-2 text-right font-medium">Min</th>
                          <th className="py-1.5 px-2 text-right font-medium">Max</th>
                          <th className="py-1.5 px-2 text-right font-medium">Std dev</th>
                          <th className="py-1.5 px-2 text-right font-medium">% positive</th>
                          <th className="py-1.5 pl-2 text-right font-medium">Consistency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortTimeframes(data.rollingReturns).map((r) => (
                          <tr key={r.timeframe} className="border-b border-border/30 last:border-0">
                            <td className="py-1.5 pr-3 uppercase">{r.timeframe}</td>
                            <td className="py-1.5 px-2 text-right tabular-nums">{fmtPctRaw(r.averageReturn)}</td>
                            <td className="py-1.5 px-2 text-right tabular-nums">{fmtPctRaw(r.medianReturn)}</td>
                            <td className="py-1.5 px-2 text-right tabular-nums text-destructive">
                              {fmtPctRaw(r.minReturn)}
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums text-success">
                              {fmtPctRaw(r.maxReturn)}
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums">{fmtNum(r.standardDeviation)}</td>
                            <td className="py-1.5 px-2 text-right tabular-nums">{fmtPctRaw(r.positiveRatio, 1)}</td>
                            <td className="py-1.5 pl-2 text-right tabular-nums">{fmtNum(r.consistencyScore, 1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </TabsContent>

              {/* Risk */}
              <TabsContent value="risk" className="mt-4 space-y-3">
                {data.riskMetrics && Object.keys(data.riskMetrics).length ? (
                  Object.entries(data.riskMetrics).map(([k, v]) => <RiskBlock key={k} name={k} block={v} />)
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No category-relative risk metrics published for this scheme.
                  </p>
                )}
              </TabsContent>

              {/* Portfolio */}
              <TabsContent value="port" className="mt-4 space-y-5">
                {alloc.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Asset allocation</h4>
                    <AllocBar data={alloc} />
                  </div>
                )}
                {mcap.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Market-cap mix</h4>
                    <AllocBar data={mcap} />
                  </div>
                )}
                {data.portfolio?.concentration && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Concentration</h4>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {Object.entries(data.portfolio.concentration).map(([k, v]) => (
                        <Stat key={k} label={prettyMetricName(k)} value={String(v)} />
                      ))}
                    </div>
                  </div>
                )}
                {data.fundamentals && Object.keys(data.fundamentals).length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Debt fundamentals</h4>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {Object.entries(data.fundamentals).map(([k, v]) => (
                        <Stat key={k} label={prettyMetricName(k)} value={String(v)} />
                      ))}
                    </div>
                  </div>
                )}
                {data.sectors?.length ? (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Sector weights</h4>
                    <div className="space-y-1.5">
                      {data.sectors.slice(0, 12).map((s) => {
                        const w = num(s.weightage) ?? 0;
                        return (
                          <div key={s.sector} className="flex items-center gap-3">
                            <span className="w-40 shrink-0 truncate text-xs">{s.sector}</span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(w, 100)}%` }} />
                            </div>
                            <span className="w-14 shrink-0 text-right text-xs tabular-nums">{fmtNum(w)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {!alloc.length && !mcap.length && !data.sectors?.length && (
                  <p className="py-6 text-center text-sm text-muted-foreground">No portfolio disclosure available.</p>
                )}
              </TabsContent>

              {/* Holdings */}
              <TabsContent value="hold" className="mt-4">
                {data.holdings?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground">
                          <th className="py-2 pr-3 text-left font-medium">Holding</th>
                          <th className="py-2 px-2 text-right font-medium">Weight</th>
                          <th className="py-2 px-2 text-right font-medium">Value (₹ Cr)</th>
                          <th className="py-2 pl-2 text-right font-medium">1M change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.holdings.slice(0, 30).map((h) => {
                          const c = num(h.change1M);
                          return (
                            <tr key={h.name} className="border-b border-border/30 last:border-0">
                              <td className="max-w-[220px] truncate py-2 pr-3">{h.name}</td>
                              <td className="py-2 px-2 text-right font-medium tabular-nums">{h.weightage ?? "—"}%</td>
                              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                                {h.marketValue ?? "—"}
                              </td>
                              <td
                                className={cn(
                                  "py-2 pl-2 text-right tabular-nums",
                                  c != null && c > 0 && "text-success",
                                  c != null && c < 0 && "text-destructive",
                                )}
                              >
                                {c != null ? `${c > 0 ? "+" : ""}${fmtNum(c)}%` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {data.holdings.length > 30 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Showing top 30 of {data.holdings.length} holdings.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">Holdings not disclosed via the API.</p>
                )}
              </TabsContent>

              {/* Peers */}
              <TabsContent value="peers" className="mt-4">
                {data.peers?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground">
                          <th className="py-2 pr-3 text-left font-medium">Scheme</th>
                          <th className="py-2 px-2 text-right font-medium">AUM</th>
                          <th className="py-2 px-2 text-right font-medium">Exp.</th>
                          <th className="py-2 px-2 text-right font-medium">1Y</th>
                          <th className="py-2 px-2 text-right font-medium">3Y</th>
                          <th className="py-2 px-2 text-right font-medium">5Y</th>
                          <th className="py-2 pl-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {data.peers.slice(0, 25).map((p) => {
                          const pc = Number(p.schemeCode);
                          const already = isSelected?.(pc);
                          return (
                            <tr key={p.schemeCode} className="border-b border-border/30 last:border-0">
                              <td className="max-w-[240px] truncate py-2 pr-3">
                                {p.schemeNameShort || p.schemeName}
                              </td>
                              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{p.aum ?? "—"}</td>
                              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                                {p.expenseRatio ?? "—"}
                              </td>
                              <td className="py-2 px-2 text-right tabular-nums">{p.returns?.["1y"] ?? "—"}</td>
                              <td className="py-2 px-2 text-right tabular-nums">{p.returns?.["3y"] ?? "—"}</td>
                              <td className="py-2 px-2 text-right tabular-nums">{p.returns?.["5y"] ?? "—"}</td>
                              <td className="py-2 pl-2 text-right">
                                {onAdd && Number.isFinite(pc) && (
                                  <Button
                                    size="sm"
                                    variant={already ? "ghost" : "outline"}
                                    className="h-7 text-xs"
                                    disabled={already || canAdd === false}
                                    onClick={() => onAdd(pc, p.schemeName)}
                                  >
                                    {already ? "Added" : <><Plus className="mr-1 h-3 w-3" />Compare</>}
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">No peer set published.</p>
                )}
              </TabsContent>

              {/* AMC */}
              <TabsContent value="amc" className="mt-4">
                {data.moreFundsFromAmc?.schemeList?.length ? (
                  <div className="overflow-x-auto">
                    <p className="mb-2 text-xs text-muted-foreground">
                      Other schemes from {data.moreFundsFromAmc.companyName}
                    </p>
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground">
                          <th className="py-2 pr-3 text-left font-medium">Scheme</th>
                          <th className="py-2 px-2 text-right font-medium">AUM</th>
                          <th className="py-2 px-2 text-right font-medium">1Y</th>
                          <th className="py-2 px-2 text-right font-medium">3Y</th>
                          <th className="py-2 pl-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {data.moreFundsFromAmc.schemeList.slice(0, 25).map((f) => {
                          const fc = Number(f.schemeCode);
                          const already = isSelected?.(fc);
                          return (
                            <tr key={f.schemeCode} className="border-b border-border/30 last:border-0">
                              <td className="max-w-[240px] truncate py-2 pr-3">
                                {f.schemeShortName || f.schemeName}
                              </td>
                              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{f.aum ?? "—"}</td>
                              <td className="py-2 px-2 text-right tabular-nums">{f.returns?.["1y"] ?? "—"}</td>
                              <td className="py-2 px-2 text-right tabular-nums">{f.returns?.["3y"] ?? "—"}</td>
                              <td className="py-2 pl-2 text-right">
                                {onAdd && Number.isFinite(fc) && (
                                  <Button
                                    size="sm"
                                    variant={already ? "ghost" : "outline"}
                                    className="h-7 text-xs"
                                    disabled={already || canAdd === false}
                                    onClick={() => onAdd(fc, f.schemeName)}
                                  >
                                    {already ? "Added" : <><Plus className="mr-1 h-3 w-3" />Compare</>}
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">No AMC lineup published.</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
