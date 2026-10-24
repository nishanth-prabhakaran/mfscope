// Forward-looking planning math (NISM-style retirement & investment projection).

export interface RetirementInput {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  monthlyExpenseToday: number;   // ₹ gross, today's money
  inflation: number;             // % p.a. inflation before retirement
  preReturn: number;             // % p.a. expected return before retirement
  postReturn: number;            // % p.a. expected return after retirement
  existingCorpus: number;        // ₹ already saved
  currentMonthlySip: number;     // ₹ ongoing SIP
  sipStepUp: number;             // % annual step-up on SIP
  // ----- Optional advanced inputs -----
  postInflation?: number;        // % p.a. inflation after retirement (defaults to `inflation`)
  pensionIncomeToday?: number;   // ₹/month other income in retirement (today's money)
  bequestToday?: number;         // ₹ legacy amount to leave at end of life (today's money)
}

export interface AccumulationRow {
  age: number;
  year: number;
  monthlySip: number;        // SIP running during that year (after step-ups)
  annualInvested: number;    // ₹ invested during that year
  totalInvested: number;     // cumulative invested by year end
  corpus: number;            // projected corpus at year end
  required: number;          // on-track corpus needed at that age
  progressPct: number;       // corpus / required (percent)
  monthlyExpenseThen: number;// gross monthly expense at that age (today's ₹ inflated)
}

export interface DrawdownRow {
  age: number;
  grossExpense: number;      // annual expense in that retirement year
  pension: number;           // annual other income in that year
  netWithdrawal: number;     // gross - pension (what the corpus must fund)
  corpusStart: number;       // corpus at start of the year
  corpusEnd: number;         // corpus at end of the year (after withdrawal + growth)
}

export interface RetirementResult {
  yearsToRetire: number;
  yearsInRetirement: number;
  monthlyExpenseAtRetirement: number;
  annualExpenseAtRetirement: number;
  pensionAtRetirement: number;   // annual pension income at retirement (₹)
  postInflationPct: number;      // effective post-retirement inflation used
  bequestAtEnd: number;          // nominal legacy amount at life expectancy
  corpusRequired: number;
  futureValueExisting: number;
  futureValueSip: number;
  projectedCorpus: number;
  gap: number;                   // positive = shortfall
  requiredMonthlySip: number;    // total SIP needed from today (level)
  additionalMonthlySip: number;  // extra over current SIP
  surplus: boolean;
  corpusPath: { age: number; projected: number; required: number }[];
  drawdownPath: { age: number; corpus: number; annualWithdrawal: number }[];
  schedule: AccumulationRow[];       // year-by-year accumulation table
  drawdownSchedule: DrawdownRow[];   // year-by-year retirement table
  corpusLastsTillAge: number | null;
}

const clampPct = (p: number) => p / 100;

/** FV of a lump sum, compounded monthly to stay consistent with the SIP math. */
export function futureValue(pv: number, ratePct: number, years: number): number {
  const i = clampPct(ratePct) / 12;
  return pv * Math.pow(1 + i, Math.round(years * 12));
}

/** FV of a monthly SIP with optional annual step-up, compounded monthly. */
export function sipFutureValue(monthly: number, ratePct: number, years: number, stepUpPct = 0): number {
  if (monthly <= 0 || years <= 0) return 0;
  const i = clampPct(ratePct) / 12;
  const months = Math.round(years * 12);
  let fv = 0;
  let amt = monthly;
  for (let m = 0; m < months; m++) {
    fv = (fv + amt) * (1 + i);
    if ((m + 1) % 12 === 0 && stepUpPct) amt *= 1 + clampPct(stepUpPct);
  }
  return fv;
}

/** Level monthly SIP needed to reach a target FV. */
export function requiredSip(target: number, ratePct: number, years: number): number {
  if (target <= 0 || years <= 0) return 0;
  const i = clampPct(ratePct) / 12;
  const n = Math.round(years * 12);
  if (i === 0) return target / n;
  // annuity-due (invest at start of month)
  return target / (((Math.pow(1 + i, n) - 1) / i) * (1 + i));
}

/**
 * Corpus needed at retirement to fund an inflation-indexed withdrawal
 * for `years`, invested at postReturn. Uses the real-rate annuity-due formula.
 */
