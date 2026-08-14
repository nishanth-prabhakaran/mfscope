import type {
  NavRow,
  RiskMetrics,
  RollingStats,
  RollingYears,
  DrawdownPoint,
  NormalizedScheme,
  CorrelationCell,
  AnnualReturn,
} from "@/types/mf";

const DAY = 86_400_000;
const YEAR_DAYS = 365.25;
const TRADING_DAYS = 252;

// ---------- Basic stats ----------
export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
export function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
}
export function stddev(xs: number[]): number {
  return Math.sqrt(variance(xs));
}
export function median(xs: number[]): number {
  return percentile(xs, 50);
}
export function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx),
    hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}
export function skewness(xs: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const m = mean(xs);
  const s = stddev(xs);
  if (!s) return 0;
  return (n / ((n - 1) * (n - 2))) * xs.reduce((a, b) => a + ((b - m) / s) ** 3, 0);
}
export function kurtosis(xs: number[]): number {
  const n = xs.length;
  if (n < 4) return 0;
  const m = mean(xs);
  const s = stddev(xs);
  if (!s) return 0;
  const g2 = xs.reduce((a, b) => a + ((b - m) / s) ** 4, 0);
  return (
    ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * g2 - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
  );
}

// ---------- NAV helpers ----------
export function calculateCAGR(start: number, end: number, years: number): number {
  if (start <= 0 || end <= 0 || years <= 0) return 0;
  return Math.pow(end / start, 1 / years) - 1;
}

/** Find NAV at-or-before target time using binary search. */
export function findNavAt(rows: NavRow[], t: number): NavRow | null {
  if (!rows.length || t < rows[0].t) return null;
  let lo = 0,
    hi = rows.length - 1,
    ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].t <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans >= 0 ? rows[ans] : null;
}

// ---------- Rolling returns ----------
export interface RollingSeriesPoint {
  t: number;
  cagr: number;
  startT: number;
}

export function calculateRollingReturns(rows: NavRow[], years: RollingYears): RollingSeriesPoint[] {
  if (rows.length < 2) return [];
  const windowMs = years * YEAR_DAYS * DAY;
  const out: RollingSeriesPoint[] = [];
  const firstAvailable = rows[0].t + windowMs;
  // step daily
  for (let i = 0; i < rows.length; i++) {
    const end = rows[i];
    if (end.t < firstAvailable) continue;
    const start = findNavAt(rows, end.t - windowMs);
    if (!start) continue;
    const cagr = calculateCAGR(start.nav, end.nav, years);
    out.push({ t: end.t, cagr, startT: start.t });
  }
  return out;
}

export function rollingStats(series: RollingSeriesPoint[], period: RollingYears): RollingStats {
  const xs = series.map((p) => p.cagr * 100);
  if (!xs.length) {
    return {
      period,
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      std: 0,
      variance: 0,
      p5: 0,
      p25: 0,
      p75: 0,
      p95: 0,
      positivePct: 0,
      negativePct: 0,
      current: null,
      bestWindow: null,
      worstWindow: null,
    };
  }
  const best = series.reduce((a, b) => (b.cagr > a.cagr ? b : a));
  const worst = series.reduce((a, b) => (b.cagr < a.cagr ? b : a));
  return {
    period,
    count: xs.length,
    min: Math.min(...xs),
    max: Math.max(...xs),
    mean: mean(xs),
    median: median(xs),
    std: stddev(xs),
    variance: variance(xs),
    p5: percentile(xs, 5),
    p25: percentile(xs, 25),
    p75: percentile(xs, 75),
    p95: percentile(xs, 95),
    positivePct: (xs.filter((v) => v > 0).length / xs.length) * 100,
    negativePct: (xs.filter((v) => v < 0).length / xs.length) * 100,
    current: xs[xs.length - 1],
    bestWindow: { start: best.t - period * YEAR_DAYS * DAY, end: best.t, value: best.cagr * 100 },
    worstWindow: {
      start: worst.t - period * YEAR_DAYS * DAY,
      end: worst.t,
      value: worst.cagr * 100,
    },
  };
}

