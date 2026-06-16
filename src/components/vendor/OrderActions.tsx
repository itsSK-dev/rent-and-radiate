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

const TRANSITIONS: Record<string, Action[]> = {
  pending: [
    { label: "Accept", next: "accepted", variant: "default", icon: CheckCircle2,
      headline: "Order accepted", statusLine: "Your order has been accepted by the store." },
    { label: "Reject", next: "rejected", variant: "destructive", icon: XCircle,
      headline: "Order rejected", statusLine: "Unfortunately the store could not accept your order." },
  ],
  accepted: [
    { label: "Mark Packing", next: "packing", variant: "default", icon: Package,
      headline: "Order is being packed", statusLine: "Your order is now being packed." },
    { label: "Cancel", next: "cancelled", variant: "outline", icon: Ban,
      headline: "Order cancelled", statusLine: "This order has been cancelled." },
  ],
  packing: [
    { label: "Mark Ready", next: "ready_for_pickup", variant: "default", icon: PackageCheck,
      headline: "Ready for pickup / shipping", statusLine: "Your order is ready for pickup or shipping." },
  ],
  ready_for_pickup: [
    { label: "Mark Shipped", next: "shipped", variant: "default", icon: Truck,
      headline: "Order shipped", statusLine: "Your order is on its way." },
    { label: "Mark Delivered", next: "delivered", variant: "outline", icon: PackageOpen,
      headline: "Order delivered", statusLine: "Your order has been delivered. Enjoy!" },
  ],
  shipped: [
    { label: "Mark Delivered", next: "delivered", variant: "default", icon: PackageOpen,
      headline: "Order delivered", statusLine: "Your order has been delivered. Enjoy!" },
  ],
  // Legacy / rental path
  confirmed: [
    { label: "Mark Packing", next: "packing", variant: "default", icon: Package,
      headline: "Being prepared", statusLine: "Your rental is being prepared." },
  ],
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
    setBusy(a.next);
    try {
      const { error } = await supabase
        .from("rentals")
        .update({ status: a.next as any })
        .eq("id", rentalId);
      if (error) throw error;
      toast.success(a.label + " ✓");
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
      toast.error(e.message ?? "Could not update order");
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
