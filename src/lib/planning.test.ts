import { describe, it, expect } from "vitest";
import { calculateRetirement } from "./planning";

const base = {
  currentAge: 30,
  retirementAge: 60,
  lifeExpectancy: 85,
  monthlyExpenseToday: 50000,
  inflation: 6,
  preReturn: 12,
  postReturn: 8,
  existingCorpus: 500000,
  currentMonthlySip: 15000,
  sipStepUp: 5,
};

describe("calculateRetirement schedule", () => {
  it("builds a year-by-year accumulation table from current age to retirement age", () => {
    const r = calculateRetirement(base);
    expect(r.schedule.length).toBe(base.retirementAge - base.currentAge + 1);
    expect(r.schedule[0].age).toBe(30);
    expect(r.schedule[r.schedule.length - 1].age).toBe(60);
    // Corpus at retirement equals projected corpus; required converges to corpusRequired
    expect(r.schedule[r.schedule.length - 1].corpus).toBeCloseTo(r.projectedCorpus, 0);
    expect(r.schedule[r.schedule.length - 1].required).toBeCloseTo(r.corpusRequired, 0);
    // Total invested grows by the SIP each year
    const last = r.schedule[r.schedule.length - 1];
    const prev = r.schedule[r.schedule.length - 2];
    expect(prev.totalInvested).toBeLessThan(last.totalInvested);
    // Expense column inflates with age
    expect(r.schedule[r.schedule.length - 1].monthlyExpenseThen)
      .toBeGreaterThan(r.schedule[0].monthlyExpenseThen);
  });

  it("builds a drawdown table from retirement age to life expectancy", () => {
    const r = calculateRetirement(base);
    expect(r.drawdownSchedule.length).toBe(base.lifeExpectancy - base.retirementAge + 1);
    expect(r.drawdownSchedule[0].age).toBe(60);
    expect(r.drawdownSchedule[r.drawdownSchedule.length - 1].age).toBe(85);
    // Expenses inflate every retirement year
    const dd = r.drawdownSchedule;
    expect(dd[1].grossExpense).toBeGreaterThan(dd[0].grossExpense);
    // Corpus end of one year is the start of the next
    expect(dd[0].corpusEnd).toBeCloseTo(dd[1].corpusStart, 0);
  });

  it("reduces the corpus required when pension income is provided", () => {
    const without = calculateRetirement(base);
    const withPension = calculateRetirement({ ...base, pensionIncomeToday: 15000 });
    expect(withPension.corpusRequired).toBeLessThan(without.corpusRequired);
    // Corpus must still fund the net withdrawal
    expect(withPension.drawdownSchedule[0].netWithdrawal)
      .toBeCloseTo(withPension.drawdownSchedule[0].grossExpense - withPension.drawdownSchedule[0].pension, 0);
    expect(withPension.pensionAtRetirement).toBeGreaterThan(0);
  });

  it("increases the corpus required when a legacy target is set", () => {
    const without = calculateRetirement(base);
    const withBequest = calculateRetirement({ ...base, bequestToday: 5000000 });
    expect(withBequest.corpusRequired).toBeGreaterThan(without.corpusRequired);
    expect(withBequest.bequestAtEnd).toBeGreaterThan(5000000);
  });

  it("uses a separate post-retirement inflation when given", () => {
    const r = calculateRetirement({ ...base, postInflation: 4 });
    expect(r.postInflationPct).toBe(4);
    const rDefault = calculateRetirement(base);
    expect(r.corpusRequired).toBeLessThan(rDefault.corpusRequired);
  });
});
