/**
 * Crisis stress testing and capture ratios.
 *
 * A max-drawdown figure is abstract. "This fund fell 46% between January and
 * March 2020 and took 14 months to get back" is not — and it is the same fact.
 * Replaying named episodes makes risk legible in a way a summary statistic
 * cannot, which matters most for the beginners the profiler is aimed at.
 */

import type { NavRow } from "@/types/mf";

export interface CrisisPeriod {
  id: string;
  label: string;
  /** Abbreviated label for narrow screens, where full names blow up the table. */
  short: string;
  /** Inclusive ISO dates bounding the decline. */
  start: string;
  end: string;
  blurb: string;
}

/**
 * Indian-market episodes, dated to the domestic decline rather than the global
 * headline date — the Nifty's 2008 low came in October, months after the US
 * peak, so using US dates would misstate what an Indian investor experienced.
 */
export const CRISES: CrisisPeriod[] = [
  {
    id: "gfc-2008",
    label: "Global Financial Crisis",
    short: "2008 GFC",
    start: "2008-01-08",
    end: "2009-03-09",
    blurb: "The Nifty lost roughly 60% peak to trough over fourteen months.",
  },
  {
    id: "taper-2013",
    label: "Taper Tantrum",
    short: "2013 Taper",
    start: "2013-05-20",
    end: "2013-08-28",
    blurb: "The rupee slid and foreign money left; mid-caps fell hardest.",
  },
  {
    id: "midcap-2018",
    label: "Mid-cap unwind & IL&FS",
    short: "2018 Mid-cap",
    start: "2018-01-15",
    end: "2019-02-19",
    blurb: "A credit shock after IL&FS defaulted. Small and mid-caps fell far more than the index.",
  },
  {
    id: "covid-2020",
    label: "COVID crash",
    short: "2020 COVID",
    start: "2020-01-14",
    end: "2020-03-23",
    blurb: "The fastest fall on record — roughly 38% in ten weeks.",
  },
  {
    id: "rates-2022",
    label: "2022 rate shock",
    short: "2022 Rates",
    start: "2021-10-18",
    end: "2022-06-17",
    blurb: "Global tightening and an inflation scare; growth stocks derated.",
  },
];

export interface CrisisResult {
  crisis: CrisisPeriod;
  /** Peak-to-trough fall within the window, as a negative decimal. */
  decline: number;
  /** Days from the trough back to the pre-crisis peak; null if never recovered. */
  recoveryDays: number | null;
  recovered: boolean;
  /** True when the fund did not yet exist for the whole window. */
  insufficientHistory: boolean;
  troughDate: number | null;
}

const DAY = 86_400_000;

function valueAt(rows: NavRow[], t: number): NavRow | null {
  // Last observation at or before t — NAVs skip weekends and holidays.
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
}

export function stressTest(rows: NavRow[], crisis: CrisisPeriod): CrisisResult {
  const start = Date.parse(crisis.start);
  const end = Date.parse(crisis.end);
  const base: CrisisResult = {
    crisis,
    decline: 0,
    recoveryDays: null,
    recovered: false,
    insufficientHistory: true,
    troughDate: null,
  };
  if (rows.length < 2) return base;

  // The fund must have existed before the window opened, or the "decline" would
  // just be measuring its first days of life.
  if (rows[0].t > start - 30 * DAY) return base;

  // Include a short lookback so the pre-crisis peak is captured even when the
  // decline began a little before the nominal start date. Anchoring on the NAV
  // exactly at `start` would understate any fall already underway.
  const window = rows.filter((r) => r.t >= start - 45 * DAY && r.t <= end);
  if (window.length < 5) return base;

  // Largest peak-to-trough fall within the window, measured from a running
  // peak — the standard definition, and robust to where the peak actually sits.
  let runningPeak = window[0].nav;
  let peakAtWorst = window[0].nav;
  let decline = 0;
  let troughT: number | null = null;

  for (const r of window) {
    if (r.nav > runningPeak) runningPeak = r.nav;
    const dd = r.nav / runningPeak - 1;
    if (dd < decline) {
      decline = dd;
      troughT = r.t;
      peakAtWorst = runningPeak;
    }
  }

  if (troughT == null) {
    return { ...base, insufficientHistory: false, decline: 0 };
  }

  // Recovery: first NAV at or above the pre-crisis peak, after the trough.
  let recoveryDays: number | null = null;
  for (const r of rows) {
    if (r.t <= troughT) continue;
    if (r.nav >= peakAtWorst) {
      recoveryDays = Math.round((r.t - troughT) / DAY);
      break;
    }
  }

  return {
    crisis,
    decline,
    recoveryDays,
    recovered: recoveryDays != null,
    insufficientHistory: false,
    troughDate: troughT,
  };
}

export function stressTestAll(rows: NavRow[]): CrisisResult[] {
  return CRISES.map((c) => stressTest(rows, c));
}

// ---------------------------------------------------------------- capture

export interface CaptureRatios {
  /** % of the benchmark's gain captured on its up months. 100 = matched it. */
  upside: number;
  /** % of the benchmark's loss suffered on its down months. Lower is better. */
  downside: number;
  /** upside / downside. Above 1 means asymmetry in the investor's favour. */
  ratio: number;
  months: number;
}

/** Compounds a series of NAVs into monthly returns keyed by year-month. */
function monthlyReturns(rows: NavRow[]): Map<string, number> {
  const byMonth = new Map<string, { first: number; last: number }>();
  for (const r of rows) {
    const d = new Date(r.t);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const entry = byMonth.get(key);
    if (!entry) byMonth.set(key, { first: r.nav, last: r.nav });
    else entry.last = r.nav;
  }
  const out = new Map<string, number>();
  for (const [k, v] of byMonth) if (v.first > 0) out.set(k, v.last / v.first - 1);
  return out;
}

/**
 * Upside/downside capture, the standard institutional pair.
 *
 * "Captures 95% of rallies but only 78% of falls" tells an investor something
 * neither CAGR nor volatility does: whether the fund's risk was taken on the
 * side that pays. Computed on months where the benchmark rose or fell.
 */
export function captureRatios(rows: NavRow[], benchmarkRows: NavRow[]): CaptureRatios | null {
  if (rows.length < 60 || benchmarkRows.length < 60) return null;
  const fund = monthlyReturns(rows);
  const bench = monthlyReturns(benchmarkRows);

  let upF = 0;
  let upB = 0;
  let downF = 0;
  let downB = 0;
  let months = 0;

  for (const [k, b] of bench) {
    const f = fund.get(k);
    if (f == null) continue;
    months++;
    if (b > 0) {
      upF += f;
      upB += b;
    } else if (b < 0) {
      downF += f;
      downB += b;
    }
  }

  if (months < 24 || upB === 0 || downB === 0) return null;

  const upside = (upF / upB) * 100;
  const downside = (downF / downB) * 100;
  return {
    upside,
    downside,
    ratio: downside === 0 ? Infinity : upside / downside,
    months,
  };
}
