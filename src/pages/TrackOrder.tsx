import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, differenceInCalendarDays } from "date-fns";
import { RentalStatusTimeline } from "@/components/RentalStatusTimeline";
import {
  CheckCircle2, Package, Truck, Home, ClipboardCheck, XCircle, Clock, ShieldCheck, MapPin, CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RequestExtensionDialog,
  InitiateReturnDialog,
  CustomerReturnPanel,
  CustomerExtensionList,
} from "@/components/DeliveryTracking";

type Rental = {
  id: string;
  kind: string;
  status: string;
  payment_status: string;
  delivery_method: string;
  delivery_stage: string | null;
  delivery_partner: string | null;
  tracking_number: string | null;
  expected_delivery_date: string | null;
  actual_delivered_at: string | null;
  return_initiated_at: string | null;
  returned_at: string | null;
  start_date: string | null;
  end_date: string | null;
  days: number | null;
  quantity: number;
  grand_total: number;
  deposit: number;
  refund_amount: number | null;
  address: string | null;
  customer_id: string;
  store_id: string;
  product: { title: string; images: string[] } | null;
  store: { name: string; city: string | null; owner_id: string } | null;
};

const RENT_STEPS = [
  { key: "placed", label: "Order placed", Icon: ClipboardCheck },
  { key: "paid", label: "Payment confirmed", Icon: ShieldCheck },
  { key: "accepted", label: "Accepted by store", Icon: Package },
  { key: "packed", label: "Packed", Icon: Package },
  { key: "out_for_delivery", label: "Out for delivery", Icon: Truck },
  { key: "delivered", label: "Delivered", Icon: Home },
] as const;

function computeStep(r: Rental): number {
  if (r.status === "delivered" || r.status === "returned" || r.delivery_stage === "delivered" || r.actual_delivered_at) return 5;
  if (r.delivery_stage === "out_for_delivery") return 4;
  if (r.delivery_stage === "packed") return 3;
  if (r.delivery_stage === "accepted" || r.status === "confirmed") return 2;
  if (r.payment_status === "paid") return 1;
  return 0;
}

