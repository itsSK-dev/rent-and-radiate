import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Loader2, FileDown, Search, Receipt as ReceiptIcon } from "lucide-react";

type Row = {
  id: string;
  created_at: string;
  start_date: string | null;
  end_date: string | null;
  days: number | null;
  grand_total: number;
  status: string;
  payment_status: string;
  payment_method: string | null;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  kind: string;
  product: { title: string } | null;
  store: { name: string | null; city: string | null } | null;
};

const PAY_LABEL: Record<string, string> = {
  paid: "Successful",
  cod: "Cash on Delivery",
  unpaid: "Pending",
  pending_verification: "Pending verification",
  verification_failed: "Failed",
  refunded: "Refunded",
  partial_refund: "Partial refund",
};

const PAY_TONE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cod: "bg-amber-100 text-amber-700 border-amber-200",
  unpaid: "bg-rose-100 text-rose-700 border-rose-200",
  pending_verification: "bg-amber-100 text-amber-700 border-amber-200",
  verification_failed: "bg-destructive/10 text-destructive border-destructive/20",
  refunded: "bg-sky-100 text-sky-700 border-sky-200",
  partial_refund: "bg-sky-100 text-sky-700 border-sky-200",
};

const FILTERS = ["all", "paid", "unpaid", "pending_verification", "verification_failed", "refunded"] as const;
type Filter = typeof FILTERS[number];

export default function MyPayments() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => { document.title = "My payments · Rent & Radiate"; }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?next=/my-payments");
  }, [user, authLoading, navigate]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("rentals")
      .select("id,created_at,start_date,end_date,days,grand_total,status,payment_status,payment_method,razorpay_payment_id,razorpay_order_id,kind,product:products(title),store:stores(name,city)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return;
    setRows((data as any) ?? []);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  // Realtime: refresh when this user's rentals change
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`my-payments-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rentals", filter: `customer_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.payment_status !== filter) return false;
      if (!q) return true;
      return (
        r.id.toLowerCase().includes(q) ||
        (r.razorpay_payment_id ?? "").toLowerCase().includes(q) ||
        (r.product?.title ?? "").toLowerCase().includes(q) ||
        (r.store?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, filter]);

  const totals = useMemo(() => {
    const paid = rows.filter((r) => r.payment_status === "paid");
    return {
      paidSum: paid.reduce((s, r) => s + Number(r.grand_total || 0), 0),
      paidCount: paid.length,
      pendingCount: rows.filter((r) => ["unpaid", "pending_verification"].includes(r.payment_status)).length,
      refundedCount: rows.filter((r) => ["refunded", "partial_refund"].includes(r.payment_status)).length,
    };
  }, [rows]);

  function exportCsv() {
    const header = ["order_id", "date", "product", "store", "amount", "method", "status", "rental_days", "payment_id"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push([
        r.id,
        new Date(r.created_at).toISOString(),
        JSON.stringify(r.product?.title ?? ""),
        JSON.stringify(r.store?.name ?? ""),
        r.grand_total,
        r.payment_method ?? "",
        r.payment_status,
        r.days ?? "",
        r.razorpay_payment_id ?? "",
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `my-payments-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-10 md:py-12">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Wallet</p>
          <h1 className="font-display text-4xl md:text-5xl">My payments</h1>
          <p className="text-muted-foreground mt-2 text-sm">All your transactions in one place.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Stat label="Total paid" value={`₹${totals.paidSum.toLocaleString("en-IN")}`} />
          <Stat label="Successful" value={totals.paidCount.toString()} />
          <Stat label="Pending" value={totals.pendingCount.toString()} />
          <Stat label="Refunded" value={totals.refundedCount.toString()} />
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by order, product, store, payment ID…" className="pl-9" />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="w-full md:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="paid">Successful</SelectItem>
              <SelectItem value="unpaid">Pending</SelectItem>
              <SelectItem value="pending_verification">Pending verification</SelectItem>
              <SelectItem value="verification_failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="default" onClick={exportCsv} disabled={!filtered.length}>
            <FileDown className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-12 text-center">
            <ReceiptIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No payments match.</p>
            <Link to="/browse" className="inline-block mt-4"><Button variant="hero" size="sm">Browse rentals</Button></Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-card">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg md:text-xl truncate">{r.product?.title ?? "Rental"}</h3>
                      <Badge className={PAY_TONE[r.payment_status] ?? "bg-secondary"} variant="outline">
                        {PAY_LABEL[r.payment_status] ?? r.payment_status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Order <span className="font-mono">{r.id.slice(0, 8).toUpperCase()}</span>
                      {" · "}{r.store?.name ?? "—"}{r.store?.city ? `, ${r.store.city}` : ""}
                      {" · "}{format(new Date(r.created_at), "PPp")}
                    </p>
                    {r.start_date && r.end_date && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Rental: {format(new Date(r.start_date), "PP")} – {format(new Date(r.end_date), "PP")} ({r.days} day{r.days === 1 ? "" : "s"})
                      </p>
                    )}
                    {r.razorpay_payment_id && (
                      <p className="text-[11px] font-mono text-muted-foreground mt-1 break-all">Payment ID: {r.razorpay_payment_id}</p>
                    )}
                  </div>
                  <div className="flex md:flex-col md:items-end justify-between gap-2 shrink-0">
                    <div className="text-right">
                      <p className="font-display text-2xl">₹{Number(r.grand_total).toLocaleString("en-IN")}</p>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {(r.payment_method ?? (r.payment_status === "unpaid" ? "—" : "manual")).toUpperCase()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {r.payment_status === "unpaid" && (
                        <Link to={`/checkout/${r.id}`}><Button size="sm" variant="hero">Pay now</Button></Link>
                      )}
                      {(r.payment_status === "paid" || r.payment_status === "cod" || r.payment_status === "refunded" || r.payment_status === "partial_refund") && (
                        <Link to={`/receipt/${r.id}`}><Button size="sm" variant="outline">Receipt</Button></Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-xl md:text-2xl mt-0.5">{value}</p>
    </div>
  );
}
