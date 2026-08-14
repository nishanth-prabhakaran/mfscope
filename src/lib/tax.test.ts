import { describe, it, expect } from "vitest";
import { classifyForTax, computeTax, postTaxCagr, EQUITY_LTCG_EXEMPTION } from "./tax";
import { stressTest, captureRatios, CRISES } from "./stress";
import type { NavRow } from "@/types/mf";

describe("classifyForTax", () => {
  it("treats arbitrage funds as equity, which is how they are actually taxed", () => {
    expect(classifyForTax("Arbitrage", "HDFC Arbitrage Fund")).toBe("equity");
  });

  it("classifies debt categories as debt", () => {
    for (const c of ["Liquid", "Corporate Bond", "Gilt", "Ultra Short Duration", "Credit Risk"]) {
      expect(classifyForTax(c)).toBe("debt");
    }
  });

  it("classifies equity categories as equity", () => {
    for (const c of ["Large Cap", "Small Cap", "Flexi Cap", "ELSS", "Index"]) {
      expect(classifyForTax(c)).toBe("equity");
    }
  });

  it("separates equity-taxed from debt-taxed hybrids", () => {
    expect(classifyForTax("Aggressive Hybrid")).toBe("hybrid-equity");
    expect(classifyForTax("Conservative Hybrid")).toBe("hybrid-debt");
  });

  it("routes gold and international to the non-equity long-term treatment", () => {
    expect(classifyForTax("Gold ETF FoF")).toBe("gold-intl");
    expect(classifyForTax("International", "Nasdaq 100 FoF")).toBe("gold-intl");
  });
});

describe("computeTax", () => {
  it("applies the 1.25L equity LTCG exemption", () => {
    const r = computeTax({ assetClass: "equity", gain: 100_000, holdingYears: 3, slabRate: 0.3 });
    expect(r.tax).toBe(0);
    expect(r.exemptionApplied).toBe(100_000);
  });

  it("taxes only the excess above the exemption at 12.5%", () => {
    const gain = EQUITY_LTCG_EXEMPTION + 100_000;
    const r = computeTax({ assetClass: "equity", gain, holdingYears: 3, slabRate: 0.3 });
    expect(r.tax).toBeCloseTo(100_000 * 0.125, 6);
    expect(r.isLongTerm).toBe(true);
  });

  it("charges 20% STCG on equity held under a year", () => {
    const r = computeTax({ assetClass: "equity", gain: 200_000, holdingYears: 0.5, slabRate: 0.3 });
    expect(r.tax).toBeCloseTo(40_000, 6);
    expect(r.isLongTerm).toBe(false);
  });

  it("slab-taxes debt funds however long they are held", () => {
    const short = computeTax({
      assetClass: "debt",
      gain: 100_000,
      holdingYears: 0.5,
      slabRate: 0.3,
    });
    const long = computeTax({ assetClass: "debt", gain: 100_000, holdingYears: 9, slabRate: 0.3 });
    expect(short.tax).toBeCloseTo(30_000, 6);
    expect(long.tax).toBeCloseTo(30_000, 6);
    expect(long.isLongTerm).toBe(false);
  });

  it("respects exemption already used elsewhere", () => {
    const r = computeTax({
      assetClass: "equity",
      gain: 100_000,
      holdingYears: 2,
      slabRate: 0.3,
      exemptionUsed: EQUITY_LTCG_EXEMPTION,
    });
    expect(r.tax).toBeCloseTo(12_500, 6);
  });

  it("returns zero for a loss", () => {
    expect(
      computeTax({ assetClass: "equity", gain: -5000, holdingYears: 3, slabRate: 0.3 }).tax,
    ).toBe(0);
  });
});

describe("postTaxCagr", () => {
  it("always reduces the return, never increases it", () => {
    const r = postTaxCagr(0.14, 10, "equity", 0.3);
    expect(r.postTax).toBeLessThan(0.14);
    expect(r.drag).toBeGreaterThan(0);
  });

  it("hits debt funds harder than equity at the same gross return", () => {
    const eq = postTaxCagr(0.12, 10, "equity", 0.3);
    const debt = postTaxCagr(0.12, 10, "debt", 0.3);
    expect(debt.drag).toBeGreaterThan(eq.drag);
  });

  it("dilutes the annualised tax drag over a longer hold", () => {
    // Tax is levied once at exit, so the same rate costs less per year the
    // longer it is deferred - an argument against churning.
    const short = postTaxCagr(0.12, 3, "equity", 0.3);
    const long = postTaxCagr(0.12, 25, "equity", 0.3);
    expect(long.drag).toBeLessThan(short.drag);
  });
});