// ---------- Daily log returns (for risk metrics) ----------
export function dailyLogReturns(rows: NavRow[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = Math.log(rows[i].nav / rows[i - 1].nav);
    if (Number.isFinite(r)) out.push(r);
  }
  return out;
}

// ---------- Drawdown ----------
export function drawdownSeries(rows: NavRow[]): DrawdownPoint[] {
  const out: DrawdownPoint[] = [];
  let peak = -Infinity;
  let peakT = rows[0]?.t ?? 0;
  for (const r of rows) {
    if (r.nav > peak) {
      peak = r.nav;
      peakT = r.t;
    }
    out.push({ t: r.t, dd: peak > 0 ? (r.nav - peak) / peak : 0, peakT });
  }
  return out;
}

export function maxDrawdown(dd: DrawdownPoint[]): number {
  return dd.reduce((m, p) => Math.min(m, p.dd), 0);
}

export function longestRecoveryDays(rows: NavRow[]): number | null {
  if (rows.length < 2) return null;
  let peak = rows[0].nav,
    peakT = rows[0].t,
    longest = 0,
    inDD = false;
  for (const r of rows) {
    if (r.nav >= peak) {
      if (inDD) {
        longest = Math.max(longest, Math.round((r.t - peakT) / DAY));
        inDD = false;
      }
      peak = r.nav;
      peakT = r.t;
    } else inDD = true;
  }
  return longest || null;
}

// ---------- Benchmark alignment & relative metrics ----------
/** Align two NAV series to common dates and return paired log returns. */
export function alignedReturns(
  fundRows: NavRow[],
  benchRows: NavRow[],
): { fund: number[]; bench: number[] } {
  const fund: number[] = [];
  const bench: number[] = [];
  let j = 0;
  for (let i = 1; i < fundRows.length; i++) {
    const t = fundRows[i].t;
    while (j < benchRows.length - 1 && benchRows[j + 1].t <= t) j++;
    if (j > 0 && benchRows[j].t >= fundRows[i - 1].t) {
      const f0 = fundRows[i - 1].nav,
        f1 = fundRows[i].nav;
      const b0 = benchRows[j - 1]?.nav ?? benchRows[0].nav;
      const b1 = benchRows[j].nav;
      if (f0 > 0 && f1 > 0 && b0 > 0 && b1 > 0) {
        fund.push(Math.log(f1 / f0));
        bench.push(Math.log(b1 / b0));
      }
    }
  }
  return { fund, bench };
}

export function calculateBeta(fundRows: NavRow[], benchRows: NavRow[]): number {
  const { fund, bench } = alignedReturns(fundRows, benchRows);
  if (fund.length < 10) return 0;
  const cov = covariance(fund, bench);
  const varB = variance(bench);
  return varB ? cov / varB : 0;
}

export function calculateAlpha(fundRows: NavRow[], benchRows: NavRow[], riskFree = 0.065): number {
  const { fund, bench } = alignedReturns(fundRows, benchRows);
  if (fund.length < 10) return 0;
  const meanF = mean(fund) * TRADING_DAYS;
  const meanB = mean(bench) * TRADING_DAYS;
  const beta = calculateBeta(fundRows, benchRows);
  return meanF - (riskFree + beta * (meanB - riskFree));
}

export function calculateTrackingError(fundRows: NavRow[], benchRows: NavRow[]): number {
  const { fund, bench } = alignedReturns(fundRows, benchRows);
  if (fund.length < 10) return 0;
  const diffs = fund.map((f, i) => f - bench[i]);
  return stddev(diffs) * Math.sqrt(TRADING_DAYS);
}

function covariance(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2 || n !== b.length) return 0;
  const ma = mean(a),
    mb = mean(b);
  return a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0) / (n - 1);
}

