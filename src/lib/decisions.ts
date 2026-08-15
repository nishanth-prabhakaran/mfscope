/**
 * Three reframings of data the app already has.
 *
 * Each one answers a question an investor actually asks, using numbers that are
 * otherwise scattered across tabs: is this fee worth paying, how long must I
 * commit, and what does moving cost me.
 */

import type { NavRow } from "@/types/mf";
import { calculateCAGR } from "./calculators";
import { computeTax, type TaxAssetClass } from "./tax";

// ---------------------------------------------------------------- break-even alpha

/** Typical all-in cost of a cheap Nifty index fund, used as the reference. */
export const INDEX_FUND_TER = 0.2;

export interface BreakEvenAlpha {
  /** Gross outperformance (pp/yr) needed just to match a cheap index fund. */
  requiredAlpha: number;
  fundTer: number;
  indexTer: number;
  /** Cumulative rupee shortfall over `years` if the fund only matches the index. */
  shortfall: number;
  years: number;
}

/**
 * How much a fund must beat the index by, every year, purely to break even
 * against a cheap index fund after fees.
 *
 * This inverts the usual framing. Rather than "is 1.8% expensive?", it says
 * "this fund must find 1.6 percentage points of outperformance a year, forever,
 * before you are any better off" — which is a far harder thing to assume.
 */
export function breakEvenAlpha(
  fundTer: number,
  years: number,
  amount = 1_000_000,
  indexReturn = 0.12,
  indexTer = INDEX_FUND_TER,
): BreakEvenAlpha {
  const requiredAlpha = fundTer - indexTer;
  const indexNet = indexReturn - indexTer / 100;
  const fundNetIfMatched = indexReturn - fundTer / 100;
  const shortfall =
    amount * Math.pow(1 + indexNet, years) - amount * Math.pow(1 + fundNetIfMatched, years);
  return { requiredAlpha, fundTer, indexTer, shortfall, years };
}

// ---------------------------------------------------------------- holding period

export interface HoldingPeriodRow {
  years: number;
  windows: number;
  /** Share of windows ending positive (%). */
  positivePct: number;
  /** Worst annualised outcome across windows (%). */
  worst: number;
  /** Worst outcome that still lost money, expressed as total loss (%). */
  worstTotal: number;
}

export interface HoldingPeriodResult {
  rows: HoldingPeriodRow[];
  /** Shortest window with no losing period in this fund's history; null if none. */
  safeYears: number | null;
  /** Shortest window where at least 95% of periods ended positive. */
  mostlySafeYears: number | null;
}

/**
 * For each holding length, what share of start dates ended in profit.
 *
 * Answers "how long do I actually need to commit this money?" from the fund's
 * own record, rather than the generic "equity needs five years". Steps monthly
 * so windows are near-independent without being prohibitively expensive.
 */
export function holdingPeriodProfile(rows: NavRow[], maxYears = 10): HoldingPeriodResult {
  const out: HoldingPeriodRow[] = [];
  if (rows.length < 200) return { rows: out, safeYears: null, mostlySafeYears: null };

  const YEAR_MS = 365.25 * 86_400_000;
  const first = rows[0].t;
  const last = rows[rows.length - 1].t;

  // Binary search for the last NAV at or before t.
  const at = (t: number): NavRow | null => {
    let lo = 0;
    let hi = rows.length - 1;
    let best: NavRow | null = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (rows[mid].t <= t) {
        best = rows[mid];
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return best;
  };

  for (let y = 1; y <= maxYears; y++) {
    const windowMs = y * YEAR_MS;
    if (last - first < windowMs) break;

    let positive = 0;
    let count = 0;
    let worst = Infinity;
    let worstTotal = Infinity;

    // Step monthly through every possible start date.
    for (let t = first; t + windowMs <= last; t += 30.44 * 86_400_000) {
      const a = at(t);
      const b = at(t + windowMs);
      if (!a || !b || a.nav <= 0) continue;
      count++;
      const total = b.nav / a.nav - 1;
      const cagr = calculateCAGR(a.nav, b.nav, y) * 100;
      if (total > 0) positive++;
      if (cagr < worst) worst = cagr;
      if (total < worstTotal) worstTotal = total * 100;
    }

    if (!count) continue;
    out.push({
      years: y,
      windows: count,
      positivePct: (positive / count) * 100,
      worst: Number.isFinite(worst) ? worst : 0,
      worstTotal: Number.isFinite(worstTotal) ? worstTotal : 0,
    });
  }

  const safe = out.find((r) => r.positivePct >= 100)?.years ?? null;
  const mostly = out.find((r) => r.positivePct >= 95)?.years ?? null;
  return { rows: out, safeYears: safe, mostlySafeYears: mostly };
}

// ---------------------------------------------------------------- switch cost

export interface SwitchCostInput {
  /** Current value of the holding. */
  currentValue: number;
  /** Original cost of the units being switched. */
  investedAmount: number;
  holdingYears: number;
  assetClass: TaxAssetClass;
  slabRate: number;
  /** Exit load as a percentage of redemption value, 0 if none applies. */
  exitLoadPct: number;
  /** Expected annual return of the destination fund, decimal. */
  newFundReturn: number;
  /** Expected annual return if the money stays put, decimal. */
  currentFundReturn: number;
  /** Years the switched money will remain invested. */
  yearsAhead: number;
}

export interface SwitchCostResult {
  exitLoad: number;
  tax: number;
  totalCost: number;
  /** What actually gets reinvested after costs. */
  amountAfterCosts: number;
  /** Value in `yearsAhead` if the switch is made. */
  switchedValue: number;
  /** Value in `yearsAhead` if nothing is done. */
  stayValue: number;
  /** Positive means switching wins. */
  advantage: number;
  /** Years for the new fund's edge to repay the switching cost; null if never. */
  breakEvenYears: number | null;
  taxBasis: string;
}

/**
 * Whether moving from one fund to another actually pays.
 *
 * The costs are immediate and certain — exit load and capital gains tax leave
 * the portfolio permanently, and the reduced base compounds for the rest of the
 * holding. The benefit is a future return difference that may not persist. Most
 * people switch without computing either.
 */
export function switchCost(i: SwitchCostInput): SwitchCostResult {
  const gain = Math.max(0, i.currentValue - i.investedAmount);
  const exitLoad = i.currentValue * (i.exitLoadPct / 100);
  const taxed = computeTax({
    assetClass: i.assetClass,
    gain,
    holdingYears: i.holdingYears,
    slabRate: i.slabRate,
  });
  const totalCost = exitLoad + taxed.tax;
  const amountAfterCosts = Math.max(0, i.currentValue - totalCost);

  const switchedValue = amountAfterCosts * Math.pow(1 + i.newFundReturn, i.yearsAhead);
  const stayValue = i.currentValue * Math.pow(1 + i.currentFundReturn, i.yearsAhead);

  // Years until the new fund's compounding overcomes the smaller starting base.
  let breakEvenYears: number | null = null;
  if (i.newFundReturn > i.currentFundReturn && amountAfterCosts > 0) {
    const ratio = i.currentValue / amountAfterCosts;
    const growthGap = (1 + i.newFundReturn) / (1 + i.currentFundReturn);
    if (growthGap > 1) {
      const y = Math.log(ratio) / Math.log(growthGap);
      breakEvenYears = Number.isFinite(y) && y > 0 ? y : 0;
    }
  }

  return {
    exitLoad,
    tax: taxed.tax,
    totalCost,
    amountAfterCosts,
    switchedValue,
    stayValue,
    advantage: switchedValue - stayValue,
    breakEvenYears,
    taxBasis: taxed.basis,
  };
}
