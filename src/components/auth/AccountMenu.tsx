import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Gauge, LogOut, UserCog, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccessContext } from "@/hooks/accessContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccessManager } from "@/components/auth/AccessManager";
import { OwnerDashboard } from "@/components/auth/OwnerDashboard";

export function AccountMenu() {
  const access = useAccessContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  if (!access?.session) return null;
  const email = access.session.user.email ?? "Signed in";

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-xs">
            <UserCog className="h-3.5 w-3.5" />
            <span className="hidden sm:inline max-w-[140px] truncate">{email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
            {email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {access.isOwner && (
            <DropdownMenuItem onSelect={() => setOpen(true)}>
              <Users className="mr-2 h-4 w-4" />
              Manage access
            </DropdownMenuItem>
          )}
          {access.isOwner && (
            <DropdownMenuItem onSelect={() => setStatsOpen(true)}>
              <Gauge className="mr-2 h-4 w-4" />
              Usage dashboard
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => void signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Who can use FundScope</DialogTitle>
            <DialogDescription>
              Add the email addresses of people you want to let in. They sign in with that address
              — anyone else is blocked.
            </DialogDescription>
          </DialogHeader>
          <AccessManager />
        </DialogContent>
      </Dialog>
    </>
  );
}
