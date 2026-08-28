import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { REFUND_STATUS_LABEL, REFUND_STATUS_TONE } from "@/lib/refundTiers";
import { CircleDollarSign, Search, Loader2 } from "lucide-react";

type Refund = {
  id: string;
  rental_id: string;
  store_id: string;
  customer_id: string;
  deposit_amount: number;
  condition_tier: string;
  refund_percent: number;
  refund_amount: number;
  late_fee: number;
  damage_charges: number;
  total_paid: number;
  rental_charges: number;
  total_deductions: number;
  razorpay_refund_id: string | null;
  refunded_at: string | null;
  refund_failure_reason: string | null;
  inspection_notes: string | null;
  status: string;
  admin_notes: string | null;
  initiated_at: string;
  reviewed_at: string | null;
  auto_created: boolean;
  rental: { id: string; start_date: string; end_date: string; product: { title: string } | null; store: { name: string } | null } | null;
  customer: { full_name: string | null } | null;
};

const inr = (n: number | null | undefined) =>
  `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function AdminRefundsPanel() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [filter, setFilter] = useState<string>("pending_admin");
  const [search, setSearch] = useState("");

  async function load() {
    const { data, error } = await (supabase.from as any)("deposit_refunds")
      .select(`
        id,rental_id,store_id,customer_id,deposit_amount,condition_tier,refund_percent,refund_amount,
        late_fee,damage_charges,total_paid,rental_charges,total_deductions,
        razorpay_refund_id,refunded_at,refund_failure_reason,
        inspection_notes,status,admin_notes,initiated_at,reviewed_at,auto_created,
        rental:rentals(id,start_date,end_date,product:products(title),store:stores(name)),
        customer:profiles!deposit_refunds_customer_profiles_fkey(full_name)
      `)
      .order("initiated_at", { ascending: false });
    if (error) return toast.error(error.message);
    setRefunds((data as any) ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-refunds-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "deposit_refunds" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = refunds.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.id.toLowerCase().includes(q) ||
      r.rental_id.toLowerCase().includes(q) ||
      (r.customer?.full_name ?? "").toLowerCase().includes(q) ||
      (r.rental?.product?.title ?? "").toLowerCase().includes(q) ||
      (r.rental?.store?.name ?? "").toLowerCase().includes(q)
    );
  });

  const counts = {
    pending_admin: refunds.filter((r) => r.status === "pending_admin").length,
    approved: refunds.filter((r) => r.status === "approved").length,
    processing: refunds.filter((r) => r.status === "processing").length,
    completed: refunds.filter((r) => r.status === "completed").length,
    failed: refunds.filter((r) => r.status === "failed").length,
    rejected: refunds.filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-5 w-5 text-rose-deep" />
          <h2 className="font-display text-2xl">Rental refunds</h2>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search order, customer, product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending_admin">Pending approval ({counts.pending_admin})</SelectItem>
              <SelectItem value="approved">Approved ({counts.approved})</SelectItem>
              <SelectItem value="processing">Processing ({counts.processing})</SelectItem>
              <SelectItem value="completed">Completed ({counts.completed})</SelectItem>
              <SelectItem value="failed">Failed ({counts.failed})</SelectItem>
              <SelectItem value="rejected">Rejected ({counts.rejected})</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No refunds in this view.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <RefundCard key={r.id} r={r} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function RefundCard({ r, onChanged }: { r: Refund; onChanged: () => void }) {
  const [notes, setNotes] = useState(r.admin_notes ?? "");
  const [busy, setBusy] = useState<null | "approve" | "reject" | "retry">(null);
  const canApprove = r.status === "pending_admin";
  const canRetry = r.status === "failed";

  async function reject() {
    setBusy("reject");
    const { error } = await (supabase.from as any)("deposit_refunds")
      .update({ status: "rejected", admin_notes: notes || null })
      .eq("id", r.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Refund rejected");
    onChanged();
  }

  async function approveAndRefund() {
    setBusy("approve");
    const { data, error } = await supabase.functions.invoke("admin-process-refund", {
      body: { refundId: r.id, adminNotes: notes || null },
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    if (!data?.ok) return toast.error(data?.error ?? "Refund failed");
    toast.success(`Refund ${data.status}`);
    onChanged();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-xl">{r.rental?.product?.title ?? "Rental"}</h3>
            {r.auto_created && (
              <Badge variant="outline" className="text-[10px]">Auto-created on return</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Order <span className="font-mono">#{r.rental_id.slice(0, 8)}</span>
            {" · "}Shop: {r.rental?.store?.name ?? "—"}
            {" · "}Customer: {r.customer?.full_name ?? "—"}
            {" · "}Opened {format(new Date(r.initiated_at), "PPp")}
          </p>
        </div>
        <Badge className={REFUND_STATUS_TONE[r.status]}>{REFUND_STATUS_LABEL[r.status] ?? r.status}</Badge>
      </div>

      {/* Required clear breakdown */}
      <div className="rounded-xl border border-border bg-secondary/40 divide-y divide-border text-sm">
        <Row label="Customer Paid" value={inr(r.total_paid)} />
        <Row label="Rental Charges (non-refundable)" value={inr(r.rental_charges)} />
        <Row label="Security Deposit Held" value={inr(r.deposit_amount)} />
        <Row label={`Condition (${r.condition_tier}, ${r.refund_percent}% of deposit)`}
          value={`− ${inr(r.deposit_amount - Math.round((r.deposit_amount * r.refund_percent) / 100))}`}
          dim />
        <Row label="Late Fee" value={r.late_fee > 0 ? `− ${inr(r.late_fee)}` : inr(0)} dim />
        <Row label="Damage Charges" value={r.damage_charges > 0 ? `− ${inr(r.damage_charges)}` : inr(0)} dim />
        <Row label="Total Deductions" value={`− ${inr(r.total_deductions)}`} dim />
        <Row label="Refund Amount" value={inr(r.refund_amount)} highlight />
      </div>

      {r.inspection_notes && (
        <div className="rounded-xl bg-secondary p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Shop notes</p>
          <p className="text-sm whitespace-pre-wrap">{r.inspection_notes}</p>
        </div>
      )}

      {r.razorpay_refund_id && (
        <div className="text-xs text-muted-foreground">
          Razorpay refund ID: <span className="font-mono">{r.razorpay_refund_id}</span>
          {r.refunded_at && <> · refunded {format(new Date(r.refunded_at), "PPp")}</>}
        </div>
      )}

      {r.refund_failure_reason && (
        <div className="rounded-xl bg-destructive/10 text-destructive p-3 text-sm">
          <strong>Failure reason:</strong> {r.refund_failure_reason}
        </div>
      )}

      {(canApprove || canRetry) && (
        <>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Admin notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1"
              maxLength={1000}
              placeholder="Optional — visible to internal audit trail."
            />
          </div>
          <div className="flex justify-end gap-2">
            {canApprove && (
              <Button variant="ghost" size="sm" disabled={busy !== null} onClick={reject}>
                {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Reject
              </Button>
            )}
            <Button variant="hero" size="sm" disabled={busy !== null} onClick={approveAndRefund}>
              {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CircleDollarSign className="h-4 w-4 mr-1" />}
              {canRetry ? "Retry refund" : `Approve & Refund ${inr(r.refund_amount)}`}
            </Button>
          </div>
        </>
      )}

      {!canApprove && !canRetry && r.reviewed_at && (
        <p className="text-xs text-muted-foreground text-right">
          Reviewed {format(new Date(r.reviewed_at), "PPp")}
          {r.admin_notes && <> · {r.admin_notes}</>}
        </p>
      )}
    </div>
  );
}

function Row({ label, value, highlight, dim }: { label: string; value: string; highlight?: boolean; dim?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2 ${highlight ? "bg-primary-soft" : ""}`}>
      <span className={`${dim ? "text-muted-foreground" : ""} ${highlight ? "font-medium" : ""}`}>{label}</span>
      <span className={`font-mono ${highlight ? "text-lg font-semibold text-rose-deep" : ""}`}>{value}</span>
    </div>
  );
}
