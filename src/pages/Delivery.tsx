import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Phone, MapPin, Navigation, Package } from "lucide-react";
import { format } from "date-fns";
import { inr } from "@/lib/pricing";
import { DeliveryProofUpload } from "@/components/DeliveryProofUpload";
import { addressFromRental, addressLines, formatAddress, isAddressComplete } from "@/lib/address";

type Assignment = {
  id: string; rental_id: string; partner_id: string; status: string;
  created_at: string;
  rental: {
    id: string; kind: string; status: string; address: string | null; grand_total: number;
    ship_full_name?: string | null; ship_mobile?: string | null; ship_house?: string | null;
    ship_street?: string | null; ship_landmark?: string | null; ship_city?: string | null;
    ship_state?: string | null; ship_pin?: string | null; ship_instructions?: string | null;
    start_date: string | null; end_date: string | null;
    customer: { full_name: string | null; phone?: string | null } | null;
    product: { title: string; images: string[] | null } | null;
    store: { name: string; address: string | null; city: string | null; owner: { phone?: string | null; full_name: string | null } | null } | null;
  } | null;
};

type EarningRow = { amount: number; status: string; created_at: string };

export default function Delivery() {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<any>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [earningRows, setEarningRows] = useState<EarningRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { document.title = "Delivery Dashboard · Rent & Radiate"; }, []);
  useEffect(() => {
    if (!loading && !user) navigate("/auth?intent=delivery_partner&next=/delivery");
  }, [user, loading, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    const { data: dp, error: dpErr } = await supabase
      .from("delivery_partners").select("*").eq("user_id", user.id).maybeSingle();
    if (dpErr) { setError(dpErr.message); setBusy(false); return; }
    if (!dp) { navigate("/delivery/register"); return; }
    setPartner(dp);
    if (dp.status !== "approved") { setBusy(false); return; }

    const { data, error: aErr } = await supabase.from("delivery_assignments")
      .select(`id, rental_id, partner_id, status, created_at,
        rental:rentals(id, kind, status, address, grand_total, start_date, end_date,
         ship_full_name, ship_mobile, ship_house, ship_street, ship_landmark,
         ship_city, ship_state, ship_pin, ship_instructions,
          customer:profiles!rentals_customer_profiles_fkey(full_name),
          product:products(title, images),
          store:stores(name, address, city))`)
      .eq("partner_id", dp.id).order("created_at", { ascending: false }).limit(200);
    if (aErr) { setError(aErr.message); setBusy(false); return; }
    setAssignments((data as any) ?? []);

    const { data: e, error: eErr } = await supabase
      .from("delivery_earnings").select("amount, status, created_at").eq("partner_id", dp.id);
    if (eErr) { setError(eErr.message); setBusy(false); return; }
    setEarningRows(((e ?? []) as any[]).map((r) => ({ amount: Number(r.amount), status: r.status, created_at: r.created_at })));
    setBusy(false);
  }, [user, navigate]);

  useEffect(() => { load(); }, [load]);

  // Realtime for new broadcasts / status updates
  useEffect(() => {
    if (!partner?.id) return;
    const ch = supabase.channel(`dp-${partner.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_assignments", filter: `partner_id=eq.${partner.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [partner?.id, load]);

  const earnings = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfDay - now.getDay() * 86400000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const sum = (from: number) => earningRows
      .filter((r) => new Date(r.created_at).getTime() >= from)
      .reduce((s, r) => s + r.amount, 0);
    return {
      total: earningRows.reduce((s, r) => s + r.amount, 0),
      count: earningRows.length,
      today: sum(startOfDay),
      week: sum(startOfWeek),
      month: sum(startOfMonth),
      pending: earningRows.filter((r) => r.status !== "paid").reduce((s, r) => s + r.amount, 0),
    };
  }, [earningRows]);

  async function toggleOnline(v: boolean) {
    if (!partner) return;
    const { error } = await supabase.from("delivery_partners").update({ is_online: v }).eq("id", partner.id);
    if (error) return toast.error(error.message);
    setPartner((p: any) => ({ ...p, is_online: v }));
  }

  /** Every status change is a real, status-guarded database update. */
  async function setStatus(a: Assignment, next: string, from: string, okMsg: string) {
    const { data, error } = await supabase.from("delivery_assignments")
      .update({ status: next as any }).eq("id", a.id).eq("status", from as any).select("id");
    if (error) return toast.error(error.message);
    if (!data || data.length === 0) { toast.error("This delivery already moved on — refreshing."); load(); return; }
    toast.success(okMsg);
    load();
  }

  const respond = (a: Assignment, accept: boolean) =>
    setStatus(a, accept ? "accepted" : "rejected", "broadcast", accept ? "Delivery accepted" : "Rejected");
  const markPickedUp = (a: Assignment) => setStatus(a, "picked_up", "accepted", "Marked picked up");
  const markDelivered = (a: Assignment) => setStatus(a, "delivered", "picked_up", "Delivery completed");
  const markReturnedToStore = (a: Assignment) => setStatus(a, "returned_to_store", "return_picked_up", "Handed back to store");

  if (loading || (busy && !partner)) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <section className="container flex-1 py-20 text-center text-sm text-muted-foreground">Loading deliveries…</section>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <section className="container flex-1 py-20 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Unable to load deliveries.</p>
          <p className="text-xs text-destructive">{error}</p>
          <Button variant="hero" onClick={() => load()}>Retry</Button>
        </section>
        <Footer />
      </div>
    );
  }

  if (!partner) return null;

  if (partner.status !== "approved") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <section className="container flex-1 py-16 text-center">
          <h1 className="font-display text-3xl mb-2">Awaiting approval</h1>
          <p className="text-muted-foreground text-sm">Your application status: <Badge>{partner.status}</Badge></p>
          {partner.status === "rejected" && partner.rejection_reason && (
            <p className="text-xs text-destructive mt-2">{partner.rejection_reason}</p>
          )}
        </section>
        <Footer />
      </div>
    );
  }

  const available = assignments.filter((a) => a.status === "broadcast");
  const assigned = assignments.filter((a) => a.status === "accepted");
  const active = assignments.filter((a) => ["picked_up", "out_for_delivery"].includes(a.status));
  const returns = assignments.filter((a) => ["return_scheduled", "return_picked_up"].includes(a.status));
  const history = assignments.filter((a) => ["delivered", "returned_to_store", "cancelled", "rejected"].includes(a.status));
  const defaultTab = available.length ? "available" : assigned.length ? "assigned" : active.length ? "active" : "available";


  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-1">Delivery Partner</p>
            <h1 className="font-display text-4xl">Hi, {partner.full_name.split(" ")[0]}</h1>
            <p className="text-muted-foreground text-sm">{partner.city} · {partner.vehicle_type}</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-card border border-border px-4 py-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</p>
              <p className="font-medium">{partner.is_online ? "Online" : "Offline"}</p>
            </div>
            <Switch checked={partner.is_online} onCheckedChange={toggleOnline} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Stat label="Available" value={available.length} />
          <Stat label="Active" value={assigned.length + active.length} />
          <Stat label="Deliveries" value={earnings.count} />
          <Stat label="Earnings" value={inr(earnings.total)} />
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="available">Available <Badge className="ml-1">{available.length}</Badge></TabsTrigger>
            <TabsTrigger value="assigned">Assigned <Badge className="ml-1">{assigned.length}</Badge></TabsTrigger>
            <TabsTrigger value="active">Active <Badge className="ml-1">{active.length}</Badge></TabsTrigger>
            <TabsTrigger value="returns">Returns <Badge className="ml-1">{returns.length}</Badge></TabsTrigger>
            <TabsTrigger value="history">History <Badge className="ml-1">{history.length}</Badge></TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="mt-4 space-y-3">
            {available.length === 0 ? <Empty msg={partner.is_online ? "No deliveries available right now." : "Go online to receive new deliveries."} /> :
              available.map((a) => <AssignmentCard key={a.id} a={a} onAccept={() => respond(a, true)} onReject={() => respond(a, false)} />)}
          </TabsContent>
          <TabsContent value="assigned" className="mt-4 space-y-3">
            {assigned.length === 0 ? <Empty msg="Nothing to pick up right now." /> :
              assigned.map((a) => <AssignmentCard key={a.id} a={a} showPickup onPickedUp={() => markPickedUp(a)} />)}
          </TabsContent>
          <TabsContent value="active" className="mt-4 space-y-3">
            {active.length === 0 ? <Empty msg="No active deliveries." /> :
              active.map((a) => (
                <AssignmentCard key={a.id} a={a} showDeliverOtp showDeliveryProof
                  partnerId={partner.id} partnerUserId={partner.user_id}
                  onDelivered={a.status === "picked_up" ? () => markDelivered(a) : undefined} />
              ))}
          </TabsContent>
          <TabsContent value="returns" className="mt-4 space-y-3">
            {returns.length === 0 ? <Empty msg="No return pickups." /> :
              returns.map((a) => <AssignmentCard key={a.id} a={a} showReturnOtp showReturnProof partnerId={partner.id} partnerUserId={partner.user_id} onReturnedToStore={() => markReturnedToStore(a)} />)}
          </TabsContent>
          <TabsContent value="history" className="mt-4 space-y-3">
            {history.length === 0 ? <Empty msg="No completed deliveries yet." /> :
              history.map((a) => <AssignmentCard key={a.id} a={a} readonly />)}
          </TabsContent>
          <TabsContent value="earnings" className="mt-4 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total earnings</p>
              <p className="font-display text-4xl mt-1">{inr(earnings.total)}</p>
              <p className="text-sm text-muted-foreground mt-1">{earnings.count} deliveries completed</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Today" value={inr(earnings.today)} />
              <Stat label="This week" value={inr(earnings.week)} />
              <Stat label="This month" value={inr(earnings.month)} />
              <Stat label="Pending payout" value={inr(earnings.pending)} />
            </div>
          </TabsContent>

        </Tabs>
      </section>
      <Footer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-secondary px-4 py-3 text-center">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-2xl">{value}</p>
    </div>
  );
}
function Empty({ msg }: { msg: string }) {
  return <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{msg}</div>;
}

