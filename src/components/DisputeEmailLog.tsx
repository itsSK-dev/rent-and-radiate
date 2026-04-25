import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Mail, ChevronDown, AlertCircle, CheckCircle2, Clock, Ban } from "lucide-react";
import { format } from "date-fns";

type LogRow = {
  id: string;
  message_id: string | null;
  template_name: string | null;
  recipient_email: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

const statusMeta: Record<string, { tone: string; icon: typeof CheckCircle2; label: string }> = {
  sent: { tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: CheckCircle2, label: "Sent" },
  pending: { tone: "bg-secondary text-foreground", icon: Clock, label: "Pending" },
  failed: { tone: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertCircle, label: "Failed" },
  dlq: { tone: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertCircle, label: "Failed (retried)" },
  suppressed: { tone: "bg-gold/20 text-rose-deep", icon: Ban, label: "Suppressed" },
  bounced: { tone: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertCircle, label: "Bounced" },
  complained: { tone: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertCircle, label: "Complaint" },
};

export function DisputeEmailLog({ disputeId, className }: { disputeId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      // Match notifications by idempotency-key convention: dispute-<event>-<disputeId>
      const { data, error } = await (supabase as any)
        .from("email_send_log")
        .select("id,message_id,template_name,recipient_email,status,error_message,created_at")
        .like("message_id", `dispute-%-${disputeId}%`)
        .order("created_at", { ascending: false });

      if (error) {
        // Table doesn't exist yet (email infra not set up) — show graceful state.
        setUnavailable(true);
        setLoading(false);
        return;
      }

      // Deduplicate by message_id, keeping the latest row per email
      const latest = new Map<string, LogRow>();
      for (const r of (data ?? []) as LogRow[]) {
        const key = r.message_id ?? r.id;
        if (!latest.has(key)) latest.set(key, r);
      }
      setRows(Array.from(latest.values()));
      setLoading(false);
    })();
  }, [open, disputeId]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-rose-deep hover:underline">
        <Mail className="h-3.5 w-3.5" />
        {open ? "Hide notification log" : "View notification log"}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        {unavailable ? (
          <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
            Email infrastructure isn't set up yet. Once a sender domain is configured and dispute notifications go out, their delivery status will appear here.
          </div>
        ) : loading ? (
          <p className="text-xs text-muted-foreground">Loading delivery log…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
            No notifications sent for this dispute yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const meta = statusMeta[r.status] ?? { tone: "bg-secondary text-foreground", icon: Clock, label: r.status };
              const Icon = meta.icon;
              return (
                <li key={r.id} className="rounded-lg border border-border bg-card p-3 text-xs space-y-1">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-rose-deep" />
                      <span className="font-medium">{r.template_name ?? "notification"}</span>
                      <span className="text-muted-foreground">→ {r.recipient_email ?? "—"}</span>
                    </div>
                    <Badge className={meta.tone} variant="outline">{meta.label}</Badge>
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {format(new Date(r.created_at), "PPp")}
                  </p>
                  {r.error_message && (
                    <p className="text-destructive text-[11px] break-words">{r.error_message}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
