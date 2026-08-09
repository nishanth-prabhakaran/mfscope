/**
 * Risk profiler & suitability matcher.
 *
 * Two ideas drive this module:
 *
 * 1. Risk *capacity* (what the investor's situation can absorb) and risk
 *    *tolerance* (what their temperament can absorb) are scored separately,
 *    and the final band is the LOWER of the two. A 20-year horizon does not
 *    help someone who sells at the first 15% drawdown.
 *
 * 2. A fund's risk band comes primarily from its own realised behaviour
 *    (volatility, max drawdown, worst rolling outcome at the investor's
 *    horizon), with the category only used as a mild sanity anchor. Two
 *    "Flexi Cap" funds can behave very differently.
 *
 * Nothing here is investment advice — it compares historical fund behaviour
 * against self-reported comfort, and history is not a forecast.
 */

import type { NavRow, RollingYears } from "@/types/mf";
import {
  calculateRisk,
  calculateRollingReturns,
  rollingStats,
  drawdownSeries,
  maxDrawdown,
} from "./calculators";
import { guessCategory, type Category } from "./categories";

// ---------------------------------------------------------------- bands

export type RiskBand = 1 | 2 | 3 | 4 | 5;

export interface BandMeta {
  band: RiskBand;
  label: string;
  /** One line an absolute beginner can act on. */
  blurb: string;
  /** Tailwind text colour token. */
  tone: string;
}

export const BANDS: Record<RiskBand, BandMeta> = {
  1: {
    band: 1,
    label: "Conservative",
    blurb: "Capital safety first. Short horizon or low comfort with any fall.",
    tone: "text-sky-400",
  },
  2: {
    band: 2,
    label: "Moderately Conservative",
    blurb: "Some growth, but large falls would be hard to sit through.",
    tone: "text-teal-400",
  },
  3: {
    band: 3,
    label: "Balanced",
    blurb: "Comfortable with normal equity swings for long-term growth.",
    tone: "text-emerald-400",
  },
  4: {
    band: 4,
    label: "Growth",
    blurb: "Long horizon and steady nerves through deep drawdowns.",
    tone: "text-warning",
  },
  5: {
    band: 5,
    label: "Aggressive",
    blurb: "Maximum long-term growth, accepting severe interim losses.",
    tone: "text-orange-400",
  },
};

// ---------------------------------------------------------------- questions

/**
 * "gate" questions are deliberately NOT scored. They decide whether the person
 * should be buying an equity fund at all — a question most beginners skip
 * straight past. Folding them into the risk score would let a high score
 * paper over "you have credit-card debt and no emergency fund".
 */
export type Dimension = "capacity" | "tolerance" | "gate";

export interface QuestionOption {
  label: string;
  /** 0 (lowest risk appetite/capacity) → 4 (highest). */
  value: number;
  /** Optional clarifier shown under the option. */
  note?: string;
}

export interface Question {
  id: string;
  dimension: Dimension;
  text: string;
  help?: string;
  options: QuestionOption[];
}

