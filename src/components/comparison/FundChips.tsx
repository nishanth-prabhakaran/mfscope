import { X } from "lucide-react";
import { colorFor } from "@/lib/format";
import type { SelectedFund } from "@/hooks/useSelection";

interface Props {
  funds: SelectedFund[];
  onRemove: (code: number) => void;
  onClear: () => void;
}

export function FundChips({ funds, onRemove, onClear }: Props) {
  if (!funds.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {funds.map((f, i) => (
        <span
          key={f.schemeCode}
          className="group inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-card/60 pl-2 pr-1 py-1 text-sm"
        >
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: colorFor(i) }}
          />
          <span className="truncate max-w-[240px] md:max-w-[320px]">{f.schemeName}</span>
          <button
            onClick={() => onRemove(f.schemeCode)}
            className="ml-1 rounded-full p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive-foreground"
            aria-label="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {funds.length > 1 && (
        <button
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-destructive-foreground ml-1"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
