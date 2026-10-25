import { useEffect, useState } from "react";

const PREFIX = "fs.state.v1:";

interface Options<T> {
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T | undefined;
}

/**
 * useState that survives page reloads (phone lock / app being killed in the
 * background) by mirroring the value into localStorage. SSR-safe: the server
 * renders the initial value, the browser picks up the stored one on mount.
 */
export function usePersistentState<T>(key: string, initial: T, options?: Options<T>) {
  const storageKey = PREFIX + key;
  const serialize = options?.serialize ?? defaultSerialize;
  const deserialize = options?.deserialize ?? defaultDeserialize;

  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    let stored: T | undefined;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw != null && raw !== "") stored = deserialize(raw);
    } catch {
      stored = undefined;
    }
    return (stored === undefined ? initial : stored) as T;
  });

  useEffect(() => {
    try {
      const raw = serialize(value);
      if (raw === "") window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, raw);
    } catch {
      /* storage unavailable or full — keep the in-memory value */
    }
  }, [storageKey, value, serialize, deserialize]);

  return [value, setValue] as const;
}

function defaultSerialize(value: unknown): string {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

function defaultDeserialize(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}
