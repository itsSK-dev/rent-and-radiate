import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "sonner";
import { ShieldAlert, RefreshCw } from "lucide-react";

type SeverityFilter = "all" | "info" | "low" | "medium" | "high" | "critical";

interface SecurityEvent {
  id: string;
  created_at: string;
  event_type: string;
  severity: string;
  actor_user_id: string | null;
  actor_email: string | null;
  ip: string | null;
  user_agent: string | null;
  summary: string | null;
  metadata: Record<string, any> | null;
  notified_at: string | null;
  notification_status: string | null;
}

const sevTone: Record<string, string> = {
  info: "bg-secondary text-muted-foreground",
  low: "bg-secondary text-muted-foreground",
  medium: "bg-gold/20 text-rose-deep",
  high: "bg-primary-soft text-rose-deep",
  critical: "bg-destructive text-destructive-foreground",
};

export function AdminSecurityEventsPanel() {
  const [rows, setRows] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [severity, setSeverity] = useState<SeverityFilter>("all");

  async function load() {
    setLoading(true);
    let q = (supabase.from as any)("security_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (severity !== "all") q = q.eq("severity", severity);
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data as SecurityEvent[]) ?? []);
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [severity]);

  useEffect(() => {
    const channel = supabase
      .channel(`security-events-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "security_events" },
        (payload) => {
          const row = payload.new as SecurityEvent;
          if (severity !== "all" && row.severity !== severity) return;
          setRows((cur) => [row, ...cur].slice(0, 200));
          if (["high", "critical"].includes(row.severity)) {
            toast.warning(`${row.severity.toUpperCase()}: ${row.event_type}`, {
              description: row.summary ?? undefined,
            });
          }
        })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [severity]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    rows.forEach((r) => { c[r.severity] = (c[r.severity] ?? 0) + 1; });
    return c;
  }, [rows]);

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-card space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-rose-deep" />
          <h3 className="font-display text-2xl">Security events</h3>
          <Badge variant="outline">{rows.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={severity} onValueChange={(v) => setSeverity(v as SeverityFilter)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        {(["critical","high","medium","low","info"] as const).map((s) => (
          <div key={s} className="rounded-xl border border-border p-3">
            <div className="text-muted-foreground uppercase tracking-wide">{s}</div>
            <div className="text-xl font-display">{counts[s] ?? 0}</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        High and critical events email all admins immediately. Detectors include payment anomalies, repeated failed logins, fraud alerts, and privilege escalations.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No security events recorded.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-2 py-2">When</th>
                <th className="text-left px-2 py-2">Severity</th>
                <th className="text-left px-2 py-2">Event</th>
                <th className="text-left px-2 py-2">Actor</th>
                <th className="text-left px-2 py-2">Details</th>
                <th className="text-left px-2 py-2">Alert</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-2 py-2 whitespace-nowrap text-xs text-muted-foreground">
                    {format(new Date(r.created_at), "PP p")}
                  </td>
                  <td className="px-2 py-2">
                    <Badge className={sevTone[r.severity] ?? "bg-secondary"}>{r.severity}</Badge>
                  </td>
                  <td className="px-2 py-2 font-medium">{r.event_type}</td>
                  <td className="px-2 py-2 text-xs">
                    {r.actor_email && <div>{r.actor_email}</div>}
                    {r.actor_user_id && (
                      <div className="font-mono text-muted-foreground break-all">{r.actor_user_id.slice(0, 8)}</div>
                    )}
                    {r.ip && <div className="text-muted-foreground">{r.ip}</div>}
                  </td>
                  <td className="px-2 py-2 text-xs max-w-md">
                    {r.summary && <div>{r.summary}</div>}
                    {r.metadata && Object.keys(r.metadata).length > 0 && (
                      <pre className="mt-1 rounded bg-secondary/60 p-2 text-[11px] overflow-x-auto max-w-sm">
                        {JSON.stringify(r.metadata, null, 2)}
                      </pre>
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {r.notification_status ? (
                      <Badge variant="outline">{r.notification_status}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
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
