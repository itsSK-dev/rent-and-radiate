import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertTriangle, RefreshCw, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SendTestEmailDialog } from "./SendTestEmailDialog";

type Readiness = {
  domain: string | null;
  domainStatus: "active" | "awaiting_dns" | "provisioning" | "failed" | "not_configured" | "unknown";
  infrastructureReady: boolean;
  canSend: boolean;
  checkedAt: string;
  notes: string[];
};

const statusCopy: Record<Readiness["domainStatus"], { label: string; tone: string }> = {
  active: { label: "Verified & active", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  awaiting_dns: { label: "Awaiting DNS", tone: "text-amber-700 bg-amber-50 border-amber-200" },
  provisioning: { label: "Provisioning", tone: "text-amber-700 bg-amber-50 border-amber-200" },
  failed: { label: "Verification failed", tone: "text-red-700 bg-red-50 border-red-200" },
  not_configured: { label: "Not configured", tone: "text-muted-foreground bg-secondary border-border" },
  unknown: { label: "Unknown", tone: "text-muted-foreground bg-secondary border-border" },
};

export function EmailReadinessPanel() {
  const [data, setData] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke<Readiness>("email-readiness");
    if (error) setError(error.message);
    else setData(data ?? null);
    setLoading(false);
  }

  useEffect(() => { check(); }, []);

  const status = data ? statusCopy[data.domainStatus] : statusCopy.unknown;

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-rose-soft p-2">
            <Mail className="h-5 w-5 text-rose-deep" />
          </div>
          <div>
            <h2 className="text-lg font-display text-rose-deep">Email sending readiness</h2>
            <p className="text-sm text-muted-foreground">
              Verifies the sender domain and email infrastructure before any dispute notification is sent.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SendTestEmailDialog />
          <Button variant="outline" size="sm" onClick={check} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Recheck</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {data && (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <ReadinessTile
              label="Sender domain"
              value={data.domain ?? "Not set"}
              tone={data.domain ? "ok" : "warn"}
            />
            <ReadinessTile
              label="Domain status"
              value={status.label}
              toneClass={status.tone}
            />
            <ReadinessTile
              label="Infrastructure"
              value={data.infrastructureReady ? "Ready" : "Pending"}
              tone={data.infrastructureReady ? "ok" : "warn"}
            />
          </div>

          <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${data.canSend ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            {data.canSend ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <span className="font-medium">
              {data.canSend
                ? "Ready to send branded dispute emails to both parties."
                : "Not ready to send live emails yet — previews still work."}
            </span>
          </div>

          {data.notes.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {data.notes.map((n, i) => <li key={i}>• {n}</li>)}
            </ul>
          )}

          <p className="text-[11px] text-muted-foreground">
            Last checked {new Date(data.checkedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}

function ReadinessTile({ label, value, tone, toneClass }: { label: string; value: string; tone?: "ok" | "warn"; toneClass?: string }) {
  const cls = toneClass ?? (tone === "ok"
    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : "text-amber-700 bg-amber-50 border-amber-200");
  return (
    <div className={`rounded-2xl border px-4 py-3 ${cls}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-sm font-medium break-all">{value}</p>
    </div>
  );
}
