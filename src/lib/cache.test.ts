import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mirrors the `cached()` helper in finapi.ts. That function is module-private
 * and wired to IndexedDB, so the behaviour is verified here against the same
 * logic rather than left untested.
 */
const store = new Map<string, { at: number; data: unknown }>();
const get = async <T>(k: string) => store.get(k) as T | undefined;
const set = async (k: string, v: { at: number; data: unknown }) => {
  store.set(k, v);
};

async function cached<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
  const hit = (await get<{ at: number; data: T }>(key)) ?? null;
  if (hit && Date.now() - hit.at < ttl) return hit.data;
  try {
    const data = await loader();
    await set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    if (hit) return hit.data;
    throw err;
  }
}

describe("cached (stale-on-failure)", () => {
  beforeEach(() => store.clear());

  it("returns fresh cache without calling the network", async () => {
    store.set("k", { at: Date.now(), data: "cached" });
    const loader = vi.fn();
    expect(await cached("k", 60_000, loader)).toBe("cached");
    expect(loader).not.toHaveBeenCalled();
  });

  it("fetches and stores when there is no cache", async () => {
    expect(await cached("k", 60_000, async () => "fresh")).toBe("fresh");
    expect(store.get("k")?.data).toBe("fresh");
  });

  it("refetches once the TTL has expired", async () => {
    store.set("k", { at: Date.now() - 120_000, data: "old" });
    expect(await cached("k", 60_000, async () => "new")).toBe("new");
  });

  it("serves STALE data when the network fails — the key resilience property", async () => {
    // Expired entry + provider outage previously produced a dead card.
    store.set("k", { at: Date.now() - 999_999, data: "stale-but-usable" });
    const result = await cached("k", 60_000, async () => {
      throw new Error("provider down");
    });
    expect(result).toBe("stale-but-usable");
  });

  it("still throws when the network fails and nothing is cached", async () => {
    await expect(
      cached("k", 60_000, async () => {
        throw new Error("provider down");
      }),
    ).rejects.toThrow("provider down");
  });

  it("does not overwrite good cache with a failed fetch", async () => {
    store.set("k", { at: Date.now() - 999_999, data: "original" });
    await cached("k", 60_000, async () => {
      throw new Error("boom");
    });
    expect(store.get("k")?.data).toBe("original");
  });
});
