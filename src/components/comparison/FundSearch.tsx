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
    const tokens = query.split(/\s+/).filter(Boolean);
    if (tokens.length === 0 && category === "All") return [];

    // Normalise a scheme name so duplicate listings collapse to one entry.
    const dedupeKey = (name: string) =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\b(plan|option|scheme|fund)\b/g, " ")
        .replace(/\bidcw\b/g, "dividend")
        .replace(/\s+/g, " ")
        .trim();

    const seen = new Map<string, { code: number; name: string; amc: string; cat: string | null; score: number }>();

    for (const s of data) {
      const name = s.schemeName;
      const lower = name.toLowerCase();
      if (!lower.includes("direct") || !lower.includes("growth")) continue;
      const cat = guessCategory(name);
      if (category !== "All" && cat !== category) continue;

      const amc = guessAmc(name);
      const haystack = `${lower} ${amc.toLowerCase()}`;
      if (tokens.length && !tokens.every((t) => haystack.includes(t))) continue;

      // Rank: prefix match on the scheme name scores highest, then earlier match position.
      let score = 0;
      if (query) {
        if (lower.startsWith(query)) score += 100;
        else if (lower.includes(query)) score += 50;
        const idx = lower.indexOf(tokens[0]);
        score += idx >= 0 ? Math.max(0, 30 - idx / 4) : 0;
      }
      score += Math.max(0, 20 - name.length / 12);

      const key = dedupeKey(name);
      const prev = seen.get(key);
      if (!prev || score > prev.score || (score === prev.score && s.schemeCode < prev.code)) {
        seen.set(key, { code: s.schemeCode, name, amc, cat, score });
      }
    }

    return Array.from(seen.values())
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 60);
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