const TrackOrder = () => {
  const { rentalId } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rental, setRental] = useState<Rental | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => { document.title = "Track order · Rent & Radiate"; }, []);
  useEffect(() => { if (!loading && !user) navigate(`/auth?next=/track/${rentalId}`); }, [user, loading, rentalId, navigate]);

  useEffect(() => {
    if (!user || !rentalId) return;
    let active = true;
    (async () => {
      setFetching(true);
      const { data } = await supabase
        .from("rentals")
        .select("id,kind,status,payment_status,delivery_method,delivery_stage,delivery_partner,tracking_number,expected_delivery_date,actual_delivered_at,return_initiated_at,returned_at,start_date,end_date,days,quantity,grand_total,deposit,refund_amount,address,customer_id,store_id,product:products(title,images),store:stores(name,city,owner_id)")
        .eq("id", rentalId)
        .maybeSingle();
      if (!active) return;
      setRental((data as any) ?? null);
      setFetching(false);
    })();

    const channel = supabase
      .channel(`rental-${rentalId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rentals", filter: `id=eq.${rentalId}` },
        (payload) => setRental((prev) => (prev ? { ...prev, ...(payload.new as any) } : prev)))
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
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
  const cancelled = rental.status === "cancelled";
  const currentIdx = computeStep(rental);
  const img = rental.product?.images?.[0];

  // Rental-specific computed
  const daysRemaining = rental.end_date ? differenceInCalendarDays(new Date(rental.end_date), new Date()) : null;
  const overdue = !isBuy && daysRemaining !== null && daysRemaining < 0 && !["returned", "cancelled"].includes(rental.status);
  const canReturn = !isBuy && (rental.status === "delivered" || rental.delivery_stage === "delivered") && rental.status !== "returned" && !rental.return_initiated_at;
  const canExtend = !isBuy && !["returned", "cancelled"].includes(rental.status) && rental.end_date;

  const depositStatus =
    rental.refund_amount != null && Number(rental.refund_amount) >= Number(rental.deposit) ? "Refunded"
    : rental.refund_amount != null && Number(rental.refund_amount) > 0 ? "Partial refund"
    : rental.status === "returned" ? "Awaiting inspection"
    : "Held";

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
        <div className="rounded-2xl border border-border bg-card p-5 flex gap-4 shadow-card mb-6">
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
                <span>{format(new Date(rental.start_date), "PP")} – {format(new Date(rental.end_date), "PP")} · {rental.days}d · </span>
              )}
              <span className="capitalize">{rental.delivery_method}</span> · Qty {rental.quantity} ·
              Total <strong className="text-foreground"> ₹{Number(rental.grand_total).toLocaleString("en-IN")}</strong>
            </div>
            {rental.address && rental.delivery_method === "delivery" && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2"><MapPin className="h-3 w-3 inline mr-1" />{rental.address}</p>
            )}
          </div>
        </div>

        {/* Delivery details card */}
        {(rental.delivery_partner || rental.tracking_number || rental.expected_delivery_date || rental.actual_delivered_at) && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card mb-6 grid sm:grid-cols-2 gap-3 text-sm">
            {rental.delivery_partner && <div><span className="text-muted-foreground">Partner: </span><strong>{rental.delivery_partner}</strong></div>}
            {rental.tracking_number && <div><span className="text-muted-foreground">Tracking #: </span><span className="font-mono">{rental.tracking_number}</span></div>}
            {rental.expected_delivery_date && <div><span className="text-muted-foreground">Expected: </span>{format(new Date(rental.expected_delivery_date), "PP")}</div>}
            {rental.actual_delivered_at && <div><span className="text-muted-foreground">Delivered: </span>{format(new Date(rental.actual_delivered_at), "PPp")}</div>}
          </div>
        )}

        {/* Step progress */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card mb-6">
          <h3 className="font-display text-xl mb-6">{isBuy ? "Delivery progress" : "Order progress"}</h3>
          {cancelled ? (
            <div className="flex items-center gap-3 rounded-xl bg-destructive/5 border border-destructive/30 p-4">
              <XCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm">This order was cancelled.</p>
            </div>
          ) : (
            <ol className="space-y-3 md:space-y-0 md:grid md:grid-cols-6 md:gap-1 relative">
              {RENT_STEPS.map((s, i) => {
                const done = i < currentIdx;
                const active = i === currentIdx;
                const Icon = s.Icon;
                return (
                  <li key={s.key} className="flex md:flex-col items-center md:text-center gap-2">
                    <span className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border-2 shrink-0",
                      done && "bg-rose-deep border-rose-deep text-primary-foreground",
                      active && "border-rose-deep text-rose-deep",
                      !done && !active && "border-border text-muted-foreground"
                    )}>
                      {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <p className={cn("text-xs font-medium", active && "text-rose-deep", !done && !active && "text-muted-foreground")}>
                      {s.label}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Rental-specific info */}
        {!isBuy && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card mb-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-display text-xl flex items-center gap-2"><CalendarClock className="h-5 w-5 text-rose-deep" /> Rental details</h3>
              {overdue && <Badge className="bg-destructive/10 text-destructive">Overdue</Badge>}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Start: </span>{rental.start_date ? format(new Date(rental.start_date), "PP") : "—"}</div>
              <div><span className="text-muted-foreground">End: </span>{rental.end_date ? format(new Date(rental.end_date), "PP") : "—"}</div>
              <div><span className="text-muted-foreground">Days remaining: </span><strong>{daysRemaining ?? "—"}</strong></div>
              <div><span className="text-muted-foreground">Deposit ₹{Number(rental.deposit).toLocaleString("en-IN")}: </span><strong>{depositStatus}</strong></div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {canExtend && <RequestExtensionDialog rental={rental as any} />}
              {canReturn && <InitiateReturnDialog rental={rental as any} />}
            </div>
            <CustomerExtensionList rentalId={rental.id} />
          </div>
        )}

        {/* Return tracking */}
        {!isBuy && <CustomerReturnPanel rentalId={rental.id} />}

        {/* Detailed timeline */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card mt-6">
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
