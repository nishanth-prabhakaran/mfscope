import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const DAILY_INDEX_QUOTA = 100;

export interface UsageByResource {
  resource: string;
  calls: number;
  failed: number;
}

export interface SignInSummary {
  email: string;
  signIns: number;
  lastSignIn: string | null;
}

export interface RecentSignIn {
  email: string;
  at: string;
}

export interface OwnerStats {
  quota: number;
  usedToday: number;
  failedToday: number;
  remaining: number;
  dayStart: string;
  byResource: UsageByResource[];
  last7Days: { day: string; calls: number }[];
  people: SignInSummary[];
  recent: RecentSignIn[];
}

/** Start of the current day in IST, returned as an ISO timestamp. */
function istDayStart(offsetDays = 0): Date {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  const day = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  return new Date(day - 5.5 * 3600_000 - offsetDays * 86_400_000);
}

function istDayKey(iso: string): string {
  const ist = new Date(new Date(iso).getTime() + 5.5 * 3600_000);
  return ist.toISOString().slice(0, 10);
}

export const getOwnerStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerStats> => {
    const { data: isOwner, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (roleError || !isOwner) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const dayStart = istDayStart();
    const weekStart = istDayStart(6);

    const [usageRes, signInRes] = await Promise.all([
      supabaseAdmin
        .from("api_usage_log")
        .select("resource, ok, created_at")
        .gte("created_at", weekStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(5000),
      supabaseAdmin
        .from("sign_in_events")
        .select("email, user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    const usage = usageRes.data ?? [];
    const today = usage.filter((r) => new Date(r.created_at) >= dayStart);

    const resourceMap = new Map<string, UsageByResource>();
    for (const row of today) {
      const name = row.resource ?? "unknown";
      const entry = resourceMap.get(name) ?? { resource: name, calls: 0, failed: 0 };
      entry.calls += 1;
      if (!row.ok) entry.failed += 1;
      resourceMap.set(name, entry);
    }

    const dayMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) dayMap.set(istDayKey(istDayStart(i).toISOString()), 0);
    for (const row of usage) {
      const key = istDayKey(row.created_at);
      if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
    }

    const events = signInRes.data ?? [];
    const peopleMap = new Map<string, SignInSummary>();
    for (const e of events) {
      const email = e.email ?? e.user_id;
      const entry = peopleMap.get(email) ?? { email, signIns: 0, lastSignIn: null };
      entry.signIns += 1;
      if (!entry.lastSignIn || e.created_at > entry.lastSignIn) entry.lastSignIn = e.created_at;
      peopleMap.set(email, entry);
    }

    const usedToday = today.length;
    return {
      quota: DAILY_INDEX_QUOTA,
      usedToday,
      failedToday: today.filter((r) => !r.ok).length,
      remaining: Math.max(0, DAILY_INDEX_QUOTA - usedToday),
      dayStart: dayStart.toISOString(),
      byResource: [...resourceMap.values()].sort((a, b) => b.calls - a.calls),
      last7Days: [...dayMap.entries()].map(([day, calls]) => ({ day, calls })),
      people: [...peopleMap.values()].sort((a, b) =>
        (b.lastSignIn ?? "").localeCompare(a.lastSignIn ?? ""),
      ),
      recent: events
        .slice(0, 25)
        .map((e) => ({ email: e.email ?? e.user_id, at: e.created_at })),
    };
  });
