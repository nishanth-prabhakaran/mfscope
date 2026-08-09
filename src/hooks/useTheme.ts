import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export const THEME_KEY = "mf-theme-v1";

export function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  return choice === "system" ? systemTheme() : choice;
}

/**
 * Applies the theme to <html>. Both classes are managed explicitly because the
 * dark palette lives on :root (not on a .dark class), while Tailwind's `dark:`
 * variant keys off `.dark` — so the class must be present for both to agree.
 */
export function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.classList.toggle("light", resolved === "light");
  el.classList.toggle("dark", resolved === "dark");
  el.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "light" ? "#ffffff" : "#131820");
}

function readStored(): ThemeChoice {
  if (typeof window === "undefined") return "dark";
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return raw === "light" || raw === "dark" || raw === "system" ? raw : "dark";
  } catch {
    return "dark";
  }
}

export function useTheme() {
  // Start from the server-safe default; the inline boot script has already
  // applied the real theme to <html>, so we sync in an effect to avoid a
  // hydration mismatch.
  const [choice, setChoiceState] = useState<ThemeChoice>("dark");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStored();
    setChoiceState(stored);
    setResolved(resolveTheme(stored));
    setReady(true);
  }, []);

  // Follow the OS when the user has chosen "system".
  useEffect(() => {
    if (choice !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const next = systemTheme();
      setResolved(next);
      applyTheme(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    const r = resolveTheme(next);
    setResolved(r);
    applyTheme(r);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setChoice(resolved === "dark" ? "light" : "dark");
  }, [resolved, setChoice]);

  return { choice, resolved, setChoice, toggle, ready };
}
