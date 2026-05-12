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
import { Shield, Banknote, Loader2, QrCode, Copy, CheckCircle2, Clock } from "lucide-react";
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
};

type ProductLite = { title: string; images: string[] };
type PaymentSettings = { upi_id: string; payee_name: string; qr_image_url: string | null; instructions: string };

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

  useEffect(() => { document.title = "Checkout · Bloom"; }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate(`/auth?next=/checkout/${rentalId}`); return; }
    (async () => {
      const [{ data: r, error }, { data: ps }] = await Promise.all([
        supabase.from("rentals")
          .select("id, customer_id, store_id, grand_total, rental_total, deposit, subtotal, discount_amount, gst_amount, delivery_fee, payment_status, status, product_id, kind, quantity, commission_amount")
          .eq("id", rentalId!).maybeSingle(),
        (supabase as any).from("payment_settings").select("upi_id,payee_name,qr_image_url,instructions").eq("id", true).maybeSingle(),
      ]);
      if (error || !r) { toast.error("Could not load order"); navigate("/my-rentals"); return; }
      setRental(r as Rental);
      setSettings((ps as PaymentSettings) ?? { upi_id: "", payee_name: "Bloom Rentals", qr_image_url: null, instructions: "" });
      const { data: p } = await supabase.from("products").select("title, images").eq("id", (r as Rental).product_id).maybeSingle();
      if (p) setProduct(p as ProductLite);
      setLoading(false);
    })();
  }, [authLoading, user, rentalId, navigate]);

  const upiUrl = useMemo(() => {
    if (!rental || !settings?.upi_id) return "";
    const params = new URLSearchParams({
      pa: settings.upi_id,
      pn: settings.payee_name || "Bloom Rentals",
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

  async function payCOD() {
    if (!rental) return;
    setCodSubmitting(true);
    const { data, error } = await supabase.functions.invoke("confirm-cod-payment", {
      body: { rentalId: rental.id },
    });
    setCodSubmitting(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error ?? error?.message ?? "Could not confirm COD");
    }
    toast.success("Order confirmed! Pay on delivery.");
    navigate("/my-rentals");
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-10 max-w-3xl">
        <h1 className="font-display text-4xl md:text-5xl">Checkout</h1>
        <p className="text-muted-foreground mt-2">Pay via UPI QR code. We'll verify your payment and confirm your order.</p>

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
          ) : (
            <div className="space-y-5 pt-2">
              {!upiConfigured ? (
                <div className="rounded-xl bg-destructive/10 text-destructive text-sm p-4">
                  UPI payments aren't configured yet. Please contact support or use Cash on Delivery.
                </div>
              ) : (
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
                  <p className="text-[11px] text-muted-foreground text-center">Works with Google Pay, PhonePe, Paytm, BHIM and any UPI app.</p>
                </div>
              )}

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase tracking-wider">
                  <span className="bg-card px-3 text-muted-foreground">or</span>
                </div>
              </div>

              <Button variant="outline" size="lg" className="w-full" onClick={payCOD} disabled={codSubmitting}>
                <Banknote className="h-4 w-4" /> {codSubmitting ? "Confirming…" : "Cash on Delivery"}
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-2 border-t border-border">
            <Shield className="h-3.5 w-3.5" /> Payments are reviewed by our team before orders are confirmed.
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
