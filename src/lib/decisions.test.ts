import { describe, it, expect } from "vitest";
import { breakEvenAlpha, holdingPeriodProfile, switchCost, INDEX_FUND_TER } from "./decisions";
import type { NavRow } from "@/types/mf";

const DAY = 86_400_000;

/** NAV compounding at exactly `rate` per year. */
function steady(rate: number, years: number): NavRow[] {
  const rows: NavRow[] = [];
  const n = Math.round(365.25 * years);
  for (let i = 0; i <= n; i++) {
    rows.push({ t: Date.UTC(2010, 0, 1) + i * DAY, nav: 100 * Math.pow(1 + rate, i / 365.25) });
  }
  return rows;
}

describe("breakEvenAlpha", () => {
  it("requires exactly the fee difference over a cheap index fund", () => {
    const r = breakEvenAlpha(1.8, 10);
    expect(r.requiredAlpha).toBeCloseTo(1.8 - INDEX_FUND_TER, 6);
  });

  it("requires nothing when the fund is as cheap as the index", () => {
    expect(breakEvenAlpha(INDEX_FUND_TER, 10).requiredAlpha).toBeCloseTo(0, 6);
  });

  it("grows the shortfall with both fee gap and horizon", () => {
    const cheapShort = breakEvenAlpha(1.0, 5).shortfall;
    const cheapLong = breakEvenAlpha(1.0, 20).shortfall;
    const dearLong = breakEvenAlpha(2.2, 20).shortfall;
    expect(cheapLong).toBeGreaterThan(cheapShort);
    expect(dearLong).toBeGreaterThan(cheapLong);
  });

  it("costs nothing if the fund matches the index fee", () => {
    expect(breakEvenAlpha(INDEX_FUND_TER, 15).shortfall).toBeCloseTo(0, 6);
  });
});

describe("holdingPeriodProfile", () => {
  it("returns nothing for too little history", () => {
    const r = holdingPeriodProfile(steady(0.1, 0.3));
    expect(r.rows).toHaveLength(0);
    expect(r.safeYears).toBeNull();
  });

  it("reports every period positive for a steadily rising fund", () => {
    const r = holdingPeriodProfile(steady(0.12, 12), 5);
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.every((x) => x.positivePct === 100)).toBe(true);
    expect(r.safeYears).toBe(1);
  });

  it("finds a longer safe period for a fund with a deep mid-life crash", () => {
    // Rises, halves over a year, then recovers strongly.
    const rows: NavRow[] = [];
    const n = Math.round(365.25 * 14);
    for (let i = 0; i <= n; i++) {
      const yrs = i / 365.25;
      let nav: number;
      if (yrs < 5) nav = 100 * Math.pow(1.12, yrs);
      else if (yrs < 6) nav = 100 * Math.pow(1.12, 5) * (1 - 0.5 * (yrs - 5));
      else nav = 100 * Math.pow(1.12, 5) * 0.5 * Math.pow(1.25, yrs - 6);
      rows.push({ t: Date.UTC(2010, 0, 1) + i * DAY, nav });
    }
    const r = holdingPeriodProfile(rows, 8);
    const oneYear = r.rows.find((x) => x.years === 1)!;
    expect(oneYear.positivePct).toBeLessThan(100);
    expect(oneYear.worstTotal).toBeLessThan(0);
    // Longer holds should fare no worse than one-year holds.
    const longest = r.rows[r.rows.length - 1];
    expect(longest.positivePct).toBeGreaterThanOrEqual(oneYear.positivePct);
  });

  it("never reports more positive periods than windows examined", () => {
    const r = holdingPeriodProfile(steady(0.09, 12), 6);
    for (const row of r.rows) {
      expect(row.positivePct).toBeLessThanOrEqual(100);
      expect(row.windows).toBeGreaterThan(0);
    }
  });
});

describe("switchCost", () => {
  const base = {
    currentValue: 1_500_000,
    investedAmount: 1_000_000,
    holdingYears: 4,
    assetClass: "equity" as const,
    slabRate: 0.3,
    exitLoadPct: 0,
    newFundReturn: 0.14,
    currentFundReturn: 0.12,
    yearsAhead: 10,
  };

  it("charges tax on the embedded gain", () => {
    const r = switchCost(base);
    expect(r.tax).toBeGreaterThan(0);
    expect(r.amountAfterCosts).toBeLessThan(base.currentValue);
  });

  it("adds exit load on top of tax", () => {
    const withLoad = switchCost({ ...base, exitLoadPct: 1 });
    const without = switchCost(base);
    expect(withLoad.exitLoad).toBeCloseTo(base.currentValue * 0.01, 6);
    expect(withLoad.totalCost).toBeGreaterThan(without.totalCost);
  });

  it("says staying wins when the new fund is no better", () => {
    const r = switchCost({ ...base, newFundReturn: 0.12 });
    expect(r.advantage).toBeLessThan(0);
    expect(r.breakEvenYears).toBeNull();
  });

  it("computes a break-even horizon when the new fund is better", () => {
    const r = switchCost(base);
    expect(r.breakEvenYears).not.toBeNull();
    expect(r.breakEvenYears!).toBeGreaterThan(0);
  });

  it("needs longer to break even when switching costs more", () => {
    const cheap = switchCost({ ...base, exitLoadPct: 0 });
    const pricey = switchCost({ ...base, exitLoadPct: 2 });
    expect(pricey.breakEvenYears!).toBeGreaterThan(cheap.breakEvenYears!);
  });

  it("charges no tax when there is no gain", () => {
    const r = switchCost({ ...base, currentValue: 900_000, investedAmount: 1_000_000 });
    expect(r.tax).toBe(0);
  });
});
