import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, Users } from "lucide-react";
import { getOwnerStats } from "@/lib/ownerStats.functions";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OwnerDashboard() {
  const fetchStats = useServerFn(getOwnerStats);
  const { data, isLoading, error } = useQuery({
    queryKey: ["owner-stats"],
    queryFn: () => fetchStats(),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    meta: { context: "owner dashboard" },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !data)
    return (
      <p className="text-sm text-muted-foreground">
        Could not load usage right now. Try again in a moment.
      </p>
    );

  const pct = Math.min(100, (data.usedToday / data.quota) * 100);
  const maxDay = Math.max(1, ...data.last7Days.map((d) => d.calls));

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Activity className="h-4 w-4" /> Index data used today
          </h3>
          <span className="font-mono text-sm tabular-nums">
            {data.usedToday} / {data.quota}
          </span>
        </div>
        <Progress value={pct} className="h-2" />
        <p className="text-xs text-muted-foreground">
          {data.remaining} calls left today (resets at midnight IST)
          {data.failedToday > 0 && (
            <span className="ml-1 inline-flex items-center gap-1 text-destructive">
              <AlertTriangle className="h-3 w-3" />
              {data.failedToday} failed
            </span>
          )}
        </p>
      </section>

      {data.byResource.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Today by index
          </h4>
          <ul className="space-y-1">
            {data.byResource.map((r) => (
              <li key={r.resource} className="flex justify-between gap-3 text-sm">
                <span className="truncate">{r.resource}</span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {r.calls}
                  {r.failed > 0 ? ` (${r.failed} failed)` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Last 7 days
        </h4>
        <div className="flex items-end gap-1.5">
          {data.last7Days.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-mono text-muted-foreground">{d.calls}</span>
              <div
                className="w-full rounded-sm bg-primary/70"
                style={{ height: `${Math.max(4, (d.calls / maxDay) * 56)}px` }}
              />
              <span className="text-[10px] text-muted-foreground">{d.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Sign-ins
        </h4>
        {data.people.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sign-ins recorded yet.</p>
        ) : (
          <ul className="space-y-1">
            {data.people.map((p) => (
              <li key={p.email} className="flex justify-between gap-3 text-sm">
                <span className="truncate">{p.email}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {p.signIns}× · last {formatWhen(p.lastSignIn)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
