import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { REFUND_STATUS_LABEL, REFUND_STATUS_TONE } from "@/lib/refundTiers";
import { CircleDollarSign } from "lucide-react";

type Refund = {
  id: string;
  rental_id: string;
  store_id: string;
  customer_id: string;
  deposit_amount: number;
  condition_tier: string;
  refund_percent: number;
  refund_amount: number;
  inspection_notes: string | null;
  status: "pending_admin" | "approved" | "rejected";
  admin_notes: string | null;
  initiated_at: string;
  reviewed_at: string | null;
  rental: { id: string; start_date: string; end_date: string; product: { title: string } | null; store: { name: string } | null } | null;
  customer: { full_name: string | null } | null;
};

export function AdminRefundsPanel() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [filter, setFilter] = useState<"pending_admin" | "approved" | "rejected" | "all">("pending_admin");

  async function load() {
    const { data, error } = await (supabase.from as any)("deposit_refunds")
      .select(`
        id,rental_id,store_id,customer_id,deposit_amount,condition_tier,refund_percent,refund_amount,
        inspection_notes,status,admin_notes,initiated_at,reviewed_at,
        rental:rentals(id,start_date,end_date,product:products(title),store:stores(name)),
        customer:profiles!deposit_refunds_customer_id_fkey(full_name)
      `)
      .order("initiated_at", { ascending: false });
    if (error) {
      // fallback without explicit FK alias
      const { data: d2, error: e2 } = await (supabase.from as any)("deposit_refunds")
        .select(`id,rental_id,store_id,customer_id,deposit_amount,condition_tier,refund_percent,refund_amount,
          inspection_notes,status,admin_notes,initiated_at,reviewed_at,
          rental:rentals(id,start_date,end_date,product:products(title),store:stores(name))`)
        .order("initiated_at", { ascending: false });
      if (e2) return toast.error(e2.message);
      setRefunds((d2 as any) ?? []);
      return;
    }
    setRefunds((data as any) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function update(id: string, patch: Partial<Refund>) {
    const { error } = await (supabase.from as any)("deposit_refunds").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Refund updated");
    load();
  }

  const filtered = filter === "all" ? refunds : refunds.filter((r) => r.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-5 w-5 text-rose-deep" />
          <h2 className="font-display text-2xl">Deposit refunds</h2>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending_admin">Pending approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No {filter === "all" ? "" : filter.replace("_", " ")} refunds.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <RefundCard key={r.id} r={r} onUpdate={(p) => update(r.id, p)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RefundCard({ r, onUpdate }: { r: Refund; onUpdate: (p: Partial<Refund>) => void }) {
  const [notes, setNotes] = useState(r.admin_notes ?? "");
  const isPending = r.status === "pending_admin";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl">{r.rental?.product?.title ?? "Rental"}</h3>
          <p className="text-xs text-muted-foreground">
            {r.rental?.store?.name} · Customer: {r.customer?.full_name ?? "—"} · Initiated {format(new Date(r.initiated_at), "PPp")}
          </p>
        </div>
        <Badge className={REFUND_STATUS_TONE[r.status]}>{REFUND_STATUS_LABEL[r.status]}</Badge>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        <Stat label="Deposit" value={`₹${Number(r.deposit_amount).toLocaleString("en-IN")}`} />
        <Stat label="Condition" value={`${r.condition_tier} (${r.refund_percent}%)`} />
        <Stat label="Refund" value={`₹${Number(r.refund_amount).toLocaleString("en-IN")}`} highlight />
      </div>

      {r.inspection_notes && (
        <div className="rounded-xl bg-secondary p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Store notes</p>
          <p className="text-sm whitespace-pre-wrap">{r.inspection_notes}</p>
        </div>
      )}

      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Admin notes</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1" maxLength={1000}
          disabled={!isPending} />
      </div>

      {isPending && (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onUpdate({ admin_notes: notes, status: "rejected" })}>
            Reject
          </Button>
          <Button variant="hero" size="sm" onClick={() => onUpdate({ admin_notes: notes, status: "approved" })}>
            Approve refund
          </Button>
        </div>
      )}
      {!isPending && r.reviewed_at && (
        <p className="text-xs text-muted-foreground text-right">Reviewed {format(new Date(r.reviewed_at), "PPp")}</p>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${highlight ? "bg-primary-soft" : "bg-secondary"}`}>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-medium capitalize">{value}</p>
    </div>
  );
}
