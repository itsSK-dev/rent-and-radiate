/**
 * Shared delivery-address helpers.
 * The address lives in two places:
 *  - profiles.addr_*  → the customer's saved/default address
 *  - rentals.ship_*   → an immutable snapshot taken when the order is placed
 */

export type DeliveryAddress = {
  full_name: string;
  mobile: string;
  house: string;
  street: string;
  landmark: string;
  city: string;
  state: string;
  pin: string;
  instructions: string;
};

export const EMPTY_ADDRESS: DeliveryAddress = {
  full_name: "", mobile: "", house: "", street: "", landmark: "",
  city: "", state: "", pin: "", instructions: "",
};

const REQUIRED: (keyof DeliveryAddress)[] = [
  "full_name", "mobile", "house", "street", "city", "state", "pin",
];

export const ADDRESS_REQUIRED_MESSAGE =
  "A complete delivery address is required before you can place this order.";

/** Returns a human message for the first problem, or null when the address is complete. */
export function validateAddress(a: Partial<DeliveryAddress> | null | undefined): string | null {
  if (!a) return ADDRESS_REQUIRED_MESSAGE;
  const labels: Record<string, string> = {
    full_name: "Full name", mobile: "Mobile number", house: "House / Flat / Building",
    street: "Street / Locality", city: "City", state: "State", pin: "PIN code",
  };
  for (const k of REQUIRED) {
    if (!String(a[k] ?? "").trim()) return `${labels[k]} is required.`;
  }
  const mobile = String(a.mobile ?? "").replace(/\D/g, "");
  if (mobile.length < 10) return "Enter a valid 10-digit mobile number.";
  if (!/^\d{6}$/.test(String(a.pin ?? "").trim())) return "Enter a valid 6-digit PIN code.";
  return null;
}

export function isAddressComplete(a: Partial<DeliveryAddress> | null | undefined): boolean {
  return validateAddress(a) === null;
}

/** Single-line address text kept in the legacy `rentals.address` column. */
export function formatAddress(a: DeliveryAddress): string {
  return [
    a.full_name, a.mobile, a.house, a.street,
    a.landmark ? `Near ${a.landmark}` : "",
    a.city, a.state, a.pin,
    a.instructions ? `Note: ${a.instructions}` : "",
  ].filter((x) => String(x ?? "").trim()).join(", ");
}

/** profiles.addr_* row → DeliveryAddress */
export function addressFromProfile(row: any): DeliveryAddress {
  if (!row) return { ...EMPTY_ADDRESS };
  return {
    full_name: row.addr_full_name ?? row.full_name ?? "",
    mobile: row.addr_mobile ?? row.phone ?? "",
    house: row.addr_house ?? "",
    street: row.addr_street ?? "",
    landmark: row.addr_landmark ?? "",
    city: row.addr_city ?? "",
    state: row.addr_state ?? "",
    pin: row.addr_pin ?? "",
    instructions: row.addr_instructions ?? "",
  };
}

export function profileAddressPayload(a: DeliveryAddress) {
  return {
    addr_full_name: a.full_name.trim(),
    addr_mobile: a.mobile.trim(),
    addr_house: a.house.trim(),
    addr_street: a.street.trim(),
    addr_landmark: a.landmark.trim() || null,
    addr_city: a.city.trim(),
    addr_state: a.state.trim(),
    addr_pin: a.pin.trim(),
    addr_instructions: a.instructions.trim() || null,
  };
}

/** rentals.ship_* snapshot payload (plus the legacy single-line column). */
export function rentalAddressPayload(a: DeliveryAddress) {
  return {
    ship_full_name: a.full_name.trim(),
    ship_mobile: a.mobile.trim(),
    ship_house: a.house.trim(),
    ship_street: a.street.trim(),
    ship_landmark: a.landmark.trim() || null,
    ship_city: a.city.trim(),
    ship_state: a.state.trim(),
    ship_pin: a.pin.trim(),
    ship_instructions: a.instructions.trim() || null,
    address: formatAddress(a),
  };
}

/** rentals.ship_* row → DeliveryAddress */
export function addressFromRental(row: any): DeliveryAddress {
  if (!row) return { ...EMPTY_ADDRESS };
  return {
    full_name: row.ship_full_name ?? "",
    mobile: row.ship_mobile ?? "",
    house: row.ship_house ?? "",
    street: row.ship_street ?? "",
    landmark: row.ship_landmark ?? "",
    city: row.ship_city ?? "",
    state: row.ship_state ?? "",
    pin: row.ship_pin ?? "",
    instructions: row.ship_instructions ?? "",
  };
}

/** Multi-line block used by shop-owner and delivery-partner views. */
export function addressLines(a: DeliveryAddress): string[] {
  return [
    a.house,
    a.street,
    a.landmark ? `Landmark: ${a.landmark}` : "",
    [a.city, a.state, a.pin].filter(Boolean).join(", "),
  ].filter((x) => String(x ?? "").trim());
}
