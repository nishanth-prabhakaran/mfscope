import { get, set } from "idb-keyval";
import type { NormalizedScheme, SchemeDetail, SchemeListItem, NavRow } from "@/types/mf";

const LIST_KEY = "mfapi:list:v1";
const LIST_TTL = 24 * 60 * 60 * 1000;
const NAV_KEY = (code: number) => `mfapi:nav:${code}:v1`;
const NAV_TTL = 12 * 60 * 60 * 1000;

interface Cached<T> { at: number; data: T }

async function cached<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
  const hit = await get<Cached<T>>(key).catch(() => null);
  if (hit && Date.now() - hit.at < ttl) return hit.data;
  const data = await loader();
  await set(key, { at: Date.now(), data } satisfies Cached<T>).catch(() => {});
  return data;
}

export async function fetchSchemeList(): Promise<SchemeListItem[]> {
  return cached(LIST_KEY, LIST_TTL, async () => {
    const res = await fetch("https://api.mfapi.in/mf");
    if (!res.ok) throw new Error("Failed to load scheme list");
    return (await res.json()) as SchemeListItem[];
  });
}

function parseDate(dmy: string): number {
  // dd-mm-yyyy
  const [d, m, y] = dmy.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export async function fetchScheme(code: number): Promise<NormalizedScheme> {
  return cached(NAV_KEY(code), NAV_TTL, async () => {
    const res = await fetch(`https://api.mfapi.in/mf/${code}`);
    if (!res.ok) throw new Error("Failed to load scheme " + code);
    const detail = (await res.json()) as SchemeDetail;
    const rows: NavRow[] = detail.data
      .map((p) => ({ t: parseDate(p.date), nav: Number(p.nav) }))
      .filter((r) => Number.isFinite(r.nav) && r.nav > 0 && Number.isFinite(r.t))
      .sort((a, b) => a.t - b.t);
    return { meta: detail.meta, rows };
  });
}
