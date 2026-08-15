import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Guards against a tab trigger existing with no matching content.
 *
 * The Switch Cost tab shipped with a TabsTrigger but no TabsContent: the
 * trigger rendered, the tab was clickable, and it displayed nothing. Nothing
 * in typecheck, lint or the unit tests catches that, because both halves are
 * individually valid JSX.
 */
const source = readFileSync(resolve(import.meta.dirname, "index.tsx"), "utf8");

function valuesOf(tag: "TabsTrigger" | "TabsContent"): string[] {
  const re = new RegExp(`<${tag}\\s+value="([^"]+)"`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) out.push(m[1]);
  return out;
}

describe("tab wiring", () => {
  it("gives every tab trigger a matching content panel", () => {
    const triggers = new Set(valuesOf("TabsTrigger"));
    const contents = new Set(valuesOf("TabsContent"));
    const orphaned = [...triggers].filter((v) => !contents.has(v));
    expect(orphaned).toEqual([]);
  });

  it("does not leave content panels unreachable by any trigger", () => {
    const triggers = new Set(valuesOf("TabsTrigger"));
    const contents = new Set(valuesOf("TabsContent"));
    const unreachable = [...contents].filter((v) => !triggers.has(v));
    expect(unreachable).toEqual([]);
  });

  it("finds a non-trivial number of tabs, so the regexes still match", () => {
    expect(valuesOf("TabsTrigger").length).toBeGreaterThan(10);
  });
});
