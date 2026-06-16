import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { OrderActions } from "@/components/vendor/OrderActions";
import { inr } from "@/lib/pricing";
import { format } from "date-fns";
import { Search, Package, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  created_at: string;
  status: string;
  kind: "buy" | "rent";
  quantity: number;
  grand_total: number;
  address: string | null;
  payment_status: string;
  customer_id: string;
  store_id: string;
  product: { title: string; images: string[] | null } | null;
  customer: { full_name: string | null } | null;
};

const STATUS_GROUPS: { key: string; label: string; statuses: string[] }[] = [
  { key: "all", label: "All", statuses: [] },
  { key: "new", label: "New", statuses: ["pending"] },
  { key: "active", label: "In Progress", statuses: ["accepted", "confirmed", "packing", "ready_for_pickup"] },
  { key: "shipped", label: "Shipped", statuses: ["shipped"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered", "returned"] },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled", "rejected"] },
];

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  accepted: "bg-sky-100 text-sky-900",
  confirmed: "bg-sky-100 text-sky-900",
  rejected: "bg-red-100 text-red-900",
  packing: "bg-indigo-100 text-indigo-900",
  ready_for_pickup: "bg-violet-100 text-violet-900",
  shipped: "bg-blue-100 text-blue-900",
  delivered: "bg-emerald-100 text-emerald-900",
  returned: "bg-gold/30 text-rose-deep",
  cancelled: "bg-red-100 text-red-900",
};

const PAYMENT_TONE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-900",
  unpaid: "bg-amber-100 text-amber-900",
  cod: "bg-amber-100 text-amber-900",
  pending_verification: "bg-amber-100 text-amber-900",
  verification_failed: "bg-red-100 text-red-900",
  refunded: "bg-sky-100 text-sky-900",
  partial_refund: "bg-sky-100 text-sky-900",
};

export default function VendorOrders() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [fetching, setFetching] = useState(true);
  const [tab, setTab] = useState("all");
  const [kindFilter, setKindFilter] = useState<"all" | "buy" | "rent">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.title = "Orders · Vendor · Rent & Radiate";
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/vendor/orders");
  }, [user, loading, navigate]);

  async function refresh() {
    if (!user) return;
    setFetching(true);
    const { data: s } = await supabase.from("stores").select("id").eq("owner_id", user.id);
    const ids = (s ?? []).map((x) => x.id);
    setStoreIds(ids);
    if (ids.length === 0) {
      setRows([]);
      setFetching(false);
      return;
    }
    const { data, error } = await supabase
      .from("rentals")
      .select(`
        id, created_at, status, kind, quantity, grand_total, address, payment_status,
        customer_id, store_id,
        product:products(title, images),
        customer:profiles!rentals_customer_id_fkey(full_name)
      `)
      .in("store_id", ids)
      .order("created_at", { ascending: false })
      .limit(500);
    if (!error) setRows((data as any) ?? []);
    setFetching(false);
  }

  useEffect(() => {
    refresh();
  }, [user?.id]);

  // Realtime: refresh on any rental change in vendor's stores
  useEffect(() => {
    if (storeIds.length === 0) return;
    const channel = supabase
      .channel("vendor-orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "rentals" }, (payload) => {
        const row: any = payload.new ?? payload.old;
        if (row && storeIds.includes(row.store_id)) refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeIds.join(",")]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const g of STATUS_GROUPS) {
      c[g.key] = g.statuses.length === 0
        ? rows.length
        : rows.filter((r) => g.statuses.includes(r.status)).length;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const group = STATUS_GROUPS.find((g) => g.key === tab)!;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (group.statuses.length > 0 && !group.statuses.includes(r.status)) return false;
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      if (q) {
        const name = r.customer?.full_name?.toLowerCase() ?? "";
        const idMatch = r.id.toLowerCase().startsWith(q) || r.id.slice(0, 8).toLowerCase().includes(q);
        const productMatch = r.product?.title?.toLowerCase().includes(q);
        if (!name.includes(q) && !idMatch && !productMatch) return false;
      }
      return true;
    });
  }, [rows, tab, kindFilter, search]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 container py-12">Loading…</div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-6 md:py-10 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-tight">Order Management</h1>
            <p className="text-sm text-muted-foreground">
              {storeIds.length === 0
                ? "No stores yet — open a store to start receiving orders."
                : `Managing orders for ${storeIds.length} store${storeIds.length > 1 ? "s" : ""}`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={fetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${fetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </header>

        {/* Filters */}
        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order ID, customer name, or product…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="buy">Purchases</SelectItem>
                <SelectItem value="rent">Rentals</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex-wrap h-auto">
              {STATUS_GROUPS.map((g) => (
                <TabsTrigger key={g.key} value={g.key} className="gap-2">
                  {g.label}
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {counts[g.key]}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </Card>

        {/* Orders */}
        {fetching && rows.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">Loading orders…</Card>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No orders match these filters.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <Card key={r.id} className="p-4 md:p-5">
                <div className="grid grid-cols-1 md:grid-cols-[80px_1fr_auto] gap-4">
                  <div className="hidden md:block">
                    {r.product?.images?.[0] ? (
                      <img
                        src={r.product.images[0]}
                        alt={r.product.title}
                        className="h-20 w-20 rounded-lg object-cover border border-border"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{r.product?.title ?? "Item"}</span>
                      <Badge className={STATUS_TONE[r.status] ?? ""}>{r.status.replaceAll("_", " ")}</Badge>
                      <Badge className={PAYMENT_TONE[r.payment_status] ?? ""}>
                        {r.payment_status.replaceAll("_", " ")}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {r.kind === "buy" ? "Purchase" : "Rental"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <div><span className="text-foreground/70">Order:</span> #{r.id.slice(0, 8)}</div>
                      <div><span className="text-foreground/70">Customer:</span> {r.customer?.full_name ?? "—"}</div>
                      <div><span className="text-foreground/70">Qty:</span> {r.quantity}</div>
                      <div><span className="text-foreground/70">Total:</span> {inr(r.grand_total)}</div>
                      <div className="col-span-2 md:col-span-2">
                        <span className="text-foreground/70">Placed:</span>{" "}
                        {format(new Date(r.created_at), "PPp")}
                      </div>
                      {r.address && (
                        <div className="col-span-2 md:col-span-4 line-clamp-2">
                          <span className="text-foreground/70">Address:</span> {r.address}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="md:text-right md:min-w-[220px]">
                    <OrderActions
                      rentalId={r.id}
                      status={r.status}
                      kind={r.kind}
                      onChanged={refresh}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
