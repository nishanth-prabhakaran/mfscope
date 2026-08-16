import { useMemo } from "react";
import { Scale, TrendingUp, TriangleAlert, Info, Eye } from "lucide-react";
import { buildInvestmentCase, type CasePoint, type CaseInput } from "@/lib/investmentCase";
import { cn } from "@/lib/utils";

interface Props extends CaseInput {
  /** Set when the risk profiler has been completed, to close the loop. */
  profileNote?: string | null;
}

const EVIDENCE_LABEL: Record<CasePoint["evidence"], string> = {
  strong: "Strong evidence",
  moderate: "Moderate evidence",
  limited: "Limited evidence",
};

export function InvestmentCaseSection({ profileNote, ...input }: Props) {
  const c = useMemo(() => buildInvestmentCase(input), [input]);

  const qualityTone =
    c.evidenceQuality === "solid"
      ? "border-success/40 bg-success/5"
      : c.evidenceQuality === "thin"
        ? "border-warning/40 bg-warning/5"
        : "border-border/60 bg-muted/20";

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Scale className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h4 className="font-display text-base font-semibold">The case for and against</h4>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Conviction that survives a crash comes from having looked at the crash first — not from
            a score. Everything below is drawn from this fund's own record.
          </p>
        </div>
      </div>

      {/* How much the evidence can carry */}
      <div className={cn("rounded-lg border p-3", qualityTone)}>
        <p className="text-xs font-medium capitalize">Evidence: {c.evidenceQuality}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.evidenceNote}</p>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <PointList
          title="The case for"
          icon={<TrendingUp className="h-3.5 w-3.5 text-success" />}
          points={c.strengths}
          emptyNote="Nothing in this fund's record stands out as a durable strength. That is a finding, not a gap in the data."
          tone="success"
        />
        <PointList
          title="The case against"
          icon={<TriangleAlert className="h-3.5 w-3.5 text-warning" />}
          points={c.concerns}
          emptyNote="No structural concerns surfaced from cost, size, drawdown behaviour or holding-period record."
          tone="warning"
        />
      </div>

      {/* What you'd have had to sit through */}
      {c.lived.length > 0 && (
        <div className="min-w-0 rounded-lg border border-border/60 p-3">
          <div className="flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            <h5 className="text-sm font-semibold">What you would have had to sit through</h5>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            On ₹10,00,000 invested before each episode. These are the moments that decide whether a
            plan survives — read them before deciding, not during.
          </p>
          <div className="mt-2.5 grid min-w-0 gap-2">
            {c.lived.map((m) => (
              <div
                key={m.label}
                className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border/50 px-3 py-2"
              >
                <span className="min-w-0 truncate text-xs">{m.label}</span>
                <span className="num shrink-0 text-right text-xs">
                  <span className="text-destructive">₹{(m.troughValue / 100000).toFixed(2)}L</span>
                  <span className="text-muted-foreground">
                    {" "}
                    ({(m.decline * 100).toFixed(0)}%) · {m.recoveryLabel}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Falsifiers */}
      <div className="min-w-0 rounded-lg border border-border/60 p-3">
        <h5 className="text-sm font-semibold">What would change this assessment</h5>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          A view you cannot state the conditions for abandoning is attachment, not conviction. Any
          of these would weaken the case:
        </p>
        <ul className="mt-2 space-y-1.5">
          {c.falsifiers.map((f) => (
            <li key={f} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {profileNote && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs leading-relaxed">{profileNote}</p>
        </div>
      )}

      <p className="flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Not a recommendation, and deliberately not a score — a number would invite you to skip the
          reasoning, which is the part that matters. Thresholds are set relative to the fund's
          category where peer data allows. Every figure is history; none of it is a forecast.
        </span>
      </p>
    </div>
  );
}

function PointList({
  title,
  icon,
  points,
  emptyNote,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  points: CasePoint[];
  emptyNote: string;
  tone: "success" | "warning";
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        {icon}
        <h5 className="text-sm font-semibold">{title}</h5>
        <span className="num text-[11px] text-muted-foreground">({points.length})</span>
      </div>
      {points.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-border/60 p-3 text-xs leading-relaxed text-muted-foreground">
          {emptyNote}
        </p>
      ) : (
        <div className="mt-2 grid min-w-0 gap-2">
          {points.map((p) => (
            <div
              key={p.id}
              className={cn(
                "min-w-0 rounded-lg border p-3",
                tone === "success"
                  ? "border-success/30 bg-success/5"
                  : "border-warning/30 bg-warning/5",
              )}
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <p className="min-w-0 text-xs font-medium">{p.title}</p>
                <span className="shrink-0 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {EVIDENCE_LABEL[p.evidence]}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
