import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VendorVerificationCard } from "@/components/vendor/VendorVerificationCard";
import { BadgeCheck, Clock, X, ArrowLeft, History } from "lucide-react";
import { format } from "date-fns";

type Store = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  logo_url: string | null;
  status: "pending" | "approved" | "rejected" | "deleted";
  is_verified: boolean;
  is_active: boolean;
  is_blocked: boolean;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

type AuditEntry = {
  id: string;
  action: string;
  summary: string | null;
  created_at: string;
  metadata: any;
};

export default function VendorVerification() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [fetching, setFetching] = useState(true);

  async function load() {
    if (!user) return;
    setFetching(true);
    const { data: s } = await supabase
      .from("stores")
      .select("id,name,city,address,logo_url,status,is_verified,is_active,is_blocked,rejection_reason,created_at,updated_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setStore((s as any) ?? null);
    if (s?.id) {
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", s.id);
      setProductCount(count ?? 0);

      const { data: log } = await (supabase as any)
        .from("admin_audit_log")
        .select("id,action,summary,created_at,metadata")
        .eq("entity_type", "store")
        .eq("entity_id", s.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setHistory((log as any) ?? []);
    }
    setFetching(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  if (!loading && !user) {
    navigate("/auth");
    return null;
  }

  const isApproved = !!store && store.status === "approved" && store.is_verified;
  const isRejected = store?.status === "rejected";
  const isPending = !store || store.status === "pending";

  const statusMeta = isApproved
    ? { label: "Approved", icon: BadgeCheck, tone: "bg-emerald-100 text-emerald-700 border-emerald-200" }
    : isRejected
    ? { label: "Rejected", icon: X, tone: "bg-rose-100 text-rose-700 border-rose-200" }
    : { label: "Pending review", icon: Clock, tone: "bg-amber-100 text-amber-700 border-amber-200" };
  const StatusIcon = statusMeta.icon;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-12 max-w-3xl">
        <Link to="/vendor" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Seller verification</p>
          <h1 className="font-display text-4xl md:text-5xl">Application status</h1>
          <p className="text-muted-foreground mt-2">
            Track your seller application progress, see admin feedback, and resubmit if needed.
          </p>
        </div>

        {fetching ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            Loading your application…
          </div>
        ) : !store ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-card">
            <h2 className="font-display text-2xl mb-2">No application yet</h2>
            <p className="text-muted-foreground mb-5">Open your boutique to start the verification process.</p>
            <Link to="/become-vendor">
              <Button variant="hero">Apply to sell</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className={`rounded-3xl border ${statusMeta.tone} p-6 mb-6 flex items-start gap-4 flex-wrap`}>
              <div className="h-14 w-14 rounded-2xl bg-white/70 grid place-items-center">
                <StatusIcon className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="text-xs uppercase tracking-[0.18em] opacity-80">Current status</p>
                <h2 className="font-display text-2xl">{statusMeta.label}</h2>
                <p className="text-sm opacity-90 mt-1">
                  {isApproved && "Your shop is live and customers see a Verified badge on every product."}
                  {isRejected && "An admin requested changes. Address the feedback below and resubmit when ready."}
                  {isPending && "An admin is reviewing your application. This typically takes under 24 hours."}
                </p>
              </div>
              <Badge variant="outline" className="bg-white/70 border-transparent">
                Updated {format(new Date(store.updated_at), "dd MMM yyyy, HH:mm")}
              </Badge>
            </div>

            <VendorVerificationCard
              store={store as any}
              rejectionReason={store.rejection_reason}
              productCount={productCount}
              hasPayment={true}
              onChanged={load}
            />

            <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <History className="h-4 w-4 text-rose-deep" />
                <h3 className="font-display text-xl">Application history</h3>
              </div>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Submitted on {format(new Date(store.created_at), "dd MMM yyyy")}. No admin actions yet.
                </p>
              ) : (
                <ol className="space-y-3">
                  {history.map((h) => (
                    <li key={h.id} className="flex gap-3 text-sm border-l-2 border-border pl-3 py-1">
                      <div className="flex-1">
                        <p className="font-medium">{h.summary ?? h.action.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(h.created_at), "dd MMM yyyy, HH:mm")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </section>
      <Footer />
    </div>
  );
}
