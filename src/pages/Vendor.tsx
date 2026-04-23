import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Store = { id: string; name: string; city: string | null; approved: boolean };
type Product = { id: string; title: string; category: "dress" | "jewellery"; price_per_day: number; security_deposit: number; available: boolean; images: string[] };
type Rental = { id: string; start_date: string; end_date: string; days: number; grand_total: number; status: string; product: { title: string } | null; customer: { full_name: string | null } | null };

const Vendor = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);

  useEffect(() => { document.title = "Vendor · Bloom"; }, []);
  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/vendor");
  }, [user, loading, navigate]);

  async function refresh() {
    if (!user) return;
    const { data: s } = await supabase.from("stores").select("id,name,city,approved").eq("owner_id", user.id);
    setStores(s ?? []);
    const sid = s?.[0]?.id ?? null;
    setStoreId(sid);
    if (sid) {
      const { data: p } = await supabase.from("products").select("id,title,category,price_per_day,security_deposit,available,images").eq("store_id", sid).order("created_at", { ascending: false });
      setProducts((p as any) ?? []);
      const { data: r } = await supabase.from("rentals").select("id,start_date,end_date,days,grand_total,status,product:products(title),customer:profiles!rentals_customer_id_fkey(full_name)").eq("store_id", sid).order("created_at", { ascending: false });
      setRentals((r as any) ?? []);
    }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user]);

  if (!user) return null;
  if (!loading && stores.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <section className="container py-20 text-center">
          <h1 className="font-display text-4xl">No store yet</h1>
          <p className="text-muted-foreground mt-2">Open your boutique to start listing pieces.</p>
          <Link to="/become-vendor"><Button variant="hero" className="mt-6">Open a store</Button></Link>
        </section>
        <Footer />
      </div>
    );
  }

  const store = stores.find((s) => s.id === storeId);
  const earnings = rentals.filter((r) => r.status !== "cancelled").reduce((sum, r) => sum + Number(r.grand_total), 0);

  async function updateRental(id: string, status: string) {
    const { error } = await supabase.from("rentals").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    refresh();
  }

  const isApproved = !!store?.approved;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-12">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Vendor</p>
            <h1 className="font-display text-5xl">{store?.name}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {isApproved ? "Approved · live" : "Awaiting approval"}{store?.city ? ` · ${store.city}` : ""}
            </p>
          </div>
          <div className="flex gap-3">
            <Stat label="Products" value={products.length.toString()} />
            <Stat label="Bookings" value={rentals.length.toString()} />
            <Stat label="Earnings" value={`₹${earnings.toLocaleString("en-IN")}`} />
          </div>
        </div>

        {!isApproved && (
          <div className="rounded-3xl bg-gradient-blossom p-6 md:p-8 mb-8 shadow-card">
            <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-1">Pending review</p>
            <h2 className="font-display text-2xl md:text-3xl mb-2">We're reviewing your store</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              You can explore the dashboard, but adding products and accepting rentals will unlock the moment an admin
              approves your boutique. We typically review within 24 hours.
            </p>
          </div>
        )}

        <Tabs defaultValue="products">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-6">
            <div className="flex justify-end mb-4">
              {storeId && isApproved && <ProductDialog storeId={storeId} onCreated={refresh} />}
            </div>
            {!isApproved ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
                Product listings unlock once your store is approved.
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
                No products yet. Add your first piece.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {products.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                    <div className="aspect-[4/5] rounded-xl overflow-hidden bg-petal mb-3">
                      {p.images?.[0] && <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover" />}
                    </div>
                    <h3 className="font-display text-xl">{p.title}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{p.category}</p>
                    <p className="text-sm mt-2">₹{Number(p.price_per_day).toLocaleString("en-IN")} / day · ₹{Number(p.security_deposit).toLocaleString("en-IN")} deposit</p>
                    <div className="flex justify-between items-center mt-3">
                      <Badge variant="secondary">{p.available ? "Available" : "Unavailable"}</Badge>
                      <Button variant="ghost" size="icon" onClick={async () => {
                        await supabase.from("products").delete().eq("id", p.id);
                        toast.success("Deleted");
                        refresh();
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bookings" className="mt-6">
            {rentals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
                No bookings yet.
              </div>
            ) : (
              <div className="space-y-3">
                {rentals.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{r.product?.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.customer?.full_name ?? "Customer"} · {format(new Date(r.start_date), "PP")} → {format(new Date(r.end_date), "PP")} · {r.days}d
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">₹{Number(r.grand_total).toLocaleString("en-IN")}</span>
                      <Select value={r.status} onValueChange={(v) => updateRental(r.id, v)}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["pending","confirmed","delivered","returned","cancelled"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>
      <Footer />
    </div>
  );
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary px-5 py-3 text-center">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-2xl">{value}</p>
    </div>
  );
}

function ProductDialog({ storeId, onCreated }: { storeId: string; onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"dress" | "jewellery">("dress");
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    let imageUrl: string | null = null;
    if (file) {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, file);
      if (upErr) { setBusy(false); return toast.error(upErr.message); }
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      imageUrl = data.publicUrl;
    }
    const { error } = await supabase.from("products").insert({
      store_id: storeId, title, description, category,
      price_per_day: Number(price), security_deposit: Number(deposit),
      size, color, images: imageUrl ? [imageUrl] : [], available: true,
    } as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Product added");
    setOpen(false);
    setTitle(""); setDescription(""); setPrice(""); setDeposit(""); setSize(""); setColor(""); setFile(null);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="hero"><Plus className="h-4 w-4 mr-2" /> Add product</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-display text-2xl">New product</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dress">Dress</SelectItem>
                  <SelectItem value="jewellery">Jewellery</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Size</Label><Input value={size} onChange={(e) => setSize(e.target.value)} className="mt-1" placeholder="S / M / L" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Price / day (₹)</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required className="mt-1" /></div>
            <div><Label>Deposit (₹)</Label><Input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} required className="mt-1" /></div>
          </div>
          <div><Label>Color</Label><Input value={color} onChange={(e) => setColor(e.target.value)} className="mt-1" /></div>
          <div>
            <Label>Image</Label>
            <label className="mt-1 flex items-center gap-2 rounded-xl border border-dashed border-border bg-background p-4 cursor-pointer hover:border-primary transition-smooth">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{file ? file.name : "Choose an image"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <Button type="submit" variant="hero" className="w-full" disabled={busy}>{busy ? "Adding…" : "Add product"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default Vendor;
