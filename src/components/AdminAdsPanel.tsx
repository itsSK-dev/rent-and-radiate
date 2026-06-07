import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Trash2, Save, Plus } from "lucide-react";

type Req = {
  id: string;
  company_name: string;
  contact_person: string;
  email: string;
  mobile: string;
  website: string | null;
  ad_type: string;
  duration_days: number;
  budget: number;
  description: string | null;
  logo_url: string | null;
  creative_url: string | null;
  package_id: string | null;
  status: string;
  admin_notes: string | null;
  set_price: number | null;
  payment_status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

type Pkg = {
  id: string;
  name: string;
  tier: "basic" | "premium" | "featured";
  price: number;
  duration_days: number;
  perks: string[];
  is_active: boolean;
  sort_order: number;
};

type Stats = {
  users_count: number;
  monthly_views: number;
  engagement_pct: number;
  reach_count: number;
  partners_count: number;
};

type Ad = {
  id: string;
  headline: string;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export function AdminAdsPanel() {
  return (
    <Tabs defaultValue="requests">
      <TabsList>
        <TabsTrigger value="requests">Requests</TabsTrigger>
        <TabsTrigger value="packages">Packages</TabsTrigger>
        <TabsTrigger value="live">Live ads</TabsTrigger>
        <TabsTrigger value="stats">Stats</TabsTrigger>
      </TabsList>
      <TabsContent value="requests" className="mt-6"><RequestsTab /></TabsContent>
      <TabsContent value="packages" className="mt-6"><PackagesTab /></TabsContent>
      <TabsContent value="live" className="mt-6"><LiveAdsTab /></TabsContent>
      <TabsContent value="stats" className="mt-6"><StatsTab /></TabsContent>
    </Tabs>
  );
}

function RequestsTab() {
  const [rows, setRows] = useState<Req[]>([]);
  const [filter, setFilter] = useState<string>("pending");

  async function load() {
    const { data, error } = await (supabase as any)
      .from("advertisement_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setRows((data as Req[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function update(id: string, patch: Partial<Req>) {
    const { error } = await (supabase as any).from("advertisement_requests").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    try {
      await supabase.functions.invoke("notify-ad-request", {
        body: { request_id: id, event: "status_changed" },
      });
    } catch { /* non-blocking */ }
    load();
  }

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["pending", "changes_requested", "approved", "rejected", "active", "completed", "draft", "all"].map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">No requests.</div>
      ) : (
        filtered.map((r) => <RequestCard key={r.id} r={r} onSave={(p) => update(r.id, p)} />)
      )}
    </div>
  );
}

function RequestCard({ r, onSave }: { r: Req; onSave: (p: Partial<Req>) => void }) {
  const [notes, setNotes] = useState(r.admin_notes ?? "");
  const [price, setPrice] = useState<number | "">(r.set_price ?? "");
  const [start, setStart] = useState(r.start_date ?? "");
  const [end, setEnd] = useState(r.end_date ?? "");
  const [pay, setPay] = useState(r.payment_status);
  const [status, setStatus] = useState(r.status);

  return (
    <div className="rounded-3xl border bg-card p-6 shadow-card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-2xl">{r.company_name}</h3>
            <Badge>{r.status.replace(/_/g, " ")}</Badge>
            <Badge variant="outline">payment: {r.payment_status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {r.contact_person} · {r.email} · {r.mobile} · {r.ad_type.replace(/_/g, " ")} · {format(new Date(r.created_at), "PPp")}
          </p>
          {r.website && <a href={r.website} target="_blank" rel="noreferrer" className="text-xs text-primary underline">{r.website}</a>}
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["pending", "changes_requested", "approved", "rejected", "active", "completed"].map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {r.description && (
        <div className="rounded-xl bg-secondary p-3 text-sm whitespace-pre-wrap">{r.description}</div>
      )}

      <div className="grid md:grid-cols-4 gap-3">
        <Field label="Set price (₹)">
          <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))} />
        </Field>
        <Field label="Payment">
          <Select value={pay} onValueChange={setPay}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["unpaid", "paid", "refunded"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Start date">
          <Input type="date" value={start ?? ""} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="End date">
          <Input type="date" value={end ?? ""} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>

      <Field label="Admin notes (visible to advertiser)">
        <Textarea rows={2} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="flex justify-end">
        <Button variant="hero" size="sm" onClick={() => onSave({
          admin_notes: notes,
          set_price: price === "" ? null : Number(price),
          start_date: start || null,
          end_date: end || null,
          payment_status: pay as any,
          status: status as any,
        })}>
          <Save className="h-4 w-4 mr-2" /> Save
        </Button>
      </div>
    </div>
  );
}

