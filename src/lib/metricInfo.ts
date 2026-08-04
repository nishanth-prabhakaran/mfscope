// Plain-language explanations of every ratio/metric shown in comparison tables.
export interface MetricDoc {
  label: string;
  what: string;
  read: string;
  group: "Returns" | "Risk" | "Risk-adjusted" | "Benchmark";
}

export const METRIC_DOCS: Record<string, MetricDoc> = {
  cagr: {
    label: "CAGR",
    group: "Returns",
    what: "Compound Annual Growth Rate — the steady yearly rate that would take the NAV from start to end value.",
    read: "Higher is better. It smooths out the bumpy path into one comparable annual number.",
  },
  annualReturn: {
    label: "Annualized Return",
    group: "Returns",
    what: "Average of daily returns scaled to a year (arithmetic, not compounded).",
    read: "Usually slightly higher than CAGR; the gap widens when the fund is volatile.",
  },
  volatility: {
    label: "Volatility (Std Dev)",
    group: "Risk",
    what: "Annualised standard deviation of daily returns — how much the NAV swings around its average.",
    read: "Lower is calmer. 12–15% is typical for large caps, 18–25% for small caps.",
  },
  downsideVol: {
    label: "Downside Volatility",
    group: "Risk",
    what: "Volatility counting only the loss-making days.",
    read: "Lower is better. Unlike plain volatility it doesn't penalise big up-moves.",
  },
  sharpe: {
    label: "Sharpe Ratio",
    group: "Risk-adjusted",
    what: "Return above the risk-free rate divided by total volatility — reward per unit of risk taken.",
    read: "Higher is better. Above 1 is good, above 1.5 is strong over long periods.",
  },
  sortino: {
    label: "Sortino Ratio",
    group: "Risk-adjusted",
    what: "Like Sharpe, but divides by downside volatility only.",
    read: "Higher is better. A fairer measure when a fund has sharp upside bursts.",
  },
  calmar: {
    label: "Calmar Ratio",
    group: "Risk-adjusted",
    what: "CAGR divided by the maximum drawdown.",
    read: "Higher is better — it tells you how much return you earned per unit of worst-case pain.",
  },
  maxDrawdown: {
    label: "Max Drawdown",
    group: "Risk",
    what: "The largest peak-to-trough fall in NAV over the period.",
    read: "Closer to zero is better. This is the worst loss a holder could have faced.",
  },
  avgDrawdown: {
    label: "Average Drawdown",
    group: "Risk",
    what: "Mean depth of all the declines from previous peaks.",
    read: "Closer to zero is better; shows the typical, not the worst, dip.",
  },
  ulcerIndex: {
    label: "Ulcer Index",
    group: "Risk",
    what: "Measures both the depth and the duration of drawdowns.",
    read: "Lower is better — a fund that recovers quickly scores well even after a deep fall.",
  },
  skewness: {
    label: "Skewness",
    group: "Risk",
    what: "Asymmetry of the return distribution.",
    read: "Positive means occasional large gains; negative means occasional large losses.",
  },
  kurtosis: {
    label: "Kurtosis",
    group: "Risk",
    what: "How fat the tails of the return distribution are.",
    read: "Higher means extreme moves (both ways) happen more often than a normal bell curve suggests.",
  },
  var95: {
    label: "VaR (95%)",
    group: "Risk",
    what: "Value at Risk — the daily loss that is exceeded only 5% of the time.",
    read: "Closer to zero is better. 'On a bad day (1 in 20), you could lose at least this much.'",
  },
  cvar95: {
    label: "CVaR (95%)",
    group: "Risk",
    what: "Conditional VaR — the average loss on those worst 5% of days.",
    read: "Closer to zero is better. It answers 'how bad is bad?' when VaR is breached.",
  },
  fundCagr: {
    label: "Fund CAGR",
    group: "Benchmark",
    what: "The fund's compounded annual return over the window it shares with the index.",
    read: "Compare it directly with the index CAGR on the same row.",
  },
  benchCagr: {
    label: "Index CAGR",
    group: "Benchmark",
    what: "The benchmark's compounded annual return over the same overlapping window.",
    read: "This is the 'do nothing, just buy the index' result.",
  },
  excessCagr: {
    label: "Excess Return",
    group: "Benchmark",
    what: "Fund CAGR minus index CAGR.",
    read: "Positive means the fund beat the index before adjusting for risk taken.",
  },
  alpha: {
    label: "Alpha",
    group: "Benchmark",
    what: "Annualised return the fund added beyond what its beta exposure to the index explains.",
    read: "Positive alpha = genuine manager skill. Negative = underperformed for the risk taken.",
  },
  beta: {
    label: "Beta",
    group: "Benchmark",
    what: "Sensitivity to index moves. Beta 1.2 means the fund typically moves 1.2% when the index moves 1%.",
    read: "Below 1 is defensive, above 1 is aggressive. Neither is 'better' — it must match your risk appetite.",
  },
  rSquared: {
    label: "R²",
    group: "Benchmark",
    what: "How much of the fund's movement is explained by the index (0 to 1).",
    read: "Near 1 means it hugs the index (alpha/beta are reliable). Low R² means alpha is less meaningful.",
  },
  trackingError: {
    label: "Tracking Error",
    group: "Benchmark",
    what: "Volatility of the fund's return difference versus the index.",
    read: "Low = index-like. High = the manager takes big off-benchmark bets.",
  },
  informationRatio: {
    label: "Information Ratio",
    group: "Benchmark",
    what: "Excess return divided by tracking error — active return per unit of active risk.",
    read: "Higher is better. Above 0.5 is respectable, above 1 is excellent.",
  },
  upCapture: {
    label: "Up Capture",
    group: "Benchmark",
    what: "Share of the index's gains the fund captured in rising months.",
    read: "Above 100% means it gained more than the index in up markets.",
  },
  downCapture: {
    label: "Down Capture",
    group: "Benchmark",
    what: "Share of the index's losses the fund suffered in falling months.",
    read: "Below 100% is good — it fell less than the index when markets dropped.",
  },
  battingAverage: {
    label: "Batting Average",
    group: "Benchmark",
    what: "Percentage of months the fund beat the index.",
    read: "Above 50% means it wins more months than it loses — a consistency check.",
  },
  outperformYears: {
    label: "Years Beaten",
    group: "Benchmark",
    what: "Calendar years the fund finished ahead of the index, out of years compared.",
    read: "More is better; it shows outperformance isn't from one lucky year.",
  },
  correlation: {
    label: "Correlation",
    group: "Risk",
    what: "How closely two funds' daily returns move together (-1 to +1).",
    read: "Above 0.85 means heavy overlap — holding both adds little diversification.",
  },
  periodReturn: {
    label: "Point-to-point Return",
    group: "Returns",
    what: "Return from a date in the past to today. Periods of a year or more are shown as CAGR.",
    read: "Higher is better, but a single start date can flatter or punish a fund — check rolling returns too.",
  },
};

export const METRIC_GROUPS: MetricDoc["group"][] = ["Returns", "Risk", "Risk-adjusted", "Benchmark"];