describe("stressTest", () => {
  const DAYMS = 86_400_000;
  function series(from: string, days: number, shape: (i: number) => number): NavRow[] {
    const t0 = Date.parse(from);
    return Array.from({ length: days }, (_, i) => ({ t: t0 + i * DAYMS, nav: shape(i) }));
  }

  it("flags insufficient history when the fund did not exist yet", () => {
    const r = stressTest(
      series("2021-01-01", 500, () => 100),
      CRISES[3],
    ); // COVID
    expect(r.insufficientHistory).toBe(true);
  });

  it("measures a decline inside the window and detects recovery", () => {
    // Flat 100, halve during COVID window, then recover past the peak.
    const covid = CRISES.find((c) => c.id === "covid-2020")!;
    const start = Date.parse(covid.start);
    const end = Date.parse(covid.end);
    const rows = series("2018-01-01", 1600, (i) => {
      const t = Date.parse("2018-01-01") + i * DAYMS;
      if (t < start) return 100;
      if (t <= end) return 50;
      return 130;
    });
    const r = stressTest(rows, covid);
    expect(r.insufficientHistory).toBe(false);
    expect(r.decline).toBeCloseTo(-0.5, 2);
    expect(r.recovered).toBe(true);
    expect(r.recoveryDays).toBeGreaterThan(0);
  });

  it("reports no recovery when the fund never regains its peak", () => {
    const covid = CRISES.find((c) => c.id === "covid-2020")!;
    const start = Date.parse(covid.start);
    const rows = series("2018-01-01", 1600, (i) =>
      Date.parse("2018-01-01") + i * DAYMS < start ? 100 : 60,
    );
    const r = stressTest(rows, covid);
    expect(r.recovered).toBe(false);
    expect(r.recoveryDays).toBeNull();
  });
});

describe("captureRatios", () => {
  const DAYMS = 86_400_000;

  /** NAV series stepping by an explicit return each calendar month. */
  function monthlySeries(monthReturns: number[]): NavRow[] {
    const rows: NavRow[] = [];
    let nav = 100;
    monthReturns.forEach((r, m) => {
      const y = 2015 + Math.floor(m / 12);
      const mo = m % 12;
      const days = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
      const step = Math.pow(1 + r, 1 / days);
      for (let d = 1; d <= days; d++) {
        rows.push({ t: Date.UTC(y, mo, d) + 12 * 3600_000, nav });
        nav *= step;
      }
    });
    return rows.map((r, i) => ({ ...r, t: r.t + (i % 1) * DAYMS }));
  }

  // 60 months alternating +4% / -3%.
  const benchMonths = Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? 0.04 : -0.03));

  it("returns null without enough overlapping history", () => {
    const tiny = monthlySeries([0.01]);
    expect(captureRatios(tiny, tiny)).toBeNull();
  });

  it("reports ~100/100 for a fund that tracks its benchmark exactly", () => {
    const s = monthlySeries(benchMonths);
    const r = captureRatios(s, s);
    expect(r).not.toBeNull();
    expect(r!.upside).toBeCloseTo(100, 0);
    expect(r!.downside).toBeCloseTo(100, 0);
  });

  it("shows favourable asymmetry when a fund falls less than its benchmark", () => {
    // Matches the benchmark on up months, halves the fall on down months.
    const fundMonths = benchMonths.map((m) => (m > 0 ? m : m / 2));
    const r = captureRatios(monthlySeries(fundMonths), monthlySeries(benchMonths));
    expect(r).not.toBeNull();
    expect(r!.downside).toBeLessThan(r!.upside);
    expect(r!.ratio).toBeGreaterThan(1);
    // Roughly half the downside captured.
    expect(r!.downside).toBeLessThan(70);
  });

  it("shows unfavourable asymmetry for a fund that amplifies falls", () => {
    const fundMonths = benchMonths.map((m) => (m > 0 ? m * 0.9 : m * 1.5));
    const r = captureRatios(monthlySeries(fundMonths), monthlySeries(benchMonths));
    expect(r!.ratio).toBeLessThan(1);
    expect(r!.downside).toBeGreaterThan(r!.upside);
  });
});
