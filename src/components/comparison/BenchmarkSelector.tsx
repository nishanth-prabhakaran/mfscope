import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BENCHMARKS, defaultBenchmarkFor } from "@/lib/benchmarks";
import type { BenchmarkKey } from "@/types/mf";
import { Activity } from "lucide-react";

interface Props {
  value: BenchmarkKey | undefined;
  onChange: (key: BenchmarkKey | undefined) => void;
  fundNames?: string[];
}

export function BenchmarkSelector({ value, onChange, fundNames }: Props) {
  const suggested = fundNames?.length
    ? defaultBenchmarkFor(fundNames.join(" "))
    : undefined;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <span className="hidden sm:inline">Benchmark</span>
      </div>
      <Select
        value={value ?? "__none__"}
        onValueChange={(v) => onChange(v === "__none__" ? undefined : (v as BenchmarkKey))}
      >
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">None</SelectItem>
          {BENCHMARKS.map((b) => (
            <SelectItem key={b.key} value={b.key}>
              {b.label}
              {suggested === b.key ? " · suggested" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
