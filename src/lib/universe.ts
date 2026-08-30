/**
 * Helpers for building a screenable universe of funds from the full scheme list.
 *
 * Shared by the Top Funds leaderboard and the risk-profiler suggestions so both
 * apply the same dedupe rules and fetch budget.
 */

import { guessAmc, guessCategory } from "./categories";
import type { SchemeListItem } from "@/types/mf";

export const UNIVERSE_CAP = 60;
// MFAPI serves one full NAV history per request, so the screen is latency-bound,
// not CPU-bound: more sockets in flight is the single biggest win. Browsers cap
// at ~6 connections per host anyway, so this mostly removes our own throttle.
export const CONCURRENCY = 16;

export interface UniverseFund {
  code: number;
  name: string;
  amc: string;
  category: string;
}

/** Collapse plan/option variants of the same scheme onto one key. */
export function dedupeKey(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(plan|option|scheme|fund)\b/g, " ")
    .replace(/\bidcw\b/g, "dividend")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Direct-Growth funds in `category`, one per AMC, capped for a sane fetch budget.
 */
export function buildUniverse(
  list: SchemeListItem[] | undefined,
  category: string,
  cap = UNIVERSE_CAP,
): UniverseFund[] {
  if (!list) return [];
  const seen = new Map<string, UniverseFund>();
  for (const s of list) {
    const name = s.schemeName;
    const lower = name.toLowerCase();
    if (!lower.includes("direct") || !lower.includes("growth")) continue;
    if (guessCategory(name) !== category) continue;
    const key = dedupeKey(name);
    const prev = seen.get(key);
    if (!prev || s.schemeCode < prev.code) {
      seen.set(key, { code: s.schemeCode, name, amc: guessAmc(name), category });
    }
  }
  // One entry per AMC keeps the leaderboard diverse and the fetch budget small.
  const perAmc = new Map<string, UniverseFund>();
  for (const f of seen.values()) {
    const prev = perAmc.get(f.amc);
    if (!prev || f.name.length < prev.name.length) perAmc.set(f.amc, f);
  }
  return Array.from(perAmc.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, cap);
}

/** Run `fn` over `items` with bounded concurrency; failures resolve to null. */
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        try {
          out[i] = await fn(items[i]);
        } catch {
          out[i] = null;
        }
      }
    }),
  );
  return out;
}
