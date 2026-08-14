import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { AddressFields } from "@/components/AddressFields";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  type DeliveryAddress, EMPTY_ADDRESS, addressFromProfile, profileAddressPayload, validateAddress,
} from "@/lib/address";

/** Loads the signed-in customer's saved delivery address (profiles.addr_*). */
export function useSavedAddress() {
  const { user } = useAuth();
  const [address, setAddress] = useState<DeliveryAddress>({ ...EMPTY_ADDRESS });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) { setLoaded(true); return; }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, addr_full_name, addr_mobile, addr_house, addr_street, addr_landmark, addr_city, addr_state, addr_pin, addr_instructions")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      setAddress(addressFromProfile(data));
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [user?.id]);

  return { address, setAddress, loaded };
}

/**
 * Dialog for entering / editing the delivery address. Saves to the customer's
 * profile so it is reused next time, and hands the address back to the caller
 * so it can be snapshotted onto the order.
 */
export function DeliveryAddressDialog({
  value,
  onSaved,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  value: DeliveryAddress;
  onSaved: (a: DeliveryAddress) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [draft, setDraft] = useState<DeliveryAddress>(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setDraft(value); }, [open, value]);

  async function save() {
    const problem = validateAddress(draft);
    if (problem) return toast.error(problem);
    if (!user) return toast.error("Please sign in first.");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update(profileAddressPayload(draft) as any)
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Delivery address saved");
    onSaved(draft);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Delivery address</DialogTitle>
          <DialogDescription>
            We need your complete address before your order can be placed and paid for.
          </DialogDescription>
        </DialogHeader>
        <AddressFields value={draft} onChange={setDraft} disabled={saving} />
        <DialogFooter>
          <Button variant="hero" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save address"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
