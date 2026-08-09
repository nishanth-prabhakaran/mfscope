import { lazy, type ComponentType } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;

/**
 * `React.lazy` that survives a deploy happening mid-session.
 *
 * Chunk filenames are content-hashed. When a new version ships, the old hashed
 * files disappear — so a user who had the page open before the deploy requests
 * a chunk that no longer exists, the dynamic import rejects, and the whole app
 * dies at the Suspense boundary. This is not hypothetical: it fires for anyone
 * with a tab open across a release, and it became a live risk the moment the
 * bundle was split into 40-odd chunks.
 *
 * Strategy:
 *   1. Retry once after a short delay — covers a genuinely transient network
 *      blip rather than a stale reference.
 *   2. If it still fails and we haven't already reloaded for this reason,
 *      force a reload. That fetches the current index.html and its correct
 *      chunk names, and the user lands back where they were.
 *   3. The reload flag is stored in sessionStorage so a real, persistent
 *      failure (offline, provider down) cannot cause a reload loop — it
 *      surfaces as an error boundary instead.
 */
const RELOAD_FLAG = "mf-chunk-reloaded";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function hasReloaded(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) === "1";
  } catch {
    return false;
  }
}

function markReloaded() {
  try {
    sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    /* storage unavailable — fall through to the error boundary */
  }
}

/** Clears the guard once the app has successfully loaded a chunk again. */
export function clearChunkReloadFlag() {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* ignore */
  }
}

export function lazyWithRetry<T extends AnyComponent>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory();
      clearChunkReloadFlag();
      return mod;
    } catch (err) {
      await sleep(400);
      try {
        const mod = await factory();
        clearChunkReloadFlag();
        return mod;
      } catch (retryErr) {
        if (typeof window !== "undefined" && !hasReloaded()) {
          markReloaded();
          window.location.reload();
          // Never resolves; the reload takes over.
          return new Promise<{ default: T }>(() => {});
        }
        throw retryErr;
      }
    }
  });
}
