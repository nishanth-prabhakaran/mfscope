import { describe, it, expect } from "vitest";
import {
  normaliseHolding,
  toWeighted,
  overlapBetween,
  allOverlaps,
  combinedExposure,
  projectCost,
  activeShare,
  activeShareVerdict,
  type FundHoldings,
} from "./overlap";
import {
  scoreProfile,
  analyseFundRisk,
  matchFund,
  isSuggestable,
  SUITABLE_CATEGORIES,
  QUESTIONS,
  evaluateGates,
  hasBlockingGate,
  suitabilityScore,
  type Answers,
  type RiskBand,
} from "./riskProfile";
import { rollingSip, percentileRank, percentileLabel } from "./rollingSip";
import type { NavRow } from "@/types/mf";

const DAY = 86_400_000;

const holdings = (rows: [string, number][]) =>
  rows.map(([name, w]) => ({ name, weightage: String(w) }) as never);

/** Deterministic pseudo-random NAV series (seeded, so tests never flake). */
function series(driftAnnual: number, volAnnual: number, seed = 1, years = 15): NavRow[] {
  let nav = 100;
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const rows: NavRow[] = [];
  const start = Date.UTC(2008, 0, 1);
  const n = Math.round(365.25 * years);
  for (let i = 0; i < n; i++) {
    const z = Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
    nav *= Math.exp(driftAnnual / 365.25 + (volAnnual / Math.sqrt(365.25)) * z);
    rows.push({ t: start + i * DAY, nav });
  }
  return rows;
}

// ---------------------------------------------------------------- overlap

describe("normaliseHolding", () => {
  it("matches the same company across AMC naming conventions", () => {
    const forms = ["HDFC Bank Ltd.", "HDFC Bank Limited", "HDFC BANK LTD", "Hdfc Bank Ltd"];
    const keys = new Set(forms.map(normaliseHolding));
    expect(keys.size).toBe(1);
  });

  it("keeps genuinely different companies distinct", () => {
    expect(normaliseHolding("HDFC Bank Ltd")).not.toBe(normaliseHolding("ICICI Bank Ltd"));
  });
});

describe("toWeighted", () => {
  it("excludes cash, TREPS and receivables, which are not portfolio overlap", () => {
    const w = toWeighted(
      holdings([
        ["HDFC Bank Ltd", 9],
        ["TREPS", 3],
        ["Net Receivables", 1],
        ["Cash & Equivalents", 2],
      ]),
    );
    expect(w.map((h) => h.name)).toEqual(["HDFC Bank Ltd"]);
  });

  it("merges duplicate names and drops non-positive weights", () => {
    const w = toWeighted(
      holdings([
        ["Infosys Ltd", 4],
        ["Infosys Limited", 3],
        ["Wipro Ltd", 0],
      ]),
    );
    expect(w).toHaveLength(1);
    expect(w[0].weight).toBeCloseTo(7, 6);
  });

  it("returns an empty array for missing holdings", () => {
    expect(toWeighted(undefined)).toEqual([]);
  });
});

describe("overlapBetween", () => {
  const a: FundHoldings = {
    code: 1,
    name: "A",
    holdings: toWeighted(
      holdings([
        ["HDFC Bank Ltd.", 10],
        ["Infosys Ltd", 5],
      ]),
    ),
  };

  it("is zero for disjoint portfolios", () => {
    const c: FundHoldings = {
      code: 3,
      name: "C",
      holdings: toWeighted(holdings([["Cyient Ltd", 4]])),
    };
    expect(overlapBetween(a, c).overlapPct).toBe(0);
  });

  it("equals total invested weight for identical portfolios", () => {
    expect(overlapBetween(a, { ...a, code: 9 }).overlapPct).toBeCloseTo(15, 6);
  });

  it("uses the smaller of the two weights, not the larger", () => {
    const b: FundHoldings = {
      code: 2,
      name: "B",
      holdings: toWeighted(
        holdings([
          ["HDFC Bank Limited", 4],
          ["Infosys Limited", 9],
        ]),
      ),
    };
    // min(10,4) + min(5,9) = 9
    expect(overlapBetween(a, b).overlapPct).toBeCloseTo(9, 6);
  });

  it("is symmetric", () => {
    const b: FundHoldings = {
      code: 2,
      name: "B",
      holdings: toWeighted(holdings([["HDFC Bank Ltd", 6]])),
    };
    expect(overlapBetween(a, b).overlapPct).toBeCloseTo(overlapBetween(b, a).overlapPct, 6);
  });
});

