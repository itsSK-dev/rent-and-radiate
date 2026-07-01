import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { Search, ShieldCheck, ShieldOff, UserCog, Ban } from "lucide-react";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  blocked: boolean;
  is_suspicious: boolean;
  reward_points: number | null;
};
type Role = { user_id: string; role: "admin" | "store_owner" | "customer" };

export function AdminUsersPanel() {
  const [rows, setRows] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: profs }, { data: rls }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,phone,created_at,blocked,is_suspicious,reward_points")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    setRows((profs as any) ?? []);
    const map: Record<string, string[]> = {};
    (rls as Role[] | null)?.forEach((r) => {
      (map[r.user_id] ||= []).push(r.role);
    });
    setRoles(map);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        (r.full_name ?? "").toLowerCase().includes(term) ||
        (r.phone ?? "").toLowerCase().includes(term) ||
        r.id.toLowerCase().startsWith(term),
    );
  }, [rows, q]);

  async function toggleBlocked(u: Profile) {
    setBusy(u.id);
    const { error } = await supabase.from("profiles").update({ blocked: !u.blocked }).eq("id", u.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(u.blocked ? "User unblocked" : "User blocked");
    load();
  }

  async function setRole(u: Profile, role: "admin" | "store_owner", grant: boolean) {
    setBusy(u.id);
    const { error } = await supabase.rpc("admin_set_user_role", {
      _target_user: u.id,
      _role: role,
      _grant: grant,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`${grant ? "Granted" : "Revoked"} ${role.replace("_", " ")}`);
    load();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading users…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone or id…"
            className="pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} / {rows.length} users
        </span>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Roles</th>
                <th className="text-left p-3">Joined</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const uroles = roles[u.id] ?? [];
                const isAdmin = uroles.includes("admin");
                const isOwner = uroles.includes("store_owner");
                return (
                  <tr key={u.id} className="border-t border-border align-top">
                    <td className="p-3">
                      <div className="font-medium">{u.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.phone ?? u.id.slice(0, 8)}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1 flex-wrap">
                        {uroles.length === 0 ? (
                          <Badge variant="outline">customer</Badge>
                        ) : (
                          uroles.map((r) => (
                            <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="capitalize">
                              {r.replace("_", " ")}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {format(new Date(u.created_at), "PP")}
                    </td>
                    <td className="p-3">
                      {u.blocked ? (
                        <Badge className="bg-destructive text-destructive-foreground">Blocked</Badge>
                      ) : u.is_suspicious ? (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300">Flagged</Badge>
                      ) : (
                        <Badge variant="outline">Active</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy === u.id}
                          onClick={() => setRole(u, "admin", !isAdmin)}
                          title={isAdmin ? "Revoke admin" : "Grant admin"}
                        >
                          {isAdmin ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                          <span className="ml-1 text-xs">{isAdmin ? "Revoke admin" : "Make admin"}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy === u.id}
                          onClick={() => setRole(u, "store_owner", !isOwner)}
                          title={isOwner ? "Revoke store owner" : "Grant store owner"}
                        >
                          <UserCog className="h-3.5 w-3.5" />
                          <span className="ml-1 text-xs">
                            {isOwner ? "Revoke seller" : "Grant seller"}
                          </span>
                        </Button>
                        <Button
                          size="sm"
                          variant={u.blocked ? "outline" : "ghost"}
                          disabled={busy === u.id}
                          onClick={() => toggleBlocked(u)}
                          className={u.blocked ? "" : "text-destructive hover:text-destructive"}
                        >
                          <Ban className="h-3.5 w-3.5" />
                          <span className="ml-1 text-xs">{u.blocked ? "Unblock" : "Block"}</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground p-8">No users match your search.</p>
        )}
      </div>
    </div>
  );
}