export const QUESTIONS: Question[] = [
  {
    id: "debt",
    dimension: "gate",
    text: "Do you have any high-interest debt right now?",
    help: "Credit cards and personal loans charge far more than any fund reliably earns.",
    options: [
      { label: "Yes — credit card or personal loan", value: 0 },
      { label: "Only a home or education loan", value: 1 },
      { label: "No high-interest debt", value: 2 },
    ],
  },
  {
    id: "insurance",
    dimension: "gate",
    text: "Do you have health insurance?",
    help: "A hospital bill without cover forces you to sell investments at the worst possible time.",
    options: [
      { label: "No cover", value: 0 },
      { label: "Employer cover only", value: 1 },
      { label: "Yes, my own policy", value: 2 },
    ],
  },
  {
    id: "horizon",
    dimension: "capacity",
    text: "When will you need this money back?",
    help: "The single biggest factor. Equity needs time to recover from bad years.",
    options: [
      { label: "Within 2 years", value: 0 },
      { label: "2 – 4 years", value: 1 },
      { label: "5 – 7 years", value: 2 },
      { label: "8 – 12 years", value: 3 },
      { label: "More than 12 years", value: 4 },
    ],
  },
  {
    id: "emergency",
    dimension: "capacity",
    text: "Do you have an emergency fund set aside separately?",
    help: "Without one, a job loss during a market fall forces you to sell at the worst time.",
    options: [
      { label: "No emergency fund yet", value: 0 },
      { label: "1 – 3 months of expenses", value: 1.5 },
      { label: "About 6 months of expenses", value: 3 },
      { label: "6+ months, plus health insurance", value: 4 },
    ],
  },
  {
    id: "income",
    dimension: "capacity",
    text: "How stable is your income?",
    options: [
      { label: "Irregular or between jobs", value: 0 },
      { label: "Self-employed / variable", value: 1.5 },
      { label: "Salaried, single income", value: 3 },
      { label: "Salaried, dual income or secure", value: 4 },
    ],
  },
  {
    id: "share",
    dimension: "capacity",
    text: "What share of your total savings is going into this?",
    options: [
      { label: "Nearly all of it", value: 0 },
      { label: "About half", value: 1.5 },
      { label: "A quarter or so", value: 3 },
      { label: "A small part — I invest monthly from surplus", value: 4 },
    ],
  },
  {
    id: "drawdown",
    dimension: "tolerance",
    text: "You invest ₹1,00,000. Eight months later it is worth ₹68,000. What do you actually do?",
    help: "This is not hypothetical — equity funds fell roughly this much in 2008 and again in March 2020.",
    options: [
      { label: "Sell everything — I can't watch that", value: 0 },
      { label: "Sell part of it to stop the bleeding", value: 1 },
      { label: "Do nothing and wait it out", value: 2 },
      { label: "Do nothing, and keep my SIP running", value: 3.2 },
      { label: "Invest more while prices are low", value: 4 },
    ],
  },
  {
    id: "experience",
    dimension: "tolerance",
    text: "Have you held investments through a real market crash?",
    help: "What people did last time predicts behaviour far better than what they expect to do.",
    options: [
      { label: "I've never invested in markets", value: 1 },
      { label: "I have, and I sold during the fall", value: 0 },
      { label: "I have, and I held on nervously", value: 2 },
      { label: "I held through 2020 without flinching", value: 3.2 },
      { label: "I've held through 2008 and 2020", value: 4 },
    ],
  },
  {
    id: "badyear",
    dimension: "tolerance",
    text: "Which statement sounds most like you?",
    options: [
      { label: "Losing money in any year is unacceptable", value: 0 },
      { label: "A small loss is tolerable, a big one is not", value: 1.3 },
      { label: "Down years are the price of long-term growth", value: 2.7 },
      { label: "A −30% year is normal and I'd ignore it", value: 4 },
    ],
  },
];

export type Answers = Record<string, number>;

/** Horizon in years implied by the horizon answer, used for gating and window choice. */
export const HORIZON_YEARS: Record<number, number> = { 0: 1.5, 1: 3, 2: 6, 3: 10, 4: 15 };

export interface ProfileResult {
  band: RiskBand;
  capacityScore: number; // 0–100
  toleranceScore: number; // 0–100
  /** Which dimension held the band down — the useful thing to explain. */
  limitedBy: Dimension | "balanced";
  horizonYears: number;
  /** Nearest rolling window we can actually evaluate for this horizon. */
  horizonWindow: RollingYears;
}

const ROLLING_CHOICES: RollingYears[] = [1, 3, 5, 7, 10, 12, 15];

function nearestWindow(years: number): RollingYears {
  return ROLLING_CHOICES.reduce((best, p) =>
    Math.abs(p - years) < Math.abs(best - years) ? p : best,
  );
}

function dimensionScore(answers: Answers, dim: Dimension): number {
  const qs = QUESTIONS.filter((q) => q.dimension === dim);
  const vals = qs.map((q) => answers[q.id]).filter((v) => typeof v === "number");
  if (!vals.length) return 0;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return (avg / 4) * 100;
}

