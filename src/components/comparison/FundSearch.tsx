import { useMemo, useState } from "react";
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
      if (out.length >= 40) break;
    }
    return out;
  }, [data, q, category]);

  return (
    <div className="relative">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder={isLoading ? "Loading schemes…" : "Search Direct Growth funds by scheme or AMC…"}
            className="pl-9 h-11 bg-card/60 border-border/60"
            disabled={disabled || isLoading}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["All", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                category === c
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {focused && filtered.length > 0 && (
        <div className="absolute z-40 left-0 right-0 top-full mt-2 glass rounded-xl overflow-hidden shadow-2xl">
          <div className="max-h-96 overflow-y-auto divide-y divide-border/40">
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
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                    selected ? "opacity-40 cursor-not-allowed" : "hover:bg-accent/40",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{f.name}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{f.amc}</span>
                      {f.cat && (
                        <>
                          <span className="opacity-40">•</span>
                          <span>{f.cat}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {selected && <Badge variant="secondary" className="text-[10px]">Added</Badge>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
