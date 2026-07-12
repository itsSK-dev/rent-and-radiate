import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { demoImageMap } from "@/lib/seedDemo";
import { toast } from "sonner";
import { RentalProofPanel, OpenDisputeButton } from "@/components/RentalProofPanel";
import { RentalDisputesList } from "@/components/RentalDisputesList";
import { RentalStatusTimeline } from "@/components/RentalStatusTimeline";
import { OrderTypeBadge } from "@/components/OrderTypeBadge";
import { REFUND_STATUS_LABEL, REFUND_STATUS_TONE } from "@/lib/refundTiers";
import { RentalAdvancedActions } from "@/components/RentalAdvancedActions";
import { DeliveryOTPCard } from "@/components/DeliveryOTPCard";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";


type Rental = {
  id: string;
  kind: "buy" | "rent";
  start_date: string;
  end_date: string;
  days: number;
  rental_total: number;
  deposit: number;
  grand_total: number;
  status: string;
  payment_status: string;
  payment_method: string | null;
  razorpay_payment_id: string | null;
  delivery_method: string;
  qr_token: string;
  product_id: string;
  protection_plan: boolean;
  protection_plan_fee: number;
  late_fee_applied: number;
  late_fee_hours: number;
  product: { title: string; images: string[] } | null;
  store: { name: string; city: string | null } | null;
};


const statusTone: Record<string, string> = {
  pending: "bg-secondary text-foreground",
  confirmed: "bg-primary-soft text-rose-deep",
  delivered: "bg-blossom text-rose-deep",
  returned: "bg-gold/20 text-rose-deep",
  cancelled: "bg-destructive/10 text-destructive",
};

const paymentTone: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cod: "bg-amber-100 text-amber-700 border-amber-200",
  unpaid: "bg-rose-100 text-rose-700 border-rose-200",
  refunded: "bg-sky-100 text-sky-700 border-sky-200",
  partial_refund: "bg-sky-100 text-sky-700 border-sky-200",
};

const paymentLabel: Record<string, string> = {
  paid: "Paid",
  cod: "Cash on Delivery",
  unpaid: "Pending payment",
  refunded: "Refunded",
  partial_refund: "Partial refund",
};

type RefundRow = { id: string; rental_id: string; status: string; refund_amount: number; refund_percent: number; condition_tier: string; inspection_notes: string | null };

