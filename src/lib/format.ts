export const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export const inrDecimal = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export function fmtInr(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${inr.format(Math.round(n))}`;
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtPctRaw(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function fmtDate(t: number): string {
  return new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateShort(t: number): string {
  return new Date(t).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

/** deterministic color from index for schemes */
export const CHART_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)",
  "var(--chart-6)", "var(--chart-7)", "var(--chart-8)", "var(--chart-9)", "var(--chart-10)",
];

export function colorFor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

export function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadFile(name: string, content: string | Blob, mime = "text/plain") {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
