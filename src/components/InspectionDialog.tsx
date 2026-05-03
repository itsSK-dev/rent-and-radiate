import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { REFUND_TIERS, RefundTier, calculateRefund } from "@/lib/refundTiers";

type Props = {
  rentalId: string;
  storeId: string;
  customerId: string;
  deposit: number;
  onCreated?: () => void;
};

export function InspectionDialog({ rentalId, storeId, customerId, deposit, onCreated }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<RefundTier>("perfect");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { percent, amount } = calculateRefund(deposit, tier);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await (supabase.from as any)("deposit_refunds").insert({
      rental_id: rentalId,
      store_id: storeId,
      customer_id: customerId,
      deposit_amount: deposit,
      condition_tier: tier,
      refund_percent: percent,
      refund_amount: amount,
      inspection_notes: notes || null,
      initiated_by: user.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Inspection sent for admin approval");
    setOpen(false);
    setNotes("");
    setTier("perfect");
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardCheck className="h-4 w-4 mr-2" /> Start inspection
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Deposit inspection</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Deposit collected: <strong>₹{Number(deposit).toLocaleString("en-IN")}</strong>. Pick the condition tier — admin will review before the refund is finalized.
          </p>

          <RadioGroup value={tier} onValueChange={(v) => setTier(v as RefundTier)} className="space-y-2">
            {REFUND_TIERS.map((t) => {
              const refund = calculateRefund(deposit, t.value);
              return (
                <label
                  key={t.value}
                  htmlFor={`tier-${t.value}`}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-smooth ${
                    tier === t.value ? "border-primary bg-primary-soft/40" : "border-border hover:border-primary/40"
                  }`}
                >
                  <RadioGroupItem id={`tier-${t.value}`} value={t.value} className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{t.label}</span>
                      <span className="text-sm font-mono">₹{refund.amount.toLocaleString("en-IN")} ({t.percent}%)</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                  </div>
                </label>
              );
            })}
          </RadioGroup>

          <div>
            <Label>Inspection notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1" maxLength={1000}
              placeholder="Describe condition, damage areas, anything admin should know." />
          </div>

          <div className="rounded-xl bg-secondary p-3 text-sm flex items-center justify-between">
            <span>Proposed refund</span>
            <strong>₹{amount.toLocaleString("en-IN")}</strong>
          </div>

          <Button type="submit" variant="hero" className="w-full" disabled={busy}>
            {busy ? "Submitting…" : "Submit for admin approval"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
