import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "sonner";
import { ShieldCheck, RefreshCw } from "lucide-react";

type AuditRow = {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_role: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  target_user_id: string | null;
  summary: string | null;
  metadata: Record<string, any> | null;
};

const ENTITY_FILTERS = ["all", "dispute", "deposit_refund", "rental_proof"] as const;
type EntityFilter = (typeof ENTITY_FILTERS)[number];

const roleTone: Record<string, string> = {
  admin: "bg-primary-soft text-rose-deep",
  service_role: "bg-gold/20 text-rose-deep",
  user: "bg-secondary text-muted-foreground",
  anonymous: "bg-destructive/10 text-destructive",
};

export function AdminAuditLogPanel() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [entity, setEntity] = useState<EntityFilter>("all");

  async function load() {
    setLoading(true);
    let q = (supabase.from as any)("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (entity !== "all") q = q.eq("entity_type", entity);
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data as AuditRow[]) ?? []);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [entity]);

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-card space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-rose-deep" />
          <h3 className="font-display text-2xl">Admin audit log</h3>
          <Badge variant="outline">{rows.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={entity} onValueChange={(v) => setEntity(v as EntityFilter)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ENTITY_FILTERS.map((e) => (
                <SelectItem key={e} value={e}>{e === "all" ? "All events" : e.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Records security-sensitive events: dispute lifecycle, deposit refund approvals, and proof / evidence image access.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No audit events recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-2 py-2">When</th>
                <th className="text-left px-2 py-2">Actor</th>
                <th className="text-left px-2 py-2">Entity</th>
                <th className="text-left px-2 py-2">Action</th>
                <th className="text-left px-2 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-2 py-2 whitespace-nowrap text-xs text-muted-foreground">
                    {format(new Date(r.created_at), "PP p")}
                  </td>
                  <td className="px-2 py-2">
                    <Badge className={roleTone[r.actor_role ?? ""] ?? "bg-secondary"}>{r.actor_role ?? "—"}</Badge>
                    <div className="text-[11px] font-mono text-muted-foreground mt-1 break-all">
                      {r.actor_id ? r.actor_id.slice(0, 8) : "—"}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-medium">{r.entity_type}</div>
                    {r.entity_id && (
                      <div className="text-[11px] font-mono text-muted-foreground break-all">
                        {r.entity_id.slice(0, 8)}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 font-medium">{r.action}</td>
                  <td className="px-2 py-2 text-xs">
                    {r.summary && <div>{r.summary}</div>}
                    {r.metadata && Object.keys(r.metadata).length > 0 && (
                      <pre className="mt-1 rounded bg-secondary/60 p-2 text-[11px] overflow-x-auto max-w-xs">
                        {JSON.stringify(r.metadata, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
