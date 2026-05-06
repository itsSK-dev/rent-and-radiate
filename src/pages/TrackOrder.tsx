import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { RentalStatusTimeline } from "@/components/RentalStatusTimeline";
import {
  CheckCircle2,
  Circle,
  Package,
  Truck,
  Home,
  ClipboardCheck,
  XCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Rental = {
  id: string;
  kind: string;
  status: string;
  payment_status: string;
  delivery_method: string;
  start_date: string | null;
  end_date: string | null;
  days: number | null;
  quantity: number;
  grand_total: number;
  address: string | null;
  customer_id: string;
  store_id: string;
  product: { title: string; images: string[] } | null;
  store: { name: string; city: string | null; owner_id: string } | null;
};

const RENT_STEPS = [
  { key: "pending", label: "Order placed", Icon: ClipboardCheck },
  { key: "confirmed", label: "Confirmed by store", Icon: Package },
  { key: "delivered", label: "Delivered to you", Icon: Truck },
  { key: "returned", label: "Returned & closed", Icon: Home },
] as const;

const BUY_STEPS = [
  { key: "pending", label: "Order placed", Icon: ClipboardCheck },
  { key: "confirmed", label: "Confirmed by store", Icon: Package },
  { key: "delivered", label: "Delivered", Icon: Truck },
] as const;

function stepIndex(status: string, steps: readonly { key: string }[]) {
  const i = steps.findIndex((s) => s.key === status);
  if (i >= 0) return i;
  // returned counts as past delivered
  if (status === "returned") return steps.length - 1;
  return 0;
}

const TrackOrder = () => {
  const { rentalId } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rental, setRental] = useState<Rental | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    document.title = "Track order · Bloom";
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate(`/auth?next=/track/${rentalId}`);
  }, [user, loading, rentalId, navigate]);

  useEffect(() => {
    if (!user || !rentalId) return;
    let active = true;
    (async () => {
      setFetching(true);
      const { data } = await supabase
        .from("rentals")
        .select(
          "id,kind,status,payment_status,delivery_method,start_date,end_date,days,quantity,grand_total,address,customer_id,store_id,product:products(title,images),store:stores(name,city,owner_id)"
        )
        .eq("id", rentalId)
        .maybeSingle();
      if (!active) return;
      setRental((data as any) ?? null);
      setFetching(false);
    })();

    const channel = supabase
      .channel(`rental-${rentalId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rentals", filter: `id=eq.${rentalId}` },
        (payload) => {
          setRental((prev) => (prev ? { ...prev, ...(payload.new as any) } : prev));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user, rentalId]);

  if (fetching || loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <section className="container py-16 text-center text-muted-foreground">Loading order…</section>
        <Footer />
      </div>
    );
  }

  if (!rental) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <section className="container py-16 text-center">
          <h1 className="font-display text-3xl mb-2">Order not found</h1>
          <p className="text-muted-foreground mb-6">It may have been removed or you don't have access.</p>
          <Link to="/my-rentals"><Button variant="hero">Back to my orders</Button></Link>
        </section>
        <Footer />
      </div>
    );
  }

  const isBuy = rental.kind === "buy";
  const steps = isBuy ? BUY_STEPS : RENT_STEPS;
  const cancelled = rental.status === "cancelled";
  const currentIdx = stepIndex(rental.status, steps);
  const img = rental.product?.images?.[0];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-10 max-w-4xl">
        <div className="mb-6">
          <Link to="/my-rentals" className="text-xs uppercase tracking-[0.2em] text-rose-deep hover:underline">
            ← Back to my orders
          </Link>
          <h1 className="font-display text-4xl mt-2">Track your {isBuy ? "purchase" : "rental"}</h1>
          <p className="text-sm text-muted-foreground mt-1">Order ID: <span className="font-mono">{rental.id.slice(0, 8)}</span></p>
        </div>

        {/* Order summary */}
        <div className="rounded-2xl border border-border bg-card p-5 flex gap-4 shadow-card mb-8">
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-petal shrink-0">
            {img && <img src={img} alt={rental.product?.title} className="w-full h-full object-cover" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-2xl truncate">{rental.product?.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {rental.store?.name}{rental.store?.city ? ` · ${rental.store.city}` : ""}
                </p>
              </div>
              <Badge className={cancelled ? "bg-destructive/10 text-destructive" : "bg-primary-soft text-rose-deep"}>
                {rental.status}
              </Badge>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {!isBuy && rental.start_date && rental.end_date && (
                <span>
                  {format(new Date(rental.start_date), "PP")} – {format(new Date(rental.end_date), "PP")} · {rental.days} day{rental.days === 1 ? "" : "s"} ·{" "}
                </span>
              )}
              <span className="capitalize">{rental.delivery_method}</span> · Qty {rental.quantity} · Total <strong className="text-foreground">₹{Number(rental.grand_total).toLocaleString("en-IN")}</strong>
            </div>
            {rental.address && rental.delivery_method === "delivery" && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">Ship to: {rental.address}</p>
            )}
          </div>
        </div>

        {/* Step progress */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card mb-8">
          <h3 className="font-display text-xl mb-6">{isBuy ? "Delivery progress" : "Rental progress"}</h3>

          {cancelled ? (
            <div className="flex items-center gap-3 rounded-xl bg-destructive/5 border border-destructive/30 p-4">
              <XCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm">This order was cancelled.</p>
            </div>
          ) : (
            <ol className="relative">
              {/* desktop: horizontal */}
              <div className="hidden md:flex items-start justify-between gap-2 relative">
                <div className="absolute left-0 right-0 top-5 h-0.5 bg-border -z-0" aria-hidden />
                <div
                  className="absolute left-0 top-5 h-0.5 bg-rose-deep -z-0 transition-all"
                  style={{ width: `${(currentIdx / (steps.length - 1)) * 100}%` }}
                  aria-hidden
                />
                {steps.map((s, i) => {
                  const done = i < currentIdx;
                  const active = i === currentIdx;
                  const Icon = s.Icon;
                  return (
                    <li key={s.key} className="relative z-10 flex flex-col items-center text-center w-1/4">
                      <span
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full border-2 bg-card",
                          done && "bg-rose-deep border-rose-deep text-primary-foreground",
                          active && "border-rose-deep text-rose-deep",
                          !done && !active && "border-border text-muted-foreground"
                        )}
                      >
                        {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                      </span>
                      <p className={cn("mt-2 text-xs font-medium", active && "text-rose-deep", !done && !active && "text-muted-foreground")}>
                        {s.label}
                      </p>
                    </li>
                  );
                })}
              </div>

              {/* mobile: vertical */}
              <ol className="md:hidden space-y-4">
                {steps.map((s, i) => {
                  const done = i < currentIdx;
                  const active = i === currentIdx;
                  const Icon = s.Icon;
                  return (
                    <li key={s.key} className="flex items-start gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full border-2 shrink-0",
                          done && "bg-rose-deep border-rose-deep text-primary-foreground",
                          active && "border-rose-deep text-rose-deep",
                          !done && !active && "border-border text-muted-foreground"
                        )}
                      >
                        {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </span>
                      <div className="pt-1.5">
                        <p className={cn("text-sm font-medium", active && "text-rose-deep", !done && !active && "text-muted-foreground")}>
                          {s.label}
                        </p>
                        {active && <p className="text-xs text-muted-foreground">Current step</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </ol>
          )}
        </div>

        {/* Detailed timeline */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-rose-deep" />
            <h3 className="font-display text-xl">Detailed history</h3>
          </div>
          <RentalStatusTimeline
            rentalId={rental.id}
            currentStatus={rental.status}
            customerId={rental.customer_id}
            storeOwnerId={rental.store?.owner_id}
          />
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default TrackOrder;