export function scoreProfile(answers: Answers): ProfileResult {
  const capacityScore = dimensionScore(answers, "capacity");
  const toleranceScore = dimensionScore(answers, "tolerance");

  // The binding constraint — deliberately the lower of the two.
  const effective = Math.min(capacityScore, toleranceScore);
  const gap = capacityScore - toleranceScore;

  const band: RiskBand =
    effective < 20 ? 1 : effective < 40 ? 2 : effective < 60 ? 3 : effective < 80 ? 4 : 5;

  const horizonIdx = answers.horizon ?? 2;
  const horizonYears = HORIZON_YEARS[horizonIdx] ?? 6;

  return {
    band,
    capacityScore,
    toleranceScore,
    limitedBy: Math.abs(gap) < 8 ? "balanced" : gap > 0 ? "tolerance" : "capacity",
    horizonYears,
    horizonWindow: nearestWindow(horizonYears),
  };
}

// ---------------------------------------------------------------- fund banding

/** Mild category prior on a 0–100 risk scale. Only nudges the realised numbers. */
const CATEGORY_PRIOR: Record<Category, number> = {
  Arbitrage: 8,
  "Balanced Advantage": 30,
  "Aggressive Hybrid": 42,
  Index: 58,
  "Large Cap": 55,
  ELSS: 65,
  "Flexi Cap": 63,
  "Multi Cap": 68,
  "Large & Mid Cap": 70,
  Value: 66,
  Contra: 66,
  Focused: 72,
  "Mid Cap": 80,
  "Small Cap": 95,
};

/** Linear 0–100 mapping of `v` within [lo, hi], clamped. */
function scale(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
}

export interface FundRisk {
  band: RiskBand;
  score: number; // 0–100
  volatility: number; // decimal, e.g. 0.18
  maxDrawdown: number; // negative decimal, e.g. -0.46
  recoveryDays: number | null;
  /** Worst rolling CAGR (%) at the investor's horizon window; null if too little history. */
  worstAtHorizon: number | null;
  /** % of rolling windows at the horizon that ended positive. */
  positivePctAtHorizon: number | null;
  horizonWindow: RollingYears;
  /** True when the fund has less history than the horizon window needs. */
  shortHistory: boolean;
  category: Category | null;
  historyYears: number;
}

export function analyseFundRisk(
  name: string,
  rows: NavRow[],
  horizonWindow: RollingYears,
): FundRisk {
  const category = guessCategory(name);
  const risk = calculateRisk(rows, 0.065);
  const mdd = maxDrawdown(drawdownSeries(rows));
  const historyYears =
    rows.length > 1 ? (rows[rows.length - 1].t - rows[0].t) / (365.25 * 86_400_000) : 0;

  const series = calculateRollingReturns(rows, horizonWindow);
  const stats = series.length ? rollingStats(series, horizonWindow) : null;

  // Realised behaviour carries most of the weight; category is a light anchor.
  const volPart = scale(risk.volatility, 0.02, 0.32);
  const ddPart = scale(Math.abs(mdd), 0.03, 0.6);
  const prior = category ? CATEGORY_PRIOR[category] : 60;

  const score = 0.42 * volPart + 0.38 * ddPart + 0.2 * prior;
  // Band 1 is reserved for genuinely cash-like funds (arbitrage/liquid); a
  // balanced-advantage fund with real equity exposure belongs in band 2.
  const band: RiskBand = score < 15 ? 1 : score < 38 ? 2 : score < 58 ? 3 : score < 76 ? 4 : 5;

  return {
    band,
    score,
    volatility: risk.volatility,
    maxDrawdown: mdd,
    recoveryDays: risk.recoveryDays,
    worstAtHorizon: stats ? stats.min : null,
    positivePctAtHorizon: stats ? stats.positivePct : null,
    horizonWindow,
    shortHistory: historyYears < horizonWindow,
    category,
    historyYears,
  };
}

// ---------------------------------------------------------------- gates

/**
 * Checks that run BEFORE any fund is suggested.
 *
 * The honest answer to "which fund should I buy" is sometimes "none yet".
 * A shortlist shown to someone with no emergency fund, credit-card debt, or a
 * two-year horizon isn't helpful — it's harmful, because acting on it is worse
 * than doing nothing. These gates surface that instead of quietly ranking funds.
 */
export type GateSeverity = "block" | "warn";

