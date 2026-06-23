// Shared pricing helpers used across product detail, cart, checkout, vendor.

export type PlatformSettings = {
  gst_percent: number;
  delivery_fee: number;
  commission_percent: number;
  rental_price_percent: number;
  deposit_percent_of_price: number;
  protection_plan_percent: number;
  protection_plan_min: number;
  late_fee_multiplier: number;
  late_fee_grace_hours: number;
  rent_to_own_enabled: boolean;
  rent_to_own_credit_percent: number;
};

export const MIN_RENTAL_PERCENT = 10;

export const DEFAULT_SETTINGS: PlatformSettings = {
  gst_percent: 18,
  delivery_fee: 50,
  commission_percent: 10,
  rental_price_percent: 10,
  deposit_percent_of_price: 100,
  protection_plan_percent: 5,
  protection_plan_min: 49,
  late_fee_multiplier: 1.5,
  late_fee_grace_hours: 2,
  rent_to_own_enabled: false,
  rent_to_own_credit_percent: 50,
};

/** Optional Rental Protection Plan fee = max(min, percent% of rental subtotal). */
export function protectionPlanFee(subtotal: number, s: Pick<PlatformSettings, "protection_plan_percent" | "protection_plan_min">) {
  const pct = Math.max(0, Number(s.protection_plan_percent) || 0);
  const min = Math.max(0, Number(s.protection_plan_min) || 0);
  const v = Math.max(min, (Number(subtotal) || 0) * pct / 100);
  return Math.round(v * 100) / 100;
}

/** Daily rental price = max(10%, configured%) of the product's discounted selling price. */
export function computeDailyRentalPrice(effectivePrice: number, rentalPercent: number): number {
  const ap = Number(effectivePrice) || 0;
  const pct = Math.max(MIN_RENTAL_PERCENT, Number(rentalPercent) || MIN_RENTAL_PERCENT);
  return Math.round(((ap * pct) / 100) * 100) / 100;
}

/** Refundable security deposit derived from the discounted selling price. */
export function computeSecurityDeposit(effectivePrice: number, depositPercent: number): number {
  const ap = Number(effectivePrice) || 0;
  const pct = Math.max(0, Number(depositPercent) || 0);
  return Math.round(((ap * pct) / 100) * 100) / 100;
}

export function discountedUnitPrice(
  actual: number,
  discountPercent: number,
  discountFlat: number,
): number {
  const ap = Number(actual) || 0;
  const pct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  const flat = Math.max(0, Number(discountFlat) || 0);
  const afterPct = ap - (ap * pct) / 100;
  return Math.max(0, Math.round((afterPct - flat) * 100) / 100);
}

export type LineInput = {
  kind: "rent" | "buy";
  pricePerDay: number;
  actualPrice: number;
  discountPercent: number;
  discountFlat: number;
  securityDeposit: number;
  quantity: number;
  days?: number; // for rent
};

export type LineBreakdown = {
  baseUnit: number;       // per unit, before discount
  finalUnit: number;      // per unit, after discount (used for buy)
  base: number;           // line base (rental_total or buy total) before discount
  discount: number;       // total discount on this line
  subtotal: number;       // base - discount
  deposit: number;        // total deposit (rent only)
};

export function computeLine(i: LineInput): LineBreakdown {
  const qty = Math.max(1, Number(i.quantity) || 1);
  const finalUnit = discountedUnitPrice(i.actualPrice, i.discountPercent, i.discountFlat);

  if (i.kind === "buy") {
    const base = (Number(i.actualPrice) || 0) * qty;
    const subtotal = finalUnit * qty;
    return {
      baseUnit: Number(i.actualPrice) || 0,
      finalUnit,
      base,
      discount: Math.max(0, base - subtotal),
      subtotal,
      deposit: 0,
    };
  }

  // Rent
  const days = Math.max(1, Number(i.days) || 1);
  const base = (Number(i.pricePerDay) || 0) * days * qty;
  // Apply same percent/flat discount to rental total per unit
  const pct = Math.max(0, Math.min(100, Number(i.discountPercent) || 0));
  const flat = Math.max(0, Number(i.discountFlat) || 0);
  const discountPerUnit = ((Number(i.pricePerDay) || 0) * days * pct) / 100 + flat;
  const totalDiscount = Math.max(0, Math.min(base, discountPerUnit * qty));
  const subtotal = Math.max(0, base - totalDiscount);
  return {
    baseUnit: Number(i.pricePerDay) || 0,
    finalUnit,
    base,
    discount: totalDiscount,
    subtotal,
    deposit: (Number(i.securityDeposit) || 0) * qty,
  };
}

export type OrderTotals = {
  subtotal: number;       // sum of line subtotals
  discount: number;       // sum of line discounts
  deposit: number;        // sum of deposits (rent)
  gst: number;            // gst on (subtotal)
  delivery: number;       // delivery fee (single, applied once)
  commission: number;     // platform commission for vendor
  grandTotal: number;     // payable
  vendorEarnings: number; // subtotal - commission (delivery & GST handled by platform)
};

export function computeOrderTotals(
  lines: LineBreakdown[],
  settings: PlatformSettings,
  opts: { delivery: boolean } = { delivery: true },
): OrderTotals {
  const subtotal = round2(lines.reduce((s, l) => s + l.subtotal, 0));
  const discount = round2(lines.reduce((s, l) => s + l.discount, 0));
  const deposit = round2(lines.reduce((s, l) => s + l.deposit, 0));
  const gst = round2((subtotal * (Number(settings.gst_percent) || 0)) / 100);
  const delivery = opts.delivery ? round2(Number(settings.delivery_fee) || 0) : 0;
  const commission = round2((subtotal * (Number(settings.commission_percent) || 0)) / 100);
  const grandTotal = round2(subtotal + gst + delivery + deposit);
  const vendorEarnings = round2(subtotal - commission);
  return { subtotal, discount, deposit, gst, delivery, commission, grandTotal, vendorEarnings };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