const MyRentals = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { settings } = usePlatformSettings();
  const [rentals, setRentals] = useState<Rental[]>([]);

  useEffect(() => { document.title = "My rentals · Rent & Radiate"; }, []);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      toast.info("Please sign in to view your order history.");
      navigate("/auth?next=/my-rentals");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("rentals")
        .select("id,kind,start_date,end_date,days,rental_total,deposit,grand_total,status,payment_status,payment_method,razorpay_payment_id,delivery_method,product_id,protection_plan,protection_plan_fee,late_fee_applied,late_fee_hours,product:products(title,images),store:stores(name,city)")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });
      const rows = ((data as any) ?? []) as Rental[];
      // qr_token is no longer directly selectable; fetch via security-definer RPC
      // so store-owner SELECT policies can't leak handoff tokens.
      const withTokens = await Promise.all(rows.map(async (r) => {
        const { data: tok } = await (supabase.rpc as any)("get_rental_qr_token", { _rental_id: r.id });
        return { ...r, qr_token: (tok as string) ?? "" };
      }));
      setRentals(withTokens);
      const { data: rf } = await (supabase.from as any)("deposit_refunds")
        .select("id,rental_id,status,refund_amount,refund_percent,condition_tier,inspection_notes")
        .eq("customer_id", user.id);
      setRefunds((rf as any) ?? []);
    })();
  }, [user]);


  async function cancel(id: string) {
    const { error } = await supabase.from("rentals").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Rental cancelled");
    setRentals((r) => r.map((x) => x.id === id ? { ...x, status: "cancelled" } : x));
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-12">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Your closet</p>
          <h1 className="font-display text-5xl">My rentals</h1>
        </div>

        {rentals.length === 0 ? (
          <div className="rounded-3xl bg-gradient-blossom p-12 text-center">
            <h2 className="font-display text-3xl mb-2">Nothing rented yet</h2>
            <p className="text-muted-foreground mb-6">Find something beautiful for your next moment.</p>
            <Link to="/browse"><Button variant="hero">Start browsing</Button></Link>
          </div>
        ) : (
          <div className="space-y-4">
            {rentals.map((r) => {
              const img = r.product?.images?.[0] || demoImageMap[r.product?.title ?? ""];
              const refund = refunds.find((x) => x.rental_id === r.id);
              return (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-5 flex flex-col md:flex-row gap-5 shadow-card">
                  <div className="w-full md:w-32 aspect-[4/5] md:aspect-square rounded-xl overflow-hidden bg-petal shrink-0">
                    {img && <img src={img} alt={r.product?.title} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1.5">
                        <OrderTypeBadge kind={r.kind} size="sm" />
                        <h3 className="font-display text-2xl">{r.product?.title}</h3>
                        <p className="text-sm text-muted-foreground">{r.store?.name}{r.store?.city ? ` · ${r.store.city}` : ""}</p>
                      </div>
                      <Badge className={statusTone[r.status] ?? ""}>{r.status}</Badge>
                    </div>
                    {r.kind === "rent" ? (
                      <p className="text-sm text-muted-foreground">
                        <strong className="text-foreground">Rental:</strong> {format(new Date(r.start_date), "PP")} – {format(new Date(r.end_date), "PP")} · {r.days} day{r.days === 1 ? "" : "s"} · Return due <strong className="text-rose-deep">{format(new Date(r.end_date), "PP")}</strong> · {r.delivery_method}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Purchase · No return required · {r.delivery_method}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm pt-1">
                      <span>Rental: <strong>₹{Number(r.rental_total).toLocaleString("en-IN")}</strong></span>
                      <span>Deposit: <strong>₹{Number(r.deposit).toLocaleString("en-IN")}</strong></span>
                      <span>Total: <strong>₹{Number(r.grand_total).toLocaleString("en-IN")}</strong></span>
                    </div>

                    {/* Payment status section */}
                    <div className={`mt-2 rounded-xl border p-3 ${paymentTone[r.payment_status] ?? "bg-secondary border-border"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs uppercase tracking-wider opacity-70">Payment</span>
                          <span className="font-medium">{paymentLabel[r.payment_status] ?? r.payment_status}</span>
                          {r.payment_method && r.payment_status !== "unpaid" && (
                            <span className="text-xs opacity-75">· {r.payment_method.toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {r.payment_status === "unpaid" && r.status !== "cancelled" && (
                            <Link to={`/checkout/${r.id}`}>
                              <Button variant="hero" size="sm">Pay now</Button>
                            </Link>
                          )}
                          {(r.payment_status === "paid" || r.payment_status === "cod") && (
                            <Link to={`/receipt/${r.id}`} className="text-sm underline underline-offset-4 hover:no-underline">
                              View receipt
                            </Link>
                          )}
                        </div>
                      </div>
                      {r.razorpay_payment_id && (
                        <p className="mt-1.5 text-xs font-mono opacity-80 break-all">
                          ID: {r.razorpay_payment_id}
                        </p>
                      )}
                    </div>

                    {refund && (
                      <div className={`rounded-xl border p-3 ${REFUND_STATUS_TONE[refund.status]}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase tracking-wider opacity-70">Deposit refund</span>
                            <span className="font-medium">{REFUND_STATUS_LABEL[refund.status]}</span>
                          </div>
                          <span className="text-sm font-medium">
                            ₹{Number(refund.refund_amount).toLocaleString("en-IN")} <span className="opacity-70">({refund.refund_percent}%)</span>
                          </span>
                        </div>
                        <p className="mt-1 text-xs opacity-80 capitalize">Condition: {refund.condition_tier}</p>
                        {refund.inspection_notes && (
                          <p className="mt-1 text-xs opacity-80 whitespace-pre-wrap">"{refund.inspection_notes}"</p>
                        )}
                      </div>
                    )}

                    {(r.protection_plan || Number(r.late_fee_applied) > 0) && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {r.protection_plan && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">🛡 Protection plan · ₹{Number(r.protection_plan_fee).toLocaleString("en-IN")}</Badge>}
                        {Number(r.late_fee_applied) > 0 && <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline">⏱ Late fee · ₹{Number(r.late_fee_applied).toLocaleString("en-IN")} ({r.late_fee_hours}h late)</Badge>}
                      </div>
                    )}

                    <div className="pt-2 flex flex-wrap gap-2">
                      <Link to={`/track/${r.id}`}>
                        <Button variant="outline" size="sm">Track order</Button>
                      </Link>
                      {r.status === "pending" && (
                        <Button variant="ghost" size="sm" onClick={() => cancel(r.id)}>Cancel</Button>
                      )}
                      {r.status === "delivered" && (
                        <p className="text-xs text-muted-foreground w-full">
                          Upload at least one <strong>after-return</strong> photo before the store can close this rental.
                        </p>
                      )}
                    </div>

                    {["assigned", "picked_up", "out_for_delivery"].includes(r.status) && (
                      <DeliveryOTPCard rentalId={r.id} kind="delivery" />
                    )}
                    {r.kind === "rent" && ["return_scheduled", "return_picked_up"].includes(r.status) && (
                      <DeliveryOTPCard rentalId={r.id} kind="return" />
                    )}

                    <RentalAdvancedActions
                      rental={{
                        id: r.id,
                        qr_token: r.qr_token,
                        kind: r.kind,
                        status: r.status,
                        end_date: r.end_date,
                        start_date: r.start_date,
                        product_id: r.product_id,
                        rental_total: r.rental_total,
                      }}
                      rentToOwnEnabled={settings.rent_to_own_enabled}
                      rentToOwnCreditPercent={settings.rent_to_own_credit_percent}
                    />

                    <div className="pt-2 border-t border-border">
                      <RentalStatusTimeline
                        rentalId={r.id}
                        currentStatus={r.status}
                        customerId={user?.id}
                      />
                    </div>
                    {(r.status === "delivered" || r.status === "returned") && (
                      <div className="pt-3 border-t border-border space-y-3">
                        <RentalProofPanel rentalId={r.id} role="customer" stages={["after_return"]} />
                        <RentalDisputesList rentalId={r.id} />
                        <div className="flex justify-end">
                          <OpenDisputeButton rentalId={r.id} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
};

export default MyRentals;
