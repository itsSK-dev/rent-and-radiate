import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type LogRow = {
  id: string;
  template: string;
  recipient_email: string;
  recipient_role: string;
  recipient_name: string | null;
  status: "queued" | "skipped" | "error" | string;
  message: string | null;
  infra_ready: boolean;
  created_at: string;
};

const statusStyle: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  queued:  { label: "Queued",  className: "bg-emerald-100 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
  skipped: { label: "Skipped", className: "bg-amber-100 text-amber-700 border-amber-200",       Icon: AlertTriangle },
  error:   { label: "Failed",  className: "bg-rose-100 text-rose-700 border-rose-200",          Icon: XCircle },
};

const templateLabel: Record<string, string> = {
  "dispute-opened": "Dispute opened",
  "dispute-resolved": "Dispute resolved",
  "dispute-rejected": "Dispute rejected",
};

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function TestEmailLog({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("test_email_log")
      .select("id,template,recipient_email,recipient_role,recipient_name,status,message,infra_ready,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) setError(error.message);
    setRows((data ?? []) as LogRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("test-email-log:refresh", handler);
    return () => window.removeEventListener("test-email-log:refresh", handler);
  }, [load]);

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blossom p-2 text-rose-deep">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-2xl">Test email log</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Every test send is recorded here with the timestamp, template, recipient, and delivery outcome — useful when troubleshooting branding or domain issues.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 mb-4">
          {error}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground text-center">
          No test emails have been sent yet. Use <span className="font-medium text-foreground">Send test email</span> above to verify branding and delivery.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-2 py-2 font-medium">When</th>
                <th className="px-2 py-2 font-medium">Template</th>
                <th className="px-2 py-2 font-medium">Recipient</th>
                <th className="px-2 py-2 font-medium">Role</th>
                <th className="px-2 py-2 font-medium">Outcome</th>
                <th className="px-2 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = statusStyle[r.status] ?? statusStyle.error;
                const Icon = s.Icon;
                return (
                  <tr key={r.id} className="border-t border-border/60 align-top">
                    <td className="px-2 py-3 whitespace-nowrap text-muted-foreground">{fmtTime(r.created_at)}</td>
                    <td className="px-2 py-3 whitespace-nowrap">{templateLabel[r.template] ?? r.template}</td>
                    <td className="px-2 py-3">
                      <div className="font-medium">{r.recipient_email}</div>
                      {r.recipient_name && (
                        <div className="text-xs text-muted-foreground">{r.recipient_name}</div>
                      )}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-muted-foreground capitalize">
                      {r.recipient_role.replace("_", " ")}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      <Badge variant="outline" className={cn("gap-1", s.className)}>
                        <Icon className="h-3 w-3" />
                        {s.label}
                      </Badge>
                    </td>
                    <td className="px-2 py-3 text-xs text-muted-foreground max-w-md">
                      {r.message ?? (r.infra_ready ? "—" : "Email infrastructure not provisioned.")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
