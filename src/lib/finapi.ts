import { get, set } from "idb-keyval";
import { fetchWithTimeout } from "./http";
import type { NormalizedScheme, SchemeListItem, NavRow, SchemeMeta } from "@/types/mf";

const API_BASE = "/api/public/finapi";

const LIST_KEY = "finapi:list:v2";
const LIST_TTL = 24 * 60 * 60 * 1000;
const NAV_KEY = (code: number) => `finapi:nav:${code}:v1`;
const NAV_TTL = 12 * 60 * 60 * 1000;

interface Cached<T> {
  at: number;
  data: T;
}

interface ApiEnvelope<T> {
  status?: string;
  statusCode?: number;
  message?: string;
  data?: T;
}

interface ApiListItem {
  schemeCode: string | number;
  schemeName: string;
  planName?: string | null;
  optionName?: string | null;
  isinDivPayoutOrGrowth?: string | null;
  isinDivReinvestment?: string | null;
  fundHouse?: string | null;
  schemeStructure?: string | null;
  schemeCategoryLabel?: string | null;
}

interface ApiNavPoint {
  navDate: string;
  nav: number | string;
}

interface ApiNavResponse {
  schemeCode: string | number;
  schemeName: string;
  fundHouse?: string | null;
  schemeCategoryLabel?: string | null;
  schemeStructure?: string | null;
  isinDivPayoutOrGrowth?: string | null;
  isinDivReinvestment?: string | null;
  navHistory?: ApiNavPoint[];
}

/**
 * Cache-first with stale-on-failure.
 *
 * The previous version returned cached data only inside the TTL and otherwise
 * threw — so an expired entry plus a failed network call produced a dead card,
 * even though perfectly usable data was sitting in IndexedDB. NAV history is
 * append-only and slow-moving; day-old values are far better than nothing.
 * Serving stale on failure turns a provider outage from a hard failure into a
 * soft one, and makes the app usable offline.
 */
async function cached<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
  const hit = await get<Cached<T>>(key).catch(() => null);
  if (hit && Date.now() - hit.at < ttl) return hit.data;

  try {
    const data = await loader();
    await set(key, { at: Date.now(), data } satisfies Cached<T>).catch(() => {});
    return data;
  } catch (err) {
    if (hit) {
      console.warn(`[finapi] serving stale cache for ${key} after fetch failure`, err);
      return hit.data;
    }
    throw err;
  }
}

async function getJson<T>(url: string, errorMessage: string): Promise<T> {
  const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(errorMessage);
  const json = (await res.json()) as ApiEnvelope<T>;
  if (json.data == null) throw new Error(json.message || errorMessage);
  return json.data;
}

export async function fetchSchemeList(): Promise<SchemeListItem[]> {
  return cached(LIST_KEY, LIST_TTL, async () => {
    const data = await getJson<ApiListItem[]>(`${API_BASE}/mf`, "Failed to load scheme list");
    const out: SchemeListItem[] = [];
    for (const s of data) {
      const code = Number(s.schemeCode);
      if (!Number.isFinite(code) || !s.schemeName) continue;
      // The API now returns plan/option separately; the app's filters and
      // labels expect them inside the display name (e.g. "… - Direct Plan - Growth").
      const parts = [s.schemeName, s.planName, s.optionName]
        .map((p) => (p ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const base = parts[0].toLowerCase();
      const name = parts
        .filter((p, i) => i === 0 || !base.includes(p.toLowerCase()))
        .join(" - ");
      out.push({
        schemeCode: code,
        schemeName: name,
        isinGrowth: s.isinDivPayoutOrGrowth ?? null,
        isinDivReinvestment: s.isinDivReinvestment ?? null,
      });
    }
    return out;
  });
}

/** yyyy-mm-dd (ISO) from the API → unix ms at UTC midnight. */
function parseDate(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Full NAV history: the API requires an explicit date window. */
export function navHistoryUrl(code: number): string {
  return `${API_BASE}/mf/scheme-code/${code}/nav?startDate=1990-01-01&endDate=${todayIso()}`;
}

export function toNavRows(history: ApiNavPoint[] | undefined): NavRow[] {
  return (history ?? [])
    .map((p) => ({ t: parseDate(p.navDate), nav: Number(p.nav) }))
    .filter((r) => Number.isFinite(r.nav) && r.nav > 0 && Number.isFinite(r.t))
    .sort((a, b) => a.t - b.t);
}

function toMeta(d: ApiNavResponse): SchemeMeta {
  return {
    fund_house: d.fundHouse ?? "",
    scheme_type: d.schemeStructure ?? "",
    scheme_category: d.schemeCategoryLabel ?? "",
    scheme_code: Number(d.schemeCode),
    scheme_name: (d.schemeName ?? "").replace(/\s+/g, " ").trim(),
    isin_growth: d.isinDivPayoutOrGrowth ?? null,
    isin_div_reinvestment: d.isinDivReinvestment ?? null,
  };
}

export async function fetchScheme(code: number): Promise<NormalizedScheme> {
  return cached(NAV_KEY(code), NAV_TTL, async () => {
    const data = await getJson<ApiNavResponse>(
      navHistoryUrl(code),
      "Failed to load scheme " + code,
    );
    return { meta: toMeta(data), rows: toNavRows(data.navHistory) };
  });
}
