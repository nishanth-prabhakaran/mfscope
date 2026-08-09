import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ShieldCheck,
  ArrowLeft,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
} from "lucide-react";
import type { NormalizedScheme } from "@/types/mf";
import {
  QUESTIONS,
  BANDS,
  scoreProfile,
  analyseFundRisk,
  matchFund,
  VERDICT_TONE,
  type Answers,
} from "@/lib/riskProfile";
import { useRiskProfile } from "@/hooks/useRiskProfile";
import { ProfileSuggestionsCard } from "./ProfileSuggestionsCard";
import { fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
  onAdd?: (f: { schemeCode: number; schemeName: string }) => void;
  isSelected?: (code: number) => boolean;
  canAdd?: boolean;
}

export function RiskProfilerCard({ schemes, onAdd, isSelected, canAdd = true }: Props) {
  const { answers, setAnswers, completed, setCompleted, reset } = useRiskProfile();
  const [step, setStep] = useState(0);
  const [started, setStarted] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const profile = useMemo(() => (completed ? scoreProfile(answers) : null), [answers, completed]);

  const matches = useMemo(() => {
    if (!profile) return [];
    return schemes.map((s) => {
      const fund = analyseFundRisk(s.name, s.data.rows, profile.horizonWindow);
      return { ...s, fund, match: matchFund(fund, profile, answers) };
    });
  }, [schemes, profile, answers]);

  // ---------------------------------------------------------------- intro
  if (!completed && !started) {
    return (
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold sm:text-lg">
                Not sure which fund suits you?
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                Answer {QUESTIONS.length} questions (about 4 minutes) and we'll show how each fund's
                real historical behaviour compares with what you're comfortable holding.
              </p>
            </div>
          </div>
          <Button onClick={() => setStarted(true)} className="shrink-0">
            Start
          </Button>
        </div>
      </Card>
    );
  }

  // ---------------------------------------------------------------- questionnaire
  if (!completed) {
    const q = QUESTIONS[step];
    const pctDone = (step / QUESTIONS.length) * 100;

    const choose = (value: number) => {
      const next: Answers = { ...answers, [q.id]: value };
      setAnswers(next);
      if (step === QUESTIONS.length - 1) setCompleted(true);
      else setStep(step + 1);
    };

    return (
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Question {step + 1} of {QUESTIONS.length}
          </span>
          <span className="text-xs capitalize text-muted-foreground">
            {q.dimension === "capacity" ? "Your situation" : "Your temperament"}
          </span>
        </div>
        <Progress value={pctDone} className="mt-2 h-1" />

        <h3 className="mt-4 font-display text-base font-semibold sm:text-lg">{q.text}</h3>
        {q.help && <p className="mt-1 text-xs text-muted-foreground">{q.help}</p>}

        <div className="mt-4 grid gap-2">
          {q.options.map((o) => {
            const active = answers[q.id] === o.value;
            return (
              <button
                key={o.label}
                type="button"
                onClick={() => choose(o.value)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/60 hover:border-primary/50 hover:bg-muted/40",
                )}
              >
                {o.label}
                {o.note && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{o.note}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStarted(false);
              setStep(0);
            }}
          >
            Skip for now
          </Button>
        </div>
      </Card>
    );
  }

  // ---------------------------------------------------------------- result
  const meta = BANDS[profile!.band];

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Your risk profile
            </p>
            <h3 className={cn("font-display text-lg font-semibold sm:text-xl", meta.tone)}>
              {meta.label}
            </h3>
            <p className="mt-0.5 max-w-prose text-xs text-muted-foreground sm:text-sm">
              {meta.blurb}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => {
            reset();
            setStep(0);
            setStarted(true);
          }}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Retake
        </Button>
      </div>

      {/* Capacity vs tolerance — the part advanced users care about */}
      <button
        type="button"
        onClick={() => setShowDetail((v) => !v)}
        className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {showDetail ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        How this was worked out
      </button>

      {showDetail && (
        <div className="mt-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capacity (your situation)</span>
                <span className="num">{profile!.capacityScore.toFixed(0)}/100</span>
              </div>
              <Progress value={profile!.capacityScore} className="mt-1 h-1" />
            </div>
            <div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tolerance (your temperament)</span>
                <span className="num">{profile!.toleranceScore.toFixed(0)}/100</span>
              </div>
              <Progress value={profile!.toleranceScore} className="mt-1 h-1" />
            </div>
          </div>
          <p className="mt-2.5 leading-relaxed text-muted-foreground">
            Your band is set by the <strong className="text-foreground">lower</strong> of the two.{" "}
            {profile!.limitedBy === "tolerance"
              ? "Your circumstances could support more risk, but your stated reaction to a fall is the binding constraint — and behaviour is what actually determines returns."
              : profile!.limitedBy === "capacity"
                ? "You're comfortable with volatility, but your horizon or safety net is the binding constraint."
                : "Your situation and temperament are well aligned."}{" "}
            Funds are assessed over {profile!.horizonWindow}-year rolling windows to match your
            stated horizon.
          </p>
        </div>
      )}

      {/* Fund matches */}
      {matches.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
          Add funds below and each one will be checked against this profile.
        </p>
      ) : (
        <div className="mt-4 grid gap-2">
          {matches.map((m, idx) => {
            const open = expanded === m.code;
            return (
              <div key={m.code} className="rounded-lg border border-border/60">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : m.code)}
                  className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {m.fund.category ?? "Fund"} · {BANDS[m.fund.band].label}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {m.match.warnings.length > 0 && (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    )}
                    <span className={cn("text-xs font-semibold", VERDICT_TONE[m.match.verdict])}>
                      {m.match.label}
                    </span>
                    {open ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {open && (
                  <div className="border-t border-border/50 px-3 py-2.5 text-xs">
                    <p className="leading-relaxed">{m.match.reason}</p>

                    {m.match.warnings.map((w) => (
                      <p key={w} className="mt-2 flex gap-1.5 leading-relaxed text-amber-400">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{w}</span>
                      </p>
                    ))}

                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
                      <Stat label="Volatility" value={fmtPct(m.fund.volatility, 1)} />
                      <Stat label="Worst fall" value={fmtPct(m.fund.maxDrawdown, 1)} />
                      <Stat
                        label={`Worst ${m.fund.horizonWindow}Y window`}
                        value={
                          m.fund.worstAtHorizon != null
                            ? `${m.fund.worstAtHorizon.toFixed(1)}%`
                            : "—"
                        }
                      />
                      <Stat
                        label={`${m.fund.horizonWindow}Y windows positive`}
                        value={
                          m.fund.positivePctAtHorizon != null
                            ? `${m.fund.positivePctAtHorizon.toFixed(0)}%`
                            : "—"
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ProfileSuggestionsCard
        profile={profile!}
        onAdd={onAdd}
        isSelected={isSelected}
        canAdd={canAdd}
      />

      <p className="mt-4 flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Educational only — not investment advice, and not a substitute for SEBI's official
          riskometer shown on each scheme's factsheet. Suitability here compares a fund's past
          behaviour with your self-reported comfort; past behaviour does not predict future returns.
        </span>
      </p>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="num mt-0.5 font-medium">{value}</p>
    </div>
  );
}
