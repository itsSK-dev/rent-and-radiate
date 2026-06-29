import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, AlertTriangle, Save } from "lucide-react";
import { toast } from "sonner";
import { inr } from "@/lib/pricing";

type Product = {
  id: string;
  title: string;
  category: string;
  images: string[];
  quantity: number;
  available: boolean;
  low_stock_threshold: number;
  actual_price: number;
  price_per_day: number;
  purpose: "rent" | "buy" | "both";
};

export function VendorInventoryPanel({ storeId }: { storeId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Record<string, Partial<Product>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("products")
      .select("id,title,category,images,quantity,available,low_stock_threshold,actual_price,price_per_day,purpose")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setProducts((data as Product[]) ?? []);
    setDirty({});
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [storeId]);

  const stats = useMemo(() => {
    const out = products.filter((p) => p.quantity <= 0).length;
    const low = products.filter((p) => p.quantity > 0 && p.quantity <= (p.low_stock_threshold ?? 2)).length;
    const totalUnits = products.reduce((s, p) => s + (p.quantity ?? 0), 0);
    return { total: products.length, out, low, totalUnits };
  }, [products]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter((p) => {
      if (filter === "low" && !(p.quantity > 0 && p.quantity <= (p.low_stock_threshold ?? 2))) return false;
      if (filter === "out" && p.quantity > 0) return false;
      if (term && !p.title.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [products, filter, q]);

  function edit(id: string, patch: Partial<Product>) {
    setDirty((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  async function saveRow(p: Product) {
    const patch = dirty[p.id];
    if (!patch) return;
    setSaving(p.id);
    const { error } = await (supabase as any).from("products").update(patch).eq("id", p.id);
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setDirty((d) => { const { [p.id]: _, ...rest } = d; return rest; });
    load();
  }

  async function restockAll(by: number) {
    if (!confirm(`Add ${by} units to every product?`)) return;
    setLoading(true);
    for (const p of products) {
      await (supabase as any).from("products").update({ quantity: (p.quantity ?? 0) + by }).eq("id", p.id);
    }
    toast.success(`Restocked +${by} on all products`);
    load();
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Products" value={stats.total.toString()} />
        <Stat label="Total units" value={stats.totalUnits.toString()} />
        <Stat label="Low stock" value={stats.low.toString()} tone={stats.low ? "warn" : undefined} />
        <Stat label="Out of stock" value={stats.out.toString()} tone={stats.out ? "danger" : undefined} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["all", "low", "out"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "low" ? `Low stock (${stats.low})` : `Out of stock (${stats.out})`}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Button size="sm" variant="outline" onClick={() => restockAll(5)}>
            <Plus className="h-4 w-4" /> Restock all +5
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No products match this filter.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-secondary/40 text-left">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Product</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Low at</th>
                <th className="p-3">Available</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Save</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const d = dirty[p.id] ?? {};
                const qty = (d.quantity ?? p.quantity) as number;
                const thr = (d.low_stock_threshold ?? p.low_stock_threshold ?? 2) as number;
                const avail = (d.available ?? p.available) as boolean;
                const isLow = qty > 0 && qty <= thr;
                const isOut = qty <= 0;
                const isDirty = !!dirty[p.id];
                return (
                  <tr key={p.id} className={`border-t border-border ${isOut ? "bg-rose-50/40" : isLow ? "bg-amber-50/40" : ""}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-lg bg-petal overflow-hidden shrink-0">
                          {p.images?.[0] && <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{p.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {p.category} · {p.purpose} · {inr(p.actual_price || p.price_per_day)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <Input
                        type="number" min={0} className="w-20"
                        value={qty}
                        onChange={(e) => edit(p.id, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </td>
                    <td className="p-3">
                      <Input
                        type="number" min={0} className="w-20"
                        value={thr}
                        onChange={(e) => edit(p.id, { low_stock_threshold: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </td>
                    <td className="p-3">
                      <Switch checked={avail} onCheckedChange={(v) => edit(p.id, { available: v })} />
                    </td>
                    <td className="p-3">
                      {isOut ? (
                        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Out
                        </Badge>
                      ) : isLow ? (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Low
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">OK</Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm" variant={isDirty ? "default" : "ghost"}
                        disabled={!isDirty || saving === p.id}
                        onClick={() => saveRow(p)}
                      >
                        {saving === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      </Button>
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" }) {
  const bg = tone === "danger" ? "bg-rose-50 text-rose-700"
           : tone === "warn" ? "bg-amber-50 text-amber-700"
           : "bg-secondary";
  return (
    <div className={`rounded-2xl px-4 py-3 ${bg}`}>
      <p className="text-[11px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="font-display text-2xl">{value}</p>
    </div>
  );
}
