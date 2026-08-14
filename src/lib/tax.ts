/**
 * Indian mutual fund taxation, on the rules in force since 23 July 2024.
 *
 * Every return figure elsewhere in the app is pre-tax, which overstates what an
 * investor actually keeps — often by two to three percentage points a year on
 * a debt fund at the top slab. This models what is left after tax so the
 * comparison is against money in hand.
 *
 * Not tax advice: surcharge, cess, set-off of capital losses, and the
 * grandfathering of pre-2018 equity gains are not modelled.
 */

export type TaxAssetClass = "equity" | "debt" | "hybrid-equity" | "hybrid-debt" | "gold-intl";

/** Long-term holding threshold in years, by asset class. */
export const LTCG_THRESHOLD_YEARS: Record<TaxAssetClass, number> = {
  equity: 1,
  "hybrid-equity": 1, // ≥65% equity — taxed as equity
  debt: Infinity, // post-July-2024 specified debt funds: always slab, no LTCG
  "hybrid-debt": 2,
  "gold-intl": 2,
};

/** Equity LTCG is exempt up to this much per financial year, across all equity. */
export const EQUITY_LTCG_EXEMPTION = 125_000;
export const EQUITY_LTCG_RATE = 0.125;
export const EQUITY_STCG_RATE = 0.2;
/** Non-equity long-term rate without indexation (hybrid-debt, gold, international). */
export const OTHER_LTCG_RATE = 0.125;

/**
 * Classify from the provider's category string. Errs toward "equity" only on a
 * clear equity signal, since misclassifying a debt fund as equity would
 * understate its tax materially.
 */
export function classifyForTax(category: string | undefined, schemeName = ""): TaxAssetClass {
  const t = `${category ?? ""} ${schemeName}`.toLowerCase();

  if (/arbitrage/.test(t)) return "equity"; // arbitrage funds are equity-taxed
  if (/\b(gold|silver|international|global|us equity|nasdaq|overseas)\b/.test(t))
    return "gold-intl";
  if (
    /(liquid|overnight|money market|ultra short|low duration|short duration|medium duration|long duration|corporate bond|credit risk|gilt|banking and psu|dynamic bond|floater|debt)/.test(
      t,
    )
  )
    return "debt";
  if (/(aggressive hybrid|equity savings|balanced advantage|dynamic asset)/.test(t))
    return "hybrid-equity";
  if (/(conservative hybrid|multi asset)/.test(t)) return "hybrid-debt";
  if (
    /(equity|large cap|mid cap|small cap|flexi|multi cap|focused|elss|value|contra|sectoral|thematic|index|dividend yield)/.test(
      t,
    )
  )
    return "equity";
  return "equity";
}

export interface TaxInput {
  assetClass: TaxAssetClass;
  /** Absolute gain in rupees. */
  gain: number;
  holdingYears: number;
  /** Marginal slab rate as a decimal, e.g. 0.30. Used for slab-taxed gains. */
  slabRate: number;
  /** Equity LTCG exemption already consumed elsewhere this year. */
  exemptionUsed?: number;
}

export interface TaxResult {
  tax: number;
  netGain: number;
  effectiveRate: number;
  isLongTerm: boolean;
  /** Plain-language basis, e.g. "LTCG 12.5% above ₹1.25L exemption". */
  basis: string;
  exemptionApplied: number;
}

export function computeTax(i: TaxInput): TaxResult {
  const { assetClass, gain, holdingYears, slabRate } = i;
  const empty = (basis: string): TaxResult => ({
    tax: 0,
    netGain: gain,
    effectiveRate: 0,
    isLongTerm: false,
    basis,
    exemptionApplied: 0,
  });

  if (gain <= 0) return empty("No taxable gain");

  const threshold = LTCG_THRESHOLD_YEARS[assetClass];
  const isLongTerm = holdingYears >= threshold;

  // Specified debt funds bought after 1 Apr 2023 are slab-taxed regardless of
  // holding period — the indexation benefit was removed entirely.
  if (assetClass === "debt") {
    const tax = gain * slabRate;
    return {
      tax,
      netGain: gain - tax,
      effectiveRate: tax / gain,
      isLongTerm: false,
      basis: `Taxed at your slab rate (${(slabRate * 100).toFixed(0)}%) — debt funds have no LTCG benefit since April 2023`,
      exemptionApplied: 0,
    };
  }

  const isEquityTaxed = assetClass === "equity" || assetClass === "hybrid-equity";

  if (isEquityTaxed) {
    if (!isLongTerm) {
      const tax = gain * EQUITY_STCG_RATE;
      return {
        tax,
        netGain: gain - tax,
        effectiveRate: EQUITY_STCG_RATE,
        isLongTerm: false,
        basis: `Short-term (held under 1 year): 20% STCG`,
        exemptionApplied: 0,
      };
    }
    const remainingExemption = Math.max(0, EQUITY_LTCG_EXEMPTION - (i.exemptionUsed ?? 0));
    const exemptionApplied = Math.min(gain, remainingExemption);
    const taxable = gain - exemptionApplied;
    const tax = taxable * EQUITY_LTCG_RATE;
    return {
      tax,
      netGain: gain - tax,
      effectiveRate: tax / gain,
      isLongTerm: true,
      basis: `Long-term: 12.5% on gains above the ₹1.25L yearly exemption`,
      exemptionApplied,
    };
  }

  // hybrid-debt and gold/international: slab if short-term, 12.5% if long.
  if (!isLongTerm) {
    const tax = gain * slabRate;
    return {
      tax,
      netGain: gain - tax,
      effectiveRate: slabRate,
      isLongTerm: false,
      basis: `Short-term (held under ${threshold} years): taxed at your slab rate`,
      exemptionApplied: 0,
    };
  }
  const tax = gain * OTHER_LTCG_RATE;
  return {
    tax,
    netGain: gain - tax,
    effectiveRate: OTHER_LTCG_RATE,
    isLongTerm: true,
    basis: `Long-term (held ${threshold}+ years): 12.5% without indexation`,
    exemptionApplied: 0,
  };
}

/**
 * Converts a pre-tax CAGR into the CAGR actually realised after tax on exit.
 * Tax is charged once on the whole gain at redemption, so a longer hold dilutes
 * its annualised impact — which is itself an argument for not churning.
 */
export function postTaxCagr(
  preTaxCagr: number,
  years: number,
  assetClass: TaxAssetClass,
  slabRate: number,
  amount = 1_000_000,
): { postTax: number; drag: number; tax: number; basis: string } {
  if (years <= 0 || !Number.isFinite(preTaxCagr)) {
    return { postTax: preTaxCagr, drag: 0, tax: 0, basis: "—" };
  }
  const finalValue = amount * Math.pow(1 + preTaxCagr, years);
  const gain = finalValue - amount;
  const { tax, basis } = computeTax({ assetClass, gain, holdingYears: years, slabRate });
  const netValue = finalValue - tax;
  const postTax = Math.pow(netValue / amount, 1 / years) - 1;
  return { postTax, drag: preTaxCagr - postTax, tax, basis };
}

export const SLAB_OPTIONS = [
  { label: "No tax (0%)", value: 0 },
  { label: "5%", value: 0.05 },
  { label: "10%", value: 0.1 },
  { label: "15%", value: 0.15 },
  { label: "20%", value: 0.2 },
  { label: "30% (highest)", value: 0.3 },
];
