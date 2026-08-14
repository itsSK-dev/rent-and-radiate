import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DeliveryAddress } from "@/lib/address";

/**
 * Reusable delivery-address form fields. Purely presentational — the parent
 * owns the state and decides when to save.
 */
export function AddressFields({
  value,
  onChange,
  disabled,
}: {
  value: DeliveryAddress;
  onChange: (next: DeliveryAddress) => void;
  disabled?: boolean;
}) {
  const set = (k: keyof DeliveryAddress) => (e: { target: { value: string } }) =>
    onChange({ ...value, [k]: e.target.value });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <Label htmlFor="ad-name">Full name *</Label>
        <Input id="ad-name" className="mt-1.5" value={value.full_name} onChange={set("full_name")} disabled={disabled} />
      </div>
      <div>
        <Label htmlFor="ad-mobile">Mobile number *</Label>
        <Input id="ad-mobile" type="tel" inputMode="numeric" className="mt-1.5" value={value.mobile} onChange={set("mobile")} disabled={disabled} />
      </div>
      <div>
        <Label htmlFor="ad-house">House / Flat / Building *</Label>
        <Input id="ad-house" className="mt-1.5" value={value.house} onChange={set("house")} disabled={disabled} />
      </div>
      <div>
        <Label htmlFor="ad-street">Street / Locality *</Label>
        <Input id="ad-street" className="mt-1.5" value={value.street} onChange={set("street")} disabled={disabled} />
      </div>
      <div>
        <Label htmlFor="ad-landmark">Landmark</Label>
        <Input id="ad-landmark" className="mt-1.5" value={value.landmark} onChange={set("landmark")} disabled={disabled} />
      </div>
      <div>
        <Label htmlFor="ad-city">City *</Label>
        <Input id="ad-city" className="mt-1.5" value={value.city} onChange={set("city")} disabled={disabled} />
      </div>
      <div>
        <Label htmlFor="ad-state">State *</Label>
        <Input id="ad-state" className="mt-1.5" value={value.state} onChange={set("state")} disabled={disabled} />
      </div>
      <div>
        <Label htmlFor="ad-pin">PIN code *</Label>
        <Input id="ad-pin" inputMode="numeric" maxLength={6} className="mt-1.5" value={value.pin} onChange={set("pin")} disabled={disabled} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="ad-note">Delivery instructions</Label>
        <Textarea id="ad-note" rows={2} className="mt-1.5" value={value.instructions} onChange={set("instructions")} disabled={disabled} />
      </div>
    </div>
  );
}
