import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Clock, AlertTriangle, CheckCircle2, Camera } from "lucide-react";

type Entry = {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  note: string | null;
  created_at: string;
  actor?: { full_name: string | null } | null;
};

type Dispute = {
  id: string;
  status: string;
  reason: string;
  created_at: string;
  resolution: string | null;
};

type ProofImage = {
  id: string;
  stage: "before_delivery" | "at_delivery" | "after_return";
  created_at: string;
  uploaded_by: string;
};

const statusTone: Record<string, string> = {
  pending: "bg-secondary text-foreground",
  accepted: "bg-sky-100 text-sky-900",
  confirmed: "bg-primary-soft text-rose-deep",
  rejected: "bg-destructive/10 text-destructive",
  packing: "bg-indigo-100 text-indigo-900",
  ready_for_pickup: "bg-violet-100 text-violet-900",
  shipped: "bg-blue-100 text-blue-900",
  delivered: "bg-blossom text-rose-deep",
  returned: "bg-gold/20 text-rose-deep",
  cancelled: "bg-destructive/10 text-destructive",
};

const stageLabel: Record<string, string> = {
  before_delivery: "Before-delivery photo uploaded by store",
  at_delivery: "At-delivery photo uploaded",
  after_return: "After-return photo uploaded by customer",
};

export function RentalStatusTimeline({
  rentalId,
  currentStatus,
  customerId,
  storeOwnerId,
  className,
}: {
  rentalId: string;
  currentStatus: string;
  customerId?: string;
  storeOwnerId?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [proofs, setProofs] = useState<ProofImage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || entries.length > 0) return;
    setLoading(true);
    (async () => {
      const [historyRes, disputesRes, proofsRes] = await Promise.all([
        supabase
          .from("rental_status_history")
          .select("id,from_status,to_status,changed_by,note,created_at")
          .eq("rental_id", rentalId)
          .order("created_at", { ascending: true }),
        supabase
          .from("disputes")
          .select("id,status,reason,created_at,resolution")
          .eq("rental_id", rentalId)
          .order("created_at", { ascending: true }),
        supabase
          .from("rental_images")
          .select("id,stage,created_at,uploaded_by")
          .eq("rental_id", rentalId)
          .order("created_at", { ascending: true }),
      ]);

      const rawEntries = (historyRes.data ?? []) as Entry[];
      const actorIds = Array.from(
        new Set(rawEntries.map((e) => e.changed_by).filter(Boolean) as string[])
      );
      let actorMap: Record<string, { full_name: string | null }> = {};
      if (actorIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", actorIds);
        actorMap = Object.fromEntries((profs ?? []).map((p) => [p.id, { full_name: p.full_name }]));
      }
      setEntries(rawEntries.map((e) => ({ ...e, actor: e.changed_by ? actorMap[e.changed_by] : null })));
      setDisputes((disputesRes.data ?? []) as Dispute[]);
      setProofs((proofsRes.data ?? []) as ProofImage[]);
      setLoading(false);
    })();
  }, [open, rentalId]);

  function actorLabel(e: Entry) {
    if (!e.changed_by) return "System";
    if (e.changed_by === customerId) return e.actor?.full_name ? `${e.actor.full_name} (customer)` : "Customer";
    if (storeOwnerId && e.changed_by === storeOwnerId) return e.actor?.full_name ? `${e.actor.full_name} (store)` : "Store";
    return e.actor?.full_name ?? "Admin";
  }

  // Build a unified timeline of events
  type TLItem = { ts: string; kind: "status" | "proof" | "dispute"; node: React.ReactNode };
  const items: TLItem[] = [];

  for (const e of entries) {
    items.push({
      ts: e.created_at,
      kind: "status",
      node: (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            {e.from_status && (
              <>
                <Badge className={statusTone[e.from_status] ?? ""}>{e.from_status}</Badge>
                <span className="text-muted-foreground text-xs">→</span>
              </>
            )}
            <Badge className={statusTone[e.to_status] ?? ""}>{e.to_status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            by {actorLabel(e)}
            {e.note ? ` · ${e.note}` : ""}
          </p>
        </div>
      ),
    });
  }

  for (const p of proofs) {
    items.push({
      ts: p.created_at,
      kind: "proof",
      node: (
        <div className="flex items-start gap-2">
          <Camera className="h-3.5 w-3.5 mt-0.5 text-rose-deep shrink-0" />
          <p className="text-xs">{stageLabel[p.stage] ?? p.stage}</p>
        </div>
      ),
    });
  }

  for (const d of disputes) {
    items.push({
      ts: d.created_at,
      kind: "dispute",
      node: (
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-destructive shrink-0" />
          <div className="text-xs space-y-0.5">
            <p>
              <strong>Dispute opened</strong> · status: {d.status}
            </p>
            <p className="text-muted-foreground line-clamp-2">{d.reason}</p>
            {d.resolution && <p className="text-muted-foreground">Resolution: {d.resolution}</p>}
          </div>
        </div>
      ),
    });
  }

  items.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  // Build "blocker" hint based on current status + missing proofs / open disputes
  const hasBefore = proofs.some((p) => p.stage === "before_delivery");
  const hasAfter = proofs.some((p) => p.stage === "after_return");
  const openDispute = disputes.find((d) => d.status === "open" || d.status === "reviewing");

  const blockers: string[] = [];
  if (currentStatus === "confirmed" && !hasBefore)
    blockers.push("Store must upload a before-delivery photo to mark as delivered.");
  if (currentStatus === "delivered" && !hasAfter)
    blockers.push("Customer must upload an after-return photo to mark as returned.");
  if (openDispute) blockers.push(`An open dispute is under review — progress is paused.`);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-rose-deep hover:underline">
        <Clock className="h-3.5 w-3.5" />
        {open ? "Hide timeline" : "View status timeline"}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        {blockers.length > 0 && (
          <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
            <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Why progress is blocked
            </p>
            {blockers.map((b, i) => (
              <p key={i} className="text-xs text-foreground/80">• {b}</p>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-xs text-muted-foreground">Loading timeline…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No history yet.</p>
        ) : (
          <ol className="relative border-l border-border pl-4 space-y-4">
            {items.map((it, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[21px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-card border border-rose-deep">
                  {it.kind === "status" && <CheckCircle2 className="h-2.5 w-2.5 text-rose-deep" />}
                </span>
                <div className="space-y-0.5">
                  {it.node}
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {format(new Date(it.ts), "PPp")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