// ---------- Risk metrics ----------
export function calculateRisk(
  rows: NavRow[],
  riskFree = 0.065,
  benchmarkRows?: NavRow[],
): RiskMetrics {
  const empty = {
    annualReturn: 0,
    cagr: 0,
    volatility: 0,
    downsideVol: 0,
    sharpe: 0,
    sortino: 0,
    calmar: 0,
    maxDrawdown: 0,
    avgDrawdown: 0,
    ulcerIndex: 0,
    skewness: 0,
    kurtosis: 0,
    var95: 0,
    cvar95: 0,
    recoveryDays: null,
    alpha: 0,
    beta: 0,
    trackingError: 0,
    informationRatio: 0,
  };
  if (rows.length < 30) return empty;
  const first = rows[0],
    last = rows[rows.length - 1];
  const years = (last.t - first.t) / (YEAR_DAYS * DAY);
  const cagr = calculateCAGR(first.nav, last.nav, years);
  const daily = dailyLogReturns(rows);
  const meanD = mean(daily);
  const stdD = stddev(daily);
  const annualReturn = meanD * TRADING_DAYS;
  const vol = stdD * Math.sqrt(TRADING_DAYS);
  const negDaily = daily.filter((x) => x < 0);
  const downside = stddev(negDaily) * Math.sqrt(TRADING_DAYS);
  const sharpe = vol ? (cagr - riskFree) / vol : 0;
  const sortino = downside ? (cagr - riskFree) / downside : 0;

  const dd = drawdownSeries(rows);
  const mdd = maxDrawdown(dd);
  const avgDD = mean(dd.map((p) => p.dd).filter((v) => v < 0));
  const ulcer = Math.sqrt(mean(dd.map((p) => (p.dd * 100) ** 2)));
  const calmar = mdd < 0 ? cagr / Math.abs(mdd) : 0;

  const sortedDaily = [...daily].sort((a, b) => a - b);
  const var95 = -sortedDaily[Math.floor(0.05 * sortedDaily.length)] * Math.sqrt(TRADING_DAYS);
  const tailCount = Math.max(1, Math.floor(0.05 * sortedDaily.length));
  const cvar95 = -mean(sortedDaily.slice(0, tailCount)) * Math.sqrt(TRADING_DAYS);

  const beta = benchmarkRows && benchmarkRows.length ? calculateBeta(rows, benchmarkRows) : 0;
  const alpha =
    benchmarkRows && benchmarkRows.length ? calculateAlpha(rows, benchmarkRows, riskFree) : 0;
  const trackingError =
    benchmarkRows && benchmarkRows.length ? calculateTrackingError(rows, benchmarkRows) : 0;
  const informationRatio = trackingError ? alpha / trackingError : 0;

  return {
    annualReturn,
    cagr,
    volatility: vol,
    downsideVol: downside,
    sharpe,
    sortino,
    calmar,
    maxDrawdown: mdd,
    avgDrawdown: avgDD,
    ulcerIndex: ulcer,
    skewness: skewness(daily),
    kurtosis: kurtosis(daily),
    var95,
    cvar95,
    recoveryDays: longestRecoveryDays(rows),
    alpha,
    beta,
    trackingError,
    informationRatio,
  };
}

// ---------- Point-to-point returns ----------
export const RETURN_PERIODS: { label: string; months: number | "inception" }[] = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "3Y", months: 36 },
  { label: "5Y", months: 60 },
  { label: "7Y", months: 84 },
  { label: "10Y", months: 120 },
  { label: "12Y", months: 144 },
  { label: "15Y", months: 180 },
  { label: "Since Inception", months: "inception" },
];

export function periodReturn(rows: NavRow[], months: number | "inception"): number | null {
  if (rows.length < 2) return null;
  const last = rows[rows.length - 1];
  if (months === "inception") {
    const first = rows[0];
    const years = (last.t - first.t) / (YEAR_DAYS * DAY);
    return years >= 1 ? calculateCAGR(first.nav, last.nav, years) : last.nav / first.nav - 1;
  }
  const target = last.t - months * 30.4375 * DAY;
  const start = findNavAt(rows, target);
  if (!start || start.t === last.t) return null;
  const years = (last.t - start.t) / (YEAR_DAYS * DAY);
  if (years >= 1) return calculateCAGR(start.nav, last.nav, years);
  return last.nav / start.nav - 1;
}

