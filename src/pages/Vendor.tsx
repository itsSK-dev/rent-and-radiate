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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { Plus, Trash2, Upload, ChevronDown, ChevronUp, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { RentalProofPanel, OpenDisputeButton } from "@/components/RentalProofPanel";
import { RentalStatusTimeline } from "@/components/RentalStatusTimeline";
import { InspectionDialog } from "@/components/InspectionDialog";
import { RentalDisputesList } from "@/components/RentalDisputesList";
import { DeliveryStageControl, StoreExtensionRequests, StoreReturnControls, type ReturnRow } from "@/components/DeliveryTracking";
import { discountedUnitPrice, inr } from "@/lib/pricing";

type Store = {
  id: string;
  name: string;
  city: string | null;
  status: "pending" | "approved" | "rejected" | "deleted";
  is_verified: boolean;
  is_active: boolean;
  is_blocked: boolean;
};
type Product = {
  id: string; title: string; description: string | null; category: "dress" | "jewellery";
  price_per_day: number; security_deposit: number; available: boolean; images: string[];
  size: string | null; color: string | null;
  actual_price: number; discount_percent: number; discount_flat: number;
  quantity: number; purpose: "rent" | "buy" | "both";
};
type Rental = {
  id: string; start_date: string | null; end_date: string | null; days: number | null;
  grand_total: number; deposit: number; subtotal: number; commission_amount: number;
  status: string; store_id: string; customer_id: string; kind: "rent" | "buy"; quantity: number;
  delivery_stage: string | null;
  product: { title: string } | null; customer: { full_name: string | null } | null;
};
type RefundRow = { id: string; rental_id: string; status: string; refund_amount: number; refund_percent: number; condition_tier: string };

const Vendor = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { settings } = usePlatformSettings();
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);

  useEffect(() => { document.title = "Vendor · Rent & Radiate"; }, []);
  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/vendor");
  }, [user, loading, navigate]);

  async function refresh() {
    if (!user) return;
    const { data: s } = await supabase
      .from("stores")
      .select("id,name,city,status,is_verified,is_active,is_blocked")
      .eq("owner_id", user.id);
    setStores(s ?? []);
    const sid = s?.[0]?.id ?? null;
    setStoreId(sid);
    if (sid) {
      const { data: p } = await supabase
        .from("products")
        .select("id,title,description,category,price_per_day,security_deposit,available,images,size,color,actual_price,discount_percent,discount_flat,quantity,purpose")
        .eq("store_id", sid).order("created_at", { ascending: false });
      setProducts((p as any) ?? []);
      const { data: r } = await supabase.from("rentals")
        .select("id,start_date,end_date,days,grand_total,deposit,subtotal,commission_amount,status,store_id,customer_id,kind,quantity,delivery_stage,product:products(title),customer:profiles!rentals_customer_id_fkey(full_name)")
        .eq("store_id", sid).order("created_at", { ascending: false });
      setRentals((r as any) ?? []);
      const { data: rf } = await (supabase.from as any)("deposit_refunds").select("id,rental_id,status,refund_amount,refund_percent,condition_tier").eq("store_id", sid);
      setRefunds((rf as any) ?? []);
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
  const earnings = rentals
    .filter((r) => r.status !== "cancelled")
    .reduce((sum, r) => sum + (Number(r.subtotal) - Number(r.commission_amount || 0)), 0);

  async function updateRental(id: string, status: string) {
    const { error } = await supabase.from("rentals").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    refresh();
  }

  async function deleteProduct(id: string) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    refresh();
  }

  const isApproved = !!store && store.status === "approved" && store.is_verified && store.is_active && !store.is_blocked;

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
          <div className="flex gap-3 items-center flex-wrap">
            <Button variant="soft" size="sm" onClick={() => navigate("/vendor/orders")}>
              Manage orders →
            </Button>
            <Stat label="Products" value={products.length.toString()} />
            <Stat label="Bookings" value={rentals.length.toString()} />
            <Stat label="Earnings (net)" value={inr(earnings)} />
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
            <TabsTrigger value="bookings">Orders</TabsTrigger>
            <TabsTrigger value="returns">Returns & extensions</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-6">
            <div className="flex justify-end mb-4">
              {storeId && isApproved && <ProductDialog storeId={storeId} onSaved={refresh} />}
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
                {products.map((p) => {
                  const finalPrice = discountedUnitPrice(p.actual_price, p.discount_percent, p.discount_flat);
                  const hasDiscount = finalPrice < Number(p.actual_price);
                  return (
                    <div key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                      <div className="aspect-[4/5] rounded-xl overflow-hidden bg-petal mb-3 relative">
                        {p.images?.[0] && <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover" />}
                        {hasDiscount && (
                          <Badge className="absolute top-2 left-2 bg-rose-deep text-white">
                            {p.discount_percent > 0 ? `${p.discount_percent}% OFF` : `₹${p.discount_flat} OFF`}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-display text-xl">{p.title}</h3>
                      <p className="text-xs text-muted-foreground capitalize">{p.category} · {p.purpose}</p>
                      <div className="mt-2 text-sm space-y-0.5">
                        {(p.purpose === "buy" || p.purpose === "both") && (
                          <p>
                            {hasDiscount && <span className="line-through text-muted-foreground mr-1">{inr(p.actual_price)}</span>}
                            <span className="font-semibold">{inr(finalPrice)}</span>
                            <span className="text-muted-foreground"> buy</span>
                          </p>
                        )}
                        {(p.purpose === "rent" || p.purpose === "both") && (
                          <p>{inr(p.price_per_day)} <span className="text-muted-foreground">/ day · deposit {inr(p.security_deposit)}</span></p>
                        )}
                        <p className="text-xs text-muted-foreground">Stock: {p.quantity}</p>
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <Badge variant={p.available && p.quantity > 0 ? "secondary" : "outline"}>
                          {p.available && p.quantity > 0 ? "Available" : "Unavailable"}
                        </Badge>
                        <div className="flex gap-1">
                          <ProductDialog storeId={storeId!} editing={p} onSaved={refresh} />
                          <Button variant="ghost" size="icon" onClick={() => deleteProduct(p.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bookings" className="mt-6">
            {rentals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
                No orders yet.
              </div>
            ) : (
              <div className="space-y-3">
                {rentals.map((r) => (
                  <RentalRow
                    key={r.id} r={r}
                    refund={refunds.find((x) => x.rental_id === r.id)}
                    onUpdate={(status) => updateRental(r.id, status)}
                    onRefresh={refresh}
                    commissionPct={settings.commission_percent}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="returns" className="mt-6 space-y-6">
            {storeId ? (
              <>
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="font-display text-xl mb-3">Active return requests</h3>
                  <StoreReturnsList storeId={storeId} />
                </div>
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="font-display text-xl mb-3">Extension requests</h3>
                  <StoreExtensionRequests storeId={storeId} />
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground">Select or create a store first.</p>}
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

function RentalRow({ r, refund, onUpdate, onRefresh, commissionPct }: {
  r: Rental; refund?: RefundRow; onUpdate: (status: string) => void; onRefresh: () => void; commissionPct: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const blockedDelivered = r.status !== "delivered" && r.status !== "returned";
  const earnings = Number(r.subtotal) - Number(r.commission_amount || 0);
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">
            {r.product?.title}
            <Badge variant="outline" className="ml-2 capitalize">{r.kind}</Badge>
            {r.quantity > 1 && <span className="text-xs text-muted-foreground ml-2">×{r.quantity}</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {r.customer?.full_name ?? "Customer"}
            {r.start_date && ` · ${format(new Date(r.start_date), "PP")} → ${format(new Date(r.end_date!), "PP")} · ${r.days}d`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Net earnings: <strong>{inr(earnings)}</strong> (after {commissionPct}% commission)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{inr(r.grand_total)}</span>
          <Select value={r.status} onValueChange={onUpdate}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["pending","confirmed","delivered","returned","cancelled"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setExpanded((x) => !x)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="ml-1">Proof</span>
          </Button>
        </div>
      </div>
      {r.kind === "rent" && blockedDelivered && (
        <p className="text-xs text-muted-foreground">
          Upload at least one <strong>before-delivery</strong> photo before marking as delivered.
        </p>
      )}
      {r.kind === "rent" && r.status === "returned" && (
        <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-3 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-sm">Customer refund (admin-processed)</p>
            {refund && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full border capitalize ${
                refund.status === "completed" ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                : refund.status === "failed" || refund.status === "rejected" ? "bg-rose-100 text-rose-800 border-rose-200"
                : "bg-amber-100 text-amber-800 border-amber-200"
              }`}>
                {refund.status.replace(/_/g, " ")}
              </span>
            )}
          </div>
          {refund ? (
            <p className="text-xs text-muted-foreground">
              Refund {inr(refund.refund_amount)} of {inr(r.deposit)} deposit
              {" · "}condition: {refund.condition_tier} ({refund.refund_percent}%)
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Awaiting refund record (deposit {inr(r.deposit)}). Only the platform admin can approve and process customer refunds.
            </p>
          )}
        </div>
      )}

      {r.kind === "rent" && r.status !== "returned" && r.status !== "cancelled" && (
        <div className="rounded-xl border border-border bg-secondary/30 p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Delivery</p>
          <DeliveryStageControl rentalId={r.id} currentStage={r.delivery_stage} onChanged={onRefresh} />
        </div>
      )}
      <RentalStatusTimeline rentalId={r.id} currentStatus={r.status} />
      {expanded && (
        <div className="pt-2 border-t border-border space-y-3">
          <RentalProofPanel rentalId={r.id} role="store" stages={["before_delivery", "at_delivery"]} />
          <RentalDisputesList rentalId={r.id} />
          <div className="flex justify-end">
            <OpenDisputeButton rentalId={r.id} />
          </div>
        </div>
      )}
    </div>
  );
}

function ProductDialog({ storeId, editing, onSaved }: { storeId: string; editing?: Product; onSaved: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [category, setCategory] = useState<"dress" | "jewellery">(editing?.category ?? "dress");
  const [purpose, setPurpose] = useState<"rent" | "buy" | "both">(editing?.purpose ?? "rent");
  const [actualPrice, setActualPrice] = useState(editing?.actual_price?.toString() ?? "");
  const [pricePerDay, setPricePerDay] = useState(editing?.price_per_day?.toString() ?? "");
  const [discountPercent, setDiscountPercent] = useState(editing?.discount_percent?.toString() ?? "0");
  const [discountFlat, setDiscountFlat] = useState(editing?.discount_flat?.toString() ?? "0");
  const [deposit, setDeposit] = useState(editing?.security_deposit?.toString() ?? "");
  const [quantity, setQuantity] = useState(editing?.quantity?.toString() ?? "1");
  const [size, setSize] = useState(editing?.size ?? "");
  const [color, setColor] = useState(editing?.color ?? "");
  const [available, setAvailable] = useState(editing?.available ?? true);
  const [files, setFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>(editing?.images ?? []);
  const [busy, setBusy] = useState(false);

  const isEdit = !!editing;
  const finalUnit = discountedUnitPrice(Number(actualPrice) || 0, Number(discountPercent) || 0, Number(discountFlat) || 0);

  async function uploadFiles(): Promise<string[]> {
    if (files.length === 0) return [];
    const urls: string[] = [];
    for (const f of files) {
      const path = `${user!.id}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("product-images").upload(path, f);
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) return toast.error("Title is required.");
    if ((purpose === "buy" || purpose === "both") && (Number(actualPrice) || 0) <= 0)
      return toast.error("Actual price is required for buy.");
    if ((purpose === "rent" || purpose === "both") && (Number(pricePerDay) || 0) <= 0)
      return toast.error("Rental price per day is required.");

    setBusy(true);
    try {
      const newImages = await uploadFiles();
      const images = [...existingImages, ...newImages];
      const payload: any = {
        store_id: storeId,
        title: title.trim(),
        description: description.trim() || null,
        category, purpose,
        actual_price: Number(actualPrice) || 0,
        price_per_day: Number(pricePerDay) || 0,
        discount_percent: Math.max(0, Math.min(100, Number(discountPercent) || 0)),
        discount_flat: Math.max(0, Number(discountFlat) || 0),
        security_deposit: Number(deposit) || 0,
        quantity: Math.max(0, Number(quantity) || 0),
        size: size || null, color: color || null,
        images, available,
      };
      const { error } = isEdit
        ? await supabase.from("products").update(payload).eq("id", editing!.id)
        : await supabase.from("products").insert(payload);
      if (error) throw new Error(error.message);
      toast.success(isEdit ? "Product updated" : "Product added");
      setOpen(false);
      if (!isEdit) {
        setTitle(""); setDescription(""); setActualPrice(""); setPricePerDay("");
        setDiscountPercent("0"); setDiscountFlat("0"); setDeposit(""); setQuantity("1");
        setSize(""); setColor(""); setFiles([]); setExistingImages([]);
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
        ) : (
          <Button variant="hero"><Plus className="h-4 w-4 mr-2" /> Add product</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{isEdit ? "Edit product" : "New product"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} className="mt-1" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={1000} className="mt-1" /></div>

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
            <div>
              <Label>Available for</Label>
              <Select value={purpose} onValueChange={(v) => setPurpose(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">Rent only</SelectItem>
                  <SelectItem value="buy">Buy only</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Actual price (₹)</Label><Input type="number" min="0" step="0.01" value={actualPrice} onChange={(e) => setActualPrice(e.target.value)} className="mt-1" /></div>
            <div><Label>Rental price / day (₹)</Label><Input type="number" min="0" step="0.01" value={pricePerDay} onChange={(e) => setPricePerDay(e.target.value)} className="mt-1" /></div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><Label>Discount (%)</Label><Input type="number" min="0" max="100" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} className="mt-1" /></div>
            <div><Label>Discount (flat ₹)</Label><Input type="number" min="0" step="0.01" value={discountFlat} onChange={(e) => setDiscountFlat(e.target.value)} className="mt-1" /></div>
            <div><Label>Quantity in stock</Label><Input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1" /></div>
          </div>

          {(purpose === "buy" || purpose === "both") && Number(actualPrice) > 0 && (
            <p className="text-xs text-muted-foreground">
              Final buy price after discount: <strong className="text-foreground">{inr(finalUnit)}</strong>
            </p>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div><Label>Deposit (₹)</Label><Input type="number" min="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="mt-1" /></div>
            <div><Label>Size</Label><Input value={size} onChange={(e) => setSize(e.target.value)} className="mt-1" placeholder="S / M / L" /></div>
            <div><Label>Color</Label><Input value={color} onChange={(e) => setColor(e.target.value)} className="mt-1" /></div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
            <div>
              <Label className="cursor-pointer">Listed / available</Label>
              <p className="text-xs text-muted-foreground">Customers can see and order this product.</p>
            </div>
            <Switch checked={available} onCheckedChange={setAvailable} />
          </div>

          {existingImages.length > 0 && (
            <div>
              <Label>Existing images</Label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {existingImages.map((url) => (
                  <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-petal">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setExistingImages(existingImages.filter((u) => u !== url))}
                      className="absolute top-1 right-1 rounded-full bg-background/90 p-0.5 hover:bg-destructive hover:text-destructive-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>{isEdit ? "Add more images" : "Images"}</Label>
            <label className="mt-1 flex items-center gap-2 rounded-xl border border-dashed border-border bg-background p-4 cursor-pointer hover:border-primary transition-smooth">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""} selected` : "Choose images (multi-select)"}
              </span>
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            </label>
          </div>

          <Button type="submit" variant="hero" className="w-full" disabled={busy}>
            {busy ? (isEdit ? "Saving…" : "Adding…") : (isEdit ? "Save changes" : "Add product")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StoreReturnsList({ storeId }: { storeId: string }) {
  const [rows, setRows] = useState<(ReturnRow & { rental: any })[]>([]);

  async function load() {
    const { data } = await supabase
      .from("return_requests")
      .select("*, rental:rentals(id,product:products(title),customer:profiles!rentals_customer_id_fkey(full_name))")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    setRows((data as any) ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase
      .channel(`ret-store-${storeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "return_requests", filter: `store_id=eq.${storeId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [storeId]);

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No return requests yet.</p>;

  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-border p-4 bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <p className="font-medium">{r.rental?.product?.title ?? "Order"}</p>
              <p className="text-xs text-muted-foreground">{r.rental?.customer?.full_name ?? "Customer"} · opened {format(new Date(r.created_at), "PP")}</p>
              {r.reason && <p className="text-xs italic mt-1">"{r.reason}"</p>}
            </div>
            <Badge className="bg-primary-soft text-rose-deep capitalize">{r.status.replace(/_/g, " ")}</Badge>
          </div>
          <StoreReturnControls ret={r} onChanged={load} />
        </div>
      ))}
    </div>
  );
}

export default Vendor;
