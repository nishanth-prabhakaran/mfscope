// Systematic Withdrawal Plan (SWP) math — historical backtest + forward projection.
import type { NavRow } from "@/types/mf";
import { findNavAt, calculateXIRR, type CashFlow } from "./calculators";

const DAY = 86_400_000;
const YEAR_DAYS = 365.25;

export interface SwpPoint {
  t: number;
  balance: number;
  withdrawn: number;   // cumulative
  withdrawal: number;  // this month's withdrawal
}

export interface SwpResult {
  invested: number;
  totalWithdrawn: number;
  finalValue: number;
  months: number;
  monthsSurvived: number;
  depletedAt: number | null;   // timestamp when corpus hit zero
  xirr: number;
  maxWithdrawal: number;       // last (possibly stepped-up) withdrawal
  path: SwpPoint[];
}

export interface SwpInput {
  initial: number;
  monthlyWithdrawal: number;
  /** annual increase of the withdrawal amount, % */
  annualIncrease: number;
  startT: number;
  endT: number;
}

/** Backtest an SWP against real NAV history. */
export function simulateSWP(rows: NavRow[], inp: SwpInput): SwpResult {
  const empty: SwpResult = {
    invested: inp.initial, totalWithdrawn: 0, finalValue: 0, months: 0, monthsSurvived: 0,
    depletedAt: null, xirr: 0, maxWithdrawal: inp.monthlyWithdrawal, path: [],
  };
  if (!rows.length || inp.initial <= 0) return empty;
  const startNav = findNavAt(rows, inp.startT);
  if (!startNav) return empty;

  const endCap = Math.min(inp.endT, rows[rows.length - 1].t);
  let units = inp.initial / startNav.nav;
  let withdrawal = inp.monthlyWithdrawal;
  let cumWithdrawn = 0;
  let months = 0;
  let depletedAt: number | null = null;
  const path: SwpPoint[] = [{ t: startNav.t, balance: inp.initial, withdrawn: 0, withdrawal: 0 }];
  const flows: CashFlow[] = [{ t: startNav.t, amount: -inp.initial }];

  const s = new Date(startNav.t);
  let cur = Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, s.getUTCDate());
  let lastYear = new Date(cur).getUTCFullYear();

  while (cur <= endCap && depletedAt === null) {
    const at = findNavAt(rows, cur);
    if (at) {
      const balance = units * at.nav;
      const take = Math.min(withdrawal, balance);
      units -= take / at.nav;
      cumWithdrawn += take;
      months++;
      if (take > 0) flows.push({ t: cur, amount: take });
      const after = units * at.nav;
      path.push({ t: cur, balance: after, withdrawn: cumWithdrawn, withdrawal: take });
      if (after <= 1) depletedAt = cur;
    }
    const d = new Date(cur);
    d.setUTCMonth(d.getUTCMonth() + 1);
    cur = d.getTime();
    if (d.getUTCFullYear() !== lastYear) {
      lastYear = d.getUTCFullYear();
      if (inp.annualIncrease) withdrawal *= 1 + inp.annualIncrease / 100;
    }
  }

  const finalRow = findNavAt(rows, depletedAt ?? endCap);
  const finalValue = finalRow ? Math.max(0, units * finalRow.nav) : 0;
  flows.push({ t: depletedAt ?? endCap, amount: finalValue });

  return {
    invested: inp.initial,
    totalWithdrawn: cumWithdrawn,
    finalValue,
    months: Math.round((endCap - startNav.t) / (YEAR_DAYS * DAY) * 12),
    monthsSurvived: months,
    depletedAt,
    xirr: calculateXIRR(flows),
    maxWithdrawal: withdrawal,
    path,
  };
}

export interface SwpProjectionInput {
  initial: number;
  monthlyWithdrawal: number;
  annualIncrease: number;   // % p.a. step-up of withdrawal
  expectedReturn: number;   // % p.a.
  inflation: number;        // % p.a. (for real value of the corpus)
  years: number;
}

export interface SwpProjectionYear {
  year: number;
  balance: number;
  withdrawnThisYear: number;
  cumulativeWithdrawn: number;
  realBalance: number;
}

export interface SwpProjectionResult {
  rows: SwpProjectionYear[];
  finalBalance: number;
  totalWithdrawn: number;
  depletedInYear: number | null;
  /** Monthly withdrawal that keeps the corpus intact for the full horizon. */
  sustainableMonthly: number;
}

export function projectSWP(inp: SwpProjectionInput): SwpProjectionResult {
  const run = (monthly: number) => {
    const i = inp.expectedReturn / 100 / 12;
    let bal = inp.initial;
    let w = monthly;
    let cum = 0;
    const rows: SwpProjectionYear[] = [
      { year: 0, balance: bal, withdrawnThisYear: 0, cumulativeWithdrawn: 0, realBalance: bal },
    ];
    let depleted: number | null = null;
    for (let y = 1; y <= Math.max(1, Math.round(inp.years)); y++) {
      let yearW = 0;
      for (let m = 0; m < 12; m++) {
        const take = Math.min(w, bal);
        bal = (bal - take) * (1 + i);
        yearW += take;
        cum += take;
        if (bal <= 1 && depleted === null) { bal = 0; depleted = y; }
      }
      rows.push({
        year: y,
        balance: Math.max(0, bal),
        withdrawnThisYear: yearW,
        cumulativeWithdrawn: cum,
        realBalance: Math.max(0, bal) / Math.pow(1 + inp.inflation / 100, y),
      });
      if (inp.annualIncrease) w *= 1 + inp.annualIncrease / 100;
    }
    return { rows, depleted, final: Math.max(0, bal), total: cum };
  };

  const base = run(inp.monthlyWithdrawal);

  // Bisect for the largest monthly withdrawal that leaves the corpus >= 0 at the horizon.
  let lo = 0;
  let hi = Math.max(inp.monthlyWithdrawal * 4, inp.initial / 12);
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (run(mid).final > 0) lo = mid; else hi = mid;
  }

  return {
    rows: base.rows,
    finalBalance: base.final,
    totalWithdrawn: base.total,
    depletedInYear: base.depleted,
    sustainableMonthly: lo,
  };
}
