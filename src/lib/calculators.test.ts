import { describe, it, expect } from "vitest";
import {
  calculateCAGR,
  calculateXIRR,
  simulateSIP,
  calculateRollingReturns,
  rollingStats,
  drawdownSeries,
  maxDrawdown,
  calculateRisk,
} from "./calculators";
import type { NavRow } from "@/types/mf";

const DAY = 86_400_000;

/** NAV compounding at exactly `rate` per calendar year — closed-form expectations. */
function exactSeries(rate: number, years: number, start = Date.UTC(2010, 0, 1)): NavRow[] {
  const rows: NavRow[] = [];
  for (let i = 0; i <= Math.round(365.25 * years); i++) {
    rows.push({ t: start + i * DAY, nav: 100 * Math.pow(1 + rate, i / 365.25) });
  }
  return rows;
}

describe("calculateCAGR", () => {
  it("recovers a known growth rate", () => {
    expect(calculateCAGR(100, 200, 10)).toBeCloseTo(Math.pow(2, 0.1) - 1, 6);
  });

  it("handles a loss", () => {
    expect(calculateCAGR(100, 50, 5)).toBeLessThan(0);
  });

  it("returns 0 for non-positive inputs rather than NaN/Infinity", () => {
    expect(Number.isFinite(calculateCAGR(0, 100, 5))).toBe(true);
    expect(Number.isFinite(calculateCAGR(100, 0, 5))).toBe(true);
    expect(Number.isFinite(calculateCAGR(100, 200, 0))).toBe(true);
  });
});

describe("calculateXIRR", () => {
  it("solves a simple one-year 12% flow", () => {
    const t = Date.UTC(2020, 0, 1);
    const xirr = calculateXIRR([
      { t, amount: -100 },
      { t: t + Math.round(365.25 * DAY), amount: 112 },
    ]);
    expect(xirr).toBeCloseTo(0.12, 3);
  });

  it("returns a negative rate when money is lost", () => {
    const t = Date.UTC(2020, 0, 1);
    const xirr = calculateXIRR([
      { t, amount: -100 },
      { t: t + Math.round(365.25 * DAY), amount: 80 },
    ]);
    expect(xirr).toBeLessThan(0);
  });
});

describe("simulateSIP", () => {
  // Regression guard: a SIP into a series compounding at exactly 12% must
  // report ~12% XIRR. This is the check that proved the engine sound when
  // rolling-SIP output looked implausibly high.
  it("reports ~12% XIRR on a series compounding at exactly 12%", () => {
    const rows = exactSeries(0.12, 10);
    const r = simulateSIP(rows, 10_000, rows[0].t, rows[rows.length - 1].t);
    expect(r.xirr).toBeCloseTo(0.12, 2);
    expect(r.installments).toBeGreaterThan(100);
    expect(r.currentValue).toBeGreaterThan(r.totalInvested);
  });

  it("returns a zeroed result for empty rows or non-positive amount", () => {
    expect(simulateSIP([], 5000, 0, 1).installments).toBe(0);
    const rows = exactSeries(0.1, 3);
    expect(simulateSIP(rows, 0, rows[0].t, rows[rows.length - 1].t).installments).toBe(0);
  });

  it("step-up increases the amount invested", () => {
    const rows = exactSeries(0.1, 6);
    const flat = simulateSIP(rows, 10_000, rows[0].t, rows[rows.length - 1].t, 0);
    const stepped = simulateSIP(rows, 10_000, rows[0].t, rows[rows.length - 1].t, 10);
    expect(stepped.totalInvested).toBeGreaterThan(flat.totalInvested);
  });
});

describe("calculateRollingReturns / rollingStats", () => {
  it("gives a constant rolling CAGR for a constant-growth series", () => {
    const rows = exactSeries(0.12, 8);
    const series = calculateRollingReturns(rows, 3);
    expect(series.length).toBeGreaterThan(0);
    const stats = rollingStats(series, 3);
    expect(stats.mean).toBeCloseTo(12, 0);
    expect(stats.min).toBeCloseTo(12, 0);
    expect(stats.max).toBeCloseTo(12, 0);
    expect(stats.positivePct).toBe(100);
  });

  it("returns nothing when history is shorter than the window", () => {
    expect(calculateRollingReturns(exactSeries(0.1, 2), 10)).toHaveLength(0);
  });

  it("min never exceeds max and median sits between them", () => {
    const rows = exactSeries(0.09, 12);
    const stats = rollingStats(calculateRollingReturns(rows, 5), 5);
    expect(stats.min).toBeLessThanOrEqual(stats.max);
    expect(stats.median).toBeGreaterThanOrEqual(stats.min);
    expect(stats.median).toBeLessThanOrEqual(stats.max);
  });
});

describe("drawdown", () => {
  it("is zero for a monotonically rising series", () => {
    expect(maxDrawdown(drawdownSeries(exactSeries(0.12, 5)))).toBeCloseTo(0, 6);
  });

  it("measures a peak-to-trough fall correctly", () => {
    const t = Date.UTC(2020, 0, 1);
    // 100 -> 200 -> 100: a 50% fall from the peak.
    const rows: NavRow[] = [
      { t, nav: 100 },
      { t: t + 30 * DAY, nav: 200 },
      { t: t + 60 * DAY, nav: 100 },
    ];
    expect(maxDrawdown(drawdownSeries(rows))).toBeCloseTo(-0.5, 6);
  });
});

describe("calculateRisk", () => {
  it("reports near-zero volatility for a smooth series", () => {
    const risk = calculateRisk(exactSeries(0.12, 6));
    expect(risk.volatility).toBeLessThan(0.01);
    expect(risk.cagr).toBeCloseTo(0.12, 2);
  });

  it("returns an empty result rather than throwing on too few rows", () => {
    const risk = calculateRisk([{ t: 0, nav: 100 }]);
    expect(risk.volatility).toBe(0);
    expect(risk.maxDrawdown).toBe(0);
  });
});