describe("allOverlaps / combinedExposure", () => {
  const mk = (code: number, rows: [string, number][]): FundHoldings => ({
    code,
    name: `F${code}`,
    holdings: toWeighted(holdings(rows)),
  });

  it("produces one entry per pair, sorted by overlap descending", () => {
    const pairs = allOverlaps([
      mk(1, [["HDFC Bank Ltd", 10]]),
      mk(2, [["HDFC Bank Ltd", 8]]),
      mk(3, [["Cyient Ltd", 5]]),
    ]);
    expect(pairs).toHaveLength(3);
    expect(pairs[0].overlapPct).toBeGreaterThanOrEqual(pairs[1].overlapPct);
  });

  it("counts how many funds hold each stock", () => {
    const combined = combinedExposure([
      mk(1, [["HDFC Bank Ltd", 10]]),
      mk(2, [["HDFC Bank Limited", 6]]),
      mk(3, [["Cyient Ltd", 5]]),
    ]);
    const hdfc = combined.find((c) => c.name.toLowerCase().includes("hdfc"));
    expect(hdfc?.fundCount).toBe(2);
    // Equal-weighted across 3 funds: (10 + 6) / 3
    expect(hdfc?.weight).toBeCloseTo(16 / 3, 6);
  });
});

describe("projectCost", () => {
  it("compounds the fee drag rather than multiplying it linearly", () => {
    const p = projectCost(1.5, 1_000_000, 15, 0.12);
    const naive = 1_000_000 * 0.015 * 15; // the wrong way to do it
    expect(p.dragRupees).toBeGreaterThan(naive);
    expect(p.netValue).toBeLessThan(p.grossValue);
  });

  it("charges nothing at a zero expense ratio", () => {
    expect(projectCost(0, 500_000, 10, 0.12).dragRupees).toBeCloseTo(0, 6);
  });

  it("drag grows with both horizon and expense ratio", () => {
    const short = projectCost(1, 1_000_000, 5, 0.12).dragRupees;
    const long = projectCost(1, 1_000_000, 20, 0.12).dragRupees;
    const pricey = projectCost(2, 1_000_000, 20, 0.12).dragRupees;
    expect(long).toBeGreaterThan(short);
    expect(pricey).toBeGreaterThan(long);
  });
});

// ---------------------------------------------------------------- profiling

describe("scoreProfile", () => {
  const answer = (over: Partial<Answers> = {}): Answers => ({
    horizon: 2,
    emergency: 3,
    income: 3,
    share: 3,
    drawdown: 2,
    experience: 2,
    badyear: 2.7,
    ...over,
  });

  it("takes the LOWER of capacity and tolerance", () => {
    // Long horizon, strong finances, but would panic-sell.
    const panicky = scoreProfile({
      horizon: 4,
      emergency: 4,
      income: 4,
      share: 4,
      drawdown: 0,
      experience: 0,
      badyear: 0,
    });
    expect(panicky.capacityScore).toBeGreaterThan(90);
    expect(panicky.toleranceScore).toBeLessThan(10);
    expect(panicky.band).toBe(1);
    expect(panicky.limitedBy).toBe("tolerance");
  });

  it("puts a middle-of-the-road investor in Balanced, not Growth", () => {
    // Regression guard: original weights mis-banded this profile as 4.
    expect(scoreProfile(answer()).band).toBe(3);
  });

  it("bands the extremes correctly", () => {
    const min = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.options[0].value])) as Answers;
    const max = Object.fromEntries(
      QUESTIONS.map((q) => [q.id, q.options[q.options.length - 1].value]),
    ) as Answers;
    expect(scoreProfile(min).band).toBe(1);
    expect(scoreProfile(max).band).toBe(5);
  });

  it("maps horizon to a supported rolling window", () => {
    expect([1, 3, 5, 7, 10, 12, 15]).toContain(scoreProfile(answer({ horizon: 0 })).horizonWindow);
    expect(scoreProfile(answer({ horizon: 4 })).horizonWindow).toBe(15);
  });
});

