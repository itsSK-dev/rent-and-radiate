import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { CheckCircle2, Loader2, Printer } from "lucide-react";

type Receipt = {
  id: string;
  created_at: string;
  start_date: string;
  end_date: string;
  days: number;
  rental_total: number;
  subtotal: number | null;
  discount_amount: number | null;
  gst_amount: number | null;
  delivery_fee: number | null;
  platform_fee: number | null;
  deposit: number;
  grand_total: number;

  status: string;
  payment_status: string;
  payment_method: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  product: { title: string } | null;
  store: { name: string; city: string | null; address: string | null } | null;
};

const Receipt = () => {
  const { rentalId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [r, setR] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = "Receipt · Rent & Radiate"; }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      const { data } = await supabase
        .from("rentals")
        .select("id,created_at,start_date,end_date,days,rental_total,deposit,grand_total,status,payment_status,payment_method,razorpay_order_id,razorpay_payment_id,product:products(title),store:stores(name,city,address)")
        .eq("id", rentalId!)
        .maybeSingle();
      setR(data as any);
      setLoading(false);
    })();
  }, [rentalId, user, authLoading]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="container py-20 text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading receipt…
        </div>
        <Footer />
      </div>
    );
  }

  if (!r) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="container py-20">
          <p className="text-muted-foreground">Receipt not found.</p>
          <Link to="/my-rentals" className="underline">Back to My Rentals</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const isPaid = r.payment_status === "paid";
  const isCOD = r.payment_status === "cod";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-10 max-w-2xl print:py-4">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link to="/my-rentals" className="text-sm text-muted-foreground hover:text-foreground">← Back to rentals</Link>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>

        <div className="rounded-3xl border border-border bg-card p-8 shadow-card space-y-6 print:shadow-none print:border-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-rose-deep">Rent & Radiate</p>
              <h1 className="font-display text-4xl mt-1">Receipt</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Issued {format(new Date(r.created_at), "PPP")}
              </p>
            </div>
            {isPaid && (
              <div className="flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1.5 text-sm">
                <CheckCircle2 className="h-4 w-4" /> Paid
              </div>
            )}
            {isCOD && (
              <div className="rounded-full bg-amber-100 text-amber-700 px-3 py-1.5 text-sm">
                Cash on Delivery
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm border-t border-border pt-5">
            <Field label="Receipt #" value={r.id.slice(0, 8).toUpperCase()} />
            <Field label="Order status" value={r.status} />
            {r.razorpay_order_id && <Field label="Razorpay order" value={r.razorpay_order_id} mono />}
            {r.razorpay_payment_id && <Field label="Payment ID" value={r.razorpay_payment_id} mono />}
            <Field label="Method" value={(r.payment_method ?? "—").toUpperCase()} />
            <Field label="Rental period" value={`${format(new Date(r.start_date), "PP")} – ${format(new Date(r.end_date), "PP")}`} />
          </div>

          <div className="border-t border-border pt-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Item</p>
            <p className="font-medium">{r.product?.title ?? "Rental"}</p>
            {r.store && (
              <p className="text-sm text-muted-foreground">
                {r.store.name}{r.store.city ? ` · ${r.store.city}` : ""}
              </p>
            )}
          </div>

          <div className="border-t border-border pt-5 space-y-2 text-sm">
            <Row label={`Rental (${r.days} day${r.days === 1 ? "" : "s"})`} value={`₹${Number(r.rental_total).toLocaleString("en-IN")}`} />
            <Row label="Refundable deposit" value={`₹${Number(r.deposit).toLocaleString("en-IN")}`} muted />
            <Row label="Total" value={`₹${Number(r.grand_total).toLocaleString("en-IN")}`} bold />
          </div>

          <p className="text-xs text-muted-foreground border-t border-border pt-4">
            {isPaid
              ? "Payment received. Refundable deposit will be returned after item is returned in good condition."
              : isCOD
                ? "Pay the total amount in cash at delivery. Deposit refunded after return in good condition."
                : "This rental has not been paid yet."}
          </p>
        </div>
      </section>
      <Footer />
    </div>
  );
};

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-semibold pt-1 border-t border-border" : ""} ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

export default Receipt;
