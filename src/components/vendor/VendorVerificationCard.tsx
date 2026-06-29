import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BadgeCheck, AlertCircle, Clock, Send, Check, X } from "lucide-react";
import { toast } from "sonner";

type Store = {
  id: string;
  name: string;
  city: string | null;
  status: "pending" | "approved" | "rejected" | "deleted";
  is_verified: boolean;
  logo_url?: string | null;
  address?: string | null;
};

type Props = {
  store: Store;
  rejectionReason?: string | null;
  productCount: number;
  hasPayment: boolean;
  onChanged: () => void;
};

export function VendorVerificationCard({ store, rejectionReason, productCount, hasPayment, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const isApproved = store.status === "approved" && store.is_verified;
  const isRejected = store.status === "rejected";

  const checks = [
    { label: "Store name", done: !!store.name?.trim() },
    { label: "Store logo", done: !!store.logo_url },
    { label: "Address & city", done: !!(store.address || store.city) },
    { label: "Payment details saved", done: hasPayment },
    { label: "At least 1 product listed", done: productCount > 0 },
  ];
  const completed = checks.filter((c) => c.done).length;
  const ready = completed === checks.length;

  async function resubmit() {
    setBusy(true);
    const { error } = await supabase
      .from("stores")
      .update({ status: "pending" as any, rejection_reason: null } as any)
      .eq("id", store.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Resubmitted for admin review");
    onChanged();
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-card mb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-2xl grid place-items-center ${isApproved ? "bg-emerald-100 text-emerald-700" : isRejected ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
            {isApproved ? <BadgeCheck className="h-6 w-6" /> : isRejected ? <X className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Seller verification</p>
            <h3 className="font-display text-2xl">
              {isApproved ? "Verified seller" : isRejected ? "Verification rejected" : "Awaiting admin approval"}
            </h3>
          </div>
        </div>
        <Badge
          variant="outline"
          className={
            isApproved ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : isRejected ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
          }
        >
          {store.status}
        </Badge>
      </div>

      {isRejected && rejectionReason && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 mb-4 flex gap-2 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 text-rose-700 shrink-0" />
          <div>
            <p className="font-medium text-rose-800">Admin feedback</p>
            <p className="text-rose-700/90">{rejectionReason}</p>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-2 mb-4">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-2 text-sm">
            <span className={`h-5 w-5 rounded-full grid place-items-center ${c.done ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
              {c.done ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            </span>
            <span className={c.done ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {completed}/{checks.length} requirements complete
          {!isApproved && !ready && " · Complete all items, then resubmit."}
          {isApproved && " · Your shop shows the Verified badge to customers."}
        </p>
        {(isRejected || (!isApproved && ready)) && (
          <Button size="sm" variant="hero" disabled={busy || !ready} onClick={resubmit}>
            <Send className="h-4 w-4" /> {isRejected ? "Resubmit for review" : "Submit for review"}
          </Button>
        )}
      </div>
    </div>
  );
}
