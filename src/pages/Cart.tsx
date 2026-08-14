import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Trash2, ShoppingBag, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { differenceInCalendarDays } from "date-fns";
import { computeLine, computeOrderTotals, inr, type LineBreakdown } from "@/lib/pricing";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { cn } from "@/lib/utils";
import { DeliveryAddressDialog, useSavedAddress } from "@/components/DeliveryAddressDialog";
import { addressLines, isAddressComplete, rentalAddressPayload, validateAddress } from "@/lib/address";

type CartRow = {
  id: string;
  product_id: string;
  kind: "rent" | "buy";
  quantity: number;
  start_date: string | null;
  end_date: string | null;
  product: {
    id: string; title: string; images: string[]; store_id: string;
    price_per_day: number; security_deposit: number;
    actual_price: number; discount_percent: number; discount_flat: number;
    quantity: number; purpose: "rent" | "buy" | "both";
  } | null;
};

const Cart = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { settings } = usePlatformSettings();
  const [items, setItems] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [delivery, setDelivery] = useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { document.title = "Cart · Rent & Radiate"; }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      toast.info("Please sign in to continue with your order.");
      navigate("/auth?next=/cart");
      return;
    }
    refresh();
  }, [user, authLoading]); // eslint-disable-line

  async function refresh() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("cart_items")
      .select("id,product_id,kind,quantity,start_date,end_date,product:products(id,title,images,store_id,price_per_day,security_deposit,actual_price,discount_percent,discount_flat,quantity,purpose)")
      .order("created_at", { ascending: false });
    setItems((data as any) ?? []);
    setLoading(false);
  }

  async function updateItem(id: string, patch: Partial<CartRow>) {
    const { error } = await (supabase as any).from("cart_items").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function removeItem(id: string) {
    const { error } = await (supabase as any).from("cart_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  function lineFor(it: CartRow): LineBreakdown | null {
    if (!it.product) return null;
    const days = it.kind === "rent" && it.start_date && it.end_date
      ? Math.max(1, differenceInCalendarDays(new Date(it.end_date), new Date(it.start_date)))
      : 0;
    return computeLine({
      kind: it.kind,
      pricePerDay: Number(it.product.price_per_day),
      actualPrice: Number(it.product.actual_price),
      // Shop owner uploads the final price — no additional checkout discount for rentals.
      discountPercent: it.kind === "rent" ? 0 : Number(it.product.discount_percent),
      discountFlat: it.kind === "rent" ? 0 : Number(it.product.discount_flat),
      securityDeposit: Number(it.product.security_deposit),
      quantity: it.quantity,
      days,
    });
  }

  const lines = items.map(lineFor).filter((x): x is LineBreakdown => !!x);
  const feeInputs = items
    .map((it) => {
      const line = lineFor(it);
      if (!it.product || !line) return null;
      // Rental platform fee is admin-toggleable; when off, rent lines add no fee.
      if (it.kind === "rent" && !settings.rental_platform_fee_enabled) return null;
      const days = it.kind === "rent" && it.start_date && it.end_date
        ? Math.max(1, differenceInCalendarDays(new Date(it.end_date), new Date(it.start_date)))
        : 1;
      return { line, unitPrice: line.finalUnit, quantity: it.quantity, days };
    })
    .filter((x): x is { line: LineBreakdown; unitPrice: number; quantity: number; days: number } => !!x);
  const totals = computeOrderTotals(lines, settings, { delivery: delivery === "delivery", feeInputs });

  // Group by store — we'll create one rental per cart item (simplest & matches existing schema).
  async function checkout() {
    if (items.length === 0) return;
    if (delivery === "delivery" && address.trim().length < 8) return toast.error("Enter a delivery address.");
    setSubmitting(true);
    try {
      const created: string[] = [];
      for (const it of items) {
        if (!it.product) continue;
        const line = lineFor(it)!;
        const days = it.kind === "rent" && it.start_date && it.end_date
          ? Math.max(1, differenceInCalendarDays(new Date(it.end_date), new Date(it.start_date)))
          : null;
        const chargeFee = it.kind !== "rent" || settings.rental_platform_fee_enabled;
        const single = computeOrderTotals([line], settings, {
          delivery: false,
          feeInputs: chargeFee
            ? [{ line, unitPrice: line.finalUnit, quantity: it.quantity, days: days ?? 1 }]
            : [],
        });
        const payload: any = {
          customer_id: user!.id,
          product_id: it.product.id,
          store_id: it.product.store_id,
          kind: it.kind,
          quantity: it.quantity,
          start_date: it.start_date,
          end_date: it.end_date,
          days,
          rental_total: it.kind === "rent" ? line.subtotal : 0,
          deposit: line.deposit,
          subtotal: single.subtotal,
          discount_amount: single.discount,
          gst_amount: single.gst,
          delivery_fee: 0, // delivery applied to first order below
          platform_fee: single.platformFee,
          commission_amount: single.commission,
          grand_total: single.grandTotal,
          delivery_method: delivery,
          address: delivery === "delivery" ? address : null,
        };
        const { data, error } = await supabase.from("rentals").insert(payload).select("id").single();
        if (error || !data) throw new Error(error?.message ?? "Failed to create order");
        created.push(data.id);
      }

      // Apply the single delivery fee to the first order so total matches what user saw.
      if (created.length > 0 && delivery === "delivery" && totals.delivery > 0) {
        const firstId = created[0];
        const { data: r } = await supabase.from("rentals").select("grand_total").eq("id", firstId).maybeSingle();
        if (r) {
          await supabase.from("rentals")
            .update({ delivery_fee: totals.delivery, grand_total: Number(r.grand_total) + totals.delivery })
            .eq("id", firstId);
        }
      }


      // Clear cart
      await (supabase as any).from("cart_items").delete().eq("user_id", user!.id);
      toast.success("Order placed");
      // Send first to checkout; remaining stay pending in My Rentals.
      navigate(`/checkout/${created[0]}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="container py-20 text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading cart…
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-10 max-w-5xl">
        <h1 className="font-display text-4xl md:text-5xl">Your cart</h1>
        <p className="text-muted-foreground mt-2">Review your items and place the order.</p>

        {items.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-dashed border-border p-16 text-center">
            <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Your cart is empty.</p>
            <Link to="/browse"><Button variant="hero" className="mt-6">Browse pieces</Button></Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_360px] gap-8 mt-8">
            <div className="space-y-3">
              {items.map((it) => {
                const line = lineFor(it);
                if (!it.product || !line) return null;
                const days = it.kind === "rent" && it.start_date && it.end_date
                  ? Math.max(1, differenceInCalendarDays(new Date(it.end_date), new Date(it.start_date)))
                  : 0;
                return (
                  <div key={it.id} className="rounded-2xl border border-border bg-card p-4 flex gap-4">
                    {it.product.images?.[0] && (
                      <img src={it.product.images[0]} alt={it.product.title}
                        className="h-24 w-24 rounded-xl object-cover bg-petal shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium truncate">{it.product.title}</p>
                          <Badge variant="outline" className="capitalize mt-1">{it.kind}</Badge>
                          {days > 0 && <span className="text-xs text-muted-foreground ml-2">{days} day{days === 1 ? "" : "s"}</span>}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(it.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" min={1} max={it.product.quantity} value={it.quantity}
                          onChange={(e) => updateItem(it.id, { quantity: Math.max(1, Math.min(it.product!.quantity, Number(e.target.value) || 1)) })}
                          className="w-20 h-8" />
                        <span className="ml-auto font-semibold">{inr(line.subtotal + line.deposit)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <aside className="rounded-3xl border border-border bg-card p-6 shadow-card h-fit space-y-4">
              <h2 className="font-display text-xl">Order summary</h2>

              <div>
                <Label className="text-sm">Delivery</Label>
                <RadioGroup value={delivery} onValueChange={(v) => setDelivery(v as any)} className="grid grid-cols-2 gap-2 mt-2">
                  <DeliveryOpt value="pickup" label="Pickup" />
                  <DeliveryOpt value="delivery" label="Delivery" />
                </RadioGroup>
                {delivery === "delivery" && (
                  <Textarea placeholder="Delivery address" value={address}
                    onChange={(e) => setAddress(e.target.value)} className="mt-3" rows={2} />
                )}
              </div>

              <div className="space-y-1.5 text-sm border-t border-border pt-4">
                <Row label="Subtotal" value={inr(totals.subtotal + totals.discount)} />
                {totals.discount > 0 && <Row label="Discount" value={`− ${inr(totals.discount)}`} className="text-rose-deep" />}
                {totals.platformFee > 0 && <Row label="Platform fee" value={inr(totals.platformFee)} muted />}
                {settings.gst_enabled && totals.gst > 0 && <Row label={`GST (${settings.gst_percent}%)`} value={inr(totals.gst)} muted />}
                {delivery === "delivery" && <Row label="Delivery" value={inr(totals.delivery)} muted />}
                {totals.deposit > 0 && <Row label="Refundable deposit" value={inr(totals.deposit)} muted />}
                <Row label="Total payable" value={inr(totals.grandTotal)} bold />
              </div>


              <Button variant="hero" size="lg" className="w-full" onClick={checkout} disabled={submitting || items.length === 0}>
                {submitting ? "Placing…" : `Checkout · ${inr(totals.grandTotal)}`}
              </Button>
            </aside>
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
};

function Row({ label, value, bold, muted, className }: { label: string; value: string; bold?: boolean; muted?: boolean; className?: string }) {
  return (
    <div className={cn("flex justify-between", bold && "text-base font-semibold pt-2 border-t border-border mt-2", muted && "text-muted-foreground", className)}>
      <span>{label}</span><span>{value}</span>
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

export default Cart;