// ---------- XIRR ----------
export interface CashFlow {
  t: number;
  amount: number;
} // amount negative = outflow (invest), positive = inflow

export function calculateXIRR(flows: CashFlow[], guess = 0.1): number {
  if (flows.length < 2) return 0;
  const t0 = flows[0].t;
  const npv = (rate: number) =>
    flows.reduce((s, f) => s + f.amount / Math.pow(1 + rate, (f.t - t0) / (YEAR_DAYS * DAY)), 0);
  const dnpv = (rate: number) =>
    flows.reduce((s, f) => {
      const yrs = (f.t - t0) / (YEAR_DAYS * DAY);
      return s - (yrs * f.amount) / Math.pow(1 + rate, yrs + 1);
    }, 0);
  let r = guess;
  for (let i = 0; i < 100; i++) {
    const v = npv(r);
    const d = dnpv(r);
    if (!Number.isFinite(v) || !Number.isFinite(d) || d === 0) break;
    const nr = r - v / d;
    if (Math.abs(nr - r) < 1e-7) return nr;
    r = nr;
    if (r <= -0.999) r = -0.9;
  }
  return r;
}

// ---------- SIP ----------
export interface SipResult {
  totalInvested: number;
  currentValue: number;
  profit: number;
  absoluteReturn: number;
  xirr: number;
  installments: number;
}

export function simulateSIP(
  rows: NavRow[],
  monthly: number,
  startT: number,
  endT: number,
  stepUpPct = 0,
): SipResult {
  if (!rows.length || monthly <= 0) {
    return {
      totalInvested: 0,
      currentValue: 0,
      profit: 0,
      absoluteReturn: 0,
      xirr: 0,
      installments: 0,
    };
  }
  let units = 0,
    invested = 0,
    installments = 0;
  const flows: CashFlow[] = [];
  const start = new Date(startT);
  let cur = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1);
  const endCap = Math.min(endT, rows[rows.length - 1].t);
  let installment = monthly;
  let yearsCounter = 0;
  let lastYear = new Date(cur).getUTCFullYear();
  while (cur <= endCap) {
    const at = findNavAt(rows, cur);
    if (at) {
      units += installment / at.nav;
      invested += installment;
      flows.push({ t: cur, amount: -installment });
      installments++;
    }
    const d = new Date(cur);
    d.setUTCMonth(d.getUTCMonth() + 1);
    cur = d.getTime();
    if (d.getUTCFullYear() !== lastYear) {
      yearsCounter++;
      lastYear = d.getUTCFullYear();
      if (stepUpPct) installment = installment * (1 + stepUpPct / 100);
    }
  }
  const finalNav = findNavAt(rows, endCap);
  const currentValue = finalNav ? units * finalNav.nav : 0;
  flows.push({ t: endCap, amount: currentValue });
  const xirr = calculateXIRR(flows);
  return {
    totalInvested: invested,
    currentValue,
    profit: currentValue - invested,
    absoluteReturn: invested ? (currentValue - invested) / invested : 0,
    xirr,
    installments,
  };
}

export interface LumpsumResult {
  invested: number;
  currentValue: number;
  absoluteReturn: number;
  cagr: number;
  years: number;
}

export function simulateLumpsum(rows: NavRow[], amount: number, startT: number): LumpsumResult {
  const start = findNavAt(rows, startT);
  const last = rows[rows.length - 1];
  if (!start || !last)
    return { invested: amount, currentValue: 0, absoluteReturn: 0, cagr: 0, years: 0 };
  const units = amount / start.nav;
  const cv = units * last.nav;
  const years = (last.t - start.t) / (YEAR_DAYS * DAY);
  return {
    invested: amount,
    currentValue: cv,
    absoluteReturn: (cv - amount) / amount,
    cagr: years >= 1 ? calculateCAGR(start.nav, last.nav, years) : (cv - amount) / amount,
    years,
  };
}

// ---------- Scoring ----------
export interface ConsistencyInput {
  rollingStd: number; // std of long-period rolling CAGR (%)
  volatility: number; // annualised, decimal
  maxDD: number; // negative decimal
  sharpe: number;
  sortino: number;
  positivePct: number;
  recoveryDays: number | null;
}

