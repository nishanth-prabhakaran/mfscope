import { useCallback, useEffect, useState } from "react";

const KEY = "mf-compare-selection-v1";
/** Query param carrying a shared comparison, e.g. ?funds=120716,125354 */
export const SHARE_PARAM = "funds";

export interface SelectedFund {
  schemeCode: number;
  schemeName: string;
}

/** Scheme codes from the URL, if this is a shared link. Names are resolved
 *  later from the scheme list, so the URL stays short and shareable. */
function codesFromUrl(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = new URLSearchParams(window.location.search).get(SHARE_PARAM);
    if (!raw) return [];
    return raw
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 10);
  } catch {
    return [];
  }
}

function loadStored(): SelectedFund[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SelectedFund[]) : [];
  } catch {
    return [];
  }
}

export function useSelection() {
  const [funds, setFunds] = useState<SelectedFund[]>(() => {
    // A shared link wins over stored state: someone opening a comparison
    // someone sent them expects to see that comparison, not their own.
    const shared = codesFromUrl();
    if (shared.length) {
      return shared.map((schemeCode) => ({ schemeCode, schemeName: `Scheme ${schemeCode}` }));
    }
    return loadStored();
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(funds));
    } catch {
      /* ignore */
    }
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

  /** Fills in real names once the scheme list has loaded, for shared links
   *  that arrived with placeholder names. */
  const hydrateNames = useCallback((lookup: (code: number) => string | undefined) => {
    setFunds((cur) => {
      let changed = false;
      const next = cur.map((f) => {
        if (!f.schemeName.startsWith("Scheme ")) return f;
        const real = lookup(f.schemeCode);
        if (!real) return f;
        changed = true;
        return { ...f, schemeName: real };
      });
      return changed ? next : cur;
    });
  }, []);

  /** Absolute URL reproducing this exact comparison. */
  const shareUrl = useCallback(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.search = "";
    if (funds.length) url.searchParams.set(SHARE_PARAM, funds.map((f) => f.schemeCode).join(","));
    return url.toString();
  }, [funds]);

  return { funds, add, remove, clear, has, shareUrl, hydrateNames };
}
