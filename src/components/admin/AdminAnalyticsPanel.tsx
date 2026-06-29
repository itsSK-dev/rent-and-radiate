import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { Download } from "lucide-react";
import {
  fetchRentalsInRange, fetchRefundsInRange, fetchSettlementsInRange,
  bucketize, toSeries, defaultBucket, csvDownload, inr,
  type RangeKey, type Bucket, type RentalRow,
} from "@/lib/adminStats";

const PAID = new Set(["paid", "partial_refund", "refunded"]);

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "12m", label: "12m" },
  { key: "all", label: "All" },
];

const REV_BUCKETS: { key: Bucket; label: string }[] = [
  { key: "day", label: "Daily" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
  { key: "year", label: "Yearly" },
];

export function AdminAnalyticsPanel() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [revBucket, setRevBucket] = useState<Bucket>("day");
  const [rentals, setRentals] = useState<RentalRow[]>([]);
  const [refunds, setRefunds] = useState<Awaited<ReturnType<typeof fetchRefundsInRange>>>([]);
  const [settlements, setSettlements] = useState<Awaited<ReturnType<typeof fetchSettlementsInRange>>>([]);
  const [productTitles, setProductTitles] = useState<Record<string, string>>({});
  const [storeNames, setStoreNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { setRevBucket(defaultBucket(range)); }, [range]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchRentalsInRange(range),
      fetchRefundsInRange(range),
      fetchSettlementsInRange(range),
    ]).then(async ([r, rf, st]) => {
      if (!alive) return;
      setRentals(r); setRefunds(rf); setSettlements(st);

      const pids = Array.from(new Set(r.map((x) => x.product_id).filter(Boolean))) as string[];
      const sids = Array.from(new Set(r.map((x) => x.store_id).filter(Boolean))) as string[];
      const [pRes, sRes] = await Promise.all([
        pids.length ? (supabase as any).from("products").select("id,title").in("id", pids) : { data: [] },
        sids.length ? (supabase as any).from("stores").select("id,name").in("id", sids) : { data: [] },
      ]);
      if (!alive) return;
      const pm: Record<string, string> = {};
      ((pRes as any).data ?? []).forEach((p: any) => (pm[p.id] = p.title));
      setProductTitles(pm);
      const sm: Record<string, string> = {};
      ((sRes as any).data ?? []).forEach((s: any) => (sm[s.id] = s.name));
      setStoreNames(sm);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { alive = false; };
  }, [range]);

  // Revenue
  const revenue = useMemo(() => {
    const paid = rentals.filter((r) => PAID.has(r.payment_status));
    const m = bucketize(paid, (r) => r.created_at, revBucket);
    return toSeries(m, revBucket, (rows) => ({
      revenue: rows.reduce((s, r) => s + Number(r.grand_total || 0), 0),
    }));
  }, [rentals, revBucket]);

  // Orders over time
  const ordersBucket = defaultBucket(range);
  const ordersSeries = useMemo(() => {
    const m = bucketize(rentals, (r) => r.created_at, ordersBucket);
    return toSeries(m, ordersBucket, (rows) => ({
      buy: rows.filter((r) => r.kind === "buy").length,
      rent: rows.filter((r) => r.kind !== "buy").length,
    }));
  }, [rentals, ordersBucket]);

  // Rental trends — created vs returned
  const rentalTrends = useMemo(() => {
    const rentalsOnly = rentals.filter((r) => r.kind !== "buy");
    const created = bucketize(rentalsOnly, (r) => r.created_at, ordersBucket);
    const returned = bucketize(rentalsOnly.filter((r) => r.returned_at), (r) => r.returned_at, ordersBucket);
    const keys = Array.from(new Set([...created.keys(), ...returned.keys()])).sort();
    return keys.map((k) => ({
      date: toSeries(new Map([[k, []]]), ordersBucket, () => ({}))[0].date,
      sort: k,
      created: (created.get(k) ?? []).length,
      returned: (returned.get(k) ?? []).length,
    }));
  }, [rentals, ordersBucket]);

  // Refund trends
  const refundTrends = useMemo(() => {
    const m = bucketize(refunds, (r) => r.created_at, ordersBucket);
    return toSeries(m, ordersBucket, (rows) => ({
      count: rows.length,
      amount: rows.reduce((s, r) => s + Number(r.refund_amount || 0), 0),
    }));
  }, [refunds, ordersBucket]);

  // Commission earnings
  const commissionSeries = useMemo(() => {
    const m = bucketize(settlements, (r) => r.created_at, ordersBucket);
    return toSeries(m, ordersBucket, (rows) => ({
      commission: rows.reduce((s, r) => s + Number(r.platform_fee || 0), 0),
    }));
  }, [settlements, ordersBucket]);

  // Top products
  const topProducts = useMemo(() => {
    const acc = new Map<string, { orders: number; revenue: number }>();
    for (const r of rentals) {
      if (!r.product_id) continue;
      const e = acc.get(r.product_id) ?? { orders: 0, revenue: 0 };
      e.orders += 1;
      if (PAID.has(r.payment_status)) e.revenue += Number(r.grand_total || 0);
      acc.set(r.product_id, e);
    }
    return Array.from(acc.entries())
      .map(([id, v]) => ({ id, title: productTitles[id] ?? id.slice(0, 8), ...v }))
      .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
      .slice(0, 10);
  }, [rentals, productTitles]);

  // Top sellers
  const topSellers = useMemo(() => {
    const acc = new Map<string, { orders: number; revenue: number }>();
    for (const r of rentals) {
      if (!r.store_id) continue;
      const e = acc.get(r.store_id) ?? { orders: 0, revenue: 0 };
      e.orders += 1;
      if (PAID.has(r.payment_status)) e.revenue += Number(r.grand_total || 0);
      acc.set(r.store_id, e);
    }
    return Array.from(acc.entries())
      .map(([id, v]) => ({ id, name: storeNames[id] ?? id.slice(0, 8), ...v }))
      .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
      .slice(0, 10);
  }, [rentals, storeNames]);

  const stroke = "hsl(var(--primary))";
  const stroke2 = "hsl(var(--rose-deep, var(--primary)))";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <TabsList>
            {RANGES.map((r) => (
              <TabsTrigger key={r.key} value={r.key}>{r.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="grid lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Revenue trend</CardTitle>
              <div className="flex items-center gap-2">
                <Tabs value={revBucket} onValueChange={(v) => setRevBucket(v as Bucket)}>
                  <TabsList className="h-8">
                    {REV_BUCKETS.map((b) => (
                      <TabsTrigger key={b.key} value={b.key} className="text-xs">{b.label}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <Button size="sm" variant="outline" onClick={() => csvDownload("revenue.csv", revenue)}>
                  <Download className="h-3.5 w-3.5 mr-1" />CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(v) => inr(Number(v))} width={70} />
                  <Tooltip formatter={(v: any) => inr(Number(v))} />
                  <Line type="monotone" dataKey="revenue" stroke={stroke} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Orders over time</CardTitle>
              <Button size="sm" variant="outline" onClick={() => csvDownload("orders.csv", ordersSeries)}>
                <Download className="h-3.5 w-3.5 mr-1" />CSV
              </Button>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ordersSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="rent" stackId="a" fill={stroke} name="Rent" />
                  <Bar dataKey="buy" stackId="a" fill={stroke2} name="Buy" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Rental trends</CardTitle>
              <Button size="sm" variant="outline" onClick={() => csvDownload("rental-trends.csv", rentalTrends)}>
                <Download className="h-3.5 w-3.5 mr-1" />CSV
              </Button>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rentalTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="created" stroke={stroke} strokeWidth={2} dot={false} name="Created" />
                  <Line type="monotone" dataKey="returned" stroke={stroke2} strokeWidth={2} dot={false} name="Returned" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Refund trends</CardTitle>
              <Button size="sm" variant="outline" onClick={() => csvDownload("refunds.csv", refundTrends)}>
                <Download className="h-3.5 w-3.5 mr-1" />CSV
              </Button>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={refundTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => inr(Number(v))} width={70} />
                  <Tooltip formatter={(v: any, n: any) => (n === "amount" ? inr(Number(v)) : v)} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="count" stroke={stroke} strokeWidth={2} dot={false} name="Refunds" />
                  <Line yAxisId="right" type="monotone" dataKey="amount" stroke={stroke2} strokeWidth={2} dot={false} name="Amount" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-2xl lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Commission earnings</CardTitle>
              <Button size="sm" variant="outline" onClick={() => csvDownload("commission.csv", commissionSeries)}>
                <Download className="h-3.5 w-3.5 mr-1" />CSV
              </Button>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={commissionSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(v) => inr(Number(v))} width={70} />
                  <Tooltip formatter={(v: any) => inr(Number(v))} />
                  <Area type="monotone" dataKey="commission" stroke={stroke} fill={stroke} fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Top-selling products</CardTitle>
              <Button size="sm" variant="outline"
                onClick={() => csvDownload("top-products.csv", topProducts.map((p) => ({
                  product: p.title, orders: p.orders, revenue: p.revenue,
                })))}>
                <Download className="h-3.5 w-3.5 mr-1" />CSV
              </Button>
            </CardHeader>
            <CardContent>
              <RankTable rows={topProducts.map((p) => ({ name: p.title, orders: p.orders, revenue: p.revenue }))} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Top-performing sellers</CardTitle>
              <Button size="sm" variant="outline"
                onClick={() => csvDownload("top-sellers.csv", topSellers.map((s) => ({
                  seller: s.name, orders: s.orders, revenue: s.revenue,
                })))}>
                <Download className="h-3.5 w-3.5 mr-1" />CSV
              </Button>
            </CardHeader>
            <CardContent>
              <RankTable rows={topSellers.map((s) => ({ name: s.name, orders: s.orders, revenue: s.revenue }))} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function RankTable({ rows }: { rows: { name: string; orders: number; revenue: number }[] }) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No data for this range.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b">
            <th className="text-left py-2 font-medium">#</th>
            <th className="text-left py-2 font-medium">Name</th>
            <th className="text-right py-2 font-medium">Orders</th>
            <th className="text-right py-2 font-medium">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name + i} className="border-b border-border/50">
              <td className="py-2 text-muted-foreground">{i + 1}</td>
              <td className="py-2 truncate max-w-[260px]">{r.name}</td>
              <td className="py-2 text-right tabular-nums">{r.orders}</td>
              <td className="py-2 text-right tabular-nums">{inr(r.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
