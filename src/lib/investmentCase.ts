/**
 * The investment case for a single fund.
 *
 * Deliberately not a score, rating or verdict badge. A number invites the
 * reader to defer to it and skip the reasoning, which produces exactly the
 * fragile confidence that evaporates in a drawdown — the moment people
 * actually sell.
 *
 * Instead this produces four things: the case for, the case against, what the
 * investor would have had to live through, and what would falsify the case.
 * Conviction that survives a 40% fall comes from having looked at that fall in
 * advance and decided it was tolerable, not from a checklist of green ticks.
 *
 * Every signal here is either structural (cost, size, concentration) or
 * behavioural across the full history (recovery, dispersion, crisis record).
 * Nothing keys off recent performance, which does not persist and which the
 * shortlist ranking was deliberately rebuilt to stop chasing.
 */

import type { NavRow } from "@/types/mf";
import { calculateRisk, drawdownSeries, maxDrawdown } from "./calculators";
import { holdingPeriodProfile } from "./decisions";
import { stressTestAll, captureRatios, type CrisisResult } from "./stress";
import { toWeighted, activeShare, type WeightedHolding } from "./overlap";
import { num, type PeerRow, type HoldingRow } from "./finapiDetail";

export type PointKind = "strength" | "concern";
/** How much weight the evidence itself deserves, independent of the finding. */
export type Evidence = "strong" | "moderate" | "limited";

export interface CasePoint {
  id: string;
  kind: PointKind;
  evidence: Evidence;
  /** One-line finding. */
  title: string;
  /** The number behind it, and why it matters. */
  detail: string;
}

export interface LivedMoment {
  label: string;
  /** Rupee value of a 10 lakh investment at the trough. */
  troughValue: number;
  decline: number;
  recoveryLabel: string;
  recovered: boolean;
}

export interface InvestmentCase {
  strengths: CasePoint[];
  concerns: CasePoint[];
  lived: LivedMoment[];
  falsifiers: string[];
  /** Honest summary of how much the evidence supports any strong view. */
  evidenceQuality: "thin" | "moderate" | "solid";
  evidenceNote: string;
  historyYears: number;
}

export interface CaseInput {
  name: string;
  rows: NavRow[];
  category?: string;
  expenseRatio: number | null;
  aumCrore: number | null;
  portfolioTurnover: number | null;
  inceptionDate?: string;
  holdings?: HoldingRow[];
  /** Index proxy holdings, when a comparable index is available. */
  indexHoldings?: WeightedHolding[];
  peers?: PeerRow[];
  benchmarkRows?: NavRow[];
}

const YEAR_MS = 365.25 * 86_400_000;