/** Clamp to 0..100 */
const clamp01 = (v: number) => Math.max(0, Math.min(100, v));

export function calculateConsistencyScore(i: ConsistencyInput): number {
  const stability = clamp01(100 - i.rollingStd * 6); // <5% std ≈ 70+
  const vol = clamp01(100 - i.volatility * 350); // 15% vol ≈ 48
  const dd = clamp01(100 - Math.abs(i.maxDD) * 200); // 25% dd ≈ 50
  const sh = clamp01(50 + i.sharpe * 25);
  const so = clamp01(50 + i.sortino * 22);
  const pos = clamp01(i.positivePct);
  const rec = clamp01(i.recoveryDays == null ? 70 : 100 - i.recoveryDays / 12);
  return Math.round(
    stability * 0.22 + vol * 0.18 + dd * 0.18 + sh * 0.12 + so * 0.12 + pos * 0.12 + rec * 0.06,
  );
}

export interface OverallInput {
  rollingMean: number; // long-period mean %
  consistency: number; // 0..100
  maxDD: number; // negative decimal
  sharpe: number;
  sortino: number;
  volatility: number; // decimal
  alpha: number; // decimal, optional
}

export function calculateOverallScore(i: OverallInput): number {
  const ret = clamp01((i.rollingMean / 20) * 100); // 20% mean rolling = 100
  const dd = clamp01(100 - Math.abs(i.maxDD) * 200);
  const sh = clamp01(50 + i.sharpe * 25);
  const so = clamp01(50 + i.sortino * 22);
  const vol = clamp01(100 - i.volatility * 350);
  const al = clamp01(50 + i.alpha * 500);
  return Math.round(
    ret * 0.3 + i.consistency * 0.2 + dd * 0.15 + sh * 0.1 + so * 0.1 + vol * 0.1 + al * 0.05,
  );
}

export function scoreLabel(score: number): {
  label: string;
  tone: "success" | "info" | "warning" | "destructive" | "muted";
} {
  if (score >= 80) return { label: "Excellent", tone: "success" };
  if (score >= 65) return { label: "Very Good", tone: "info" };
  if (score >= 50) return { label: "Good", tone: "info" };
  if (score >= 35) return { label: "Average", tone: "warning" };
  return { label: "Poor", tone: "destructive" };
}

export function starRating(score: number): number {
  if (score >= 85) return 5;
  if (score >= 70) return 4;
  if (score >= 55) return 3;
  if (score >= 40) return 2;
  return 1;
}

// ---------- Correlation & annual returns ----------
export function correlation(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2 || n !== b.length) return 0;
  const ma = mean(a),
    mb = mean(b);
  const sa = stddev(a),
    sb = stddev(b);
  if (!sa || !sb) return 0;
  return a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0) / ((n - 1) * sa * sb);
}

/**
 * Correlation measured only across the worst market days.
 *
 * Full-period correlation understates how funds behave in a crash: correlations
 * converge toward 1 exactly when diversification is supposed to help. A pair
 * reading 0.72 over ten years can sit near 0.95 through a drawdown, so a
 * portfolio that looks diversified on the full-period matrix may not be.
 *
 * "Stress days" are the worst `pct` of days by the equal-weighted average
 * return across the selected funds — a market-wide proxy that needs no
 * benchmark series and so works for any selection.
 */
