import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Shield, CreditCard, Banknote, Loader2 } from "lucide-react";

type Rental = {
  id: string;
  customer_id: string;
  grand_total: number;
  rental_total: number;
  deposit: number;
  payment_status: string;
  status: string;
  product_id: string;
};

type ProductLite = { title: string; images: string[] };

declare global {
  interface Window { Razorpay: any }
}

function loadRazorpay(): Promise<boolean> {
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
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [codSubmitting, setCodSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Checkout · Bloom";
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/auth?next=/checkout/${rentalId}`);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("id, customer_id, grand_total, rental_total, deposit, payment_status, status, product_id")
        .eq("id", rentalId!)
        .maybeSingle();
      if (error || !data) {
        toast.error("Could not load order");
        navigate("/my-rentals");
        return;
      }
      setRental(data as Rental);
      const { data: p } = await supabase
        .from("products").select("title, images").eq("id", (data as Rental).product_id).maybeSingle();
      if (p) setProduct(p as ProductLite);
      setLoading(false);
    })();
  }, [authLoading, user, rentalId, navigate]);

  async function payWithRazorpay() {
    if (!rental || !user) return;
    setPaying(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) {
        toast.error("Failed to load payment SDK. Check your connection.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("razorpay-create-order", {
        body: { rentalId: rental.id },
      });
      if (error || !data?.orderId) {
        toast.error(error?.message ?? "Could not start payment");
        return;
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        order_id: data.orderId,
        name: "Bloom Rentals",
        description: product?.title ?? "Dress rental",
        prefill: { email: user.email ?? "" },
        theme: { color: "#c2185b" },
        method: { card: true, upi: true, netbanking: true, wallet: true },
        handler: async (resp: any) => {
          const { data: vData, error: vErr } = await supabase.functions.invoke(
            "razorpay-verify-payment",
            {
              body: {
                rentalId: rental.id,
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
                method: "razorpay",
              },
            },
          );
          if (vErr || !vData?.ok) {
            toast.error("Payment received but verification failed. Contact support.");
            return;
          }
          toast.success("Payment successful!");
          navigate("/my-rentals");
        },
        modal: {
          ondismiss: async () => {
            await supabase.functions.invoke("razorpay-verify-payment", {
              body: {
                rentalId: rental.id,
                razorpay_order_id: data.orderId,
                failure: { code: "USER_CANCELLED", description: "User closed checkout" },
              },
            });
            toast("Payment cancelled. Your order is still pending.");
          },
        },
      });

      rzp.on("payment.failed", async (resp: any) => {
        await supabase.functions.invoke("razorpay-verify-payment", {
          body: {
            rentalId: rental.id,
            razorpay_order_id: data.orderId,
            razorpay_payment_id: resp.error?.metadata?.payment_id,
            failure: {
              code: resp.error?.code,
              description: resp.error?.description,
              reason: resp.error?.reason,
              source: resp.error?.source,
              step: resp.error?.step,
            },
            method: resp.error?.metadata?.payment_id ? "razorpay" : "unknown",
          },
        });
        toast.error(resp.error?.description ?? "Payment failed. Order kept as pending.");
      });

      rzp.open();
    } finally {
      setPaying(false);
    }
  }

  async function payCOD() {
    if (!rental) return;
    setCodSubmitting(true);
    const { error } = await supabase
      .from("rentals")
      .update({
        payment_status: "cod" as any,
        payment_method: "cod",
        status: "confirmed" as any,
      })
      .eq("id", rental.id);
    setCodSubmitting(false);
    if (error) return toast.error(error.message);
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-10 max-w-3xl">
        <h1 className="font-display text-4xl md:text-5xl">Checkout</h1>
        <p className="text-muted-foreground mt-2">Complete payment to confirm your reservation.</p>

        <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-card space-y-5">
          <div className="flex items-center gap-4">
            {product?.images?.[0] && (
              <img src={product.images[0]} alt={product.title} className="h-20 w-20 rounded-xl object-cover bg-petal" />
            )}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Item</p>
              <p className="font-medium">{product?.title ?? "Rental"}</p>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-2 text-sm">
            <Row label="Rental" value={`₹${Number(rental.rental_total).toLocaleString("en-IN")}`} />
            <Row label="Refundable deposit" value={`₹${Number(rental.deposit).toLocaleString("en-IN")}`} muted />
            <Row label="Total payable" value={`₹${Number(rental.grand_total).toLocaleString("en-IN")}`} bold />
          </div>

          {isPaid ? (
            <div className="rounded-xl bg-secondary p-4 text-sm">
              This order has already been paid. <Button variant="link" className="px-1" onClick={() => navigate("/my-rentals")}>View rentals</Button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <Button variant="hero" size="lg" className="w-full" onClick={payWithRazorpay} disabled={paying}>
                {paying ? <><Loader2 className="h-4 w-4 animate-spin" /> Starting…</> : <><CreditCard className="h-4 w-4" /> Proceed to Payment</>}
              </Button>
              <p className="text-xs text-muted-foreground text-center">Cards · UPI · Net banking · Wallets — secured by Razorpay (test mode)</p>

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
            <Shield className="h-3.5 w-3.5" /> Payments are processed securely. Your card details never touch our servers.
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
