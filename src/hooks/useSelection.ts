import { useEffect, useState } from "react";

const KEY = "mf-compare-selection-v1";

export interface SelectedFund {
  schemeCode: number;
  schemeName: string;
}

export function useSelection() {
  const [funds, setFunds] = useState<SelectedFund[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as SelectedFund[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(funds)); } catch { /* ignore */ }
  }, [funds]);

  const add = (f: SelectedFund) => {
    setFunds((cur) => {
      if (cur.some((x) => x.schemeCode === f.schemeCode)) return cur;
      if (cur.length >= 10) return cur;
      return [...cur, f];
    });
  };
  const remove = (code: number) => setFunds((cur) => cur.filter((f) => f.schemeCode !== code));
  const clear = () => setFunds([]);
  const has = (code: number) => funds.some((f) => f.schemeCode === code);

  return { funds, add, remove, clear, has };
}
