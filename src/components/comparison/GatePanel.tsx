import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShieldAlert, TriangleAlert, ChevronDown, ChevronUp } from "lucide-react";
import type { Gate } from "@/lib/riskProfile";
import { cn } from "@/lib/utils";

interface Props {
  gates: Gate[];
  /** Set when the user has chosen to see funds anyway despite a blocking gate. */
  overridden: boolean;
  onOverride: () => void;
}

export function GatePanel({ gates, overridden, onOverride }: Props) {
  const [expanded, setExpanded] = useState<string | null>(gates[0]?.id ?? null);
  if (!gates.length) return null;

  const blocking = gates.filter((g) => g.severity === "block");
  const warnings = gates.filter((g) => g.severity === "warn");
  const hasBlock = blocking.length > 0;

  return (
    <div
      className={cn(
        "mt-4 min-w-0 rounded-lg border p-3",
        hasBlock ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/5",
      )}
    >
      <div className="flex gap-2">
        {hasBlock ? (
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        ) : (
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {hasBlock ? "Before you invest in any fund" : "Worth sorting out first"}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {hasBlock
              ? "Based on your answers, buying an equity fund right now would likely leave you worse off than these steps. This isn't about picking a better fund — no fund solves these."
              : "None of these stop you investing, but they meaningfully change how much risk you're actually taking."}
          </p>
        </div>
      </div>

      <div className="mt-3 grid min-w-0 gap-2">
        {[...blocking, ...warnings].map((g) => {
          const open = expanded === g.id;
          return (
            <div
              key={g.id}
              className="min-w-0 overflow-hidden rounded-md border border-border/50 bg-background/40"
            >
              <button
                type="button"
                onClick={() => setExpanded(open ? null : g.id)}
                className="flex w-full min-w-0 items-center justify-between gap-3 px-3 py-2 text-left"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      g.severity === "block"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-warning/15 text-warning",
                    )}
                  >
                    {g.severity === "block" ? "Stop" : "Check"}
                  </span>
                  <span className="truncate text-xs font-medium">{g.title}</span>
                </span>
                {open ? (
                  <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </button>
              {open && (
                <div className="border-t border-border/50 px-3 py-2.5">
                  <p className="text-xs leading-relaxed text-muted-foreground">{g.detail}</p>
                  <p className="mt-2 text-xs leading-relaxed font-medium">{g.action}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasBlock && !overridden && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 text-[11px] text-muted-foreground">
            You can still browse funds — but please treat the above as the higher priority.
          </p>
          <Button size="sm" variant="ghost" className="shrink-0 text-xs" onClick={onOverride}>
            Show funds anyway
          </Button>
        </div>
      )}
    </div>
  );
}
