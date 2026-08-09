import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithTimeout, HttpError, DEFAULT_TIMEOUT_MS } from "./http";

const okResponse = () => new Response("{}", { status: 200 });
const errorResponse = (status: number) => new Response("", { status });

describe("fetchWithTimeout", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the response on success without retrying", async () => {
    const spy = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", spy);
    const res = await fetchWithTimeout("https://example.test/a");
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("passes an abort signal so a request cannot hang forever", async () => {
    const spy = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", spy);
    await fetchWithTimeout("https://example.test/a");
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeDefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("retries a 500 and succeeds on a later attempt", async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", spy);
    const res = await fetchWithTimeout("https://example.test/a", { retries: 2 });
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a 404 — the request itself is wrong", async () => {
    const spy = vi.fn().mockResolvedValue(errorResponse(404));
    vi.stubGlobal("fetch", spy);
    await expect(fetchWithTimeout("https://example.test/a", { retries: 3 })).rejects.toBeInstanceOf(
      HttpError,
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("does retry a 429, since rate limiting is transient", async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", spy);
    const res = await fetchWithTimeout("https://example.test/a", { retries: 1 });
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("gives up after the configured number of retries rather than looping", async () => {
    const spy = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", spy);
    await expect(fetchWithTimeout("https://example.test/a", { retries: 2 })).rejects.toThrow();
    expect(spy).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("never retries a caller-initiated abort", async () => {
    const controller = new AbortController();
    const spy = vi.fn().mockImplementation(() => {
      controller.abort();
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    });
    vi.stubGlobal("fetch", spy);
    await expect(
      fetchWithTimeout("https://example.test/a", { retries: 3, signal: controller.signal }),
    ).rejects.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("exposes a sane default timeout", () => {
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(1000);
    expect(DEFAULT_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});
