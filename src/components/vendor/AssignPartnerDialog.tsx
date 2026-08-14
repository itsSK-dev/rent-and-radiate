import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bike, Phone } from "lucide-react";

export type AvailablePartner = {
  id: string;
  full_name: string;
  mobile: string | null;
  city: string | null;
  vehicle_type: string;
  is_online: boolean;
  status: string;
  active_assignments: number;
};

/** Loads approved delivery partners visible to the signed-in shop owner. */
export async function fetchAvailablePartners(): Promise<AvailablePartner[]> {
  const { data, error } = await (supabase as any).rpc("list_available_delivery_partners");
  if (error) {
    console.warn("[vendor] could not load delivery partners", error.message);
    return [];
  }
  return (data ?? []) as AvailablePartner[];
}

export function AssignPartnerDialog({
  rentalId,
  partners,
  assignedPartnerId,
  onAssigned,
}: {
  rentalId: string;
  partners: AvailablePartner[];
  assignedPartnerId?: string | null;
  onAssigned?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function assign(p: AvailablePartner) {
    setBusy(p.id);
    const { error } = await (supabase as any).rpc("assign_delivery_partner", {
      _rental_id: rentalId,
      _partner_id: p.id,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Assigned to ${p.full_name}`);
    setOpen(false);
    onAssigned?.();
  }

  const online = partners.filter((p) => p.is_online);
  const offline = partners.filter((p) => !p.is_online);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Bike className="h-3.5 w-3.5 mr-1.5" />
          {assignedPartnerId ? "Change partner" : "Assign delivery partner"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Delivery partners</DialogTitle>
          <DialogDescription>
            Approved partners only. Assigning notifies the partner, who then accepts the pickup.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {partners.length === 0 && (
            <p className="text-sm text-muted-foreground">No approved delivery partners yet.</p>
          )}
          {[...online, ...offline].map((p) => (
            <div key={p.id} className="rounded-xl border border-border p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">
                  {p.full_name}
                  {assignedPartnerId === p.id && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">Assigned</Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {p.vehicle_type?.replace(/_/g, " ")}{p.city ? ` · ${p.city}` : ""} · {p.active_assignments} active
                </p>
                {p.mobile && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {p.mobile}
                  </p>
                )}
              </div>
              <Badge className={p.is_online ? "bg-emerald-100 text-emerald-900" : "bg-muted text-muted-foreground"}>
                {p.is_online ? "Online" : "Offline"}
              </Badge>
              <Button size="sm" variant="soft" disabled={busy !== null} onClick={() => assign(p)}>
                {busy === p.id ? "…" : "Assign"}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
