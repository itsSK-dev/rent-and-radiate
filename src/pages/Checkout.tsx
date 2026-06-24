import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Shield, Banknote, Loader2, QrCode, Copy, CheckCircle2, Clock,
  Smartphone, CreditCard, Building2, ChevronRight, ArrowLeft, Wallet, Store as StoreIcon,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

type Rental = {
  id: string;
  customer_id: string;
  store_id: string;
  grand_total: number;
  rental_total: number;
  deposit: number;
  subtotal: number;
  discount_amount: number;
  gst_amount: number;
  delivery_fee: number;
  payment_status: string;
  status: string;
  product_id: string;
  kind: "rent" | "buy";
  quantity: number;
  commission_amount: number;
  protection_plan: boolean;
  protection_plan_fee: number;
  reward_points_used: number;
  reward_discount: number;
};

type ProductLite = { title: string; images: string[] };
type PaymentSettings = { upi_id: string; payee_name: string; qr_image_url: string | null; instructions: string };

type MethodKey = "upi" | "qr" | "card" | "netbanking" | "wallet" | "cod" | "pay_at_store";

declare global {
  interface Window { Razorpay?: any }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const Checkout = () => {
  const { rentalId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [rental, setRental] = useState<Rental | null>(null);
  const [product, setProduct] = useState<ProductLite | null>(null);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [codSubmitting, setCodSubmitting] = useState(false);
  const [reference, setReference] = useState("");
  const [selected, setSelected] = useState<MethodKey | null>(null);
  const [launching, setLaunching] = useState(false);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [redeemValue, setRedeemValue] = useState(0.1);
  const [maxRedeemPct, setMaxRedeemPct] = useState(20);
  const [rewardsEnabled, setRewardsEnabled] = useState(true);
  const [pointsInput, setPointsInput] = useState<string>("");
  const [redeemBusy, setRedeemBusy] = useState(false);

  useEffect(() => { document.title = "Checkout · Rent & Radiate"; }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate(`/auth?next=/checkout/${rentalId}`); return; }
    (async () => {
      const [{ data: r, error }, { data: psRows }] = await Promise.all([
        supabase.from("rentals")
          .select("id, customer_id, store_id, grand_total, rental_total, deposit, subtotal, discount_amount, gst_amount, delivery_fee, payment_status, status, product_id, kind, quantity, commission_amount, protection_plan, protection_plan_fee, reward_points_used, reward_discount")
          .eq("id", rentalId!).maybeSingle(),
        (supabase as any).rpc("get_public_payment_settings"),
      ]);
      if (error || !r) { toast.error("Could not load order"); navigate("/my-rentals"); return; }
      setRental(r as Rental);
      const ps = Array.isArray(psRows) ? psRows[0] : psRows;
      setSettings((ps as PaymentSettings) ?? { upi_id: "", payee_name: "Rent & Radiate", qr_image_url: null, instructions: "" });
      const { data: p } = await supabase.from("products").select("title, images").eq("id", (r as Rental).product_id).maybeSingle();
      if (p) setProduct(p as ProductLite);

      const [{ data: prof }, { data: plat }] = await Promise.all([
        supabase.from("profiles").select("reward_points").eq("id", user.id).maybeSingle(),
        supabase.from("platform_settings").select("rewards_enabled, reward_redeem_value, reward_max_redeem_percent").eq("id", true).maybeSingle(),
      ]);
      setPointsBalance((prof as any)?.reward_points ?? 0);
      if (plat) {
        setRewardsEnabled((plat as any).rewards_enabled ?? true);
        setRedeemValue(Number((plat as any).reward_redeem_value ?? 0.1));
        setMaxRedeemPct(Number((plat as any).reward_max_redeem_percent ?? 20));
      }
      setPointsInput(String((r as Rental).reward_points_used || ""));

      setLoading(false);
    })();
  }, [authLoading, user, rentalId, navigate]);

  const upiUrl = useMemo(() => {
    if (!rental || !settings?.upi_id) return "";
    const params = new URLSearchParams({
      pa: settings.upi_id,
      pn: settings.payee_name || "Rent & Radiate",
      am: Number(rental.grand_total).toFixed(2),
      cu: "INR",
      tn: `Order ${rental.id.slice(0, 8)}`,
      tr: rental.id.slice(0, 12),
    });
    return `upi://pay?${params.toString()}`;
  }, [rental, settings]);

  async function copyUpi() {
    if (!settings?.upi_id) return;
    try {
      await navigator.clipboard.writeText(settings.upi_id);
      toast.success("UPI ID copied");
    } catch { toast.error("Could not copy"); }
  }

  async function submitPaid() {
    if (!rental || !user || !settings?.upi_id) return;
    setSubmitting(true);
    const { error } = await (supabase as any).from("manual_payments").insert({
      rental_id: rental.id,
      user_id: user.id,
      store_id: rental.store_id,
      amount: rental.grand_total,
      upi_id: settings.upi_id,
      user_reference: reference.trim() || null,
      commission_amount: rental.commission_amount ?? 0,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Payment submitted! We'll verify it shortly.");
    navigate("/my-rentals");
  }

  async function payDeferred(mode: "cod" | "pay_at_store") {
    if (!rental) return;
    setCodSubmitting(true);
    const { data, error } = await supabase.functions.invoke("confirm-cod-payment", {
      body: { rentalId: rental.id, mode },
    });
    setCodSubmitting(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error ?? error?.message ?? "Could not confirm order");
    }
    toast.success(
      mode === "cod" ? "Order confirmed! Pay on delivery." : "Order confirmed! Pay when you pick up.",
    );
    navigate("/my-rentals");
  }

  async function launchRazorpay(method: "upi" | "card" | "netbanking" | "wallet") {
    if (!rental || !user) return;
    setLaunching(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok) { toast.error("Could not load payment gateway"); return; }

      const { data, error } = await supabase.functions.invoke("razorpay-create-order", {
        body: { rentalId: rental.id },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error ?? error?.message ?? "Could not start payment");
        return;
      }
      const { orderId, amount, currency, keyId } = data as any;

      const rzp = new window.Razorpay({
        key: keyId,
        amount,
        currency,
        name: "Rent & Radiate",
        description: `Order ${rental.id.slice(0, 8).toUpperCase()}`,
        order_id: orderId,
        prefill: { method },
        config: {
          display: {
            blocks: {
              chosen: {
                name:
                  method === "upi" ? "Pay using UPI"
                  : method === "card" ? "Pay using Card"
                  : method === "wallet" ? "Pay using Wallet"
                  : "Pay using Net Banking",
                instruments: [{ method }],
              },
            },
            sequence: ["block.chosen"],
            preferences: { show_default_blocks: false },
          },
        },
        handler: async (resp: any) => {
          const { data: vData, error: vErr } = await supabase.functions.invoke("razorpay-verify-payment", {
            body: {
              rentalId: rental.id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              method,
            },
          });
          if (vErr || (vData as any)?.error) {
            toast.error((vData as any)?.error ?? vErr?.message ?? "Payment verification failed");
            return;
          }
          toast.success("Payment successful! Order confirmed.");
          navigate("/my-rentals");
        },
        modal: {
          ondismiss: () => setLaunching(false),
        },
        theme: { color: "#be123c" },
      });
      rzp.on("payment.failed", (resp: any) => {
        supabase.functions.invoke("razorpay-verify-payment", {
          body: { rentalId: rental!.id, failure: resp?.error ?? null, method },
        });
        toast.error(resp?.error?.description ?? "Payment failed");
      });
      rzp.open();
    } finally {
      setLaunching(false);
    }
  }

  if (loading || !rental) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="container py-20 text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading checkout…
        </div>
        <Footer />
      </div>
    );
  }

  const isPaid = rental.payment_status === "paid";
  const isPending = rental.payment_status === "pending_verification";
  const upiConfigured = !!settings?.upi_id;
  const allowCOD = rental.kind === "buy";

  const methods: { key: MethodKey; label: string; desc: string; icon: any; disabled?: boolean; hint?: string }[] = [
    { key: "upi", label: "UPI", desc: "GPay, PhonePe, Paytm, BHIM & more", icon: Smartphone },
    { key: "qr", label: "QR code", desc: "Scan & pay, then submit reference", icon: QrCode, disabled: !upiConfigured, hint: !upiConfigured ? "Not configured" : undefined },
    { key: "card", label: "Debit / Credit card", desc: "Visa, Mastercard, RuPay, Amex", icon: CreditCard },
    { key: "netbanking", label: "Net banking", desc: "All major Indian banks", icon: Building2 },
    { key: "wallet", label: "Wallets", desc: "Paytm, Amazon Pay, Mobikwik, Freecharge", icon: Wallet },
    { key: "pay_at_store", label: "Pay at pickup / store", desc: "Reserve now, pay when you collect from the store", icon: StoreIcon },
    ...(allowCOD ? [{ key: "cod" as MethodKey, label: "Cash on delivery", desc: "Pay when your order arrives", icon: Banknote }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-10 max-w-3xl">
        <h1 className="font-display text-4xl md:text-5xl">Checkout</h1>
        <p className="text-muted-foreground mt-2">Choose how you'd like to pay. Your order is confirmed once payment succeeds.</p>

        <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-card space-y-5">
          <div className="flex items-center gap-4">
            {product?.images?.[0] && (
              <img src={product.images[0]} alt={product.title} className="h-20 w-20 rounded-xl object-cover bg-petal" />
            )}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Item</p>
              <p className="font-medium">{product?.title ?? "Rental"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Order ID: {rental.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-2 text-sm">
            <Row label={`${rental.kind === "buy" ? "Purchase" : "Rental"}${rental.quantity > 1 ? ` × ${rental.quantity}` : ""}`} value={`₹${(Number(rental.subtotal) + Number(rental.discount_amount || 0)).toLocaleString("en-IN")}`} />
            {Number(rental.discount_amount) > 0 && <Row label="Discount" value={`− ₹${Number(rental.discount_amount).toLocaleString("en-IN")}`} />}
            {Number(rental.gst_amount) > 0 && <Row label="GST" value={`₹${Number(rental.gst_amount).toLocaleString("en-IN")}`} muted />}
            {Number(rental.delivery_fee) > 0 && <Row label="Delivery" value={`₹${Number(rental.delivery_fee).toLocaleString("en-IN")}`} muted />}
            {Number(rental.deposit) > 0 && <Row label="Refundable deposit" value={`₹${Number(rental.deposit).toLocaleString("en-IN")}`} muted />}
            {Number(rental.protection_plan_fee) > 0 && <Row label="Rental Protection Plan" value={`₹${Number(rental.protection_plan_fee).toLocaleString("en-IN")}`} muted />}
            <Row label="Total payable" value={`₹${Number(rental.grand_total).toLocaleString("en-IN")}`} bold />
          </div>

          {isPaid ? (
            <div className="rounded-xl bg-secondary p-4 text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              This order has already been paid.
              <Button variant="link" className="px-1" onClick={() => navigate("/my-rentals")}>View rentals</Button>
            </div>
          ) : isPending ? (
            <div className="rounded-xl bg-gold/20 p-4 text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Payment submitted — waiting for admin verification.
              <Button variant="link" className="px-1" onClick={() => navigate("/my-rentals")}>View rentals</Button>
            </div>
          ) : selected === null ? (
            <div className="space-y-3 pt-2">
              <h2 className="font-display text-xl">Choose a payment method</h2>
              <div className="grid gap-3">
                {methods.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      disabled={m.disabled}
                      onClick={() => setSelected(m.key)}
                      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary hover:bg-blossom/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="h-11 w-11 rounded-xl bg-blossom/50 flex items-center justify-center text-rose-deep">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium flex items-center gap-2">{m.label}{m.hint && <Badge variant="outline" className="text-[10px]">{m.hint}</Badge>}</p>
                        <p className="text-xs text-muted-foreground">{m.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-5 pt-2">
              <button type="button" onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Choose another method
              </button>

              {selected === "qr" && upiConfigured && (
                <div className="rounded-2xl border border-border bg-blossom/30 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-rose-deep" />
                    <h3 className="font-display text-xl">Pay via QR code</h3>
                    <Badge variant="outline" className="ml-auto">UPI</Badge>
                  </div>

                  <div className="flex flex-col items-center gap-3">
                    {settings?.qr_image_url ? (
                      <img src={settings.qr_image_url} alt="UPI QR" className="h-56 w-56 rounded-xl bg-white p-3 object-contain" />
                    ) : (
                      <div className="rounded-xl bg-white p-3">
                        <QRCodeSVG value={upiUrl} size={224} level="M" includeMargin={false} />
                      </div>
                    )}
                    <a href={upiUrl} className="text-xs text-rose-deep underline sm:hidden">Open in UPI app</a>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-card border border-border p-3">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Payable</p>
                      <p className="font-semibold mt-0.5">₹{Number(rental.grand_total).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="rounded-lg bg-card border border-border p-3">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Payee</p>
                      <p className="font-medium mt-0.5 truncate">{settings?.payee_name}</p>
                    </div>
                    <div className="rounded-lg bg-card border border-border p-3 col-span-2 flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">UPI ID</p>
                        <p className="font-mono text-sm truncate">{settings?.upi_id}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={copyUpi}><Copy className="h-3.5 w-3.5" /> Copy</Button>
                    </div>
                  </div>

                  {settings?.instructions && (
                    <p className="text-xs text-muted-foreground">{settings.instructions}</p>
                  )}

                  <div className="space-y-2 pt-2 border-t border-border">
                    <Label htmlFor="ref" className="text-xs">UPI reference / txn ID (optional)</Label>
                    <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value.slice(0, 64))} placeholder="e.g. 412345678901" />
                  </div>

                  <Button variant="hero" size="lg" className="w-full" onClick={submitPaid} disabled={submitting}>
                    {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <><CheckCircle2 className="h-4 w-4" /> I have paid</>}
                  </Button>
                </div>
              )}

              {(selected === "upi" || selected === "card" || selected === "netbanking" || selected === "wallet") && (
                <div className="rounded-2xl border border-border bg-blossom/30 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    {selected === "upi" ? <Smartphone className="h-4 w-4 text-rose-deep" /> :
                     selected === "card" ? <CreditCard className="h-4 w-4 text-rose-deep" /> :
                     selected === "wallet" ? <Wallet className="h-4 w-4 text-rose-deep" /> :
                     <Building2 className="h-4 w-4 text-rose-deep" />}
                    <h3 className="font-display text-xl">
                      {selected === "upi" ? "Pay using UPI"
                        : selected === "card" ? "Pay using Card"
                        : selected === "wallet" ? "Pay using Wallet"
                        : "Pay using Net Banking"}
                    </h3>
                    <Badge variant="outline" className="ml-auto">Secure</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selected === "wallet"
                      ? <>You'll pay <span className="font-semibold text-foreground">₹{Number(rental.grand_total).toLocaleString("en-IN")}</span> with Paytm Wallet, Amazon Pay, Mobikwik, Freecharge or any other supported wallet via our secure gateway.</>
                      : <>You'll complete payment of <span className="font-semibold text-foreground">₹{Number(rental.grand_total).toLocaleString("en-IN")}</span> through our secure payment gateway. Your order is confirmed automatically once payment succeeds.</>}
                  </p>
                  <Button variant="hero" size="lg" className="w-full" onClick={() => launchRazorpay(selected)} disabled={launching}>
                    {launching ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening…</> : <>Pay ₹{Number(rental.grand_total).toLocaleString("en-IN")}</>}
                  </Button>
                </div>
              )}

              {selected === "cod" && (
                <div className="rounded-2xl border border-border bg-blossom/30 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-rose-deep" />
                    <h3 className="font-display text-xl">Cash on delivery</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Pay <span className="font-semibold text-foreground">₹{Number(rental.grand_total).toLocaleString("en-IN")}</span> in cash when your order is delivered. We'll confirm your order right away.
                  </p>
                  <Button variant="hero" size="lg" className="w-full" onClick={() => payDeferred("cod")} disabled={codSubmitting}>
                    {codSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirming…</> : <><Banknote className="h-4 w-4" /> Confirm order</>}
                  </Button>
                </div>
              )}

              {selected === "pay_at_store" && (
                <div className="rounded-2xl border border-border bg-blossom/30 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <StoreIcon className="h-4 w-4 text-rose-deep" />
                    <h3 className="font-display text-xl">Pay at pickup / store</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Reserve your order now and pay <span className="font-semibold text-foreground">₹{Number(rental.grand_total).toLocaleString("en-IN")}</span> when you collect it from the store. The shop will mark the payment as received on pickup.
                  </p>
                  <Button variant="hero" size="lg" className="w-full" onClick={() => payDeferred("pay_at_store")} disabled={codSubmitting}>
                    {codSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirming…</> : <><StoreIcon className="h-4 w-4" /> Reserve & pay at store</>}
                  </Button>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-2 border-t border-border">
            <Shield className="h-3.5 w-3.5" /> Payments are encrypted and verified server-side before orders are confirmed.
          </p>
        </div>
      </section>
      <Footer />
    </div>
  );
};

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-semibold pt-1" : ""} ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

export default Checkout;