export function stressCorrelationMatrix(
  schemes: { code: number; name: string; data: NormalizedScheme }[],
  pct = 0.1,
): CorrelationCell[] {
  const out: CorrelationCell[] = [];
  const rets = schemes.map((s) => ({ ...s, daily: dailyLogReturns(s.data.rows) }));
  if (rets.length < 2) return out;

  const minLen = Math.min(...rets.map((r) => r.daily.length));
  if (minLen < 60) return out;
  const aligned = rets.map((r) => ({ ...r, daily: r.daily.slice(-minLen) }));

  // Rank days by the average move across the selection, then keep the worst.
  const avg = Array.from(
    { length: minLen },
    (_, i) => aligned.reduce((sum, r) => sum + r.daily[i], 0) / aligned.length,
  );
  const cutoffCount = Math.max(30, Math.floor(minLen * pct));
  const threshold = [...avg].sort((x, y) => x - y)[cutoffCount - 1];
  const idx: number[] = [];
  for (let i = 0; i < minLen; i++) if (avg[i] <= threshold) idx.push(i);
  if (idx.length < 20) return out;

  for (let i = 0; i < aligned.length; i++) {
    for (let j = i + 1; j < aligned.length; j++) {
      const a = idx.map((k) => aligned[i].daily[k]);
      const b = idx.map((k) => aligned[j].daily[k]);
      const value = correlation(a, b);
      out.push({
        codeA: aligned[i].code,
        nameA: aligned[i].name,
        codeB: aligned[j].code,
        nameB: aligned[j].name,
        value,
        overlap: Math.abs(value) > 0.85,
      });
    }
  }
  return out;
}

export function correlationMatrix(
  schemes: { code: number; name: string; data: NormalizedScheme }[],
): CorrelationCell[] {
  const out: CorrelationCell[] = [];
  const rets = schemes.map((s) => ({ ...s, daily: dailyLogReturns(s.data.rows) }));
  for (let i = 0; i < rets.length; i++) {
    for (let j = i + 1; j < rets.length; j++) {
      const a = rets[i],
        b = rets[j];
      const minLen = Math.min(a.daily.length, b.daily.length);
      if (minLen < 10) continue;
      const sliceA = a.daily.slice(-minLen);
      const sliceB = b.daily.slice(-minLen);
      const value = correlation(sliceA, sliceB);
      out.push({
        codeA: a.code,
        nameA: a.name,
        codeB: b.code,
        nameB: b.name,
        value,
        overlap: Math.abs(value) > 0.85,
      });
    }
  }
  return out;
}

export function annualReturns(rows: NavRow[]): AnnualReturn[] {
  if (rows.length < 2) return [];
  const byYear = new Map<number, { first: NavRow | null; last: NavRow | null }>();
  for (const r of rows) {
    const year = new Date(r.t).getUTCFullYear();
    const entry = byYear.get(year);
    if (!entry) {
      byYear.set(year, { first: r, last: r });
    } else {
      entry.last = r;
    }
  }
  const out: AnnualReturn[] = [];
  for (const [year, { first, last }] of byYear) {
    if (first && last && first !== last && first.nav > 0 && last.nav > 0) {
      out.push({ year, value: last.nav / first.nav - 1 });
    }
  }
  return out.sort((a, b) => a.year - b.year);
}

// ---------- Benchmark relative performance ----------
export interface BenchmarkComparison {
  fundCagr: number;
  benchCagr: number;
  excessCagr: number;
  alpha: number;
  beta: number;
  rSquared: number;
  trackingError: number;
  informationRatio: number;
  upCapture: number; // %
  downCapture: number; // %
  captureSpread: number; // up - down
  battingAverage: number; // % of months beating the index
  bestMonthDiff: number; // decimal
  worstMonthDiff: number; // decimal
  outperformYears: number;
  totalYears: number;
  months: number;
}

/** Month-end NAV rows. */
export function monthEndRows(rows: NavRow[]): NavRow[] {
  const byMonth = new Map<string, NavRow>();
  for (const r of rows) {
    const d = new Date(r.t);
    byMonth.set(`${d.getUTCFullYear()}-${d.getUTCMonth()}`, r);
  }
  return [...byMonth.values()].sort((a, b) => a.t - b.t);
}

/** Aligned monthly simple returns for fund and benchmark. */
export function alignedMonthlyReturns(
  fundRows: NavRow[],
  benchRows: NavRow[],
): { t: number; f: number; b: number }[] {
  const f = monthEndRows(fundRows);
  const out: { t: number; f: number; b: number }[] = [];
  for (let i = 1; i < f.length; i++) {
    const prevB = findNavAt(benchRows, f[i - 1].t);
    const curB = findNavAt(benchRows, f[i].t);
    if (!prevB || !curB || prevB.nav <= 0 || curB.nav <= 0 || prevB.t === curB.t) continue;
    out.push({ t: f[i].t, f: f[i].nav / f[i - 1].nav - 1, b: curB.nav / prevB.nav - 1 });
  }
  return out;
}

