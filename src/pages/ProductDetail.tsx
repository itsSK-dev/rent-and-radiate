import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CalendarIcon, MapPin, Shield, Sparkles, ShoppingCart, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { format, differenceInCalendarDays, addDays, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { demoImageMap } from "@/lib/seedDemo";
import { discountedUnitPrice, inr, computeLine, computeOrderTotals, protectionPlanFee } from "@/lib/pricing";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

type Product = {
  id: string;
  store_id: string;
  category: "dress" | "jewellery";
  title: string;
  description: string | null;
  images: string[];
  price_per_day: number;
  security_deposit: number;
  size: string | null;
  color: string | null;
  condition_notes: string | null;
  actual_price: number;
  discount_percent: number;
  discount_flat: number;
  quantity: number;
  purpose: "rent" | "buy" | "both";
  store?: { name: string; city: string | null; address: string | null; rating: number } | null;
};

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = usePlatformSettings();
  const [product, setProduct] = useState<Product | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [mode, setMode] = useState<"rent" | "buy">("rent");
  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();
  const [qty, setQty] = useState(1);
  const [delivery, setDelivery] = useState<"pickup" | "delivery">("pickup");
  const [submitting, setSubmitting] = useState(false);
  const [protectionPlan, setProtectionPlan] = useState(false);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("*, store:stores(name,city,address,rating)")
        .eq("id", id!).maybeSingle();
      setProduct(data as any);
      if (data) {
        document.title = `${(data as any).title} · Rent & Radiate`;
        const purpose = (data as any).purpose ?? "rent";
        if (purpose === "buy") setMode("buy");
      }
      // Load active rental bookings to disable on calendar
      const { data: bookings } = await supabase
        .from("rentals")
        .select("start_date,end_date,status,kind")
        .eq("product_id", id!)
        .neq("kind", "buy")
        .in("status", ["pending", "accepted", "confirmed", "packing", "ready_for_pickup", "shipped", "delivered"]);
      const blocked: Date[] = [];
      (bookings ?? []).forEach((b: any) => {
        if (!b.start_date || !b.end_date) return;
        try {
          eachDayOfInterval({ start: parseISO(b.start_date), end: parseISO(b.end_date) })
            .forEach((d) => blocked.push(d));
        } catch {}
      });
      setBookedDates(blocked);
    })();
  }, [id]);

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="container py-20 text-muted-foreground">Loading…</div>
        <Footer />
      </div>
    );
  }

  const purpose = product.purpose ?? "rent";
  const canRent = purpose === "rent" || purpose === "both";
  const canBuy = purpose === "buy" || purpose === "both";
  const outOfStock = (product.quantity ?? 0) <= 0;
  const days = mode === "rent" && start && end ? Math.max(1, differenceInCalendarDays(end, start) + 1) : 0;

  const line = computeLine({
    kind: mode,
    pricePerDay: Number(product.price_per_day),
    actualPrice: Number(product.actual_price),
    discountPercent: Number(product.discount_percent),
    discountFlat: Number(product.discount_flat),
    securityDeposit: Number(product.security_deposit),
    quantity: qty,
    days,
  });
  const totals = computeOrderTotals([line], settings, { delivery: delivery === "delivery" });
  const ppFee = mode === "rent" && protectionPlan ? protectionPlanFee(line.subtotal, settings) : 0;
  const displayGrandTotal = totals.grandTotal + ppFee;
  const finalUnit = discountedUnitPrice(product.actual_price, product.discount_percent, product.discount_flat);
  const hasDiscount = canBuy && Number(product.actual_price) > 0 && finalUnit < Number(product.actual_price);
  const heroImg = product.images?.[activeImage] || product.images?.[0] || demoImageMap[product.title];

  const isBlocked = (d: Date) => bookedDates.some((b) => isSameDay(b, d));

  async function addToCart() {
    if (!user) { navigate(`/auth?next=/product/${id}`); return; }
    if (mode === "rent" && (!start || !end)) return toast.error("Pick rental dates first.");
    if (qty > (product!.quantity ?? 0)) return toast.error("Not enough stock.");
    const payload: any = {
      user_id: user.id,
      product_id: product!.id,
      kind: mode,
      quantity: qty,
      start_date: mode === "rent" ? format(start!, "yyyy-MM-dd") : null,
      end_date: mode === "rent" ? format(end!, "yyyy-MM-dd") : null,
    };
    const { error } = await (supabase as any).from("cart_items").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Added to cart");
    navigate("/cart");
  }

  async function buyNow() {
    if (!user) { navigate(`/auth?next=/product/${id}`); return; }
    if (mode === "rent" && (!start || !end)) return toast.error("Pick rental dates.");
    if (mode === "rent" && start && end) {
      const span = eachDayOfInterval({ start, end });
      if (span.some(isBlocked)) return toast.error("Some dates are already booked. Pick a free range.");
    }
    if (qty > (product!.quantity ?? 0)) return toast.error("Not enough stock.");
    setSubmitting(true);
    const payload: any = {
      customer_id: user.id,
      product_id: product!.id,
      store_id: product!.store_id,
      kind: mode,
      quantity: qty,
      start_date: mode === "rent" ? format(start!, "yyyy-MM-dd") : null,
      end_date: mode === "rent" ? format(end!, "yyyy-MM-dd") : null,
      days: mode === "rent" ? days : null,
      rental_total: mode === "rent" ? line.subtotal : 0,
      deposit: line.deposit,
      subtotal: totals.subtotal,
      discount_amount: totals.discount,
      gst_amount: totals.gst,
      delivery_fee: totals.delivery,
      commission_amount: totals.commission,
      grand_total: totals.grandTotal,
      delivery_method: delivery,
      protection_plan: mode === "rent" ? protectionPlan : false,
    };
    const { data: created, error } = await supabase.from("rentals").insert(payload).select("id").single();
    setSubmitting(false);
    if (error || !created) return toast.error(error?.message ?? "Could not place order");
    navigate(`/checkout/${created.id}`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-10 grid lg:grid-cols-2 gap-10 lg:gap-16">
        <div className="space-y-4 animate-fade-up">
          <div className="aspect-[4/5] rounded-3xl overflow-hidden bg-petal shadow-petal relative">
            {heroImg && <img src={heroImg} alt={product.title} className="w-full h-full object-cover" />}
            {hasDiscount && (
              <Badge className="absolute top-4 left-4 bg-rose-deep text-white">
                {Number(product.discount_percent) > 0 ? `${product.discount_percent}% OFF` : `${inr(product.discount_flat)} OFF`}
              </Badge>
            )}
          </div>
          {product.images?.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {product.images.slice(0, 5).map((src, i) => (
                <button key={i} onClick={() => setActiveImage(i)}
                  className={cn("aspect-square rounded-xl overflow-hidden bg-petal border-2 transition-smooth",
                    i === activeImage ? "border-primary" : "border-transparent hover:border-border")}>
                  <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6 animate-fade-up">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-rose-deep">{product.category}</span>
            <h1 className="font-display text-5xl md:text-6xl mt-2">{product.title}</h1>
            {product.store && (
              <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" /> {product.store.name}
                {product.store.city ? ` · ${product.store.city}` : ""}
                <span className="text-gold ml-2">★ {Number(product.store.rating).toFixed(1)}</span>
              </p>
            )}
          </div>

          {/* Price summary */}
          <div className="flex flex-wrap items-baseline gap-3">
            {canBuy && Number(product.actual_price) > 0 && (
              <>
                {hasDiscount && <span className="text-lg text-muted-foreground line-through">{inr(product.actual_price)}</span>}
                <span className="font-display text-3xl">{inr(finalUnit)}</span>
                <span className="text-sm text-muted-foreground">to buy</span>
                {hasDiscount && (
                  <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                    You save {inr(Number(product.actual_price) - finalUnit)}
                  </span>
                )}
              </>
            )}
            {canRent && (
              <span className="text-sm text-muted-foreground">
                · {inr(product.price_per_day)} / day rent
              </span>
            )}
          </div>

          <p className="text-foreground/80 leading-relaxed">{product.description}</p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {product.size && <Detail label="Size" value={product.size} />}
            {product.color && <Detail label="Color" value={product.color} />}
            <Detail label="Stock" value={`${product.quantity} available`} />
            {canRent && <Detail label="Refundable deposit" value={inr(product.security_deposit)} />}
          </div>

          {product.condition_notes && (
            <div className="rounded-2xl bg-secondary p-4 text-sm flex gap-3">
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span><strong className="font-medium">Condition:</strong> {product.condition_notes}</span>
            </div>
          )}

          {/* Order card */}
          <div className="rounded-3xl border border-border bg-card p-6 space-y-5 shadow-card">
            {canRent && canBuy ? (
              <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
                <TabsList className="w-full">
                  <TabsTrigger value="rent" className="flex-1">Rent</TabsTrigger>
                  <TabsTrigger value="buy" className="flex-1">Buy</TabsTrigger>
                </TabsList>
                <TabsContent value="rent" className="mt-4 space-y-4">
                  <RentDatePickers start={start} end={end} setStart={setStart} setEnd={setEnd} isBlocked={isBlocked} />
                </TabsContent>
                <TabsContent value="buy" className="mt-4">
                  <p className="text-sm text-muted-foreground">Buy this piece outright at the discounted price below.</p>
                </TabsContent>
              </Tabs>
            ) : canRent ? (
              <RentDatePickers start={start} end={end} setStart={setStart} setEnd={setEnd} isBlocked={isBlocked} />
            ) : (
              <p className="text-sm text-muted-foreground">This item is for purchase only.</p>
            )}

            {mode === "rent" && bookedDates.length > 0 && (
              <p className="text-[11px] text-muted-foreground -mt-2">
                <CalendarIcon className="inline h-3 w-3 mr-1" />
                {bookedDates.length} day{bookedDates.length === 1 ? "" : "s"} already booked — unavailable dates are disabled.
              </p>
            )}

            {mode === "rent" && (
              <label className="flex items-start gap-3 rounded-2xl border border-border bg-blossom/30 p-3 cursor-pointer">
                <Switch checked={protectionPlan} onCheckedChange={setProtectionPlan} className="mt-1" />
                <div className="flex-1">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-rose-deep" /> Rental Protection Plan
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Optional. Covers accidental damage up to ₹{Number(line.deposit).toLocaleString("en-IN")}. Adds{" "}
                    <strong>{inr(protectionPlanFee(line.subtotal, settings))}</strong> to this order.
                  </p>
                </div>
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Quantity</Label>
                <Input type="number" min={1} max={product.quantity} value={qty}
                  onChange={(e) => setQty(Math.max(1, Math.min(product.quantity, Number(e.target.value) || 1)))}
                  className="mt-2" />
              </div>
              <div>
                <Label className="text-sm">Delivery</Label>
                <RadioGroup value={delivery} onValueChange={(v) => setDelivery(v as any)} className="grid grid-cols-2 gap-2 mt-2">
                  <DeliveryOpt value="pickup" label="Pickup" />
                  <DeliveryOpt value="delivery" label="Delivery" />
                </RadioGroup>
              </div>
            </div>

            <div className="space-y-1.5 text-sm border-t border-border pt-4">
              {mode === "rent" && (
                <>
                  <Row label="Rate / day" value={inr(product.price_per_day)} muted />
                  <Row label={`Rental (${days || 0} day${days === 1 ? "" : "s"} × ${qty})`} value={inr(line.base)} />
                </>
              )}
              {mode === "buy" && (
                <Row label={`Price × ${qty}`} value={inr(line.base)} />
              )}
              {totals.discount > 0 && <Row label="Discount" value={`− ${inr(totals.discount)}`} className="text-rose-deep" />}
              <Row label={`GST (${settings.gst_percent}%)`} value={inr(totals.gst)} muted />
              {delivery === "delivery" && <Row label="Delivery" value={inr(totals.delivery)} muted />}
              {mode === "rent" && line.deposit > 0 && <Row label="Refundable deposit" value={inr(line.deposit)} muted />}
              <Row label="Total payable" value={inr(totals.grandTotal)} bold />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" onClick={addToCart} disabled={outOfStock}>
                <ShoppingCart className="h-4 w-4" /> Add to cart
              </Button>
              <Button variant="hero" size="lg" onClick={buyNow}
                disabled={submitting || outOfStock || (mode === "rent" && !days)}>
                {submitting ? "…" : mode === "buy" ? "Buy Now" : "Rent Now"}
              </Button>
            </div>
            {mode === "rent" && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" /> Deposit refunded after item is returned in good condition.
              </p>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

function RentDatePickers({ start, end, setStart, setEnd, isBlocked }: {
  start?: Date; end?: Date; setStart: (d?: Date) => void; setEnd: (d?: Date) => void;
  isBlocked?: (d: Date) => boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <DateField label="Start" value={start} onChange={(d) => { setStart(d); if (d && end && end < d) setEnd(addDays(d, 1)); }} isBlocked={isBlocked} />
      <DateField label="End" value={end} onChange={setEnd} min={start} isBlocked={isBlocked} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

function Row({ label, value, bold, muted, className }: { label: string; value: string; bold?: boolean; muted?: boolean; className?: string }) {
  return (
    <div className={cn("flex justify-between", bold && "text-base font-semibold pt-1 border-t border-border mt-2", muted && "text-muted-foreground", className)}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function DateField({ label, value, onChange, min }: { label: string; value?: Date; onChange: (d?: Date) => void; min?: Date }) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-2", !value && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "PPP") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange}
            disabled={(d) => d < new Date(new Date().setHours(0,0,0,0)) || (min ? d < min : false)}
            initialFocus className={cn("p-3 pointer-events-auto")} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function DeliveryOpt({ value, label }: { value: string; label: string }) {
  return (
    <Label htmlFor={value} className="flex items-center gap-2 rounded-xl border border-border bg-background p-3 cursor-pointer hover:border-primary transition-smooth has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40">
      <RadioGroupItem value={value} id={value} />
      <span className="text-sm">{label}</span>
    </Label>
  );
}

export default ProductDetail;
