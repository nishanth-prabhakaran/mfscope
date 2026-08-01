// Portfolio mode: blend several funds into one synthetic NAV series.
import type { NavRow, NormalizedScheme } from "@/types/mf";
import { findNavAt } from "./calculators";

export type Rebalance = "none" | "annual" | "quarterly";

export interface PortfolioHolding {
  code: number;
  name: string;
  data: NormalizedScheme;
  weight: number; // percent
}

export interface PortfolioSeries {
  rows: NavRow[];          // synthetic NAV (base 100)
  startT: number;
  endT: number;
  /** Weight drift at the end (only meaningful with rebalance = none) */
  finalWeights: { code: number; name: string; weight: number }[];
  rebalanceCount: number;
}

const DAY = 86_400_000;

/** Normalise weights to sum to 100. */
export function normalizeWeights(weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (sum <= 0) return weights.map(() => 100 / Math.max(1, weights.length));
  return weights.map((w) => (Math.max(0, w) / sum) * 100);
}

function isRebalanceDate(prev: Date, cur: Date, mode: Rebalance): boolean {
  if (mode === "none") return false;
  if (mode === "annual") return cur.getUTCFullYear() !== prev.getUTCFullYear();
  const q = (d: Date) => Math.floor(d.getUTCMonth() / 3);
  return cur.getUTCFullYear() !== prev.getUTCFullYear() || q(cur) !== q(prev);
}

/**
 * Build a base-100 synthetic NAV series for a weighted basket.
 * Uses the common overlapping window of all holdings and a weekly grid.
 */
export function buildPortfolioSeries(holdings: PortfolioHolding[], rebalance: Rebalance = "annual"): PortfolioSeries | null {
  const usable = holdings.filter((h) => h.data.rows.length > 1 && h.weight > 0);
  if (!usable.length) return null;

  const startT = Math.max(...usable.map((h) => h.data.rows[0].t));
  const endT = Math.min(...usable.map((h) => h.data.rows[h.data.rows.length - 1].t));
  if (endT <= startT) return null;

  const w = normalizeWeights(usable.map((h) => h.weight));
  // units of each fund held for a ₹100 portfolio
  let units = usable.map((h, i) => {
    const nav = findNavAt(h.data.rows, startT)?.nav ?? h.data.rows[0].nav;
    return (100 * w[i]) / 100 / nav;
  });

  const rows: NavRow[] = [];
  let rebalanceCount = 0;
  let prev = new Date(startT);
  for (let t = startT; t <= endT; t += 7 * DAY) {
    const navs = usable.map((h) => findNavAt(h.data.rows, t)?.nav ?? 0);
    const values = units.map((u, i) => u * navs[i]);
    const total = values.reduce((a, b) => a + b, 0);
    if (!Number.isFinite(total) || total <= 0) continue;
    rows.push({ t, nav: total });

    const cur = new Date(t);
    if (isRebalanceDate(prev, cur, rebalance)) {
      units = navs.map((n, i) => (n > 0 ? (total * (w[i] / 100)) / n : units[i]));
      rebalanceCount++;
    }
    prev = cur;
  }
  // ensure last point
  if (rows.length && rows[rows.length - 1].t < endT) {
    const navs = usable.map((h) => findNavAt(h.data.rows, endT)?.nav ?? 0);
    const total = units.reduce((s, u, i) => s + u * navs[i], 0);
    if (total > 0) rows.push({ t: endT, nav: total });
  }
  if (rows.length < 2) return null;

  const lastNavs = usable.map((h) => findNavAt(h.data.rows, endT)?.nav ?? 0);
  const lastValues = units.map((u, i) => u * lastNavs[i]);
  const lastTotal = lastValues.reduce((a, b) => a + b, 0) || 1;

  return {
    rows,
    startT,
    endT,
    finalWeights: usable.map((h, i) => ({ code: h.code, name: h.name, weight: (lastValues[i] / lastTotal) * 100 })),
    rebalanceCount,
  };
}

/** Equal-weight helper. */
export function equalWeights(n: number): number[] {
  return Array.from({ length: n }, () => Math.round((100 / n) * 100) / 100);
}
