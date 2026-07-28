export const CATEGORIES = [
  "Large Cap",
  "Large & Mid Cap",
  "Mid Cap",
  "Small Cap",
  "Flexi Cap",
  "Multi Cap",
  "ELSS",
  "Value",
  "Contra",
  "Focused",
  "Index",
  "Aggressive Hybrid",
  "Balanced Advantage",
  "Arbitrage",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Guess category from scheme name text (works before we fetch the meta). */
export function guessCategory(name: string): Category | null {
  const s = name.toLowerCase();
  const map: Array<[RegExp, Category]> = [
    [/large\s*&\s*mid|large\s*and\s*mid|large\s*mid/, "Large & Mid Cap"],
    [/large\s*cap/, "Large Cap"],
    [/mid\s*cap/, "Mid Cap"],
    [/small\s*cap/, "Small Cap"],
    [/flexi\s*cap/, "Flexi Cap"],
    [/multi\s*cap/, "Multi Cap"],
    [/elss|tax\s*saver/, "ELSS"],
    [/value/, "Value"],
    [/contra/, "Contra"],
    [/focus/, "Focused"],
    [/index|nifty|sensex/, "Index"],
    [/aggressive\s*hybrid|equity\s*hybrid/, "Aggressive Hybrid"],
    [/balanced\s*advantage|bafof|baf\b|dynamic\s*asset/, "Balanced Advantage"],
    [/arbitrage/, "Arbitrage"],
  ];
  for (const [re, cat] of map) if (re.test(s)) return cat;
  return null;
}

export function categoryFromMeta(schemeCategory: string): string {
  return schemeCategory.replace(/^Equity Scheme\s*-\s*/i, "").replace(/^Hybrid Scheme\s*-\s*/i, "");
}

/** Extract AMC name from scheme name (before "Mutual Fund" isn't in name; use first 1-2 words heuristic) */
export function guessAmc(name: string): string {
  // Common AMC prefixes
  const amcs = [
    "HDFC", "ICICI Prudential", "ICICI", "SBI", "Axis", "Kotak", "Aditya Birla Sun Life", "Nippon India",
    "Mirae Asset", "Mirae", "UTI", "DSP", "Franklin", "Tata", "Motilal Oswal", "Invesco", "Canara Robeco",
    "Baroda BNP Paribas", "Baroda", "PGIM", "Sundaram", "Edelweiss", "Bandhan", "IDFC", "L&T",
    "Quant", "Parag Parikh", "PPFAS", "JM Financial", "JM", "LIC", "Mahindra Manulife", "HSBC",
    "Bank of India", "Union", "ITI", "Navi", "WhiteOak", "White Oak", "Groww", "Zerodha", "NJ",
    "Trust", "Samco", "Shriram", "Taurus", "Quantum", "PPAS", "360 One", "Bajaj Finserv",
  ];
  for (const a of amcs) if (name.toLowerCase().startsWith(a.toLowerCase())) return a;
  return name.split(" ")[0];
}
