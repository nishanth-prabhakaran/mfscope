import { get, set } from "idb-keyval";
import { fetchWithTimeout } from "./http";
import type { NormalizedScheme, SchemeListItem, NavRow, SchemeMeta } from "@/types/mf";

/**
 * MFAPI.in — free, public, key-less AMFI NAV mirror.
 *
 * It serves scheme list + full NAV history and nothing else (no factsheets,
 * holdings, expense ratios or index data), so factsheet-driven features are
 * gated off via `src/lib/features.ts`.
 */
export const MFAPI_BASE = "https://api.mfapi.in";

const LIST_KEY = "mfapi:list:v1";
const LIST_TTL = 24 * 60 * 60 * 1000;
const NAV_KEY = (code: number) => `mfapi:nav:${code}:v1`;
const NAV_TTL = 12 * 60 * 60 * 1000;

interface Cached<T> {
  at: number;
  data: T;
}

interface ApiListItem {
  schemeCode: number | string;
  schemeName: string;
  isinGrowth?: string | null;
  isinDivReinvestment?: string | null;
}

interface ApiNavPoint {
  date: string; // dd-MM-yyyy
  nav: string;
}

interface ApiSchemeResponse {
  meta?: {
    fund_house?: string;
    scheme_type?: string;
    scheme_category?: string;
    scheme_code?: number | string;
    scheme_name?: string;
    isin_growth?: string | null;
    isin_div_reinvestment?: string | null;
  };
  data?: ApiNavPoint[];
  status?: string;
}

/** Cache-first with stale-on-failure: day-old NAVs beat an empty card. */
async function cached<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
  const hit = await get<Cached<T>>(key).catch(() => null);
  if (hit && Date.now() - hit.at < ttl) return hit.data;

  try {
    const data = await loader();
    await set(key, { at: Date.now(), data } satisfies Cached<T>).catch(() => {});
    return data;
  } catch (err) {
    if (hit) {
      console.warn(`[mfapi] serving stale cache for ${key} after fetch failure`, err);
      return hit.data;
    }
    throw err;
  }
}

async function getJson<T>(url: string, errorMessage: string, timeoutMs?: number): Promise<T> {
  const res = await fetchWithTimeout(url, {
    headers: { Accept: "application/json" },
    ...(timeoutMs ? { timeoutMs } : {}),
  });
  if (!res.ok) throw new Error(errorMessage);
  return (await res.json()) as T;
}

export async function fetchSchemeList(): Promise<SchemeListItem[]> {
  return cached(LIST_KEY, LIST_TTL, async () => {
    const data = await getJson<ApiListItem[]>(`${MFAPI_BASE}/mf`, "Failed to load scheme list");
    const out: SchemeListItem[] = [];
    for (const s of data) {
      const code = Number(s.schemeCode);
      if (!Number.isFinite(code) || !s.schemeName) continue;
      out.push({
        schemeCode: code,
        schemeName: s.schemeName.replace(/\s+/g, " ").trim(),
        isinGrowth: s.isinGrowth ?? null,
        isinDivReinvestment: s.isinDivReinvestment ?? null,
      });
    }
    return out;
  });
}

/** "dd-MM-yyyy" → unix ms at UTC midnight. */
function parseDate(s: string): number {
  const [d, m, y] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function toNavRows(history: ApiNavPoint[] | undefined): NavRow[] {
  return (history ?? [])
    .map((p) => ({ t: parseDate(p.date), nav: Number(p.nav) }))
    .filter((r) => Number.isFinite(r.nav) && r.nav > 0 && Number.isFinite(r.t))
    .sort((a, b) => a.t - b.t);
}

function toMeta(code: number, m: ApiSchemeResponse["meta"]): SchemeMeta {
  return {
    fund_house: m?.fund_house ?? "",
    scheme_type: m?.scheme_type ?? "",
    scheme_category: m?.scheme_category ?? "",
    scheme_code: Number(m?.scheme_code ?? code),
    scheme_name: (m?.scheme_name ?? "").replace(/\s+/g, " ").trim(),
    isin_growth: m?.isin_growth ?? null,
    isin_div_reinvestment: m?.isin_div_reinvestment ?? null,
  };
}

/**
 * In-flight dedupe: a screen and an open comparison card can ask for the same
 * scheme at the same moment. Without this, both pay the full download and both
 * write the same blob to IndexedDB.
 */
const inflight = new Map<number, Promise<NormalizedScheme>>();

export async function fetchScheme(code: number): Promise<NormalizedScheme> {
  const running = inflight.get(code);
  if (running) return running;

  const p = cached(NAV_KEY(code), NAV_TTL, async () => {
    const data = await getJson<ApiSchemeResponse>(
      `${MFAPI_BASE}/mf/${code}`,
      "Failed to load scheme " + code,
      // Full NAV history is a large payload; the 15s default aborts healthy but
      // slow downloads, which then get retried from scratch — making it slower.
      30_000,
    );
    const rows = toNavRows(data.data);
    if (!rows.length) throw new Error("No NAV history for scheme " + code);
    return { meta: toMeta(code, data.meta), rows };
  }).finally(() => inflight.delete(code));

  inflight.set(code, p);
  return p;
}
