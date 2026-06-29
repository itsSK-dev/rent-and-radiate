import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { Download, Save, Trash2 } from "lucide-react";

type Category = "dress" | "jewellery";
const CATEGORIES: Category[] = ["dress", "jewellery"];

type Settlement = {
  id: string;
  rental_id: string;
  store_id: string;
  kind: string;
  sale_price: number;
  platform_fee_percent: number;
  platform_fee: number;
  net_payout: number;
  status: string;
  created_at: string;
  store?: { name: string | null } | null;
  rental?: { product: { title: string | null; category: string | null } | null } | null;
};

type PayoutSummary = {
  store_id: string;
  store_name: string;
  total_sales: number;
  total_fee: number;
  total_net: number;
  pending: number;
  eligible: number;
  paid: number;
  count: number;
};

export function AdminCommissionsPanel() {
  const [globalPct, setGlobalPct] = useState<number>(10);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [catRates, setCatRates] = useState<Record<string, number | "">>({});
  const [savingCat, setSavingCat] = useState<string | null>(null);
  const [history, setHistory] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [ps, cc, h] = await Promise.all([
      supabase.from("platform_settings").select("commission_percent").eq("id", true).maybeSingle(),
      (supabase as any).from("category_commissions").select("category, commission_percent"),
      supabase
        .from("vendor_settlements")
        .select(`id,rental_id,store_id,kind,sale_price,platform_fee_percent,platform_fee,net_payout,status,created_at,
          store:stores(name),
          rental:rentals(product:products(title,category))`)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (ps.data) setGlobalPct(Number(ps.data.commission_percent ?? 10));
    const map: Record<string, number | ""> = {};
    CATEGORIES.forEach((c) => (map[c] = ""));
    (cc.data as any[] | null)?.forEach((r) => (map[r.category] = Number(r.commission_percent)));
    setCatRates(map);
    setHistory((h.data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveGlobal() {
    setSavingGlobal(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({ commission_percent: globalPct })
      .eq("id", true);
    setSavingGlobal(false);
    if (error) return toast.error(error.message);
    toast.success("Default commission updated. New orders will use it.");
  }

  async function saveCategory(cat: string) {
    const v = catRates[cat];
    setSavingCat(cat);
    if (v === "" || v === null) {
      const { error } = await (supabase as any).from("category_commissions").delete().eq("category", cat);
      setSavingCat(null);
      if (error) return toast.error(error.message);
      toast.success(`${cat}: now uses default (${globalPct}%)`);
      return;
    }
    const { error } = await (supabase as any)
      .from("category_commissions")
      .upsert({ category: cat, commission_percent: Number(v) }, { onConflict: "category" });
    setSavingCat(null);
    if (error) return toast.error(error.message);
    toast.success(`${cat}: ${v}% saved`);
  }

  const payoutSummary = useMemo<PayoutSummary[]>(() => {
    const m = new Map<string, PayoutSummary>();
    for (const s of history) {
      const k = s.store_id;
      const row = m.get(k) ?? {
        store_id: k,
        store_name: s.store?.name ?? "—",
        total_sales: 0, total_fee: 0, total_net: 0,
        pending: 0, eligible: 0, paid: 0, count: 0,
      };
      row.total_sales += Number(s.sale_price || 0);
      row.total_fee += Number(s.platform_fee || 0);
      row.total_net += Number(s.net_payout || 0);
      row.count += 1;
      if (s.status === "pending") row.pending += Number(s.net_payout || 0);
      else if (s.status === "eligible") row.eligible += Number(s.net_payout || 0);
      else if (s.status === "paid") row.paid += Number(s.net_payout || 0);
      m.set(k, row);
    }
    return [...m.values()].sort((a, b) => b.total_fee - a.total_fee);
  }, [history]);

  const totals = useMemo(() => history.reduce(
    (a, s) => ({
      sales: a.sales + Number(s.sale_price || 0),
      fee: a.fee + Number(s.platform_fee || 0),
      net: a.net + Number(s.net_payout || 0),
    }), { sales: 0, fee: 0, net: 0 }
  ), [history]);

  function exportCSV(rows: any[], headers: string[], keys: string[], name: string) {
    const csv = [headers.join(",")].concat(
      rows.map((r) => keys.map((k) => {
        const v = r[k] ?? "";
        return typeof v === "string" && /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v);
      }).join(","))
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Default platform commission</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Label>Commission %</Label>
            <Input type="number" min={0} max={100} step={0.5}
              value={globalPct} onChange={(e) => setGlobalPct(Number(e.target.value))} />
          </div>
          <Button onClick={saveGlobal} disabled={savingGlobal}>
            <Save className="h-4 w-4 mr-1" />{savingGlobal ? "Saving…" : "Save default"}
          </Button>
          <p className="text-xs text-muted-foreground basis-full">
            Applies to all new orders unless a category override exists. Existing orders & settlements are not changed.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Per-category commission overrides</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {CATEGORIES.map((c) => (
            <div key={c} className="flex flex-wrap items-end gap-3 border-b border-border pb-3">
              <div className="w-32"><Label className="capitalize">{c}</Label></div>
              <div className="w-32">
                <Input
                  type="number" min={0} max={100} step={0.5}
                  placeholder={`Default (${globalPct}%)`}
                  value={catRates[c] === "" ? "" : catRates[c]}
                  onChange={(e) => setCatRates({ ...catRates, [c]: e.target.value === "" ? "" : Number(e.target.value) })}
                />
              </div>
              <Button size="sm" variant="outline" onClick={() => saveCategory(c)} disabled={savingCat === c}>
                <Save className="h-4 w-4 mr-1" />Save
              </Button>
              {catRates[c] !== "" && (
                <Button size="sm" variant="ghost" onClick={() => { setCatRates({ ...catRates, [c]: "" }); saveCategory(c); }}>
                  <Trash2 className="h-4 w-4 mr-1" />Clear override
                </Button>
              )}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Overrides apply to new orders only.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Commission earned · totals</span>
            <Button size="sm" variant="outline" onClick={() => exportCSV(
              history.map((h) => ({
                date: format(new Date(h.created_at), "yyyy-MM-dd HH:mm"),
                store: h.store?.name ?? "", product: h.rental?.product?.title ?? "",
                category: h.rental?.product?.category ?? "", kind: h.kind,
                sale_price: h.sale_price, fee_percent: h.platform_fee_percent,
                platform_fee: h.platform_fee, net_payout: h.net_payout, status: h.status,
              })),
              ["Date","Store","Product","Category","Kind","Sale","Fee %","Platform fee","Net payout","Status"],
              ["date","store","product","category","kind","sale_price","fee_percent","platform_fee","net_payout","status"],
              "commission-history.csv",
            )}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Stat label="Sales" value={`₹${totals.sales.toLocaleString("en-IN")}`} />
            <Stat label="Commission" value={`₹${totals.fee.toLocaleString("en-IN")}`} />
            <Stat label="Net payouts" value={`₹${totals.net.toLocaleString("en-IN")}`} />
            <Stat label="Settlements" value={history.length.toString()} />
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Store</TableHead>
                  <TableHead>Product</TableHead><TableHead>Cat.</TableHead>
                  <TableHead className="text-right">Sale</TableHead>
                  <TableHead className="text-right">Fee %</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
                ) : history.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No settlements yet.</TableCell></TableRow>
                ) : history.slice(0, 200).map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(h.created_at), "dd MMM, HH:mm")}</TableCell>
                    <TableCell>{h.store?.name ?? "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{h.rental?.product?.title ?? "—"}</TableCell>
                    <TableCell className="capitalize">{h.rental?.product?.category ?? "—"}</TableCell>
                    <TableCell className="text-right">₹{Number(h.sale_price).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right">{Number(h.platform_fee_percent)}%</TableCell>
                    <TableCell className="text-right">₹{Number(h.platform_fee).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right">₹{Number(h.net_payout).toLocaleString("en-IN")}</TableCell>
                    <TableCell><Badge variant="outline">{h.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {history.length > 200 && (
              <p className="text-xs text-muted-foreground mt-2">Showing first 200 — export CSV for full history.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Seller payout summary</span>
            <Button size="sm" variant="outline" onClick={() => exportCSV(
              payoutSummary, ["Store","Orders","Sales","Commission","Net","Pending","Eligible","Paid"],
              ["store_name","count","total_sales","total_fee","total_net","pending","eligible","paid"],
              "seller-payout-summary.csv",
            )}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Eligible</TableHead>
                <TableHead className="text-right">Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payoutSummary.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No payouts yet.</TableCell></TableRow>
              ) : payoutSummary.map((r) => (
                <TableRow key={r.store_id}>
                  <TableCell>{r.store_name}</TableCell>
                  <TableCell className="text-right">{r.count}</TableCell>
                  <TableCell className="text-right">₹{r.total_sales.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">₹{r.total_fee.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">₹{r.total_net.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">₹{r.pending.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">₹{r.eligible.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">₹{r.paid.toLocaleString("en-IN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-xl">{value}</p>
    </div>
  );
}