export interface Gate {
  id: string;
  severity: GateSeverity;
  title: string;
  detail: string;
  /** What to do instead, concretely. */
  action: string;
}

export function evaluateGates(answers: Answers): Gate[] {
  const gates: Gate[] = [];
  const horizonIdx = answers.horizon;
  const horizonYears = horizonIdx != null ? (HORIZON_YEARS[horizonIdx] ?? 6) : 6;

  if (answers.debt === 0) {
    gates.push({
      id: "debt",
      severity: "block",
      title: "Clear the high-interest debt first",
      detail:
        "Credit cards in India typically charge 36–48% a year and personal loans 12–20%. Equity has returned roughly 12% a year over long periods, and not reliably in any single year. Paying that debt down is a guaranteed return no fund can match.",
      action:
        "Clear the balance, then come back — this is the single highest-return move available to you.",
    });
  }

  if (answers.emergency === 0) {
    gates.push({
      id: "emergency",
      severity: "block",
      title: "Build an emergency fund first",
      detail:
        "Without 6 months of expenses set aside, a job loss or medical bill forces you to sell — and those events cluster with market falls, so you would be selling at the bottom. That single forced exit can undo years of returns.",
      action:
        "Park 6 months of expenses in a savings account or liquid fund before investing in equity.",
    });
  }

  if (horizonYears < 3) {
    gates.push({
      id: "horizon",
      severity: "block",
      title: "Equity is the wrong tool for this horizon",
      detail:
        "Indian equity funds have fallen 40–60% and taken two to four years to recover. With under three years, you may be forced to sell mid-fall with no time to recover. This is about arithmetic, not nerve — no risk appetite fixes a short horizon.",
      action:
        "For money needed within three years, use a fixed deposit, liquid fund or short-duration debt fund. Equity is not a substitute.",
    });
  } else if (horizonYears < 5) {
    gates.push({
      id: "horizon-short",
      severity: "warn",
      title: "A three-to-four year horizon is tight for equity",
      detail:
        "Historically, most rolling windows shorter than five years have included at least one significant drawdown. It can work, but the odds of a poor outcome are materially higher than at seven years or more.",
      action: "Consider a hybrid or balanced-advantage fund, or extend the horizon if you can.",
    });
  }

  if (answers.insurance === 0) {
    gates.push({
      id: "insurance",
      severity: "warn",
      title: "Get health cover before investing",
      detail:
        "One uninsured hospitalisation can wipe out an emergency fund and force redemption at a loss. Cover is cheap relative to what it protects.",
      action: "A basic family floater policy costs a fraction of what a single hospital stay does.",
    });
  } else if (answers.insurance === 1) {
    gates.push({
      id: "insurance-employer",
      severity: "warn",
      title: "Employer health cover disappears with the job",
      detail:
        "Job loss and market falls tend to coincide, which is exactly when you would lose the cover and need the money.",
      action: "Consider a personal policy alongside the employer one.",
    });
  }

  if (answers.share === 0) {
    gates.push({
      id: "concentration",
      severity: "warn",
      title: "Putting nearly all your savings into this",
      detail:
        "Committing everything to one asset class leaves no buffer. If markets fall just as you need cash, you have no alternative source.",
      action: "Keep some of it liquid and invest the rest gradually.",
    });
  }

  return gates;
}

export function hasBlockingGate(gates: Gate[]): boolean {
  return gates.some((g) => g.severity === "block");
}

// ---------------------------------------------------------------- suggestions

/**
 * Categories worth *screening* for each band. This only narrows where we look —
 * every candidate is still re-banded from its own realised numbers afterwards,
 * so an unusually tame small cap can still surface and a wild large cap can't
 * sneak through on its label.
 */
export const SUITABLE_CATEGORIES: Record<RiskBand, Category[]> = {
  1: ["Arbitrage"],
  2: ["Arbitrage", "Balanced Advantage", "Aggressive Hybrid"],
  3: ["Balanced Advantage", "Aggressive Hybrid", "Index", "Large Cap", "Flexi Cap"],
  4: ["Large Cap", "Flexi Cap", "Large & Mid Cap", "Multi Cap", "ELSS", "Index"],
  5: ["Flexi Cap", "Multi Cap", "Mid Cap", "Small Cap", "Focused"],
};