function AssignmentCard({
  a, onAccept, onReject, showPickup, onPickedUp, showDeliverOtp, showReturnOtp, onReturnedToStore, readonly,
  showDeliveryProof, showReturnProof, partnerId, partnerUserId,
}: {
  a: Assignment;
  onAccept?: () => void; onReject?: () => void;
  showPickup?: boolean; onPickedUp?: () => void;
  showDeliverOtp?: boolean; showReturnOtp?: boolean;
  onReturnedToStore?: () => void; readonly?: boolean;
  showDeliveryProof?: boolean; showReturnProof?: boolean;
  partnerId?: string; partnerUserId?: string;
}) {
  const r = a.rental;
  if (!r) return null;
  const mapsPickup = r.store?.address ? `https://maps.google.com/?q=${encodeURIComponent(r.store.address + ", " + (r.store.city ?? ""))}` : "";
  const dropAddr = addressFromRental(r);
  const hasSnapshot = isAddressComplete(dropAddr);
  const dropText = hasSnapshot ? formatAddress(dropAddr) : (r.address ?? "");
  const mapsDrop = dropText ? `https://maps.google.com/?q=${encodeURIComponent(dropText)}` : "";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        {r.product?.images?.[0] ? (
          <img src={r.product.images[0]} alt="" className="w-16 h-16 rounded-lg object-cover" />
        ) : <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center"><Package className="h-6 w-6 text-muted-foreground" /></div>}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{r.product?.title}</p>
          <p className="text-xs text-muted-foreground">Order #{r.id.slice(0, 8)} · {inr(r.grand_total)}</p>
          <Badge variant="outline" className="mt-1 capitalize">{a.status.replace(/_/g, " ")}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-secondary p-2">
          <p className="uppercase tracking-wider text-muted-foreground mb-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" /> Pickup</p>
          <p className="font-medium">{r.store?.name}</p>
          <p className="text-muted-foreground">{r.store?.address ?? "—"}</p>
          {mapsPickup && <a href={mapsPickup} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 mt-1"><Navigation className="h-3 w-3" /> Navigate</a>}
        </div>
        <div className="rounded-lg bg-secondary p-2">
          <p className="uppercase tracking-wider text-muted-foreground mb-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" /> Drop</p>
          <p className="font-medium">{dropAddr.full_name || r.customer?.full_name || "Customer"}</p>
          {(dropAddr.mobile || r.customer?.phone) && (
            <a href={`tel:${dropAddr.mobile || r.customer?.phone}`} className="text-primary inline-flex items-center gap-1">
              <Phone className="h-3 w-3" /> {dropAddr.mobile || r.customer?.phone}
            </a>
          )}
          {hasSnapshot ? (
            <div className="text-muted-foreground">
              {addressLines(dropAddr).map((l, i) => <p key={i}>{l}</p>)}
              {dropAddr.instructions && <p className="italic">Note: {dropAddr.instructions}</p>}
            </div>
          ) : (
            <p className="text-muted-foreground">{r.address ?? "—"}</p>
          )}
          {mapsDrop && <a href={mapsDrop} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 mt-1"><Navigation className="h-3 w-3" /> Navigate</a>}
        </div>
      </div>

      {r.kind === "rent" && r.start_date && r.end_date && (
        <p className="text-xs text-muted-foreground">Rental: {format(new Date(r.start_date), "PP")} → {format(new Date(r.end_date), "PP")}</p>
      )}

      {!readonly && (
        <div className="flex flex-wrap gap-2">
          {onAccept && <Button size="sm" variant="hero" onClick={onAccept}>Accept</Button>}
          {onReject && <Button size="sm" variant="ghost" onClick={onReject}>Reject</Button>}
          {showPickup && onPickedUp && <Button size="sm" variant="hero" onClick={onPickedUp}>Mark Picked Up</Button>}
          {showDeliverOtp && <OtpDialog rentalId={r.id} kind="delivery" />}
          {showDeliveryProof && partnerId && partnerUserId && (
            <DeliveryProofUpload assignmentId={a.id} rentalId={r.id} partnerId={partnerId} partnerUserId={partnerUserId} kind="delivery" />
          )}
          {showReturnOtp && <OtpDialog rentalId={r.id} kind="return" />}
          {showReturnProof && partnerId && partnerUserId && (
            <DeliveryProofUpload assignmentId={a.id} rentalId={r.id} partnerId={partnerId} partnerUserId={partnerUserId} kind="return" />
          )}
          {onReturnedToStore && <Button size="sm" variant="hero" onClick={onReturnedToStore}>Handed to Store</Button>}
        </div>
      )}
    </div>
  );
}

function OtpDialog({ rentalId, kind }: { rentalId: string; kind: "delivery" | "return" }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function verify() {
    if (code.length !== 6) return toast.error("Enter the 6-digit OTP");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("deliverypartner-verify-otp", {
      body: { rentalId, kind, code },
    });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error || error?.message || "Failed");
    toast.success(kind === "delivery" ? "Delivery confirmed!" : "Return pickup confirmed!");
    setOpen(false); setCode("");
    setTimeout(() => window.location.reload(), 500);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="hero">Enter {kind === "delivery" ? "Delivery" : "Return"} OTP</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Ask customer for the 6-digit OTP</DialogTitle></DialogHeader>
        <div className="flex justify-center py-4">
          <InputOTP maxLength={6} value={code} onChange={setCode}>
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => <InputOTPSlot key={i} index={i} />)}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button variant="hero" size="lg" onClick={verify} disabled={busy}>{busy ? "Verifying…" : "Verify"}</Button>
      </DialogContent>
    </Dialog>
  );
}
