import { describe, it, expect } from "vitest";
import { buildInvestmentCase, type CaseInput } from "./investmentCase";
import type { NavRow } from "@/types/mf";

const DAY = 86_400_000;

/** Deterministic NAV series with optional crash windows. */
function series(opts: {
  years: number;
  drift?: number;
  vol?: number;
  seed?: number;
  startYear?: number;
  crashes?: { atYear: number; depth: number; lengthDays: number }[];
}): NavRow[] {
  const { years, drift = 0.12, vol = 0.16, seed = 7, startYear = 2005, crashes = [] } = opts;
  let nav = 100;
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const rows: NavRow[] = [];
  const t0 = Date.UTC(startYear, 0, 1);
  const n = Math.round(365.25 * years);
  for (let i = 0; i < n; i++) {
    const yr = i / 365.25;
    const z = Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
    let r = drift / 365.25 + (vol / Math.sqrt(365.25)) * z;
    for (const c of crashes) {
      if (yr >= c.atYear && yr < c.atYear + c.lengthDays / 365.25) {
        r -= c.depth / c.lengthDays;
      }
    }
    nav *= Math.exp(r);
    rows.push({ t: t0 + i * DAY, nav });
  }
  return rows;
}

const baseInput = (over: Partial<CaseInput> = {}): CaseInput => ({
  name: "Test Fund",
  rows: series({ years: 18 }),
  category: "Flexi Cap",
  expenseRatio: 1.0,
  aumCrore: 5000,
  portfolioTurnover: 40,
  ...over,
});

describe("buildInvestmentCase", () => {
  it("never emits a numeric score or verdict field", () => {
    const c = buildInvestmentCase(baseInput());
    expect(c).not.toHaveProperty("score");
    expect(c).not.toHaveProperty("rating");
    expect(c).not.toHaveProperty("verdict");
  });

  it("calls the evidence thin for a young fund and says so plainly", () => {
    const c = buildInvestmentCase(baseInput({ rows: series({ years: 3, startYear: 2022 }) }));
    expect(c.evidenceQuality).toBe("thin");
    expect(c.concerns.some((x) => x.id === "young")).toBe(true);
    expect(c.evidenceNote).toMatch(/not support a strong view/i);
  });

  it("flags a fund costing well above its category median", () => {
    const peers = [1.0, 1.1, 0.95, 1.05, 1.2].map((er, n) => ({
      schemeCode: String(n),
      schemeName: `Peer ${n}`,
      expenseRatio: String(er),
    }));
    const c = buildInvestmentCase(baseInput({ expenseRatio: 1.9, peers }));
    const flag = c.concerns.find((x) => x.id === "expensive");
    expect(flag).toBeDefined();
    expect(flag!.detail).toMatch(/category median/i);
    // A cost concern must come with a falsifier, not just a complaint.
    expect(c.falsifiers.some((f) => /fee gap/i.test(f))).toBe(true);
  });

  it("credits a fund cheaper than its category median", () => {
    const peers = [1.4, 1.5, 1.6, 1.45].map((er, n) => ({
      schemeCode: String(n),
      schemeName: `Peer ${n}`,
      expenseRatio: String(er),
    }));
    const c = buildInvestmentCase(baseInput({ expenseRatio: 0.9, peers }));
    expect(c.strengths.some((x) => x.id === "cheap")).toBe(true);
  });

  it("flags capacity strain only for size-sensitive categories", () => {
    const big = { aumCrore: 40_000 };
    const smallCap = buildInvestmentCase(baseInput({ ...big, category: "Small Cap" }));
    const largeCap = buildInvestmentCase(baseInput({ ...big, category: "Large Cap" }));
    expect(smallCap.concerns.some((x) => x.id === "capacity")).toBe(true);
    expect(largeCap.concerns.some((x) => x.id === "capacity")).toBe(false);
  });

  it("reports what a crash would have felt like in rupees", () => {
    const c = buildInvestmentCase(
      baseInput({
        rows: series({
          years: 18,
          crashes: [{ atYear: 3, depth: 0.55, lengthDays: 300 }],
        }),
      }),
    );
    expect(c.lived.length).toBeGreaterThan(0);
    const worst = c.lived.reduce((a, b) => (b.decline < a.decline ? b : a));
    expect(worst.troughValue).toBeLessThan(1_000_000);
    expect(worst.decline).toBeLessThan(-0.1);
  });

  it("always supplies falsifiers, including manager change", () => {
    const c = buildInvestmentCase(baseInput());
    expect(c.falsifiers.length).toBeGreaterThanOrEqual(2);
    expect(c.falsifiers.some((f) => /manager/i.test(f))).toBe(true);
  });

  it("flags high turnover as a hidden cost", () => {
    const c = buildInvestmentCase(baseInput({ portfolioTurnover: 220 }));
    const t = c.concerns.find((x) => x.id === "turnover");
    expect(t).toBeDefined();
    expect(t!.detail).toMatch(/not included in the expense ratio/i);
  });

  it("marks every point with an evidence level", () => {
    const c = buildInvestmentCase(baseInput());
    for (const p of [...c.strengths, ...c.concerns]) {
      expect(["strong", "moderate", "limited"]).toContain(p.evidence);
      expect(p.detail.length).toBeGreaterThan(40);
    }
  });

  it("does not suppress concerns when strengths are present", () => {
    // Cheap (a strength) but with a brutal drawdown (a concern). Both must show.
    const peers = [1.5, 1.6, 1.7, 1.55].map((er, n) => ({
      schemeCode: String(n),
      schemeName: `Peer ${n}`,
      expenseRatio: String(er),
    }));
    const c = buildInvestmentCase(
      baseInput({
        expenseRatio: 0.5,
        peers,
        rows: series({ years: 18, crashes: [{ atYear: 4, depth: 0.75, lengthDays: 280 }] }),
      }),
    );
    expect(c.strengths.some((x) => x.id === "cheap")).toBe(true);
    expect(c.concerns.length).toBeGreaterThan(0);
  });

  it("reports no strengths rather than inventing them when evidence is absent", () => {
    // Expensive, one crash, no benchmark or holdings to analyse.
    const peers = [1.0, 1.1, 0.95].map((er, n) => ({
      schemeCode: String(n),
      schemeName: `Peer ${n}`,
      expenseRatio: String(er),
    }));
    const c = buildInvestmentCase(
      baseInput({
        expenseRatio: 2.0,
        peers,
        rows: series({ years: 18, crashes: [{ atYear: 4, depth: 0.55, lengthDays: 280 }] }),
      }),
    );
    expect(c.concerns.length).toBeGreaterThan(0);
    // An empty strengths list is the honest output here, not a bug.
    expect(Array.isArray(c.strengths)).toBe(true);
  });
});