/**
 * A candidate is worth showing when its realised band lands at or below the
 * investor's band, but not so far below that it's a different product class.
 */
export function isSuggestable(fundBand: RiskBand, userBand: RiskBand): boolean {
  const diff = fundBand - userBand;
  return diff <= 0 && diff >= -1;
}

// ---------------------------------------------------------------- matching

export type Verdict = "fit" | "stretch" | "mismatch" | "below";

export interface Match {
  verdict: Verdict;
  label: string;
  /** Plain-language reason tied to the investor's own answers. */
  reason: string;
  /** Hard warnings that override the band comparison (e.g. horizon too short). */
  warnings: string[];
}

function pct(v: number, digits = 0): string {
  return `${(v * 100).toFixed(digits)}%`;
}

function months(days: number): string {
  const m = Math.round(days / 30.44);
  return m >= 12 ? `${(m / 12).toFixed(1)} years` : `${m} months`;
}

/** Options the investor picked, needed to quote their own answers back. */
export function matchFund(fund: FundRisk, profile: ProfileResult, answers: Answers): Match {
  const warnings: string[] = [];

  // Hard gate: equity-like funds over short horizons, regardless of temperament.
  const equityLike = fund.band >= 3;
  if (equityLike && profile.horizonYears < 3) {
    warnings.push(
      `You said you need this money within ${profile.horizonYears < 2 ? "2 years" : "3 years"}. This fund has fallen ${pct(Math.abs(fund.maxDrawdown))} before${fund.recoveryDays ? ` and took ${months(fund.recoveryDays)} to recover` : ""} — that is longer than your horizon.`,
    );
  }

  if (fund.shortHistory) {
    warnings.push(
      `Less than ${fund.horizonWindow} years of history, so its behaviour over your full horizon is unproven.`,
    );
  }

  // Quote the drawdown answer back with real numbers — the most useful sentence here.
  const ddAnswer = answers.drawdown;
  const wouldSell = ddAnswer != null && ddAnswer <= 1;
  if (wouldSell && Math.abs(fund.maxDrawdown) > 0.25) {
    warnings.push(
      `You said you would sell during a deep fall. This fund has dropped ${pct(Math.abs(fund.maxDrawdown))} from its peak.`,
    );
  }

  const diff = fund.band - profile.band;
  let verdict: Verdict;
  if (diff <= -2) verdict = "below";
  else if (diff <= 0) verdict = "fit";
  else if (diff === 1) verdict = "stretch";
  else verdict = "mismatch";

  if (warnings.length && verdict === "fit") verdict = "stretch";

  const label =
    verdict === "fit"
      ? "Good fit"
      : verdict === "stretch"
        ? "A stretch"
        : verdict === "mismatch"
          ? "Mismatch"
          : "Below your capacity";

  const worst =
    fund.worstAtHorizon != null
      ? `Over every ${fund.horizonWindow}-year window in its history, its worst outcome was ${fund.worstAtHorizon.toFixed(1)}% a year.`
      : "";

  let reason: string;
  switch (verdict) {
    case "fit":
      reason = `Its historical swings sit within what you said you can handle. ${worst}`.trim();
      break;
    case "stretch":
      reason =
        `Slightly more volatile than your profile suggests. It has fallen ${pct(Math.abs(fund.maxDrawdown))} at worst. ${worst}`.trim();
      break;
    case "mismatch":
      reason =
        `Materially riskier than your answers indicate. It has fallen ${pct(Math.abs(fund.maxDrawdown))} from peak${fund.recoveryDays ? ` and took ${months(fund.recoveryDays)} to recover` : ""}. ${worst}`.trim();
      break;
    default:
      reason =
        `Calmer than your profile allows for. That is fine if it is deliberate, but over ${profile.horizonYears}+ years you may be giving up growth. ${worst}`.trim();
  }

  return { verdict, label, reason, warnings };
}

export const VERDICT_TONE: Record<Verdict, string> = {
  fit: "text-success",
  stretch: "text-warning",
  mismatch: "text-destructive",
  below: "text-sky-400",
};
