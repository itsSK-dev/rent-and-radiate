import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CheckCircle2, Truck, PackageCheck, Package, ClipboardList, Undo2, Camera } from "lucide-react";
import { notifyRentalStatus } from "@/lib/notifyRentalStatus";
import { ProofImage } from "@/components/ProofImage";

const STAGE_HEADLINES: Record<string, string> = {
  accepted: "Your order has been accepted",
  packed: "Your order is packed",
  out_for_delivery: "Your order is out for delivery",
  delivered: "Your order has been delivered",
};

const RETURN_HEADLINES: Record<string, string> = {
  approved: "Return approved",
  rejected: "Return request rejected",
  pickup_scheduled: "Return pickup scheduled",
  picked_up: "Return picked up",
  returned_to_store: "Return received by store",
  refund_processed: "Refund processed",
  completed: "Return completed",
};

/* -------------------- Delivery stages -------------------- */

export const DELIVERY_STAGES = [
  { key: "accepted", label: "Accepted by store" },
  { key: "packed", label: "Packed" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
] as const;

export function DeliveryStageBadge({ stage }: { stage: string | null }) {
  if (!stage) return <Badge variant="outline">Awaiting</Badge>;
  const s = DELIVERY_STAGES.find((d) => d.key === stage);
  return <Badge className="bg-primary-soft text-rose-deep">{s?.label ?? stage}</Badge>;
}

export function DeliveryStageControl({
  rentalId,
  currentStage,
  onChanged,
}: {
  rentalId: string;
  currentStage: string | null;
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [partner, setPartner] = useState("");
  const [tracking, setTracking] = useState("");
  const [eta, setEta] = useState("");
  const [open, setOpen] = useState(false);

  async function update(stage: string) {
    setBusy(true);
    const patch: any = { delivery_stage: stage };
    if (stage === "delivered") {
      patch.actual_delivered_at = new Date().toISOString();
    }
    const { error } = await supabase.from("rentals").update(patch).eq("id", rentalId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Marked as ${stage.replace(/_/g, " ")}`);
    notifyRentalStatus({
      rentalId,
      eventKey: `delivery-${stage}`,
      headline: STAGE_HEADLINES[stage] ?? `Order update: ${stage}`,
      statusLine: `Status: ${stage.replace(/_/g, " ")}`,
      audience: ["customer"],
    });
    onChanged?.();
  }

  async function saveLogistics() {
    setBusy(true);
    const { error } = await supabase.from("rentals").update({
      delivery_partner: partner || null,
      tracking_number: tracking || null,
      expected_delivery_date: eta || null,
    }).eq("id", rentalId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Logistics updated");
    setOpen(false);
    onChanged?.();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={currentStage ?? ""} onValueChange={update} disabled={busy}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Delivery stage" /></SelectTrigger>
        <SelectContent>
          {DELIVERY_STAGES.map((s) => (
            <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm"><Truck className="h-4 w-4 mr-1" />Logistics</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Delivery details</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Delivery partner</Label><Input value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="e.g. Delhivery / Self" /></div>
            <div><Label>Tracking number</Label><Input value={tracking} onChange={(e) => setTracking(e.target.value)} /></div>
            <div><Label>Expected delivery date</Label><Input type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button onClick={saveLogistics} disabled={busy}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- Customer dialogs -------------------- */

export function RequestExtensionDialog({
  rental,
  onCreated,
}: {
  rental: { id: string; store_id: string; customer_id: string; end_date: string | null };
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [extraDays, setExtraDays] = useState(3);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!rental.end_date) return toast.error("This order has no end date.");
    setBusy(true);
    const requestedEnd = new Date(rental.end_date);
    requestedEnd.setDate(requestedEnd.getDate() + Number(extraDays));
    const { error } = await supabase.from("rental_extension_requests").insert({
      rental_id: rental.id,
      customer_id: rental.customer_id,
      store_id: rental.store_id,
      current_end_date: rental.end_date,
      requested_end_date: requestedEnd.toISOString().slice(0, 10),
      additional_days: Number(extraDays),
      reason: reason || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Extension requested");
    notifyRentalStatus({
      rentalId: rental.id,
      eventKey: `ext-requested-${Date.now()}`,
      headline: "New rental extension request",
      statusLine: `Customer requested +${extraDays} day${Number(extraDays) === 1 ? "" : "s"}`,
      message: reason ? `Reason: ${reason}` : undefined,
      audience: ["store"],
    });
    setOpen(false);
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><ClipboardList className="h-4 w-4 mr-2" />Request extension</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Request rental extension</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Additional days</Label><Input type="number" min={1} max={60} value={extraDays} onChange={(e) => setExtraDays(Number(e.target.value))} /></div>
          <div><Label>Reason (optional)</Label><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">Store will review and confirm any extra fees with you.</p>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InitiateReturnDialog({
  rental,
  onCreated,
}: {
  rental: { id: string; store_id: string; customer_id: string };
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const { error } = await supabase.from("return_requests").insert({
      rental_id: rental.id,
      customer_id: rental.customer_id,
      store_id: rental.store_id,
      reason: reason || null,
      customer_notes: notes || null,
    });
    if (!error) {
      await supabase.from("rentals").update({ return_initiated_at: new Date().toISOString() }).eq("id", rental.id);
    }
    setBusy(false);
    if (error) {
      if (error.code === "23505") return toast.error("A return is already in progress for this order.");
      return toast.error(error.message);
    }
    toast.success("Return request submitted");
    notifyRentalStatus({
      rentalId: rental.id,
      eventKey: `return-requested-${Date.now()}`,
      headline: "New return request",
      statusLine: "Customer initiated a return",
      message: reason || notes || undefined,
      audience: ["store"],
    });
    setOpen(false);
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Undo2 className="h-4 w-4 mr-2" />Initiate return</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Initiate return</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Rental period ending" /></div>
          <div><Label>Notes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the store should know" /></div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>Submit return request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Return timeline + panel -------------------- */

export const RETURN_STEPS = [
  { key: "requested", label: "Return requested" },
  { key: "approved", label: "Return approved" },
  { key: "pickup_scheduled", label: "Pickup scheduled" },
  { key: "picked_up", label: "Picked up" },
  { key: "returned_to_store", label: "Returned to store" },
  { key: "refund_processed", label: "Refund processed" },
  { key: "completed", label: "Return completed" },
] as const;

export type ReturnRow = {
  id: string;
  rental_id: string;
  customer_id: string;
  store_id: string;
  status: string;
  reason: string | null;
  customer_notes: string | null;
  store_notes: string | null;
  admin_notes: string | null;
  pickup_scheduled_at: string | null;
  pickup_address: string | null;
  picked_up_at: string | null;
  returned_at: string | null;
  refund_processed_at: string | null;
  completed_at: string | null;
  photos: string[];
  created_at: string;
};

export function ReturnTimeline({ status }: { status: string }) {
  const isRejected = status === "rejected";
  const idx = RETURN_STEPS.findIndex((s) => s.key === status);
  const currentIdx = idx < 0 ? 0 : idx;

  if (isRejected) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
        Return request was rejected by the store.
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {RETURN_STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span className={cn(
              "h-6 w-6 rounded-full flex items-center justify-center text-xs border",
              done && "bg-rose-deep border-rose-deep text-primary-foreground",
              active && "border-rose-deep text-rose-deep",
              !done && !active && "border-border text-muted-foreground"
            )}>
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn("text-sm", active && "font-medium text-rose-deep", !done && !active && "text-muted-foreground")}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* Customer-side: view their return + upload photos */
export function CustomerReturnPanel({ rentalId }: { rentalId: string }) {
  const [ret, setRet] = useState<ReturnRow | null>(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const { data } = await supabase.from("return_requests").select("*").eq("rental_id", rentalId).maybeSingle();
    setRet((data as any) ?? null);
  }
  useEffect(() => {
    load();
    const ch = supabase
      .channel(`ret-${rentalId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "return_requests", filter: `rental_id=eq.${rentalId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [rentalId]);

  async function uploadPhoto(file: File) {
    if (!ret) return;
    setUploading(true);
    const path = `${ret.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("rental-proofs").upload(path, file, { upsert: false });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data: pub } = supabase.storage.from("rental-proofs").getPublicUrl(path);
    const { error } = await supabase.from("return_requests").update({ photos: [...(ret.photos ?? []), pub.publicUrl] }).eq("id", ret.id);
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Photo uploaded");
    load();
  }

  if (!ret) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-display text-xl">Return progress</h3>
        <Badge className="bg-primary-soft text-rose-deep capitalize">{ret.status.replace(/_/g, " ")}</Badge>
      </div>
      <ReturnTimeline status={ret.status} />
      {ret.pickup_scheduled_at && (
        <p className="text-xs text-muted-foreground">Pickup: {format(new Date(ret.pickup_scheduled_at), "PPP p")}</p>
      )}
      {ret.store_notes && <p className="text-sm"><strong>Store:</strong> {ret.store_notes}</p>}
      <div>
        <Label className="text-xs">Return photos</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {ret.photos?.map((u) => <ProofImage key={u} src={u} alt="return" className="h-20 w-20 rounded-lg object-cover" />)}
          <label className="h-20 w-20 rounded-lg border border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary text-muted-foreground">
            <Camera className="h-5 w-5" />
            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
          </label>
        </div>
      </div>
    </div>
  );
}

/* Store-side: manage return for a rental */
export function StoreReturnControls({ ret, onChanged }: { ret: ReturnRow; onChanged?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [pickupAt, setPickupAt] = useState(ret.pickup_scheduled_at?.slice(0, 16) ?? "");
  const [notes, setNotes] = useState(ret.store_notes ?? "");

  async function setStatus(status: string, patch: any = {}) {
    setBusy(true);
    const { error } = await supabase.from("return_requests").update({ status, store_notes: notes || null, ...patch }).eq("id", ret.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Return ${status.replace(/_/g, " ")}`);
    notifyRentalStatus({
      rentalId: ret.rental_id,
      eventKey: `return-${status}`,
      headline: RETURN_HEADLINES[status] ?? `Return update: ${status}`,
      statusLine: `Return status: ${status.replace(/_/g, " ")}`,
      message: notes || undefined,
      audience: ["customer"],
    });
    onChanged?.();
  }

  return (
    <div className="space-y-3">
      <ReturnTimeline status={ret.status} />
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Pickup date/time</Label>
          <Input type="datetime-local" value={pickupAt} onChange={(e) => setPickupAt(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Notes for customer</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {ret.status === "requested" && (
          <>
            <Button size="sm" onClick={() => setStatus("approved")} disabled={busy}>Approve</Button>
            <Button size="sm" variant="outline" onClick={() => setStatus("rejected")} disabled={busy}>Reject</Button>
          </>
        )}
        {(ret.status === "approved" || ret.status === "pickup_scheduled") && (
          <Button size="sm" onClick={() => setStatus("pickup_scheduled", { pickup_scheduled_at: pickupAt || new Date().toISOString() })} disabled={busy}>
            Schedule pickup
          </Button>
        )}
        {ret.status === "pickup_scheduled" && (
          <Button size="sm" onClick={() => setStatus("picked_up")} disabled={busy}>Mark picked up</Button>
        )}
        {ret.status === "picked_up" && (
          <Button size="sm" onClick={() => setStatus("returned_to_store")} disabled={busy}>Returned to store</Button>
        )}
        {ret.status === "returned_to_store" && (
          <Button size="sm" onClick={() => setStatus("refund_processed")} disabled={busy}>Mark refund processed</Button>
        )}
        {ret.status === "refund_processed" && (
          <Button size="sm" onClick={() => setStatus("completed")} disabled={busy}>Complete return</Button>
        )}
      </div>
    </div>
  );
}

/* Store-side: list of pending extension requests with approve/reject */
export function StoreExtensionRequests({ storeId, onChanged }: { storeId: string; onChanged?: () => void }) {
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase
      .from("rental_extension_requests")
      .select("*, rental:rentals(id,product:products(title))")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    setRows((data as any) ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase
      .channel(`ext-${storeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rental_extension_requests", filter: `store_id=eq.${storeId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [storeId]);

  async function review(id: string, status: "approved" | "rejected", reviewer_notes?: string) {
    const row = rows.find((r) => r.id === id);
    const { error } = await supabase.from("rental_extension_requests").update({ status, reviewer_notes: reviewer_notes || null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Extension ${status}`);
    if (row?.rental_id) {
      notifyRentalStatus({
        rentalId: row.rental_id,
        eventKey: `ext-${status}-${id}`,
        headline: status === "approved" ? "Extension approved" : "Extension request declined",
        statusLine: status === "approved"
          ? `+${row.additional_days} day${row.additional_days === 1 ? "" : "s"} approved`
          : "Your store could not approve this extension",
        message: reviewer_notes || undefined,
        audience: ["customer"],
      });
    }
    load();
    onChanged?.();
  }

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No extension requests.</p>;

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-border p-3 bg-card flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <p className="font-medium">{r.rental?.product?.title ?? "Order"}</p>
            <p className="text-xs text-muted-foreground">
              +{r.additional_days} days · new end {format(new Date(r.requested_end_date), "PP")} · <span className="capitalize">{r.status}</span>
            </p>
            {r.reason && <p className="text-xs italic mt-1">"{r.reason}"</p>}
          </div>
          {r.status === "pending" && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => review(r.id, "approved")}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => review(r.id, "rejected")}>Reject</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* Customer extension list display */
export function CustomerExtensionList({ rentalId }: { rentalId: string }) {
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase
      .from("rental_extension_requests")
      .select("*")
      .eq("rental_id", rentalId)
      .order("created_at", { ascending: false });
    setRows((data as any) ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase
      .channel(`ext-r-${rentalId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rental_extension_requests", filter: `rental_id=eq.${rentalId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [rentalId]);

  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="text-sm rounded-lg border border-border bg-secondary/30 p-2 flex justify-between gap-2">
          <span>+{r.additional_days} days · new end {format(new Date(r.requested_end_date), "PP")}</span>
          <Badge variant="outline" className="capitalize">{r.status}</Badge>
        </div>
      ))}
    </div>
  );
}
