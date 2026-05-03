import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CircleDot, ShieldAlert, Search, CheckCircle2, XCircle } from "lucide-react";

type Row = {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
  changed_by: string | null;
};

const meta: Record<string, { label: string; icon: any; tone: string }> = {
  open: { label: "Opened", icon: ShieldAlert, tone: "text-destructive" },
  reviewing: { label: "Under review", icon: Search, tone: "text-amber-600" },
  resolved: { label: "Resolved", icon: CheckCircle2, tone: "text-emerald-600" },
  rejected: { label: "Rejected", icon: XCircle, tone: "text-muted-foreground" },
};

export function DisputeStatusTimeline({ disputeId }: { disputeId: string }) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const { data } = await (supabase.from as any)("dispute_status_history")
        .select("id,from_status,to_status,note,created_at,changed_by")
        .eq("dispute_id", disputeId)
        .order("created_at", { ascending: true });
      if (!ignore) setRows((data as Row[]) ?? []);
    })();
    return () => { ignore = true; };
  }, [disputeId]);

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">No timeline yet.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Status timeline</p>
      <ol className="relative border-l border-border ml-2 space-y-3">
        {rows.map((r) => {
          const m = meta[r.to_status] ?? { label: r.to_status, icon: CircleDot, tone: "text-muted-foreground" };
          const Icon = m.icon;
          return (
            <li key={r.id} className="ml-4">
              <span className={`absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-card border border-border ${m.tone}`}>
                <Icon className="h-2.5 w-2.5" />
              </span>
              <div className="text-sm">
                <span className={`font-medium ${m.tone}`}>{m.label}</span>
                {r.from_status && (
                  <span className="text-xs text-muted-foreground"> · from {r.from_status}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), "PPp")}</p>
              {r.note && <p className="text-xs text-muted-foreground italic mt-0.5">{r.note}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
