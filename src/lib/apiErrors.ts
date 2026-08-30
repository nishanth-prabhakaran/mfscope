/**
 * Turns raw fetch/query failures into one short, human sentence.
 *
 * Every data call in the app goes through MFAPI, so the useful distinction for
 * a user is *why* it failed (offline / timed out / provider down / rate limited)
 * and whether retrying is worth it — not the stack trace.
 */

import { toast } from "sonner";
import { HttpError } from "./http";

export interface ApiErrorInfo {
  title: string;
  description: string;
}

export function describeApiError(error: unknown, context?: string): ApiErrorInfo {
  const where = context ? `${context}: ` : "";

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      title: "You're offline",
      description: `${where}reconnect and we'll load fresh NAV data. Cached funds still work.`,
    };
  }

  const err = error instanceof Error ? error : new Error(String(error));

  if (err.name === "TimeoutError" || /timed? ?out/i.test(err.message)) {
    return {
      title: "MFAPI is slow to respond",
      description: `${where}the request timed out. Try again in a moment.`,
    };
  }

  if (err instanceof HttpError && err.status) {
    if (err.status === 429) {
      return {
        title: "Too many requests",
        description: `${where}MFAPI is rate limiting us. Wait a few seconds and retry.`,
      };
    }
    if (err.status >= 500) {
      return {
        title: "MFAPI is having trouble",
        description: `${where}the data provider returned ${err.status}. This is on their side.`,
      };
    }
    return {
      title: "Request rejected",
      description: `${where}MFAPI returned ${err.status}.`,
    };
  }

  if (err.name === "AbortError") {
    return { title: "Request cancelled", description: `${where}the request was aborted.` };
  }

  if (/failed to fetch|networkerror|load failed/i.test(err.message)) {
    return {
      title: "Network error",
      description: `${where}couldn't reach MFAPI. Check your connection and retry.`,
    };
  }

  return { title: "Something went wrong", description: `${where}${err.message}` };
}

/**
 * A screen can fail 20 funds at once; without a stable id the user gets buried.
 * Same id = same toast updated in place.
 */
export function toastApiError(error: unknown, context?: string, id?: string) {
  const { title, description } = describeApiError(error, context);
  toast.error(title, { description, id: id ?? `api:${title}`, duration: 6000 });
}
