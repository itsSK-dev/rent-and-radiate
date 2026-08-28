import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { inr } from "@/lib/pricing";
import { toast } from "sonner";

export type Settlement = {
  id: string;
  rental_id: string;
  store_id: string;
  kind: "buy" | "rent";
  sale_price: number;
  platform_fee_percent: number;
  platform_fee: number;
  gst_amount: number;
  gateway_fee: number;
  delivery_fee: number;
  other_deductions: number;
  total_deductions: number;
  net_payout: number;
  status: "pending" | "eligible" | "paid" | "on_hold" | "reversed";
  eligible_at: string | null;
  paid_at: string | null;
  created_at: string;
  rental?: { id: string; product?: { title: string | null } | null; customer?: { full_name: string | null } | null } | null;
  store?: { name: string | null } | null;
};

const statusTone: Record<string, string> = {
  pending: "bg-gold/20 text-rose-deep",
  eligible: "bg-primary-soft text-rose-deep",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  on_hold: "bg-muted text-foreground",
  reversed: "bg-destructive/10 text-destructive",
};

type Props = { storeId?: string; admin?: boolean };

export function VendorSettlementsPanel({ storeId, admin = false }: Props) {
  const [rows, setRows] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"all" | Settlement["status"]>("all");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    // Settlement promotion is handled server-side (service role only)

    let q = (supabase as any)
      .from("vendor_settlements")
      .select(`*, store:stores(name), rental:rentals(id, product:products(title), customer:profiles!rentals_customer_profiles_fkey(full_name))`)
      .order("created_at", { ascending: false });
    if (storeId) q = q.eq("store_id", storeId);
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data as any) ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [storeId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!term) return true;
      return (
        r.id.toLowerCase().includes(term) ||
        r.rental_id.toLowerCase().includes(term) ||
        (r.rental?.product?.title ?? "").toLowerCase().includes(term) ||
        (r.rental?.customer?.full_name ?? "").toLowerCase().includes(term) ||
        (r.store?.name ?? "").toLowerCase().includes(term)
      );
    });
  }, [rows, status, search]);

  const totals = useMemo(() => ({
    grossSales: rows.reduce((s, r) => s + Number(r.sale_price || 0), 0),
    platformFees: rows.reduce((s, r) => s + Number(r.platform_fee || 0), 0),
    gatewayFees: rows.reduce((s, r) => s + Number(r.gateway_fee || 0), 0),
    netPayouts: rows.reduce((s, r) => s + Number(r.net_payout || 0), 0),
    pendingPayouts: rows.filter((r) => r.status !== "paid" && r.status !== "reversed")
                       .reduce((s, r) => s + Number(r.net_payout || 0), 0),
  }), [rows]);

  function exportCsv() {
    const header = ["id","date","order_id","kind","sale_price","platform_fee_pct","platform_fee","gst","gateway_fee","delivery_fee","other_deductions","total_deductions","net_payout","status","paid_at"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push([
        r.id, r.created_at, r.rental_id, r.kind, r.sale_price, r.platform_fee_percent, r.platform_fee,
        r.gst_amount, r.gateway_fee, r.delivery_fee, r.other_deductions, r.total_deductions, r.net_payout,
        r.status, r.paid_at ?? "",
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `settlements-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function markPaid(row: Settlement) {
    const { error } = await (supabase as any).from("vendor_settlements").update({
      status: "paid", paid_at: new Date().toISOString(),
    }).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Marked as paid");
    load();
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Gross sales" value={inr(totals.grossSales)} />
        <Stat label={`Platform fees${admin ? " collected" : " paid"}`} value={inr(totals.platformFees)} highlight />
        <Stat label="Gateway fees" value={inr(totals.gatewayFees)} />
        <Stat label={admin ? "Total payouts" : "Total earnings"} value={inr(totals.netPayouts)} />
        <Stat label="Awaiting payout" value={inr(totals.pendingPayouts)} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">On hold (refund window)</SelectItem>
            <SelectItem value="eligible">Eligible</SelectItem>
            <SelectItem value="paid">Paid out</SelectItem>
            <SelectItem value="reversed">Reversed</SelectItem>
          </SelectContent>
        </Select>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search id, product, customer…" className="w-72" />
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Export CSV</Button>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No settlements yet. They appear automatically once a sale is delivered or a rental is returned.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <SettlementCard key={r.id} row={r} admin={admin} onMarkPaid={() => markPaid(r)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-rose-deep/40 bg-rose-deep/5" : "border-border bg-card"}`}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="font-display text-xl mt-1">{value}</p>
    </div>
  );
}

function SettlementCard({ row, admin, onMarkPaid }: { row: Settlement; admin?: boolean; onMarkPaid: () => void }) {
  const product = row.rental?.product?.title ?? "Order";
  const customer = row.rental?.customer?.full_name ?? "—";
  const isOnHold = row.status === "pending" && row.eligible_at && new Date(row.eligible_at) > new Date();

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={statusTone[row.status]}>{row.status.replace("_", " ")}</Badge>
            <Badge variant="outline" className={row.kind === "buy" ? "border-emerald-500 text-emerald-700" : "border-sky-500 text-sky-700"}>
              {row.kind === "buy" ? "🟢 Purchase" : "🔵 Rental"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Order #{row.rental_id.slice(0, 8).toUpperCase()} · {format(new Date(row.created_at), "PP")}
            </span>
          </div>
          <p className="font-display text-lg mt-2">{product}</p>
          <p className="text-xs text-muted-foreground">
            {admin && row.store?.name ? `${row.store.name} · ` : ""}Customer: {customer}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Net payout</p>
          <p className="font-display text-2xl text-emerald-700 dark:text-emerald-400">{inr(row.net_payout)}</p>
          {isOnHold && row.eligible_at && (
            <p className="text-xs text-muted-foreground">Eligible {format(new Date(row.eligible_at), "PP")}</p>
          )}
          {row.paid_at && <p className="text-xs text-muted-foreground">Paid {format(new Date(row.paid_at), "PP")}</p>}
        </div>
      </div>

      <div className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <Row label="Sale price" value={inr(row.sale_price)} />
        <Row label={`Platform fee (${row.platform_fee_percent}%)`} value={`− ${inr(row.platform_fee)}`} tone="negative" />
        <Row label="GST" value={inr(row.gst_amount)} muted />
        <Row label="Payment gateway fee" value={`− ${inr(row.gateway_fee)}`} tone="negative" />
        <Row label="Delivery fee" value={inr(row.delivery_fee)} muted />
        {Number(row.other_deductions) > 0 && (
          <Row label="Other deductions" value={`− ${inr(row.other_deductions)}`} tone="negative" />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => downloadInvoice(row, product, customer)}>
          <FileText className="h-3.5 w-3.5" /> Download invoice
        </Button>
        {admin && row.status !== "paid" && row.status !== "reversed" && (
          <Button variant="hero" size="sm" onClick={onMarkPaid}>Mark payout sent</Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, muted, tone }: { label: string; value: string; muted?: boolean; tone?: "negative" }) {
  return (
    <div className={`flex justify-between border-b border-dashed border-border/60 py-1 ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className={tone === "negative" ? "text-destructive font-medium" : "font-medium"}>{value}</span>
    </div>
  );
}

function downloadInvoice(row: Settlement, product: string, customer: string) {
  const date = format(new Date(row.created_at), "PPP");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Settlement Invoice ${row.id.slice(0,8)}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#222}
  h1{font-size:22px;margin:0 0 4px} .muted{color:#777;font-size:12px}
  table{width:100%;border-collapse:collapse;margin-top:20px;font-size:14px}
  td,th{padding:10px 8px;border-bottom:1px solid #eee;text-align:left}
  td.r,th.r{text-align:right} .neg{color:#c0392b}
  .total{font-weight:700;font-size:16px} .box{background:#faf6f3;padding:16px;border-radius:10px;margin-top:16px}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-end">
  <div><h1>Settlement Invoice</h1><div class="muted">${row.id}</div></div>
  <div class="muted">Date: ${date}</div>
</div>
<div class="box">
  <div><strong>Order:</strong> ${row.rental_id} (${row.kind === "buy" ? "Purchase" : "Rental"})</div>
  <div><strong>Product:</strong> ${escapeHtml(product)}</div>
  <div><strong>Customer:</strong> ${escapeHtml(customer)}</div>
  ${row.store?.name ? `<div><strong>Shop:</strong> ${escapeHtml(row.store.name)}</div>` : ""}
</div>
<table>
  <thead><tr><th>Description</th><th class="r">Amount (₹)</th></tr></thead>
  <tbody>
    <tr><td>Sale price</td><td class="r">${row.sale_price.toFixed(2)}</td></tr>
    <tr><td>Platform fee (${row.platform_fee_percent}%)</td><td class="r neg">− ${row.platform_fee.toFixed(2)}</td></tr>
    <tr><td>GST included</td><td class="r">${row.gst_amount.toFixed(2)}</td></tr>
    <tr><td>Payment gateway fee</td><td class="r neg">− ${row.gateway_fee.toFixed(2)}</td></tr>
    <tr><td>Delivery fee</td><td class="r">${row.delivery_fee.toFixed(2)}</td></tr>
    ${row.other_deductions > 0 ? `<tr><td>Other deductions</td><td class="r neg">− ${row.other_deductions.toFixed(2)}</td></tr>` : ""}
    <tr class="total"><td>Net payout to shop owner</td><td class="r">₹ ${row.net_payout.toFixed(2)}</td></tr>
  </tbody>
</table>
<p class="muted" style="margin-top:24px">Status: ${row.status.toUpperCase()}${row.paid_at ? ` · Paid on ${format(new Date(row.paid_at), "PPP")}` : ""}</p>
</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `invoice-${row.id.slice(0,8)}.html`; a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