/** Median of a numeric list, or null when empty. */
function median(vals: number[]): number | null {
  const clean = vals.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

function months(days: number): string {
  const m = Math.round(days / 30.44);
  return m >= 12 ? `${(m / 12).toFixed(1)} years` : `${m} months`;
}

const inr = (v: number) =>
  v >= 1e7
    ? `₹${(v / 1e7).toFixed(2)} Cr`
    : v >= 1e5
      ? `₹${(v / 1e5).toFixed(2)} L`
      : `₹${Math.round(v).toLocaleString("en-IN")}`;

/** Categories where fund size genuinely constrains the strategy. */
const CAPACITY_SENSITIVE = /small cap|mid cap|micro/i;

export function buildInvestmentCase(i: CaseInput): InvestmentCase {
  const strengths: CasePoint[] = [];
  const concerns: CasePoint[] = [];
  const falsifiers: string[] = [];

  const rows = i.rows;
  const historyYears = rows.length > 1 ? (rows[rows.length - 1].t - rows[0].t) / YEAR_MS : 0;
  const risk = calculateRisk(rows, 0.065);
  const mdd = maxDrawdown(drawdownSeries(rows));
  const crises = stressTestAll(rows);
  const survived = crises.filter((c) => !c.insufficientHistory);
  const capture = i.benchmarkRows?.length ? captureRatios(rows, i.benchmarkRows) : null;
  const holding = holdingPeriodProfile(rows, 10);

  // ------------------------------------------------------------------ cost
  const peerTers = (i.peers ?? [])
    .map((p) => num(p.expenseRatio))
    .filter((v): v is number => v != null);
  const medianTer = median(peerTers);

  if (i.expenseRatio != null) {
    if (medianTer != null && peerTers.length >= 4) {
      const gap = i.expenseRatio - medianTer;
      if (gap <= -0.25) {
        strengths.push({
          id: "cheap",
          kind: "strength",
          evidence: "strong",
          title: "Cheaper than most of its category",
          detail: `Charges ${i.expenseRatio.toFixed(2)}% against a category median of ${medianTer.toFixed(2)}%. Cost is the most reliable predictor of future relative return there is — it is certain, recurring, and compounds against you.`,
        });
      } else if (gap >= 0.4) {
        concerns.push({
          id: "expensive",
          kind: "concern",
          evidence: "strong",
          title: "Costs more than most of its category",
          detail: `Charges ${i.expenseRatio.toFixed(2)}% against a category median of ${medianTer.toFixed(2)}% — ${gap.toFixed(2)} percentage points a year it must recover before you are level with the average peer, every year.`,
        });
        falsifiers.push(
          `The fee gap of ${gap.toFixed(2)}pp closes, or the fund demonstrably out-earns it over a full market cycle rather than one good run.`,
        );
      }
    } else if (i.expenseRatio >= 1.9) {
      concerns.push({
        id: "expensive-abs",
        kind: "concern",
        evidence: "moderate",
        title: "High expense ratio",
        detail: `Charges ${i.expenseRatio.toFixed(2)}% a year. Without enough peer data to compare, note that a broad index fund costs roughly 0.2% — this fund must beat the index by about ${(i.expenseRatio - 0.2).toFixed(2)}pp a year just to draw level.`,
      });
    }
  }

  // ------------------------------------------------------------------ closet indexing
  if (i.indexHoldings?.length && i.holdings?.length) {
    const as = activeShare(toWeighted(i.holdings), i.indexHoldings);
    if (as) {
      if (as.activeShare < 45 && (i.expenseRatio ?? 0) > 1.2) {
        concerns.push({
          id: "closet",
          kind: "concern",
          evidence: "strong",
          title: "Looks like a closet indexer",
          detail: `Only ${as.activeShare.toFixed(0)}% of the portfolio differs from its index, yet it charges ${i.expenseRatio!.toFixed(2)}%. You are paying active fees for largely index exposure; the small active portion has to work very hard to justify the whole fee.`,
        });
      } else if (as.activeShare >= 65) {
        strengths.push({
          id: "genuinely-active",
          kind: "strength",
          evidence: "moderate",
          title: "Genuinely different from its index",
          detail: `${as.activeShare.toFixed(0)}% of the portfolio deviates from the index, so returns come from real stock selection rather than index-tracking. This raises the odds of both out- and under-performance.`,
        });
      }
    }
  }

  // ------------------------------------------------------------------ capacity
  if (i.aumCrore != null && CAPACITY_SENSITIVE.test(i.category ?? "")) {
    if (i.aumCrore > 25_000) {
      concerns.push({
        id: "capacity",
        kind: "concern",
        evidence: "moderate",
        title: "Large for its category",
        detail: `Manages ₹${Math.round(i.aumCrore).toLocaleString("en-IN")} Cr in a ${i.category}. Size constrains a small- and mid-cap strategy: the fund cannot enter or exit positions without moving the price against itself, which tends to push it toward larger, more liquid names over time.`,
      });
      falsifiers.push(
        "The fund soft-closes to new money, or its portfolio drifts materially toward larger caps.",
      );
    }
  }

  // ------------------------------------------------------------------ history & crises
  if (historyYears < 5) {
    concerns.push({
      id: "young",
      kind: "concern",
      evidence: "strong",
      title: "Short track record",
      detail: `Only ${historyYears.toFixed(1)} years of history. Nothing here has been tested by a severe market fall, and a clean record over a rising period tells you very little about behaviour in a bad one.`,
    });
  }

  const crisisWithData = survived.filter((c) => c.decline < -0.05);
  if (crisisWithData.length === 0 && historyYears >= 5) {
    concerns.push({
      id: "untested",
      kind: "concern",
      evidence: "moderate",
      title: "Never tested by a major crash",
      detail: `Has ${historyYears.toFixed(1)} years of history but has not lived through one of the severe episodes tracked here. Its worst realistic drawdown is therefore unknown rather than low.`,
    });
  } else if (crisisWithData.length >= 2) {
    const recovered = crisisWithData.filter((c) => c.recovered);
    if (recovered.length === crisisWithData.length) {
      strengths.push({
        id: "crisis-record",
        kind: "strength",
        evidence: "strong",
        title: `Recovered from ${crisisWithData.length} major crashes`,
        detail: `Came through ${crisisWithData.map((c) => c.crisis.short).join(", ")} and regained its previous peak each time. Surviving multiple distinct shocks is far stronger evidence than a good run in one market regime.`,
      });
    }
  }

  // ------------------------------------------------------------------ drawdown behaviour
  const worstCrisis = survived.reduce<CrisisResult | null>(
    (w, c) => (!w || c.decline < w.decline ? c : w),
    null,
  );
  if (Math.abs(mdd) > 0.5) {
    concerns.push({
      id: "deep-dd",
      kind: "concern",
      evidence: "strong",
      title: "Has fallen more than half from peak",
      detail: `Worst peak-to-trough fall of ${(mdd * 100).toFixed(0)}%${risk.recoveryDays ? `, taking ${months(risk.recoveryDays)} to recover` : ""}. A fall of that depth is where most investors abandon a plan, which converts a paper loss into a permanent one.`,
    });
  }
  if (risk.recoveryDays != null && risk.recoveryDays > 900) {
    concerns.push({
      id: "slow-recovery",
      kind: "concern",
      evidence: "moderate",
      title: "Slow to recover",
      detail: `Took ${months(risk.recoveryDays)} to regain its previous peak after its worst fall. Long underwater periods test patience more than the depth of the fall itself.`,
    });
  }

  // ------------------------------------------------------------------ capture
  if (capture) {
    if (capture.downside < capture.upside - 5) {
      strengths.push({
        id: "asymmetry",
        kind: "strength",
        evidence: "moderate",
        title: "Falls less than it rises",
        detail: `Captured ${capture.upside.toFixed(0)}% of the benchmark's gains but only ${capture.downside.toFixed(0)}% of its losses across ${capture.months} months. Risk taken on the side that pays is the asymmetry worth holding for.`,
      });
    } else if (capture.downside > capture.upside + 5) {
      concerns.push({
        id: "bad-asymmetry",
        kind: "concern",
        evidence: "moderate",
        title: "Falls more than it rises",
        detail: `Captured ${capture.upside.toFixed(0)}% of benchmark gains but ${capture.downside.toFixed(0)}% of its losses. The risk is landing on the wrong side — you get more of the falls than the rallies.`,
      });
    }
  }

  // ------------------------------------------------------------------ holding period
  const safe = holding.safeYears;
  if (safe != null && safe <= 5) {
    strengths.push({
      id: "holding",
      kind: "strength",
      evidence: historyYears >= 10 ? "strong" : "limited",
      title: `No ${safe}-year period has lost money`,
      detail: `Across every start date in its history, no ${safe}-year holding has ended in a loss. Commit for that long and history has been on your side — though history covers only the periods this fund has actually lived through.`,
    });
  }
  const tenYear = holding.rows.find((r) => r.years === 7) ?? holding.rows[holding.rows.length - 1];
  if (tenYear && tenYear.positivePct < 100 && tenYear.years >= 7) {
    concerns.push({
      id: "long-losses",
      kind: "concern",
      evidence: "strong",
      title: `Some ${tenYear.years}-year holdings still lost money`,
      detail: `${(100 - tenYear.positivePct).toFixed(0)}% of ${tenYear.years}-year periods ended in a loss, the worst at ${tenYear.worstTotal.toFixed(1)}% total. Losing money over that long a stretch points to something structural rather than bad timing.`,
    });
  }

  // ------------------------------------------------------------------ turnover
  if (i.portfolioTurnover != null && i.portfolioTurnover > 150) {
    concerns.push({
      id: "turnover",
      kind: "concern",
      evidence: "limited",
      title: "High portfolio turnover",
      detail: `Turns over ${i.portfolioTurnover.toFixed(0)}% of its portfolio a year. Trading costs are not included in the expense ratio, so the real cost of ownership is higher than the headline figure.`,
    });
  }

  // ------------------------------------------------------------------ what you'd have lived through
  const lived: LivedMoment[] = survived
    .filter((c) => c.decline < -0.1)
    .map((c) => ({
      label: c.crisis.label,
      troughValue: 1_000_000 * (1 + c.decline),
      decline: c.decline,
      recoveryLabel: c.recovered ? months(c.recoveryDays!) : "still not recovered",
      recovered: c.recovered,
    }));

  // ------------------------------------------------------------------ falsifiers
  falsifiers.push(
    "The fund manager changes, or the mandate shifts — the record above belongs to the people and strategy that produced it, not to the name.",
  );
  if (worstCrisis && worstCrisis.decline < -0.2) {
    falsifiers.push(
      `The next major fall exceeds ${Math.abs(worstCrisis.decline * 100).toFixed(0)}%, or recovery takes materially longer than the ${worstCrisis.recovered ? months(worstCrisis.recoveryDays!) : "period"} it took before.`,
    );
  }
  falsifiers.push(
    "You find yourself checking the NAV daily during a fall — that is a sign the position is larger, or the fund riskier, than you are actually comfortable with.",
  );

  // ------------------------------------------------------------------ evidence quality
  let evidenceQuality: InvestmentCase["evidenceQuality"];
  let evidenceNote: string;
  const strongCount = [...strengths, ...concerns].filter((p) => p.evidence === "strong").length;

  if (historyYears < 5 || crisisWithData.length === 0) {
    evidenceQuality = "thin";
    evidenceNote =
      "The evidence here does not support a strong view either way. This fund has not been through enough distinct market conditions for its record to mean much yet — that is not a criticism of the fund, just a limit on what can be concluded.";
  } else if (historyYears >= 10 && crisisWithData.length >= 2 && strongCount >= 3) {
    evidenceQuality = "solid";
    evidenceNote =
      "There is enough history across enough different market conditions to draw real conclusions here — though every figure below is still a record of what happened, not a forecast of what will.";
  } else {
    evidenceQuality = "moderate";
    evidenceNote =
      "There is a reasonable amount of history, but not across the full range of market conditions. Treat the case below as suggestive rather than settled.";
  }

  return { strengths, concerns, lived, falsifiers, evidenceQuality, evidenceNote, historyYears };
}
