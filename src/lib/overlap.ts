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
