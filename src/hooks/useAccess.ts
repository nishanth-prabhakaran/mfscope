import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AccessState {
  loading: boolean;
  session: Session | null;
  allowed: boolean;
  isOwner: boolean;
  refresh: () => void;
}

/**
 * Session + invite-list check. `claim_access` also makes the very first
 * person to sign in the owner, so the app is usable straight after setup.
 */
export function useAccess(): AccessState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setTick((t) => t + 1);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setAllowed(false);
      setIsOwner(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .rpc("claim_access")
      .then(({ data, error }) => {
        if (cancelled) return;
        const row = Array.isArray(data) ? data[0] : null;
        setAllowed(!error && Boolean(row?.allowed));
        setIsOwner(!error && Boolean(row?.is_owner));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, tick]);

  return { loading, session, allowed, isOwner, refresh: () => setTick((t) => t + 1) };
}
