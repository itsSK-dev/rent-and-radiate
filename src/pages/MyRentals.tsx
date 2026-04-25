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
import { RentalStatusTimeline } from "@/components/RentalStatusTimeline";

type Rental = {
  id: string;
  start_date: string;
  end_date: string;
  days: number;
  rental_total: number;
  deposit: number;
  grand_total: number;
  status: string;
  payment_status: string;
  delivery_method: string;
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

const MyRentals = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rentals, setRentals] = useState<Rental[]>([]);

  useEffect(() => { document.title = "My rentals · Bloom"; }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/my-rentals");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("rentals")
        .select("id,start_date,end_date,days,rental_total,deposit,grand_total,status,payment_status,delivery_method,product:products(title,images),store:stores(name,city)")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });
      setRentals((data as any) ?? []);
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
              return (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-5 flex flex-col md:flex-row gap-5 shadow-card">
                  <div className="w-full md:w-32 aspect-[4/5] md:aspect-square rounded-xl overflow-hidden bg-petal shrink-0">
                    {img && <img src={img} alt={r.product?.title} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display text-2xl">{r.product?.title}</h3>
                        <p className="text-sm text-muted-foreground">{r.store?.name}{r.store?.city ? ` · ${r.store.city}` : ""}</p>
                      </div>
                      <Badge className={statusTone[r.status] ?? ""}>{r.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(r.start_date), "PP")} – {format(new Date(r.end_date), "PP")} · {r.days} day{r.days === 1 ? "" : "s"} · {r.delivery_method}
                    </p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm pt-1">
                      <span>Rental: <strong>₹{Number(r.rental_total).toLocaleString("en-IN")}</strong></span>
                      <span>Deposit: <strong>₹{Number(r.deposit).toLocaleString("en-IN")}</strong></span>
                      <span>Total: <strong>₹{Number(r.grand_total).toLocaleString("en-IN")}</strong></span>
                      <span className="text-muted-foreground">Payment: {r.payment_status}</span>
                    </div>
                    <div className="pt-2 flex flex-wrap gap-2">
                      {r.status === "pending" && (
                        <Button variant="ghost" size="sm" onClick={() => cancel(r.id)}>Cancel</Button>
                      )}
                      {r.status === "delivered" && (
                        <p className="text-xs text-muted-foreground w-full">
                          Upload at least one <strong>after-return</strong> photo before the store can close this rental.
                        </p>
                      )}
                    </div>
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
