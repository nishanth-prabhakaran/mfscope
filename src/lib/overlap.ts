/**
 * Portfolio overlap and cost analysis.
 *
 * Overlap answers the question most multi-fund investors don't know to ask:
 * "am I actually diversified, or do I own the same twenty stocks four times?"
 * Correlation (already in CorrelationMatrixCard) infers this from price
 * movement; this measures it directly from holdings.
 */

import type { HoldingRow } from "./finapiDetail";
import { num } from "./finapiDetail";

/** Normalise company names so "HDFC Bank Ltd." and "HDFC Bank Limited" match. */
export function normaliseHolding(name: string): string {
  return name
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/\b(ltd|limited|ltd\.|inc|corporation|corp|co)\b/g, "")
    .replace(/[^a-z0-9& ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface WeightedHolding {
  key: string;
  name: string;
  weight: number; // percent
}

/** Equity holdings only, normalised and de-duplicated, weights in percent. */
export function toWeighted(holdings: HoldingRow[] | undefined): WeightedHolding[] {
  if (!holdings?.length) return [];
  const byKey = new Map<string, WeightedHolding>();
  for (const h of holdings) {
    const w = num(h.weightage);
    if (w == null || w <= 0) continue;
    const name = (h.name ?? "").trim();
    if (!name) continue;
    const key = normaliseHolding(name);
    if (!key) continue;
    // Skip cash / derivatives / repo lines — they aren't portfolio overlap.
    if (/^(net |cash|trep|treps|repo|clearing|margin|sub total|total)/.test(key)) continue;
    const prev = byKey.get(key);
    if (prev) prev.weight += w;
    else byKey.set(key, { key, name, weight: w });
  }
  return Array.from(byKey.values()).sort((a, b) => b.weight - a.weight);
}

export interface OverlapPair {
  codeA: number;
  codeB: number;
  nameA: string;
  nameB: string;
  /** Sum of min(weightA, weightB) across shared holdings, in percent. */
  overlapPct: number;
  sharedCount: number;
  /** Largest shared positions, biggest common weight first. */
  topShared: { name: string; a: number; b: number; common: number }[];
}

export interface FundHoldings {
  code: number;
  name: string;
  holdings: WeightedHolding[];
}

/**
 * Weighted overlap = Σ min(wA, wB) over common holdings — the standard measure.
 * Two identical portfolios give 100%; disjoint ones give 0%. This is stricter
 * and more honest than "count of shared names", which can read 60% while the
 * shared names are trivial positions.
 */
export function overlapBetween(a: FundHoldings, b: FundHoldings): OverlapPair {
  const mapB = new Map(b.holdings.map((h) => [h.key, h]));
  let overlapPct = 0;
  let sharedCount = 0;
  const shared: OverlapPair["topShared"] = [];

  for (const ha of a.holdings) {
    const hb = mapB.get(ha.key);
    if (!hb) continue;
    const common = Math.min(ha.weight, hb.weight);
    overlapPct += common;
    sharedCount++;
    shared.push({ name: ha.name, a: ha.weight, b: hb.weight, common });
  }

  shared.sort((x, y) => y.common - x.common);
  return {
    codeA: a.code,
    codeB: b.code,
    nameA: a.name,
    nameB: b.name,
    overlapPct,
    sharedCount,
    topShared: shared.slice(0, 8),
  };
}

export function allOverlaps(funds: FundHoldings[]): OverlapPair[] {
  const out: OverlapPair[] = [];
  for (let i = 0; i < funds.length; i++) {
    for (let j = i + 1; j < funds.length; j++) {
      if (!funds[i].holdings.length || !funds[j].holdings.length) continue;
      out.push(overlapBetween(funds[i], funds[j]));
    }
  }
  return out.sort((a, b) => b.overlapPct - a.overlapPct);
}

export function overlapTone(pct: number): { label: string; tone: string } {
  if (pct >= 70) return { label: "Very high", tone: "text-destructive" };
  if (pct >= 50) return { label: "High", tone: "text-warning" };
  if (pct >= 30) return { label: "Moderate", tone: "text-foreground" };
  return { label: "Low", tone: "text-success" };
}

/**
 * Union of holdings across the whole selection, weighted by allocation.
 * Shows true single-stock concentration, which no individual fund reveals.
 */
export function combinedExposure(
  funds: FundHoldings[],
  weights?: number[],
): { name: string; weight: number; fundCount: number }[] {
  const n = funds.filter((f) => f.holdings.length).length;
  if (!n) return [];
  const byKey = new Map<string, { name: string; weight: number; funds: Set<number> }>();
  funds.forEach((f, i) => {
    if (!f.holdings.length) return;
    const share = weights?.[i] != null ? weights[i] / 100 : 1 / n;
    for (const h of f.holdings) {
      const prev = byKey.get(h.key);
      if (prev) {
        prev.weight += h.weight * share;
        prev.funds.add(f.code);
      } else {
        byKey.set(h.key, { name: h.name, weight: h.weight * share, funds: new Set([f.code]) });
      }
    }
  });
  return Array.from(byKey.values())
    .map((v) => ({ name: v.name, weight: v.weight, fundCount: v.funds.size }))
    .sort((a, b) => b.weight - a.weight);
}

// ---------------------------------------------------------------- cost

export interface CostProjection {
  expenseRatio: number; // percent p.a.
  /** Rupees lost to fees over `years` on `amount`, assuming `grossReturn` p.a. */
  dragRupees: number;
  /** Ending value net of fees. */
  netValue: number;
  /** Ending value if the fund charged nothing — the counterfactual. */
  grossValue: number;
}

/**
 * Fee drag compounds: the money paid as fees would itself have compounded.
 * Comparing (1+g)^n against (1+g-e)^n captures that, whereas multiplying the
 * expense ratio by the number of years badly understates the cost.
 */
export function projectCost(
  expenseRatio: number,
  amount: number,
  years: number,
  grossReturn = 0.12,
): CostProjection {
  const e = expenseRatio / 100;
  const grossValue = amount * Math.pow(1 + grossReturn, years);
  const netValue = amount * Math.pow(1 + grossReturn - e, years);
  return {
    expenseRatio,
    dragRupees: grossValue - netValue,
    netValue,
    grossValue,
  };
}

// ---------------------------------------------------------------- active share

/**
 * Active Share: the share of a portfolio that differs from its benchmark.
 *   ActiveShare = 1/2 * Σ |w_fund - w_index|
 *
 * Cremers & Petajisto's measure. Roughly:
 *   < 20%  pure index fund
 *   20-60% "closet indexer" — paying active fees for near-index exposure
 *   > 60%  genuinely active
 *
 * The halving matters: without it, a fund that simply reweights the same
 * stocks would score double what it should, since every overweight is
 * necessarily matched by an underweight elsewhere.
 */
export interface ActiveShareResult {
  activeShare: number; // percent
  /** Weight held in names absent from the index entirely. */
  offBenchmarkPct: number;
  /** Index weight the fund doesn't hold at all. */
  missingPct: number;
  /** Biggest deviations, largest absolute difference first. */
  topDeviations: { name: string; fund: number; index: number; diff: number }[];
  fundHoldings: number;
  indexHoldings: number;
}

export function activeShare(
  fund: WeightedHolding[],
  index: WeightedHolding[],
): ActiveShareResult | null {
  if (!fund.length || !index.length) return null;

  // Renormalise both to 100% so a fund holding 5% cash isn't scored as 5% active.
  const fundTotal = fund.reduce((a, h) => a + h.weight, 0);
  const indexTotal = index.reduce((a, h) => a + h.weight, 0);
  if (fundTotal <= 0 || indexTotal <= 0) return null;

  const fMap = new Map(fund.map((h) => [h.key, (h.weight / fundTotal) * 100]));
  const iMap = new Map(index.map((h) => [h.key, (h.weight / indexTotal) * 100]));
  const names = new Map<string, string>();
  for (const h of fund) names.set(h.key, h.name);
  for (const h of index) if (!names.has(h.key)) names.set(h.key, h.name);

  let sumAbs = 0;
  let offBenchmark = 0;
  let missing = 0;
  const deviations: ActiveShareResult["topDeviations"] = [];

  for (const key of new Set([...fMap.keys(), ...iMap.keys()])) {
    const f = fMap.get(key) ?? 0;
    const i = iMap.get(key) ?? 0;
    const diff = f - i;
    sumAbs += Math.abs(diff);
    if (i === 0) offBenchmark += f;
    if (f === 0) missing += i;
    deviations.push({ name: names.get(key) ?? key, fund: f, index: i, diff });
  }

  deviations.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return {
    activeShare: sumAbs / 2,
    offBenchmarkPct: offBenchmark,
    missingPct: missing,
    topDeviations: deviations.slice(0, 10),
    fundHoldings: fund.length,
    indexHoldings: index.length,
  };
}

export function activeShareVerdict(pct: number): { label: string; tone: string; note: string } {
  if (pct < 20)
    return {
      label: "Index-like",
      tone: "text-info",
      note: "Effectively tracks the index. Fine if that's what you want — but only worth an index fund's fee.",
    };
  if (pct < 60)
    return {
      label: "Closet indexer",
      tone: "text-warning",
      note: "Most of this portfolio mirrors the index, yet it charges active fees. The active portion has to work much harder to justify the cost.",
    };
  if (pct < 80)
    return {
      label: "Genuinely active",
      tone: "text-success",
      note: "Meaningfully different from the index — for better or worse, you are paying for real stock selection.",
    };
  return {
    label: "Highly active",
    tone: "text-success",
    note: "Very different from the index. Expect returns to diverge sharply from it in both directions.",
  };
}