function PackagesTab() {
  const [rows, setRows] = useState<Pkg[]>([]);
  async function load() {
    const { data } = await (supabase as any).from("ad_packages").select("*").order("sort_order");
    setRows((data as Pkg[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    const { error } = await (supabase as any).from("ad_packages").insert({
      name: "New package", tier: "basic", price: 0, duration_days: 7, perks: [], sort_order: rows.length + 1,
    });
    if (error) return toast.error(error.message);
    load();
  }
  async function save(id: string, p: Partial<Pkg>) {
    const { error } = await (supabase as any).from("ad_packages").update(p).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    load();
  }
  async function remove(id: string) {
    if (!confirm("Delete package?")) return;
    const { error } = await (supabase as any).from("ad_packages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="hero" size="sm" onClick={create}><Plus className="h-4 w-4 mr-2" /> Add package</Button>
      </div>
      {rows.map((p) => <PackageRow key={p.id} p={p} onSave={(patch) => save(p.id, patch)} onDelete={() => remove(p.id)} />)}
    </div>
  );
}

function PackageRow({ p, onSave, onDelete }: { p: Pkg; onSave: (p: Partial<Pkg>) => void; onDelete: () => void }) {
  const [name, setName] = useState(p.name);
  const [tier, setTier] = useState<Pkg["tier"]>(p.tier);
  const [price, setPrice] = useState(p.price);
  const [duration, setDuration] = useState(p.duration_days);
  const [perks, setPerks] = useState(p.perks.join("\n"));
  const [isActive, setIsActive] = useState(p.is_active);
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card grid md:grid-cols-6 gap-3">
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Tier">
        <Select value={tier} onValueChange={(v) => setTier(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["basic", "premium", "featured"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Price (₹)"><Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></Field>
      <Field label="Duration (days)"><Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></Field>
      <Field label="Active">
        <Select value={isActive ? "yes" : "no"} onValueChange={(v) => setIsActive(v === "yes")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="md:col-span-6">
        <Field label="Perks (one per line)">
          <Textarea rows={3} value={perks} onChange={(e) => setPerks(e.target.value)} />
        </Field>
      </div>
      <div className="md:col-span-6 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
        <Button variant="hero" size="sm" onClick={() => onSave({
          name, tier, price, duration_days: duration, is_active: isActive,
          perks: perks.split("\n").map((s) => s.trim()).filter(Boolean),
        })}><Save className="h-4 w-4 mr-2" /> Save</Button>
      </div>
    </div>
  );
}

function LiveAdsTab() {
  const [rows, setRows] = useState<Ad[]>([]);
  async function load() {
    const { data } = await (supabase as any).from("advertisements").select("*").order("sort_order");
    setRows((data as Ad[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    const { error } = await (supabase as any).from("advertisements").insert({
      headline: "New ad", image_url: "https://placehold.co/600x400", sort_order: rows.length + 1,
    });
    if (error) return toast.error(error.message);
    load();
  }
  async function save(id: string, p: Partial<Ad>) {
    const { error } = await (supabase as any).from("advertisements").update(p).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    load();
  }
  async function remove(id: string) {
    if (!confirm("Delete advertisement?")) return;
    const { error } = await (supabase as any).from("advertisements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="hero" size="sm" onClick={create}><Plus className="h-4 w-4 mr-2" /> Add ad</Button>
      </div>
      {rows.map((a) => <AdRow key={a.id} a={a} onSave={(p) => save(a.id, p)} onDelete={() => remove(a.id)} />)}
    </div>
  );
}

function AdRow({ a, onSave, onDelete }: { a: Ad; onSave: (p: Partial<Ad>) => void; onDelete: () => void }) {
  const [headline, setHeadline] = useState(a.headline);
  const [imageUrl, setImageUrl] = useState(a.image_url);
  const [linkUrl, setLinkUrl] = useState(a.link_url ?? "");
  const [order, setOrder] = useState(a.sort_order);
  const [active, setActive] = useState(a.is_active);
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card grid md:grid-cols-6 gap-3">
      <Field label="Headline"><Input value={headline} onChange={(e) => setHeadline(e.target.value)} /></Field>
      <Field label="Image URL"><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /></Field>
      <Field label="Link URL"><Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} /></Field>
      <Field label="Sort"><Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} /></Field>
      <Field label="Active">
        <Select value={active ? "yes" : "no"} onValueChange={(v) => setActive(v === "yes")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
        </Select>
      </Field>
      <div className="md:col-span-6 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
        <Button variant="hero" size="sm" onClick={() => onSave({
          headline, image_url: imageUrl, link_url: linkUrl || null, sort_order: order, is_active: active,
        })}><Save className="h-4 w-4 mr-2" /> Save</Button>
      </div>
    </div>
  );
}

function StatsTab() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("ad_platform_stats").select("*").eq("id", true).maybeSingle();
      setS((data as Stats) ?? null);
    })();
  }, []);
  if (!s) return <p className="text-muted-foreground">Loading…</p>;
  async function save() {
    const { error } = await (supabase as any).from("ad_platform_stats").update(s).eq("id", true);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  }
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-card grid md:grid-cols-2 gap-3 max-w-3xl">
      {([
        ["users_count", "Active users"],
        ["monthly_views", "Monthly views"],
        ["engagement_pct", "Engagement (%)"],
        ["reach_count", "Total reach"],
        ["partners_count", "Brand partners"],
      ] as const).map(([k, label]) => (
        <Field key={k} label={label}>
          <Input type="number" value={(s as any)[k]} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) } as Stats)} />
        </Field>
      ))}
      <div className="md:col-span-2 flex justify-end">
        <Button variant="hero" size="sm" onClick={save}><Save className="h-4 w-4 mr-2" /> Save stats</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
