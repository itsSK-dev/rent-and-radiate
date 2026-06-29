import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { Pencil, Plus, Trash2, Users } from "lucide-react";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_days: number;
  features: string[];
  max_products: number | null;
  is_active: boolean;
  sort_order: number;
};

type Subscription = {
  id: string;
  store_id: string;
  plan_id: string;
  status: string;
  start_at: string;
  end_at: string;
  price_paid: number;
  notes: string | null;
  store: { name: string | null; owner_id: string } | null;
  plan: { name: string | null } | null;
};

const empty: Partial<Plan> = {
  name: "", description: "", price: 0, duration_days: 30,
  features: [], max_products: null, is_active: true, sort_order: 0,
};

export function AdminSubscriptionsPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Plan> | null>(null);
  const [assigning, setAssigning] = useState<{ plan: Plan } | null>(null);
  const [assignStore, setAssignStore] = useState<string>("");
  const [assignNotes, setAssignNotes] = useState("");

  async function load() {
    setLoading(true);
    const [p, s, st] = await Promise.all([
      (supabase as any).from("subscription_plans").select("*").order("sort_order").order("price"),
      (supabase as any).from("shop_subscriptions")
        .select("*, store:stores(name, owner_id), plan:subscription_plans(name)")
        .order("created_at", { ascending: false }),
      supabase.from("stores").select("id, name").order("name"),
    ]);
    setPlans(((p.data as any[]) ?? []).map((x) => ({ ...x, features: Array.isArray(x.features) ? x.features : [] })));
    setSubs((s.data as any) ?? []);
    setStores((st.data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function savePlan() {
    if (!editing) return;
    const payload: any = {
      name: editing.name?.trim(),
      description: editing.description?.trim() || null,
      price: Number(editing.price ?? 0),
      duration_days: Number(editing.duration_days ?? 30),
      features: editing.features ?? [],
      max_products: editing.max_products == null || (editing.max_products as any) === "" ? null : Number(editing.max_products),
      is_active: !!editing.is_active,
      sort_order: Number(editing.sort_order ?? 0),
    };
    if (!payload.name) return toast.error("Name required");
    if (payload.duration_days < 1) return toast.error("Duration must be ≥ 1 day");
    const q = editing.id
      ? (supabase as any).from("subscription_plans").update(payload).eq("id", editing.id)
      : (supabase as any).from("subscription_plans").insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Plan updated" : "Plan created");
    setEditing(null);
    load();
  }

  async function deletePlan(id: string) {
    if (!confirm("Delete this plan? Existing subscribers stay assigned.")) return;
    const { error } = await (supabase as any).from("subscription_plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Plan deleted");
    load();
  }

  async function togglePlan(p: Plan) {
    const { error } = await (supabase as any).from("subscription_plans")
      .update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function assignSubscription() {
    if (!assigning || !assignStore) return;
    const start = new Date();
    const end = addDays(start, assigning.plan.duration_days);
    const { error } = await (supabase as any).from("shop_subscriptions").insert({
      store_id: assignStore,
      plan_id: assigning.plan.id,
      status: "active",
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      price_paid: assigning.plan.price,
      notes: assignNotes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Subscription assigned");
    setAssigning(null); setAssignStore(""); setAssignNotes("");
    load();
  }

  async function cancelSubscription(id: string) {
    if (!confirm("Cancel this subscription?")) return;
    const { error } = await (supabase as any).from("shop_subscriptions")
      .update({ status: "cancelled", end_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cancelled"); load();
  }

  const activeSubs = subs.filter((s) => s.status === "active" && new Date(s.end_at) > new Date());

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Subscription plans</span>
            <Button size="sm" onClick={() => setEditing({ ...empty })}>
              <Plus className="h-4 w-4 mr-1" />New plan
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground">Loading…</p> : plans.length === 0 ? (
            <p className="text-muted-foreground">No plans yet. Create your first one.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((p) => (
                <div key={p.id} className="rounded-xl border border-border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-display text-lg flex items-center gap-2">
                        {p.name}
                        {!p.is_active && <Badge variant="outline">inactive</Badge>}
                      </h4>
                      <p className="text-xs text-muted-foreground">{p.duration_days} days · ₹{Number(p.price).toLocaleString("en-IN")}</p>
                    </div>
                    <Switch checked={p.is_active} onCheckedChange={() => togglePlan(p)} />
                  </div>
                  {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                  {p.max_products != null && (
                    <p className="text-xs"><Badge variant="secondary">Max {p.max_products} products</Badge></p>
                  )}
                  {p.features.length > 0 && (
                    <ul className="text-sm list-disc list-inside text-muted-foreground">
                      {p.features.slice(0, 5).map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing({ ...p, features: [...p.features] })}>
                      <Pencil className="h-3 w-3 mr-1" />Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAssigning({ plan: p })}>
                      <Users className="h-3 w-3 mr-1" />Assign
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deletePlan(p.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active subscribers ({activeSubs.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead><TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead><TableHead>Ends</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No subscriptions yet.</TableCell></TableRow>
              ) : subs.map((s) => {
                const expired = new Date(s.end_at) <= new Date() && s.status === "active";
                return (
                  <TableRow key={s.id}>
                    <TableCell>{s.store?.name ?? "—"}</TableCell>
                    <TableCell>{s.plan?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" && !expired ? "default" : "outline"}>
                        {expired ? "expired" : s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(s.start_at), "dd MMM yyyy")}</TableCell>
                    <TableCell>{format(new Date(s.end_at), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-right">₹{Number(s.price_paid).toLocaleString("en-IN")}</TableCell>
                    <TableCell>
                      {s.status === "active" && (
                        <Button size="sm" variant="ghost" onClick={() => cancelSubscription(s.id)}>Cancel</Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit / new plan dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit plan" : "New plan"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Price (₹)</Label><Input type="number" min={0} value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
                <div><Label>Duration (days)</Label><Input type="number" min={1} value={editing.duration_days ?? 30} onChange={(e) => setEditing({ ...editing, duration_days: Number(e.target.value) })} /></div>
                <div><Label>Max products</Label><Input type="number" min={0} placeholder="Unlimited" value={editing.max_products ?? ""} onChange={(e) => setEditing({ ...editing, max_products: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              </div>
              <div>
                <Label>Features (one per line)</Label>
                <Textarea rows={4} value={(editing.features ?? []).join("\n")}
                  onChange={(e) => setEditing({ ...editing, features: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2"><Switch checked={!!editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Active</Label></div>
                <div className="ml-auto w-24"><Label>Sort</Label><Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={savePlan}>{editing?.id ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={!!assigning} onOpenChange={(o) => !o && setAssigning(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign “{assigning?.plan.name}” to a shop</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Shop</Label>
              <Select value={assignStore} onValueChange={setAssignStore}>
                <SelectTrigger><SelectValue placeholder="Pick a shop" /></SelectTrigger>
                <SelectContent>
                  {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name ?? s.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes (optional)</Label><Textarea rows={2} value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} /></div>
            {assigning && (
              <p className="text-xs text-muted-foreground">
                Will run for {assigning.plan.duration_days} days · ₹{Number(assigning.plan.price).toLocaleString("en-IN")} recorded as paid.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssigning(null)}>Cancel</Button>
            <Button onClick={assignSubscription} disabled={!assignStore}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
