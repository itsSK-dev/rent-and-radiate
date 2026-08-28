import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, differenceInCalendarDays } from "date-fns";
import { Download, Truck } from "lucide-react";
import { DeliveryStageControl, StoreReturnControls, type ReturnRow } from "@/components/DeliveryTracking";

type Row = {
  id: string;
  kind: string;
  status: string;
  payment_status: string;
  delivery_stage: string | null;
  delivery_method: string;
  start_date: string | null;
  end_date: string | null;
  expected_delivery_date: string | null;
  actual_delivered_at: string | null;
  grand_total: number;
  created_at: string;
  customer_id: string;
  store_id: string;
  product: { title: string } | null;
  store: { name: string; city: string | null } | null;
  customer: { full_name: string | null } | null;
};

export function AdminDeliveryPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [returns, setReturns] = useState<(ReturnRow & { rental: any })[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");

  async function load() {
    const { data } = await supabase
      .from("rentals")
      .select("id,kind,status,payment_status,delivery_stage,delivery_method,start_date,end_date,expected_delivery_date,actual_delivered_at,grand_total,created_at,customer_id,store_id,product:products(title),store:stores(name,city),customer:profiles!rentals_customer_profiles_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data as any) ?? []);

    const { data: ret } = await supabase
      .from("return_requests")
      .select("*, rental:rentals(id,product:products(title),store:stores(name))")
      .order("created_at", { ascending: false })
      .limit(200);
    setReturns((ret as any) ?? []);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (city && !(r.store?.city?.toLowerCase().includes(city.toLowerCase()))) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.id.toLowerCase().includes(q) ||
          r.product?.title?.toLowerCase().includes(q) ||
          r.store?.name?.toLowerCase().includes(q) ||
          r.customer?.full_name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, statusFilter, city, search]);

  const stats = useMemo(() => {
    const today = new Date();
    const active = rows.filter((r) => r.kind === "rent" && !["returned", "cancelled"].includes(r.status));
    const overdue = active.filter((r) => r.end_date && differenceInCalendarDays(new Date(r.end_date), today) < 0);
    const pendingDelivery = rows.filter((r) => r.status !== "cancelled" && r.status !== "delivered" && r.status !== "returned" && r.delivery_stage !== "delivered");
    const pendingReturns = returns.filter((r) => !["completed", "rejected"].includes(r.status));
    return {
      total: rows.length,
      active: active.length,
      pendingDelivery: pendingDelivery.length,
      pendingReturns: pendingReturns.length,
      overdue: overdue.length,
      completed: rows.filter((r) => r.status === "returned" || (r.kind === "buy" && r.status === "delivered")).length,
    };
  }, [rows, returns]);

  function exportCSV() {
    const headers = ["Order ID", "Kind", "Customer", "Product", "Store", "City", "Status", "Delivery stage", "Start", "End", "Expected", "Delivered", "Total"];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      lines.push([
        r.id, r.kind, r.customer?.full_name ?? "", r.product?.title ?? "", r.store?.name ?? "",
        r.store?.city ?? "", r.status, r.delivery_stage ?? "", r.start_date ?? "", r.end_date ?? "",
        r.expected_delivery_date ?? "", r.actual_delivered_at ?? "", r.grand_total,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `deliveries-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <Stat label="Total orders" value={stats.total} />
        <Stat label="Active rentals" value={stats.active} />
        <Stat label="Pending delivery" value={stats.pendingDelivery} />
        <Stat label="Pending returns" value={stats.pendingReturns} />
        <Stat label="Overdue" value={stats.overdue} tone="danger" />
        <Stat label="Completed" value={stats.completed} />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <Input placeholder="Search order, product, customer, store…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Input placeholder="City" className="w-40" value={city} onChange={(e) => setCity(e.target.value)} />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-left">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Store / City</th>
              <th className="p-3">Status</th>
              <th className="p-3">Delivery</th>
              <th className="p-3">Dates</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const overdue = r.kind === "rent" && r.end_date && !["returned","cancelled"].includes(r.status) &&
                differenceInCalendarDays(new Date(r.end_date), new Date()) < 0;
              return (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="p-3">
                    <div className="font-mono text-xs">{r.id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{r.product?.title}</div>
                  </td>
                  <td className="p-3">{r.customer?.full_name ?? "—"}</td>
                  <td className="p-3">{r.store?.name}<div className="text-xs text-muted-foreground">{r.store?.city}</div></td>
                  <td className="p-3">
                    <Badge variant="outline" className="capitalize">{r.status}</Badge>
                    {overdue && <Badge className="ml-1 bg-destructive/10 text-destructive">Overdue</Badge>}
                  </td>
                  <td className="p-3">
                    <DeliveryStageControl rentalId={r.id} currentStage={r.delivery_stage} onChanged={load} />
                  </td>
                  <td className="p-3 text-xs">
                    {r.start_date && <div>Start: {format(new Date(r.start_date), "PP")}</div>}
                    {r.end_date && <div>End: {format(new Date(r.end_date), "PP")}</div>}
                    {r.expected_delivery_date && <div>ETA: {format(new Date(r.expected_delivery_date), "PP")}</div>}
                  </td>
                  <td className="p-3"><Link to={`/track/${r.id}`} className="text-xs text-rose-deep hover:underline">Open</Link></td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">No orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="font-display text-xl mb-3 flex items-center gap-2"><Truck className="h-5 w-5" /> Return requests</h3>
        <div className="space-y-3">
          {returns.length === 0 && <p className="text-sm text-muted-foreground">No return requests.</p>}
          {returns.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="text-sm">
                  <p className="font-medium">{r.rental?.product?.title ?? "Order"} · {r.rental?.store?.name}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), "PPp")}</p>
                </div>
                <Badge className="bg-primary-soft text-rose-deep capitalize">{r.status.replace(/_/g, " ")}</Badge>
              </div>
              <StoreReturnControls ret={r} onChanged={load} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div className={`rounded-2xl px-4 py-3 text-center ${tone === "danger" ? "bg-destructive/10" : "bg-secondary"}`}>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl ${tone === "danger" ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