export function corpusForAnnuity(firstYearExpense: number, postReturnPct: number, inflationPct: number, years: number): number {
  const r = clampPct(postReturnPct);
  const g = clampPct(inflationPct);
  if (years <= 0) return 0;
  const real = (1 + r) / (1 + g) - 1;
  if (Math.abs(real) < 1e-9) return firstYearExpense * years;
  return firstYearExpense * ((1 - Math.pow(1 + real, -years)) / real) * (1 + real);
}

export function calculateRetirement(inp: RetirementInput): RetirementResult {
  const yearsToRetire = Math.max(0, inp.retirementAge - inp.currentAge);
  const yearsInRetirement = Math.max(0, inp.lifeExpectancy - inp.retirementAge);

  const postInfl = inp.postInflation ?? inp.inflation;
  const pensionToday = inp.pensionIncomeToday ?? 0;
  const bequestToday = inp.bequestToday ?? 0;

  const monthlyExpenseAtRetirement = inp.monthlyExpenseToday * Math.pow(1 + clampPct(inp.inflation), yearsToRetire);
  const annualExpenseAtRetirement = monthlyExpenseAtRetirement * 12;
  const pensionAtRetirement = pensionToday * Math.pow(1 + clampPct(postInfl), yearsToRetire);
  const netAnnualExpenseAtRetirement = Math.max(0, annualExpenseAtRetirement - pensionAtRetirement);

  // Legacy target: inflate today's ₹ to end of life, then discount to retirement day.
  const bequestAtEnd = bequestToday * Math.pow(1 + clampPct(postInfl), yearsToRetire + yearsInRetirement);
  const bequestPV = yearsInRetirement > 0
    ? bequestAtEnd / Math.pow(1 + clampPct(inp.postReturn), yearsInRetirement)
    : bequestAtEnd;

  const corpusRequired = corpusForAnnuity(netAnnualExpenseAtRetirement, inp.postReturn, postInfl, yearsInRetirement) + bequestPV;
  const futureValueExisting = futureValue(inp.existingCorpus, inp.preReturn, yearsToRetire);
  const futureValueSip = sipFutureValue(inp.currentMonthlySip, inp.preReturn, yearsToRetire, inp.sipStepUp);
  const projectedCorpus = futureValueExisting + futureValueSip;
  const gap = corpusRequired - projectedCorpus;

  const needFromSip = Math.max(0, corpusRequired - futureValueExisting);
  const requiredMonthlySip = requiredSip(needFromSip, inp.preReturn, yearsToRetire);
  const additionalMonthlySip = Math.max(0, requiredMonthlySip - inp.currentMonthlySip);

  // Accumulation path + full year-by-year schedule
  const corpusPath: RetirementResult["corpusPath"] = [];
  const schedule: AccumulationRow[] = [];
  {
    const i = clampPct(inp.preReturn) / 12;
    let corpus = inp.existingCorpus;
    let invested = inp.existingCorpus;
    let amt = inp.currentMonthlySip;
    for (let y = 0; y <= yearsToRetire; y++) {
      const remaining = yearsToRetire - y;
      const requiredNow = remaining > 0
        ? corpusRequired / Math.pow(1 + clampPct(inp.preReturn), remaining)
        : corpusRequired;
      const annualInvested = amt * 12;
      corpusPath.push({ age: inp.currentAge + y, projected: corpus, required: requiredNow });
      schedule.push({
        age: inp.currentAge + y,
        year: y,
        monthlySip: amt,
        annualInvested: y === 0 ? 0 : annualInvested,
        totalInvested: invested,
        corpus,
        required: requiredNow,
        progressPct: requiredNow > 0 ? (corpus / requiredNow) * 100 : 100,
        monthlyExpenseThen: inp.monthlyExpenseToday * Math.pow(1 + clampPct(inp.inflation), y),
      });
      if (y === yearsToRetire) break;
      for (let m = 0; m < 12; m++) corpus = (corpus + amt) * (1 + i);
      invested += annualInvested;
      if (inp.sipStepUp) amt *= 1 + clampPct(inp.sipStepUp);
    }
  }

  // Retirement drawdown path (pension-adjusted) + full schedule
  const drawdownPath: RetirementResult["drawdownPath"] = [];
  const drawdownSchedule: DrawdownRow[] = [];
  let corpusLastsTillAge: number | null = null;
  {
    let corpus = projectedCorpus;
    let grossExpense = annualExpenseAtRetirement;
    let pension = pensionAtRetirement;
    let netWithdrawal = Math.max(0, grossExpense - pension);
    for (let y = 0; y < yearsInRetirement; y++) {
      const corpusStart = corpus;
      const corpusEnd = Math.max(0, (corpus - netWithdrawal) * (1 + clampPct(inp.postReturn)));
      drawdownPath.push({ age: inp.retirementAge + y, corpus: corpusEnd, annualWithdrawal: netWithdrawal });
      drawdownSchedule.push({
        age: inp.retirementAge + y,
        grossExpense,
        pension,
        netWithdrawal,
        corpusStart,
        corpusEnd,
      });
      if (corpusEnd <= 0 && corpusLastsTillAge === null) corpusLastsTillAge = inp.retirementAge + y;
      corpus = corpusEnd;
      grossExpense *= 1 + clampPct(postInfl);
      pension *= 1 + clampPct(postInfl);
      netWithdrawal = Math.max(0, grossExpense - pension);
    }
    const corpusEnd = Math.max(0, (corpus - netWithdrawal) * (1 + clampPct(inp.postReturn)));
    drawdownPath.push({ age: inp.retirementAge + yearsInRetirement, corpus: corpusEnd, annualWithdrawal: netWithdrawal });
    drawdownSchedule.push({
      age: inp.retirementAge + yearsInRetirement,
      grossExpense,
      pension,
      netWithdrawal,
      corpusStart: corpus,
      corpusEnd,
    });
    if (corpusLastsTillAge === null && corpusEnd > 0) corpusLastsTillAge = inp.lifeExpectancy;
  }

  return {
    yearsToRetire, yearsInRetirement,
    monthlyExpenseAtRetirement, annualExpenseAtRetirement,
    pensionAtRetirement, postInflationPct: postInfl, bequestAtEnd,
    corpusRequired, futureValueExisting, futureValueSip, projectedCorpus,
    gap, requiredMonthlySip, additionalMonthlySip,
    surplus: gap <= 0,
    corpusPath, drawdownPath, schedule, drawdownSchedule, corpusLastsTillAge,
  };
}

