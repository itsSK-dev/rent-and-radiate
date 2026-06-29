import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, TrendingUp, Loader2, FileText } from "lucide-react";
import { format, parseISO, startOfMonth, subDays, isAfter } from "date-fns";
import { inr } from "@/lib/pricing";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function exportPdf(opts: {
  filename: string;
  title: string;
  subtitle?: string;
  head: string[];
  body: (string | number)[][];
  totals?: [string, string][];
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text(opts.title, 40, 48);
  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(opts.subtitle, 40, 64);
    doc.setTextColor(0);
  }
  autoTable(doc, {
    startY: 80,
    head: [opts.head],
    body: opts.body.map((r) => r.map((c) => String(c))),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [17, 17, 17] },
    margin: { left: 40, right: 40 },
  });
  if (opts.totals?.length) {
    const y = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(11);
    opts.totals.forEach(([k, v], i) => {
      doc.text(`${k}: ${v}`, 40, y + i * 16);
    });
  }
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generated ${format(new Date(), "PPpp")}`, 40, doc.internal.pageSize.getHeight() - 24);
  doc.save(opts.filename);
}

type Rental = {
  id: string;
  kind: "rent" | "buy";
  status: string;
  subtotal: number;
  grand_total: number;
  commission_amount: number;
  gst_amount: number;
  discount_amount: number;
  delivery_fee: number;
  deposit: number;
  quantity: number;
  days: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  customer_id: string;
  product_id: string;
  product: { title: string | null } | null;
  customer: { full_name: string | null } | null;

};

type Settlement = {
  rental_id: string;
  net_payout: number;
  platform_fee: number;
  status: string;
  created_at: string;
};

type Refund = { rental_id: string; refund_amount: number; status: string };

const RANGES = [
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 12 months", days: 365 },
  { label: "All time", days: 0 },
];

const COLORS = ["#c2410c", "#fb7185", "#10b981", "#6366f1", "#f59e0b"];

export function VendorAnalyticsPanel({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [loading, setLoading] = useState(true);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [rangeDays, setRangeDays] = useState(30);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [r, s, rf] = await Promise.all([
        supabase
          .from("rentals")
          .select("id,kind,status,subtotal,grand_total,commission_amount,gst_amount,discount_amount,delivery_fee,deposit,quantity,days,start_date,end_date,created_at,customer_id,product_id,product:products(title),customer:profiles!rentals_customer_id_fkey(full_name)")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false }),
        (supabase as any).from("vendor_settlements")
          .select("rental_id,net_payout,platform_fee,status,created_at")
          .eq("store_id", storeId),
        (supabase as any).from("deposit_refunds")
          .select("rental_id,refund_amount,status")
          .eq("store_id", storeId),
      ]);
      if (cancelled) return;
      setRentals((r.data as any) ?? []);
      setSettlements((s.data as any) ?? []);
      setRefunds((rf.data as any) ?? []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [storeId]);

  const sinceDate = useMemo(() => rangeDays > 0 ? subDays(new Date(), rangeDays) : null, [rangeDays]);

  const inRange = useMemo(
    () => rentals.filter((r) => !sinceDate || isAfter(parseISO(r.created_at), sinceDate)),
    [rentals, sinceDate],
  );

  const completed = useMemo(
    () => inRange.filter((r) => r.status !== "cancelled" && r.status !== "rejected"),
    [inRange],
  );

  const kpis = useMemo(() => {
    const gross = completed.reduce((s, r) => s + Number(r.subtotal || 0), 0);
    const buyCount = completed.filter((r) => r.kind === "buy").length;
    const rentCount = completed.filter((r) => r.kind === "rent").length;
    const net = settlements
      .filter((s) => !sinceDate || isAfter(parseISO(s.created_at), sinceDate))
      .reduce((sum, s) => sum + Number(s.net_payout || 0), 0);
    const platformFees = settlements
      .filter((s) => !sinceDate || isAfter(parseISO(s.created_at), sinceDate))
      .reduce((sum, s) => sum + Number(s.platform_fee || 0), 0);
    const aov = completed.length > 0 ? gross / completed.length : 0;
    const customers = new Set(completed.map((r) => r.customer_id));
    const repeatCustomers = [...customers].filter(
      (cid) => completed.filter((r) => r.customer_id === cid).length > 1,
    ).length;
    const repeatRate = customers.size > 0 ? (repeatCustomers / customers.size) * 100 : 0;
    const conversion = inRange.length > 0
      ? (inRange.filter((r) => ["confirmed", "delivered", "returned"].includes(r.status)).length / inRange.length) * 100
      : 0;
    return { gross, net, platformFees, buyCount, rentCount, total: completed.length, aov, repeatRate, conversion };
  }, [completed, settlements, sinceDate, inRange]);

  const earningsByDay = useMemo(() => {
    const map = new Map<string, number>();
    completed.forEach((r) => {
      const key = format(parseISO(r.created_at), rangeDays > 90 ? "yyyy-MM" : "yyyy-MM-dd");
      map.set(key, (map.get(key) ?? 0) + Number(r.subtotal || 0));
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
  }, [completed, rangeDays]);

  const statusBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    inRange.forEach((r) => map.set(r.status, (map.get(r.status) ?? 0) + 1));
    return [...map.entries()].map(([status, count]) => ({ status, count }));
  }, [inRange]);

  const kindSplit = useMemo(() => ([
    { name: "Rent", value: completed.filter((r) => r.kind === "rent").reduce((s, r) => s + Number(r.subtotal), 0) },
    { name: "Buy", value: completed.filter((r) => r.kind === "buy").reduce((s, r) => s + Number(r.subtotal), 0) },
  ].filter((d) => d.value > 0)), [completed]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { title: string; revenue: number; orders: number }>();
    completed.forEach((r) => {
      const t = r.product?.title ?? "Unknown";
      const cur = map.get(t) ?? { title: t, revenue: 0, orders: 0 };
      cur.revenue += Number(r.subtotal || 0);
      cur.orders += 1;
      map.set(t, cur);
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [completed]);

  const monthlyStatements = useMemo(() => {
    const map = new Map<string, { gross: number; fees: number; net: number; orders: number; key: string; label: string }>();
    completed.forEach((r) => {
      const d = startOfMonth(parseISO(r.created_at));
      const key = format(d, "yyyy-MM");
      const cur = map.get(key) ?? { gross: 0, fees: 0, net: 0, orders: 0, key, label: format(d, "MMMM yyyy") };
      cur.gross += Number(r.subtotal || 0);
      cur.orders += 1;
      map.set(key, cur);
    });
    settlements.forEach((s) => {
      const key = format(startOfMonth(parseISO(s.created_at)), "yyyy-MM");
      const cur = map.get(key);
      if (cur) { cur.fees += Number(s.platform_fee || 0); cur.net += Number(s.net_payout || 0); }
    });
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [completed, settlements]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading analytics…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-rose-deep" />
          <h2 className="font-display text-2xl">Analytics</h2>
        </div>
        <Select value={String(rangeDays)} onValueChange={(v) => setRangeDays(Number(v))}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => <SelectItem key={r.days} value={String(r.days)}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Gross sales" value={inr(kpis.gross)} />
        <Kpi label="Net payout" value={inr(kpis.net)} tone="good" />
        <Kpi label="Platform fees" value={inr(kpis.platformFees)} tone="muted" />
        <Kpi label="Orders" value={`${kpis.total}`} sub={`${kpis.rentCount} rent · ${kpis.buyCount} buy`} />
        <Kpi label="Avg order" value={inr(kpis.aov)} />
        <Kpi label="Repeat customers" value={`${kpis.repeatRate.toFixed(0)}%`} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rentals">Rental earnings</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="monthly">Monthly statements</TabsTrigger>
          <TabsTrigger value="products">Product performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 grid lg:grid-cols-2 gap-5">
          <Card title="Earnings over time">
            {earningsByDay.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={earningsByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => inr(Number(v))} />
                  <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
          <Card title="Orders by status">
            {statusBreakdown.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={statusBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill={COLORS[1]} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
          <Card title="Buy vs Rent revenue">
            {kindSplit.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={kindSplit} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                    {kindSplit.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => inr(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
          <Card title="Top 5 products by revenue">
            {topProducts.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="title" type="category" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => inr(Number(v))} />
                  <Bar dataKey="revenue" fill={COLORS[2]} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="rentals" className="mt-6">
          <ReportTable
            title="Rental earnings"
            rows={completed.filter((r) => r.kind === "rent")}
            settlements={settlements}
            refunds={refunds}
            kind="rent"
          />
        </TabsContent>

        <TabsContent value="sales" className="mt-6">
          <ReportTable
            title="Sales (buy orders)"
            rows={completed.filter((r) => r.kind === "buy")}
            settlements={settlements}
            refunds={refunds}
            kind="buy"
          />
        </TabsContent>

        <TabsContent value="monthly" className="mt-6">
          <MonthlyStatements months={monthlyStatements} storeName={storeName} />
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <ProductPerformance storeId={storeId} rentals={completed} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "muted" }) {
  const bg = tone === "good" ? "bg-emerald-50 text-emerald-900"
           : tone === "muted" ? "bg-muted text-foreground"
           : "bg-secondary";
  return (
    <div className={`rounded-2xl px-4 py-3 ${bg}`}>
      <p className="text-[11px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="font-display text-xl">{value}</p>
      {sub && <p className="text-[11px] opacity-70 mt-0.5">{sub}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h3 className="font-display text-lg mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="h-[260px] grid place-items-center text-sm text-muted-foreground">Not enough data yet</div>;
}

function toCsv(headers: string[], rows: (string | number)[][]) {
  const esc = (v: any) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

function download(filename: string, content: string, type = "text/csv") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ReportTable({ title, rows, settlements, refunds, kind }: {
  title: string;
  rows: Rental[];
  settlements: Settlement[];
  refunds: Refund[];
  kind: "rent" | "buy";
}) {
  const [productFilter, setProductFilter] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const products = useMemo(
    () => [...new Set(rows.map((r) => r.product?.title ?? "Unknown"))],
    [rows],
  );

  const filtered = useMemo(() => rows.filter((r) => {
    if (productFilter !== "all" && (r.product?.title ?? "Unknown") !== productFilter) return false;
    const d = parseISO(r.created_at);
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(to)) return false;
    return true;
  }), [rows, productFilter, from, to]);

  function exportCsv() {
    if (kind === "rent") {
      const headers = ["Date", "Product", "Period", "Days", "Qty", "Gross", "Platform fee", "Net", "Deposit refunded", "Status"];
      const data = filtered.map((r) => {
        const s = settlements.find((x) => x.rental_id === r.id);
        const rf = refunds.find((x) => x.rental_id === r.id);
        return [
          format(parseISO(r.created_at), "yyyy-MM-dd"),
          r.product?.title ?? "—",
          r.start_date && r.end_date ? `${r.start_date} → ${r.end_date}` : "—",
          r.days ?? "",
          r.quantity,
          Number(r.subtotal).toFixed(2),
          Number(s?.platform_fee ?? 0).toFixed(2),
          Number(s?.net_payout ?? 0).toFixed(2),
          Number(rf?.refund_amount ?? 0).toFixed(2),
          r.status,
        ];
      });
      download(`rental-earnings-${Date.now()}.csv`, toCsv(headers, data));
    } else {
      const headers = ["Date", "Order id", "Product", "Qty", "Subtotal", "Discount", "GST", "Net", "Status"];
      const data = filtered.map((r) => {
        const s = settlements.find((x) => x.rental_id === r.id);
        return [
          format(parseISO(r.created_at), "yyyy-MM-dd"),
          r.id,
          r.product?.title ?? "—",
          r.quantity,
          Number(r.subtotal).toFixed(2),
          Number(r.discount_amount ?? 0).toFixed(2),
          Number(r.gst_amount ?? 0).toFixed(2),
          Number(s?.net_payout ?? 0).toFixed(2),
          r.status,
        ];
      });
      download(`sales-${Date.now()}.csv`, toCsv(headers, data));
    }

    toast.success("CSV downloaded");
  }

  function exportPdfReport() {
    if (kind === "rent") {
      const head = ["Date", "Product", "Period", "Days", "Qty", "Gross", "Fee", "Net", "Refund", "Status"];
      const body = filtered.map((r) => {
        const s = settlements.find((x) => x.rental_id === r.id);
        const rf = refunds.find((x) => x.rental_id === r.id);
        return [
          format(parseISO(r.created_at), "yyyy-MM-dd"),
          r.product?.title ?? "—",
          r.start_date && r.end_date ? `${r.start_date} → ${r.end_date}` : "—",
          r.days ?? "",
          r.quantity,
          inr(r.subtotal),
          inr(s?.platform_fee ?? 0),
          inr(s?.net_payout ?? 0),
          inr(rf?.refund_amount ?? 0),
          r.status,
        ];
      });
      const totals: [string, string][] = [
        ["Total gross", inr(filtered.reduce((a, r) => a + Number(r.subtotal || 0), 0))],
        ["Total platform fees", inr(filtered.reduce((a, r) => a + Number(settlements.find((x) => x.rental_id === r.id)?.platform_fee ?? 0), 0))],
        ["Total net payout", inr(filtered.reduce((a, r) => a + Number(settlements.find((x) => x.rental_id === r.id)?.net_payout ?? 0), 0))],
      ];
      exportPdf({
        filename: `rental-earnings-${Date.now()}.pdf`,
        title: "Rental Earnings Report",
        subtitle: `${filtered.length} rentals${from || to ? ` · ${from || "…"} → ${to || "…"}` : ""}`,
        head, body, totals,
      });
    } else {
      const head = ["Date", "Order", "Product", "Qty", "Subtotal", "Discount", "GST", "Net", "Status"];
      const body = filtered.map((r) => {
        const s = settlements.find((x) => x.rental_id === r.id);
        return [
          format(parseISO(r.created_at), "yyyy-MM-dd"),
          r.id.slice(0, 8),
          r.product?.title ?? "—",
          r.quantity,
          inr(r.subtotal),
          inr(r.discount_amount ?? 0),
          inr(r.gst_amount ?? 0),
          inr(s?.net_payout ?? 0),
          r.status,
        ];
      });
      const totals: [string, string][] = [
        ["Total subtotal", inr(filtered.reduce((a, r) => a + Number(r.subtotal || 0), 0))],
        ["Total GST", inr(filtered.reduce((a, r) => a + Number(r.gst_amount || 0), 0))],
        ["Total net payout", inr(filtered.reduce((a, r) => a + Number(settlements.find((x) => x.rental_id === r.id)?.net_payout ?? 0), 0))],
      ];
      exportPdf({
        filename: `sales-${Date.now()}.pdf`,
        title: "Sales Report",
        subtitle: `${filtered.length} orders${from || to ? ` · ${from || "…"} → ${to || "…"}` : ""}`,
        head, body, totals,
      });
    }
    toast.success("PDF downloaded");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Product" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        <Button size="sm" variant="outline" onClick={exportCsv} className="ml-auto">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No matching {kind === "rent" ? "rentals" : "sales"}.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Product</th>
                {kind === "rent" ? <th className="p-3">Period</th> : <th className="p-3">Order</th>}
                <th className="p-3">Qty</th>
                <th className="p-3">Gross</th>
                {kind === "rent" ? <th className="p-3">Fee</th> : <th className="p-3">GST</th>}
                <th className="p-3">Net</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const s = settlements.find((x) => x.rental_id === r.id);
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3">{format(parseISO(r.created_at), "PP")}</td>
                    <td className="p-3 font-medium">{r.product?.title ?? "—"}</td>
                    {kind === "rent"
                      ? <td className="p-3 text-xs">{r.start_date && r.end_date ? `${format(parseISO(r.start_date), "MMM d")} → ${format(parseISO(r.end_date), "MMM d")}` : "—"} · {r.days}d</td>
                      : <td className="p-3 text-xs font-mono">{r.id.slice(0, 8)}</td>}
                    <td className="p-3">{r.quantity}</td>
                    <td className="p-3">{inr(r.subtotal)}</td>
                    <td className="p-3">{kind === "rent" ? inr(s?.platform_fee ?? 0) : inr(r.gst_amount ?? 0)}</td>
                    <td className="p-3 font-semibold">{inr(s?.net_payout ?? 0)}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="capitalize">{r.status}</Badge>
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

function MonthlyStatements({ months, storeName }: { months: { gross: number; fees: number; net: number; orders: number; key: string; label: string }[]; storeName: string }) {
  function downloadStatement(m: typeof months[number]) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${m.label} – Statement</title>
<style>body{font-family:system-ui;max-width:680px;margin:40px auto;padding:0 24px;color:#111}
h1{margin:0}.muted{color:#666;font-size:13px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}
.total{font-weight:600;font-size:18px;padding-top:14px;border-top:2px solid #111;margin-top:14px}</style></head>
<body>
<h1>${storeName}</h1>
<p class="muted">Monthly earnings statement · ${m.label}</p>
<div class="row"><span>Orders</span><span>${m.orders}</span></div>
<div class="row"><span>Gross sales</span><span>${inr(m.gross)}</span></div>
<div class="row"><span>Platform fees</span><span>− ${inr(m.fees)}</span></div>
<div class="row total"><span>Net payout</span><span>${inr(m.net)}</span></div>
<p class="muted" style="margin-top:24px">Generated by Rent & Radiate · ${format(new Date(), "PP")}</p>
</body></html>`;
    download(`statement-${m.key}.html`, html, "text/html");
  }

  if (months.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">No completed orders yet.</div>;
  }
  return (
    <div className="rounded-2xl border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="p-3">Month</th>
            <th className="p-3">Orders</th>
            <th className="p-3">Gross</th>
            <th className="p-3">Platform fees</th>
            <th className="p-3">Net payout</th>
            <th className="p-3 text-right">Statement</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.key} className="border-t border-border">
              <td className="p-3 font-medium">{m.label}</td>
              <td className="p-3">{m.orders}</td>
              <td className="p-3">{inr(m.gross)}</td>
              <td className="p-3">{inr(m.fees)}</td>
              <td className="p-3 font-semibold">{inr(m.net)}</td>
              <td className="p-3 text-right">
                <Button size="sm" variant="outline" onClick={() => downloadStatement(m)}>
                  <FileText className="h-3.5 w-3.5" /> Download
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductPerformance({ storeId, rentals }: { storeId: string; rentals: Rental[] }) {
  const [wishCounts, setWishCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const productIds = [...new Set(rentals.map((r) => r.product_id))];
      if (productIds.length === 0) return;
      const w = await (supabase as any).from("wishlists").select("product_id").in("product_id", productIds);
      if (cancelled) return;
      const wc: Record<string, number> = {};
      (w.data ?? []).forEach((r: any) => { wc[r.product_id] = (wc[r.product_id] ?? 0) + 1; });
      setWishCounts(wc);
    }
    load();
    return () => { cancelled = true; };
  }, [rentals, storeId]);

  const perProduct = useMemo(() => {
    const map = new Map<string, { id: string; title: string; orders: number; units: number; revenue: number }>();
    rentals.forEach((r) => {
      const cur = map.get(r.product_id) ?? { id: r.product_id, title: r.product?.title ?? "—", orders: 0, units: 0, revenue: 0 };
      cur.orders += 1;
      cur.units += r.quantity;
      cur.revenue += Number(r.subtotal || 0);
      map.set(r.product_id, cur);
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [rentals]);

  if (perProduct.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">No product sales yet.</div>;
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="p-3">Product</th>
            <th className="p-3">Orders</th>
            <th className="p-3">Units sold</th>
            <th className="p-3">Revenue</th>
            <th className="p-3">Avg per order</th>
            <th className="p-3">Wishlist saves</th>
          </tr>
        </thead>
        <tbody>
          {perProduct.map((p) => (
            <tr key={p.id} className="border-t border-border">
              <td className="p-3 font-medium">{p.title}</td>
              <td className="p-3">{p.orders}</td>
              <td className="p-3">{p.units}</td>
              <td className="p-3 font-semibold">{inr(p.revenue)}</td>
              <td className="p-3">{inr(p.orders > 0 ? p.revenue / p.orders : 0)}</td>
              <td className="p-3">{wishCounts[p.id] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