describe("fund banding and matching", () => {
  it("orders bands from arbitrage-like to small-cap-like", () => {
    const calm = analyseFundRisk("HDFC Arbitrage Fund", series(0.06, 0.01, 3), 5);
    const large = analyseFundRisk("SBI Large Cap Fund", series(0.12, 0.16, 7), 5);
    const wild = analyseFundRisk("Quant Small Cap Fund", series(0.18, 0.32, 13), 5);
    expect(calm.band).toBeLessThan(large.band);
    expect(large.band).toBeLessThan(wild.band);
    expect(calm.score).toBeLessThan(wild.score);
  });

  it("flags a short horizon against a volatile fund", () => {
    const answers: Answers = {
      horizon: 0,
      emergency: 0,
      income: 0,
      share: 0,
      drawdown: 0,
      experience: 0,
      badyear: 0,
    };
    const profile = scoreProfile(answers);
    const fund = analyseFundRisk(
      "Quant Small Cap Fund",
      series(0.18, 0.32, 13),
      profile.horizonWindow,
    );
    const m = matchFund(fund, profile, answers);
    expect(m.verdict).toBe("mismatch");
    expect(m.warnings.length).toBeGreaterThan(0);
    expect(m.warnings.join(" ")).toMatch(/sell|horizon/i);
  });

  it("marks a very tame fund as below an aggressive investor's capacity", () => {
    const answers: Answers = {
      horizon: 4,
      emergency: 4,
      income: 4,
      share: 4,
      drawdown: 4,
      experience: 4,
      badyear: 4,
    };
    const profile = scoreProfile(answers);
    const calm = analyseFundRisk(
      "HDFC Arbitrage Fund",
      series(0.06, 0.01, 3),
      profile.horizonWindow,
    );
    expect(matchFund(calm, profile, answers).verdict).toBe("below");
  });

  it("never suggests a fund riskier than the investor's band", () => {
    for (let u = 1 as RiskBand; u <= 5; u++) {
      for (let f = 1 as RiskBand; f <= 5; f++) {
        if (isSuggestable(f as RiskBand, u as RiskBand)) expect(f).toBeLessThanOrEqual(u);
      }
    }
  });

  it("gives every band at least one category to screen", () => {
    for (const b of [1, 2, 3, 4, 5] as RiskBand[]) {
      expect(SUITABLE_CATEGORIES[b].length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------- rolling SIP

describe("rollingSip", () => {
  it("produces multiple start-month windows and a coherent spread", () => {
    const r = rollingSip(series(0.13, 0.18, 7), 5);
    expect(r.count).toBeGreaterThan(10);
    expect(r.worst!.xirr).toBeLessThanOrEqual(r.best!.xirr);
    expect(r.p25).toBeLessThanOrEqual(r.p75);
    expect(r.medianXirr).toBeGreaterThanOrEqual(r.p25);
    expect(r.medianXirr).toBeLessThanOrEqual(r.p75);
  });

  it("returns empty rather than throwing when history is too short", () => {
    const r = rollingSip(series(0.1, 0.15, 3, 2), 10);
    expect(r.count).toBe(0);
    expect(r.best).toBeNull();
  });
});

describe("percentileRank", () => {
  const peers = [8, 10, 12, 14, 16, 18, 20];

  it("ranks higher values better by default", () => {
    const r = percentileRank({ code: 1, name: "X", value: 19 }, peers);
    expect(r.percentile).toBeGreaterThan(80);
    expect(r.rank).toBe(2);
  });

  it("inverts for metrics where lower is better", () => {
    const r = percentileRank({ code: 1, name: "X", value: 9 }, peers, false);
    expect(r.percentile).toBeGreaterThan(80);
  });

  it("falls back to the median with no peers instead of dividing by zero", () => {
    const r = percentileRank({ code: 1, name: "X", value: 5 }, []);
    expect(r.percentile).toBe(50);
    expect(Number.isFinite(r.percentile)).toBe(true);
  });

  it("labels the extremes sensibly", () => {
    expect(percentileLabel(95).label).toMatch(/top/i);
    expect(percentileLabel(5).label).toMatch(/bottom/i);
  });
});

// ---------------------------------------------------------------- active share

describe("activeShare", () => {
  const idx = toWeighted(
    holdings([
      ["HDFC Bank Ltd", 30],
      ["Reliance Industries Ltd", 30],
      ["Infosys Ltd", 40],
    ]),
  );

  it("is 0 for a portfolio identical to the index", () => {
    expect(activeShare(idx, idx)!.activeShare).toBeCloseTo(0, 6);
  });

  it("is 100 for a completely disjoint portfolio", () => {
    const other = toWeighted(
      holdings([
        ["Cyient Ltd", 50],
        ["KEI Industries Ltd", 50],
      ]),
    );
    expect(activeShare(other, idx)!.activeShare).toBeCloseTo(100, 6);
    expect(activeShare(other, idx)!.offBenchmarkPct).toBeCloseTo(100, 6);
    expect(activeShare(other, idx)!.missingPct).toBeCloseTo(100, 6);
  });

  it("halves the summed deviation, so pure reweighting isn't double-counted", () => {
    // Same three names, weights shuffled: |10|+|10| summed = 20, active share = 10.
    const reweighted = toWeighted(
      holdings([
        ["HDFC Bank Ltd", 40],
        ["Reliance Industries Ltd", 20],
        ["Infosys Ltd", 40],
      ]),
    );
    expect(activeShare(reweighted, idx)!.activeShare).toBeCloseTo(10, 6);
  });

  it("normalises for cash so it isn't counted as active risk", () => {
    // Identical equity weights; cash is stripped by toWeighted.
    const withCash = toWeighted(
      holdings([
        ["HDFC Bank Ltd", 27],
        ["Reliance Industries Ltd", 27],
        ["Infosys Ltd", 36],
        ["TREPS", 10],
      ]),
    );
    expect(activeShare(withCash, idx)!.activeShare).toBeCloseTo(0, 4);
  });

  it("returns null when either side is empty rather than dividing by zero", () => {
    expect(activeShare([], idx)).toBeNull();
    expect(activeShare(idx, [])).toBeNull();
  });

  it("labels the bands as expected", () => {
    expect(activeShareVerdict(10).label).toMatch(/index/i);
    expect(activeShareVerdict(40).label).toMatch(/closet/i);
    expect(activeShareVerdict(70).label).toMatch(/active/i);
  });
});

// ---------------------------------------------------------------- gates

describe("evaluateGates", () => {
  const clean: Answers = {
    debt: 2,
    insurance: 2,
    horizon: 4,
    emergency: 3,
    income: 3,
    share: 3,
    drawdown: 2,
    experience: 2,
    badyear: 2.7,
  };

  it("raises nothing for a well-prepared investor", () => {
    expect(evaluateGates(clean)).toHaveLength(0);
    expect(hasBlockingGate(evaluateGates(clean))).toBe(false);
  });

  it("blocks on high-interest debt", () => {
    const g = evaluateGates({ ...clean, debt: 0 });
    expect(g.some((x) => x.id === "debt" && x.severity === "block")).toBe(true);
    expect(hasBlockingGate(g)).toBe(true);
  });

  it("blocks when there is no emergency fund", () => {
    const g = evaluateGates({ ...clean, emergency: 0 });
    expect(g.some((x) => x.id === "emergency" && x.severity === "block")).toBe(true);
  });

  it("blocks a sub-3-year horizon regardless of risk appetite", () => {
    // Maximum risk tolerance must NOT unlock equity on a 2-year horizon.
    const bold = { ...clean, horizon: 0, drawdown: 4, experience: 4, badyear: 4 };
    expect(hasBlockingGate(evaluateGates(bold))).toBe(true);
    expect(evaluateGates(bold).some((x) => x.id === "horizon")).toBe(true);
  });

  it("warns but does not block a 3-4 year horizon", () => {
    const g = evaluateGates({ ...clean, horizon: 1 });
    expect(g.some((x) => x.id === "horizon-short" && x.severity === "warn")).toBe(true);
    expect(hasBlockingGate(g)).toBe(false);
  });

  it("warns on missing or employer-only health cover", () => {
    expect(evaluateGates({ ...clean, insurance: 0 }).some((x) => x.id === "insurance")).toBe(true);
    expect(
      evaluateGates({ ...clean, insurance: 1 }).some((x) => x.id === "insurance-employer"),
    ).toBe(true);
  });

  it("stacks multiple gates", () => {
    const g = evaluateGates({ ...clean, debt: 0, emergency: 0, horizon: 0, insurance: 0 });
    expect(g.length).toBeGreaterThanOrEqual(4);
  });

  it("does not let gate answers alter the risk score", () => {
    // Gate questions are excluded from scoring; band must be identical.
    const withDebt = scoreProfile({ ...clean, debt: 0, insurance: 0 });
    const withoutDebt = scoreProfile(clean);
    expect(withDebt.band).toBe(withoutDebt.band);
    expect(withDebt.capacityScore).toBeCloseTo(withoutDebt.capacityScore, 6);
  });
});

// ---------------------------------------------------------------- shortlist ranking

describe("suitabilityScore", () => {
  const base = {
    rollingMean: 13,
    worstRolling: 4,
    positivePct: 95,
    volatility: 0.17,
    maxDD: -0.35,
    recoveryDays: 400,
    expenseRatio: 1.0,
  };

  it("prefers the cheaper of two otherwise identical funds", () => {
    const cheap = suitabilityScore({ ...base, expenseRatio: 0.3 });
    const pricey = suitabilityScore({ ...base, expenseRatio: 2.0 });
    expect(cheap).toBeGreaterThan(pricey);
  });

  it("weights cost more than past return", () => {
    // A cheap fund with weaker past returns should still beat an expensive
    // fund with stronger ones — the core behavioural fix.
    const cheapWeaker = suitabilityScore({ ...base, expenseRatio: 0.3, rollingMean: 11 });
    const dearStronger = suitabilityScore({ ...base, expenseRatio: 2.0, rollingMean: 15 });
    expect(cheapWeaker).toBeGreaterThan(dearStronger);
  });

  it("penalises a worse downside even when the average is identical", () => {
    const shallow = suitabilityScore({ ...base, worstRolling: 6, maxDD: -0.2 });
    const deep = suitabilityScore({ ...base, worstRolling: -8, maxDD: -0.55 });
    expect(shallow).toBeGreaterThan(deep);
  });

  it("scores a missing expense ratio neutrally, never favourably", () => {
    const unknown = suitabilityScore({ ...base, expenseRatio: null });
    const cheapest = suitabilityScore({ ...base, expenseRatio: 0.1 });
    const dearest = suitabilityScore({ ...base, expenseRatio: 2.5 });
    expect(unknown).toBeLessThan(cheapest);
    expect(unknown).toBeGreaterThan(dearest);
  });

  it("still rewards higher returns when cost and risk match", () => {
    expect(suitabilityScore({ ...base, rollingMean: 16 })).toBeGreaterThan(
      suitabilityScore({ ...base, rollingMean: 9 }),
    );
  });

  it("stays within 0-100 for extreme inputs", () => {
    const awful = suitabilityScore({
      rollingMean: -30,
      worstRolling: -60,
      positivePct: 0,
      volatility: 0.9,
      maxDD: -0.9,
      recoveryDays: 5000,
      expenseRatio: 5,
    });
    const ideal = suitabilityScore({
      rollingMean: 40,
      worstRolling: 25,
      positivePct: 100,
      volatility: 0.01,
      maxDD: -0.01,
      recoveryDays: 0,
      expenseRatio: 0,
    });
    expect(awful).toBeGreaterThanOrEqual(0);
    expect(ideal).toBeLessThanOrEqual(100);
    expect(ideal).toBeGreaterThan(awful);
  });
});
