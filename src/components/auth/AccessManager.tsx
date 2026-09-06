import { useEffect, useState } from "react";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface AllowedRow {
  id: string;
  email: string;
  note: string | null;
  is_active: boolean;
}

export function AccessManager() {
  const [rows, setRows] = useState<AllowedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("allowed_emails")
      .select("id, email, note, is_active")
      .order("created_at", { ascending: true });
    if (error) toast.error("Couldn't load the approved list");
    setRows((data as AllowedRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase
      .from("allowed_emails")
      .insert({ email: email.trim().toLowerCase(), note: note.trim() || null });
    setBusy(false);
    if (error) {
      toast.error(
        error.code === "23505" ? "That email is already on the list" : "Couldn't add that email",
      );
      return;
    }
    setEmail("");
    setNote("");
    toast.success("Added to the approved list");
    void load();
  }

  async function toggle(row: AllowedRow, active: boolean) {
    const { error } = await supabase
      .from("allowed_emails")
      .update({ is_active: active })
      .eq("id", row.id);
    if (error) {
      toast.error("Couldn't update access");
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: active } : r)));
  }

  async function remove(row: AllowedRow) {
    const { error } = await supabase.from("allowed_emails").delete().eq("id", row.id);
    if (error) {
      toast.error("Couldn't remove that person");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          required
          placeholder="friend@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="sm:flex-1"
        />
        <Input
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="sm:w-40"
        />
        <Button type="submit" disabled={busy} className="gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Add
        </Button>
      </form>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Nobody added yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.email}</p>
                {row.note && <p className="truncate text-xs text-muted-foreground">{row.note}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {row.is_active ? "Active" : "Paused"}
                </span>
                <Switch
                  checked={row.is_active}
                  onCheckedChange={(v) => toggle(row, v)}
                  aria-label={`Toggle access for ${row.email}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(row)}
                  aria-label={`Remove ${row.email}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Paused people stay on the list but can't open the app. Removing deletes them entirely.
      </p>
    </div>
  );
}