// ---------- Investment projection ----------
export interface ProjectionInput {
  lumpsum: number;
  monthly: number;
  stepUp: number;      // % p.a.
  years: number;
  expectedReturn: number; // % p.a.
  inflation: number;      // % p.a. for real value
}

export interface ProjectionYear {
  year: number;
  invested: number;
  value: number;
  gains: number;
  realValue: number;
}

export interface ProjectionResult {
  rows: ProjectionYear[];
  totalInvested: number;
  finalValue: number;
  totalGains: number;
  realValue: number;
  multiple: number;
}

export function projectInvestment(inp: ProjectionInput): ProjectionResult {
  const i = clampPct(inp.expectedReturn) / 12;
  const rows: ProjectionYear[] = [];
  let value = inp.lumpsum;
  let invested = inp.lumpsum;
  let amt = inp.monthly;
  rows.push({ year: 0, invested, value, gains: 0, realValue: value });
  for (let y = 1; y <= Math.max(0, Math.round(inp.years)); y++) {
    for (let m = 0; m < 12; m++) {
      value = (value + amt) * (1 + i);
      invested += amt;
    }
    const real = value / Math.pow(1 + clampPct(inp.inflation), y);
    rows.push({ year: y, invested, value, gains: value - invested, realValue: real });
    if (inp.stepUp) amt *= 1 + clampPct(inp.stepUp);
  }
  const last = rows[rows.length - 1];
  return {
    rows,
    totalInvested: last.invested,
    finalValue: last.value,
    totalGains: last.value - last.invested,
    realValue: last.realValue,
    multiple: last.invested > 0 ? last.value / last.invested : 0,
  };
}

/** Scenario returns around a base expected return. */
export function scenarioReturns(base: number): { label: string; rate: number }[] {
  return [
    { label: "Conservative", rate: Math.max(1, base - 4) },
    { label: "Base", rate: base },
    { label: "Optimistic", rate: base + 3 },
  ];
}
