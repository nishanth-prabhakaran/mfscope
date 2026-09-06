import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAccess } from "@/hooks/useAccess";
import { AccessContext } from "@/hooks/accessContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useHydrated } from "@/hooks/useHydrated";

export function AccessGate({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const access = useAccess();

  useEffect(() => {
    if (hydrated && !access.loading && !access.session) {
      navigate({ to: "/auth", replace: true });
    }
  }, [hydrated, access.loading, access.session, navigate]);

  if (!hydrated || access.loading || !access.session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!access.allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md p-6 text-center">
          <ShieldAlert className="mx-auto h-7 w-7 text-primary" />
          <h1 className="mt-3 font-display text-xl font-semibold">Access not approved yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You're signed in as {access.session.user.email}, but this address isn't on the approved
            list. Ask the owner to add you, then reload.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" onClick={access.refresh}>
              Check again
            </Button>
            <Button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth", replace: true });
              }}
            >
              Sign out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}
