import { Info, BookOpen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { METRIC_DOCS, METRIC_GROUPS } from "@/lib/metricInfo";

/** Tap/hover info icon explaining a single metric. */
export function MetricInfo({ id, className = "" }: { id: string; className?: string }) {
  const doc = METRIC_DOCS[id];
  if (!doc) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What is ${doc.label}?`}
          className={`inline-flex items-center justify-center text-muted-foreground/70 hover:text-primary transition-colors align-middle ${className}`}
        >
          <Info className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 text-xs leading-relaxed">
        <p className="font-semibold text-sm mb-1">{doc.label}</p>
        <p className="text-muted-foreground">{doc.what}</p>
        <p className="mt-2">{doc.read}</p>
      </PopoverContent>
    </Popover>
  );
}

/** Legend chip explaining best / second-best colouring. */
export function RankLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground ${className}`}>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-success" /> Best
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-info" /> 2nd best
      </span>
    </div>
  );
}

/** Full glossary of every ratio used in the app. */
export function MetricGlossaryButton({ className = "" }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={`h-8 gap-1.5 text-xs ${className}`}>
          <BookOpen className="h-3.5 w-3.5" />
          Explain the ratios
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Metric glossary</DialogTitle>
          <DialogDescription>
            Every ratio used across the comparison tables, in plain English.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-6">
            {METRIC_GROUPS.map((group) => {
              const docs = Object.values(METRIC_DOCS).filter((d) => d.group === group);
              if (!docs.length) return null;
              return (
                <section key={group}>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">{group}</h4>
                  <dl className="space-y-3">
                    {docs.map((d) => (
                      <div key={d.label} className="border-l-2 border-border pl-3">
                        <dt className="text-sm font-medium">{d.label}</dt>
                        <dd className="text-xs text-muted-foreground mt-0.5">{d.what}</dd>
                        <dd className="text-xs mt-1">{d.read}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
