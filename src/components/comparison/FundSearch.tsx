import { use `useMemo, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSchemeList } from "@/hooks/useSchemes";
import { guessAmc, guessCategory, CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { SelectedFund } from "@/hooks/useSelection";

interface Props {
  onPick: (f: SelectedFund) => void;
  isSelected: (code: number) => boolean;
  disabled?: boolean;
}

export function FundSearch({ onPick, isSelected, disabled }: Props) {
  const { data, isLoading } = useSchemeList();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [focused, setFocused] = useState(false);

  // Restrict to Direct Growth for cleaner comparisons.
  const filtered = useMemo(() => {
    if (!data) return [];
    const query = q.trim().toLowerCase();
    if (query.length < 2 && category === "All") return [];
    const out: Array<{ code: number; name: string; amc: string; cat: string | null }> = [];
    for (const s of data) {
      const name = s.schemeName;
      const lower = name.toLowerCase();
      if (!lower.includes("direct") || !lower.includes("growth")) continue;
      const cat = guessCategory(name);
      if (category !== "All" && cat !== category) continue;
      if (query) {
        if (!(lower.includes(query) || guessAmc(name).toLowerCase().includes(query))) continue;
      }
      out.push({ code: s.schemeCode, name, amc: guessAmc(name), cat });
      if (out.length >= 60) break;
    }
    return out;
  }, [data, q, category]);

  return (
    <div className="relative w-full">
      <div className="w-full">
        <div className="relative w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
          {isLoading && (
            <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 h-6 w-6 animate-spin text-muted-foreground" />
          )}
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder={isLoading ? "Loading schemes…" : "Search Direct Growth funds by scheme or AMC…"}
            className="w-full pl-14 pr-14 h-16 md:h-[72px] text-lg md:text-xl bg-card/60 border-border/60 rounded-2xl placeholder:text-muted-foreground/70"
            disabled={disabled || isLoading}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["All", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors",
                category === c
                  ? "bg-primary/15 border-primary/50 text-primary font-medium"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border hover:bg-accent/30",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {focused && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-2 glass rounded-2xl overflow-hidden shadow-2xl card-glow border border-border/60">
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border/40">
            {filtered.map((f) => {
              const selected = isSelected(f.code);
              return (
                <button
                  key={f.code}
                  disabled={selected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (!selected) onPick({ schemeCode: f.code, schemeName: f.name });
                  }}
                  className={cn(
                    "flex w-full items-start gap-4 px-5 py-4 text-left transition-colors",
                    selected ? "opacity-40 cursor-not-allowed" : "hover:bg-primary/10",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-medium leading-snug truncate">{f.name}</div>
                    <div className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground/80">{f.amc}</span>
                      {f.cat && (
                        <>
                          <span className="opacity-40">•</span>
                          <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 h-5 border-border/60">
                            {f.cat}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                  {selected && <Badge variant="secondary" className="text-[10px] shrink-0">Added</Badge>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
