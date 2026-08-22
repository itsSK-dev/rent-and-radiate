import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, ShoppingBag, CalendarClock, Loader2, Hash } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { differenceInCalendarDays, parseISO, addDays, format } from "date-fns";

type Props = {
  rental: {
    id: string;
    qr_token: string;
    kind: string;
    status: string;
    end_date: string | null;
    start_date: string | null;
    product_id: string;
    rental_total: number;
  };
  rentToOwnEnabled: boolean;
  rentToOwnCreditPercent: number;
};

export function RentalAdvancedActions({ rental, rentToOwnEnabled, rentToOwnCreditPercent }: Props) {
  const [hasExtensionPending, setHasExtensionPending] = useState(false);
  const [extDays, setExtDays] = useState(3);
  const [extReason, setExtReason] = useState("");
  const [extBusy, setExtBusy] = useState(false);
  const [extOpen, setExtOpen] = useState(false);

  const [product, setProduct] = useState<{ rent_to_own_enabled: boolean; actual_price: number; discount_percent: number; discount_flat: number } | null>(null);
  const [pastSpend, setPastSpend] = useState(0);
  const [convertBusy, setConvertBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: ext } = await (supabase as any)
        .from("rental_extension_requests")
        .select("id,status").eq("rental_id", rental.id).eq("status", "pending").maybeSingle();
      setHasExtensionPending(!!ext);

      const { data: p } = await supabase
        .from("products")
        .select("rent_to_own_enabled,actual_price,discount_percent,discount_flat")
        .eq("id", rental.product_id).maybeSingle();
      if (p) setProduct(p as any);

      const { data: past } = await supabase
        .from("rentals")
        .select("rental_total")
        .eq("product_id", rental.product_id)
        .neq("kind", "buy")
        .in("status", ["delivered", "returned"]);
      const total = (past ?? []).reduce((s: number, r: any) => s + Number(r.rental_total || 0), 0);
      setPastSpend(total);
    })();
  }, [rental.id, rental.product_id]);

  async function requestExtension() {
    if (!rental.end_date) return;
    setExtBusy(true);
    const requested = addDays(parseISO(rental.end_date), extDays);
    const { error } = await (supabase as any).from("rental_extension_requests").insert({
      rental_id: rental.id,
      requested_end_date: format(requested, "yyyy-MM-dd"),
      additional_days: extDays,
      reason: extReason || null,
    });
    setExtBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Extension requested. The store will review it.");
    setExtOpen(false);
    setHasExtensionPending(true);
  }

  async function convertToPurchase() {
    setConvertBusy(true);
    const { data, error } = await supabase.functions.invoke("convert-rental-to-purchase", {
      body: { rentalId: rental.id },
    });
    setConvertBusy(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error ?? error?.message ?? "Could not convert.");
    }
    toast.success("Purchase order created — pay to claim ownership.");
    window.location.href = `/checkout/${(data as any).rentalId}`;
  }

  const canExtend = rental.kind !== "buy"
    && rental.end_date
    && ["confirmed", "accepted", "delivered", "shipped"].includes(rental.status)
    && differenceInCalendarDays(parseISO(rental.end_date), new Date()) >= 0
    && !hasExtensionPending;

  const eligibleR2O = rentToOwnEnabled
    && product?.rent_to_own_enabled
    && ["delivered", "returned"].includes(rental.status);
  const credit = eligibleR2O ? Math.round(pastSpend * rentToOwnCreditPercent / 100) : 0;
  const price = product ? Math.max(0, Math.round(Number(product.actual_price) - Number(product.actual_price) * Number(product.discount_percent || 0) / 100 - Number(product.discount_flat || 0))) : 0;
  const buyoutPrice = Math.max(0, price - credit);

  return (
    <div className="flex flex-wrap gap-2 items-center pt-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm"><QrCode className="h-3.5 w-3.5" /> Show QR</Button>
        </DialogTrigger>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Pickup / handover QR</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="rounded-xl bg-white p-3 border border-border">
              <QRCodeSVG value={rental.qr_token} size={200} level="M" />
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="h-3 w-3" /> {rental.qr_token.slice(0, 8).toUpperCase()}</p>
            <p className="text-xs text-center text-muted-foreground">Show this at pickup or return so the store can verify your rental instantly.</p>
          </div>
        </DialogContent>
      </Dialog>

      {canExtend && (
        <Dialog open={extOpen} onOpenChange={setExtOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><CalendarClock className="h-3.5 w-3.5" /> Extend rental</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Request extension</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Additional days</Label>
                <Input type="number" min={1} max={30} value={extDays} onChange={(e) => setExtDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Reason (optional)</Label>
                <Input value={extReason} onChange={(e) => setExtReason(e.target.value.slice(0, 200))} className="mt-1" />
              </div>
              <p className="text-xs text-muted-foreground">If approved, your due date moves to {rental.end_date ? format(addDays(parseISO(rental.end_date), extDays), "PP") : ""}. Extra rental charges apply per platform rate.</p>
              <Button variant="hero" onClick={requestExtension} disabled={extBusy} className="w-full">
                {extBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Requesting…</> : "Submit request"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {hasExtensionPending && (
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Extension pending review</span>
      )}

      {eligibleR2O && price > 0 && (
        <Button variant="hero" size="sm" onClick={convertToPurchase} disabled={convertBusy}>
          <ShoppingBag className="h-3.5 w-3.5" />
          {convertBusy ? "Converting…" : `Buy for ₹${buyoutPrice.toLocaleString("en-IN")}${credit > 0 ? ` (₹${credit.toLocaleString("en-IN")} rental credit)` : ""}`}
        </Button>
      )}
    </div>
  );
}
