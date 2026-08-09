/**
 * Rolling SIP analysis.
 *
 * Every SIP metric elsewhere in the app assumes one fixed start date, which
 * quietly bakes in luck: a SIP started in Jan 2020 looks very different from
 * one started in Jan 2018. Sweeping every possible start month shows the range
 * an investor could actually have experienced, which is the honest picture for
 * someone who invests monthly rather than in a lump sum.
 */

import type { NavRow } from "@/types/mf";
import { simulateSIP, median as medianOf, percentile } from "./calculators";

export interface SipWindow {
  startT: number;
  endT: number;
  xirr: number; // decimal, e.g. 0.134
  invested: number;
  value: number;
}

export interface RollingSipStats {
  years: number;
  count: number;
  best: SipWindow | null;
  worst: SipWindow | null;
  medianXirr: number;
  meanXirr: number;
  p25: number;
  p75: number;
  positivePct: number;
  windows: SipWindow[];
}

const MONTH_MS = 30.44 * 86_400_000;

/**
 * Runs an N-year SIP starting at every month-begin for which a full window
 * exists. Steps monthly rather than daily — a SIP buys monthly, so daily
 * starts would produce near-duplicate windows at 30x the cost.
 */
export function rollingSip(rows: NavRow[], years: number, monthly = 10_000): RollingSipStats {
  const empty: RollingSipStats = {
    years,
    count: 0,
    best: null,
    worst: null,
    medianXirr: 0,
    meanXirr: 0,
    p25: 0,
    p75: 0,
    positivePct: 0,
    windows: [],
  };
  if (rows.length < 2) return empty;

  const first = rows[0].t;
  const last = rows[rows.length - 1].t;
  const windowMs = years * 365.25 * 86_400_000;
  if (last - first < windowMs) return empty;

  const windows: SipWindow[] = [];
  const startDate = new Date(first);
  let cur = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1);
  // Advance to the first whole month at or after inception.
  if (cur < first) {
    const d = new Date(cur);
    d.setUTCMonth(d.getUTCMonth() + 1);
    cur = d.getTime();
  }

  while (cur + windowMs <= last) {
    const endT = cur + windowMs;
    const r = simulateSIP(rows, monthly, cur, endT);
    // Need a meaningful number of installments for XIRR to mean anything.
    if (r.installments >= Math.max(6, years * 6) && Number.isFinite(r.xirr)) {
      windows.push({
        startT: cur,
        endT,
        xirr: r.xirr,
        invested: r.totalInvested,
        value: r.currentValue,
      });
    }
    const d = new Date(cur);
    d.setUTCMonth(d.getUTCMonth() + 1);
    cur = d.getTime();
  }

  if (!windows.length) return empty;

  const xs = windows.map((w) => w.xirr * 100);
  const best = windows.reduce((a, b) => (b.xirr > a.xirr ? b : a));
  const worst = windows.reduce((a, b) => (b.xirr < a.xirr ? b : a));

  return {
    years,
    count: windows.length,
    best,
    worst,
    medianXirr: medianOf(xs),
    meanXirr: xs.reduce((a, b) => a + b, 0) / xs.length,
    p25: percentile(xs, 25),
    p75: percentile(xs, 75),
    positivePct: (xs.filter((v) => v > 0).length / xs.length) * 100,
    windows,
  };
}

export { MONTH_MS };

// ---------------------------------------------------------------- percentile

export interface PercentileResult {
  code: number;
  name: string;
  value: number;
  /** 0–100, where 100 = best in category. */
  percentile: number;
  rank: number;
  outOf: number;
}

/**
 * Percentile within a peer set. `higherBetter=false` inverts for metrics like
 * volatility or drawdown where lower is better.
 *
 * Expressed as "better than X% of the category", which is more meaningful to a
 * beginner than a raw CAGR with no reference point.
 */
export function percentileRank(
  target: { code: number; name: string; value: number },
  peers: number[],
  higherBetter = true,
): PercentileResult {
  const valid = peers.filter((v) => Number.isFinite(v));
  if (!valid.length) {
    return { ...target, percentile: 50, rank: 1, outOf: 1 };
  }
  const beaten = valid.filter((v) => (higherBetter ? target.value > v : target.value < v)).length;
  const pct = (beaten / valid.length) * 100;
  const sorted = [...valid].sort((a, b) => (higherBetter ? b - a : a - b));
  const rank =
    sorted.filter((v) => (higherBetter ? v > target.value : v < target.value)).length + 1;
  return { ...target, percentile: pct, rank, outOf: valid.length };
}

export function percentileLabel(pct: number): { label: string; tone: string } {
  if (pct >= 90) return { label: "Top 10%", tone: "text-success" };
  if (pct >= 75) return { label: "Top quartile", tone: "text-success" };
  if (pct >= 50) return { label: "Above median", tone: "text-foreground" };
  if (pct >= 25) return { label: "Below median", tone: "text-amber-400" };
  return { label: "Bottom quartile", tone: "text-destructive" };
}
