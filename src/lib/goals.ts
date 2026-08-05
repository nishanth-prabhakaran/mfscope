// Goal-based SIP planning math.
import { futureValue, sipFutureValue, requiredSip } from "@/lib/planning";

export interface GoalInput {
  goalName: string;
  targetToday: number;      // cost of the goal in today's money
  years: number;            // time to goal
  inflation: number;        // % p.a. cost escalation
  expectedReturn: number;   // % p.a. expected portfolio return
  currentSavings: number;   // ₹ already saved for this goal
  currentMonthlySip: number;// ₹ ongoing monthly SIP for this goal
  sipStepUp: number;        // % annual step-up on the SIP
}

export interface GoalResult {
  targetAtGoal: number;
  futureValueSavings: number;
  futureValueSip: number;
  projectedCorpus: number;
  gap: number;                // positive = shortfall
  onTrackPct: number;         // projected / target (0..1+)
  requiredMonthlySip: number; // level SIP needed from today
  requiredStepUpSip: number;  // starting SIP if stepped up annually
  additionalMonthlySip: number;
  requiredLumpsumToday: number;
  achievedInYears: number | null; // when projected corpus first meets target
  rows: { year: number; invested: number; projected: number; target: number }[];
}

const pct = (p: number) => p / 100;

/** Starting SIP that, with an annual step-up, reaches the target. */
export function requiredStepUpSip(target: number, ratePct: number, years: number, stepUpPct: number): number {
  if (target <= 0 || years <= 0) return 0;
  if (!stepUpPct) return requiredSip(target, ratePct, years);
  const unit = sipFutureValue(1, ratePct, years, stepUpPct);
  return unit > 0 ? target / unit : 0;
}

export function calculateGoal(inp: GoalInput): GoalResult {
  const years = Math.max(0, inp.years);
  const targetAtGoal = inp.targetToday * Math.pow(1 + pct(inp.inflation), years);

  const futureValueSavings = futureValue(inp.currentSavings, inp.expectedReturn, years);
  const futureValueSip = sipFutureValue(inp.currentMonthlySip, inp.expectedReturn, years, inp.sipStepUp);
  const projectedCorpus = futureValueSavings + futureValueSip;
  const gap = targetAtGoal - projectedCorpus;

  const needFromSip = Math.max(0, targetAtGoal - futureValueSavings);
  const requiredMonthlySip = requiredSip(needFromSip, inp.expectedReturn, years);
  const stepUpSip = requiredStepUpSip(needFromSip, inp.expectedReturn, years, inp.sipStepUp);
  const additionalMonthlySip = Math.max(0, requiredMonthlySip - inp.currentMonthlySip);
  const requiredLumpsumToday = targetAtGoal / Math.pow(1 + pct(inp.expectedReturn), years || 1);

  // Year-by-year path with the current plan
  const rows: GoalResult["rows"] = [];
  let achievedInYears: number | null = null;
  {
    const i = pct(inp.expectedReturn) / 12;
    let corpus = inp.currentSavings;
    let invested = inp.currentSavings;
    let amt = inp.currentMonthlySip;
    for (let y = 0; y <= years; y++) {
      const targetNow = inp.targetToday * Math.pow(1 + pct(inp.inflation), y);
      rows.push({ year: y, invested, projected: corpus, target: y === years ? targetAtGoal : targetNow });
      if (achievedInYears === null && corpus >= targetAtGoal) achievedInYears = y;
      if (y === years) break;
      for (let m = 0; m < 12; m++) {
        corpus = (corpus + amt) * (1 + i);
        invested += amt;
      }
      if (inp.sipStepUp) amt *= 1 + pct(inp.sipStepUp);
    }
  }

  return {
    targetAtGoal,
    futureValueSavings,
    futureValueSip,
    projectedCorpus,
    gap,
    onTrackPct: targetAtGoal > 0 ? projectedCorpus / targetAtGoal : 0,
    requiredMonthlySip,
    requiredStepUpSip: stepUpSip,
    additionalMonthlySip,
    requiredLumpsumToday,
    achievedInYears,
    rows,
  };
}

export const GOAL_PRESETS: { name: string; targetToday: number; years: number; inflation: number }[] = [
  { name: "Child's education", targetToday: 2500000, years: 15, inflation: 8 },
  { name: "Home down payment", targetToday: 2000000, years: 7, inflation: 7 },
  { name: "Car purchase", targetToday: 1200000, years: 5, inflation: 6 },
  { name: "Child's marriage", targetToday: 3000000, years: 18, inflation: 8 },
  { name: "Emergency fund", targetToday: 600000, years: 2, inflation: 6 },
  { name: "Dream vacation", targetToday: 500000, years: 3, inflation: 6 },
];
