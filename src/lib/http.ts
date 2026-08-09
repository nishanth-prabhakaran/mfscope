/**
 * Network helpers shared by every data fetch.
 *
 * Previously each `fetch` ran with no timeout, so a provider that hung rather
 * than erroring left the UI spinning indefinitely with no way to recover — the
 * worst failure mode available, because it is indistinguishable from slowness
 * and never resolves.
 */

/** Default ceiling for a single attempt. Generous enough for a cold API, short
 *  enough that a hung connection surfaces as an error the UI can act on. */
export const DEFAULT_TIMEOUT_MS = 15_000;

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  /** Extra attempts after the first. */
  retries?: number;
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** 4xx (other than 408/429) means the request itself is wrong — retrying just
 *  wastes time and hammers the provider. */
function isRetryableStatus(status: number): boolean {
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch with a hard timeout and bounded exponential backoff.
 *
 * Any caller-supplied `signal` is respected alongside the timeout, so an
 * unmounting component still aborts the request.
 */
export async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = 2, signal, ...init } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    // Combine so either the caller or the timeout can abort.
    const combined =
      signal && typeof AbortSignal.any === "function"
        ? AbortSignal.any([signal, timeoutSignal])
        : (signal ?? timeoutSignal);

    let nonRetryable = false;
    try {
      const res = await fetch(url, { ...init, signal: combined });
      if (res.ok) return res;

      lastError = new HttpError(`Request failed (${res.status})`, res.status);
      // A 4xx (other than 408/429) is the request's fault, not the network's.
      // Flag rather than throw here: throwing inside this try would be caught
      // by the handler below and retried anyway.
      nonRetryable = !isRetryableStatus(res.status);
    } catch (err) {
      // A caller-initiated abort is intentional — never retry it.
      if (signal?.aborted) throw err;
      lastError = err;
    }

    if (nonRetryable || attempt === retries) break;

    // 400ms, 800ms, 1600ms … with jitter so retries don't synchronise across
    // the dozens of parallel fund fetches a screen can trigger.
    const backoff = 400 * 2 ** attempt;
    await sleep(backoff + Math.random() * 200);
  }

  throw lastError instanceof Error
    ? lastError
    : new HttpError("Network request failed", undefined, lastError);
}
