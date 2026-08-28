import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyRentalStatus } from "@/lib/notifyRentalStatus";
import { CheckCircle2, XCircle, Package, Truck, PackageCheck, PackageOpen, Ban } from "lucide-react";

type Status =
  | "pending" | "accepted" | "rejected" | "confirmed"
  | "packing" | "ready_for_pickup" | "shipped"
  | "delivered" | "returned" | "cancelled";

interface Action {
  label: string;
  next: Status;
  variant?: "default" | "outline" | "destructive" | "soft";
  icon?: React.ComponentType<{ className?: string }>;
  headline: string;
  statusLine: string;
}

// NOTE: these must stay inside the DB transition whitelist enforced by
// public.enforce_rental_status_transition(), otherwise the update is rejected.
const TRANSITIONS: Record<string, Action[]> = {
  pending: [
    { label: "Accept Order", next: "accepted", variant: "default", icon: CheckCircle2,
      headline: "Order accepted", statusLine: "Your order has been accepted by the store." },
    { label: "Reject Order", next: "cancelled", variant: "destructive", icon: XCircle,
      headline: "Order rejected", statusLine: "Unfortunately the store could not accept your order." },
  ],
  // Paid orders land here straight from payment verification.
  confirmed: [
    { label: "Accept Order", next: "accepted", variant: "default", icon: CheckCircle2,
      headline: "Order accepted", statusLine: "Your order has been accepted by the store." },
    { label: "Reject Order", next: "cancelled", variant: "destructive", icon: XCircle,
      headline: "Order rejected", statusLine: "Unfortunately the store could not accept your order." },
  ],
  accepted: [
    { label: "Start Packing", next: "packing", variant: "default", icon: Package,
      headline: "Order is being packed", statusLine: "Your order is now being packed." },
    { label: "Cancel", next: "cancelled", variant: "outline", icon: Ban,
      headline: "Order cancelled", statusLine: "This order has been cancelled." },
  ],
  packing: [
    { label: "Mark as Packed", next: "ready_for_pickup", variant: "default", icon: PackageCheck,
      headline: "Order packed", statusLine: "Your order is packed and ready for delivery." },
  ],
  ready_for_pickup: [
    { label: "Mark Out for Delivery", next: "shipped", variant: "default", icon: Truck,
      headline: "Out for delivery", statusLine: "Your order is on its way." },
  ],
  shipped: [
    { label: "Mark as Delivered", next: "delivered", variant: "default", icon: PackageOpen,
      headline: "Order delivered", statusLine: "Your order has been delivered. Enjoy!" },
  ],
};

const CONFIRM_REQUIRED: Record<string, string> = {
  cancelled: "Are you sure you want to reject/cancel this order? The customer will be notified.",
};

const SUCCESS_MESSAGE: Record<string, string> = {
  accepted: "Order accepted successfully.",
  packing: "Order moved to packing.",
  ready_for_pickup: "Order packed successfully.",
  shipped: "Order marked as out for delivery.",
  delivered: "Order marked as delivered.",
  cancelled: "Order cancelled.",
};

export function OrderActions({
  rentalId,
  status,
  kind,
  onChanged,
}: {
  rentalId: string;
  status: string;
  kind: "buy" | "rent";
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const actions = TRANSITIONS[status] ?? [];

  async function run(a: Action) {
    const confirmMsg = CONFIRM_REQUIRED[a.next];
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(a.next);
    try {
      // Atomic: only succeeds if the row is still in the status we rendered from,
      // so a second session/tab cannot apply the same transition twice.
      const { data, error } = await supabase
        .from("rentals")
        .update({ status: a.next as any })
        .eq("id", rentalId)
        .eq("status", status as any)
        .select("id, status");
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error("This order was already updated elsewhere. Refreshing…");
        onChanged?.();
        return;
      }
      toast.success(SUCCESS_MESSAGE[a.next] ?? `${a.label} ✓`);
      // Fire email (best effort)
      notifyRentalStatus({
        rentalId,
        eventKey: `order-${a.next}`,
        headline: a.headline,
        statusLine: a.statusLine,
        audience: ["customer"],
      });
      onChanged?.();
    } catch (e: any) {
      console.error("[order-actions] update failed", e);
      toast.error(e?.message ?? "Unable to update order. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (actions.length === 0) {
    return <span className="text-xs text-muted-foreground">No actions available</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Button
            key={a.next}
            size="sm"
            variant={a.variant as any}
            disabled={busy !== null}
            onClick={() => run(a)}
          >
            {Icon && <Icon className="h-3.5 w-3.5 mr-1.5" />}
            {busy === a.next ? "…" : a.label}
          </Button>
        );
      })}
    </div>
  );
}