export function compareToBenchmark(
  fundRows: NavRow[],
  benchRows: NavRow[],
  riskFree = 0.065,
): BenchmarkComparison | null {
  if (fundRows.length < 30 || benchRows.length < 30) return null;
  // Restrict both to their overlapping window.
  const from = Math.max(fundRows[0].t, benchRows[0].t);
  const to = Math.min(fundRows[fundRows.length - 1].t, benchRows[benchRows.length - 1].t);
  const f = fundRows.filter((r) => r.t >= from && r.t <= to);
  const b = benchRows.filter((r) => r.t >= from && r.t <= to);
  if (f.length < 30 || b.length < 30) return null;

  const years = (to - from) / (YEAR_DAYS * DAY);
  const fundCagr = calculateCAGR(f[0].nav, f[f.length - 1].nav, years);
  const benchCagr = calculateCAGR(b[0].nav, b[b.length - 1].nav, years);

  const beta = calculateBeta(f, b);
  const alpha = calculateAlpha(f, b, riskFree);
  const trackingError = calculateTrackingError(f, b);
  const informationRatio = trackingError ? (fundCagr - benchCagr) / trackingError : 0;
  const pair = alignedReturns(f, b);
  const r = correlation(pair.fund, pair.bench);
  const rSquared = r * r;

  const monthly = alignedMonthlyReturns(f, b);
  const up = monthly.filter((m) => m.b > 0);
  const down = monthly.filter((m) => m.b < 0);
  const geo = (xs: number[]) =>
    xs.length ? xs.reduce((a, x) => a * (1 + x), 1) ** (1 / xs.length) - 1 : 0;
  const upCapture = up.length ? (geo(up.map((m) => m.f)) / geo(up.map((m) => m.b))) * 100 : 0;
  const downCapture = down.length
    ? (geo(down.map((m) => m.f)) / geo(down.map((m) => m.b))) * 100
    : 0;
  const diffs = monthly.map((m) => m.f - m.b);
  const battingAverage = monthly.length
    ? (diffs.filter((d) => d > 0).length / monthly.length) * 100
    : 0;

  const fy = annualReturns(f);
  const by = new Map(annualReturns(b).map((a) => [a.year, a.value]));
  let outperformYears = 0,
    totalYears = 0;
  for (const y of fy) {
    const bv = by.get(y.year);
    if (bv == null) continue;
    totalYears++;
    if (y.value > bv) outperformYears++;
  }

  return {
    fundCagr,
    benchCagr,
    excessCagr: fundCagr - benchCagr,
    alpha,
    beta,
    rSquared,
    trackingError,
    informationRatio,
    upCapture,
    downCapture,
    captureSpread: upCapture - downCapture,
    battingAverage,
    bestMonthDiff: diffs.length ? Math.max(...diffs) : 0,
    worstMonthDiff: diffs.length ? Math.min(...diffs) : 0,
    outperformYears,
    totalYears,
    months: monthly.length,
  };
}

/** Cumulative relative performance (fund / benchmark, rebased to 100). */
export function relativeStrengthSeries(
  fundRows: NavRow[],
  benchRows: NavRow[],
): { t: number; rel: number }[] {
  if (!fundRows.length || !benchRows.length) return [];
  const from = Math.max(fundRows[0].t, benchRows[0].t);
  const rows = fundRows.filter((r) => r.t >= from);
  if (!rows.length) return [];
  const b0 = findNavAt(benchRows, rows[0].t);
  if (!b0) return [];
  const base = rows[0].nav / b0.nav;
  const out: { t: number; rel: number }[] = [];
  for (const r of rows) {
    const bn = findNavAt(benchRows, r.t);
    if (!bn || bn.nav <= 0) continue;
    out.push({ t: r.t, rel: (r.nav / bn.nav / base) * 100 });
  }
  return out;
}
