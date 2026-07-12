// Shared pricing helpers used across product detail, cart, checkout, vendor.

export type PlatformFeeSlabs = {
  tiers: { max: number; fee: number }[];
  above: { base_fee: number; threshold: number; step: number; step_fee: number };
};

export type DeliveryFeeSlabs = {
  tiers: { max_order: number; fee: number }[];
};

export type PlatformSettings = {
  gst_percent: number;
  gst_enabled: boolean;
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
  platform_fee_slabs: PlatformFeeSlabs;
  delivery_fee_slabs: DeliveryFeeSlabs;
};

export const MIN_RENTAL_PERCENT = 10;

export const DEFAULT_PLATFORM_FEE_SLABS: PlatformFeeSlabs = {
  tiers: [
    { max: 499, fee: 50 },
    { max: 999, fee: 70 },
    { max: 1999, fee: 120 },
  ],
  above: { base_fee: 120, threshold: 1999, step: 1000, step_fee: 50 },
};

export const DEFAULT_DELIVERY_FEE_SLABS: DeliveryFeeSlabs = {
  tiers: [
    { max_order: 499, fee: 50 },
    { max_order: 999, fee: 40 },
    { max_order: 100_000_000, fee: 25 },
  ],
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  gst_percent: 18,
  gst_enabled: true,
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
  platform_fee_slabs: DEFAULT_PLATFORM_FEE_SLABS,
  delivery_fee_slabs: DEFAULT_DELIVERY_FEE_SLABS,
};

/** One-day platform fee for a given final (discounted) unit price. */
export function computePlatformFeeOneDay(price: number, slabs?: PlatformFeeSlabs): number {
  const cfg = slabs ?? DEFAULT_PLATFORM_FEE_SLABS;
  const p = Math.max(0, Number(price) || 0);
  const sortedTiers = [...cfg.tiers].sort((a, b) => a.max - b.max);
  for (const t of sortedTiers) if (p <= Number(t.max)) return Math.max(0, Number(t.fee) || 0);
  const a = cfg.above;
  const step = Math.max(1, Number(a.step) || 1000);
  const extra = Math.max(0, Math.ceil((p - Number(a.threshold)) / step));
  return Math.max(0, (Number(a.base_fee) || 0) + extra * (Number(a.step_fee) || 0));
}

/** Total platform fee = one-day-fee × days × quantity (days = 1 for buy orders). */
export function computePlatformFee(
  unitPrice: number,
  quantity: number,
  days: number,
  slabs?: PlatformFeeSlabs,
): number {
  const perDay = computePlatformFeeOneDay(unitPrice, slabs);
  const qty = Math.max(1, Number(quantity) || 1);
  const d = Math.max(1, Number(days) || 1);
  return round2(perDay * qty * d);
}

/** Configurable delivery charge based on order value (rental/buy subtotal). */
export function computeDeliveryCharge(orderValue: number, slabs?: DeliveryFeeSlabs, fallback = 50): number {
  const cfg = slabs ?? DEFAULT_DELIVERY_FEE_SLABS;
  const v = Math.max(0, Number(orderValue) || 0);
  const sorted = [...cfg.tiers].sort((a, b) => a.max_order - b.max_order);
  for (const t of sorted) if (v <= Number(t.max_order)) return Math.max(0, Number(t.fee) || 0);
  return Math.max(0, Number(fallback) || 0);
}



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
  subtotal: number;
  discount: number;
  deposit: number;
  gst: number;
  delivery: number;
  platformFee: number;
  commission: number;
  grandTotal: number;
  vendorEarnings: number;
};

export type LineWithFeeInput = { line: LineBreakdown; unitPrice: number; quantity: number; days: number };

export function computeOrderTotals(
  lines: LineBreakdown[],
  settings: PlatformSettings,
  opts: { delivery: boolean; feeInputs?: LineWithFeeInput[] } = { delivery: true },
): OrderTotals {
  const subtotal = round2(lines.reduce((s, l) => s + l.subtotal, 0));
  const discount = round2(lines.reduce((s, l) => s + l.discount, 0));
  const deposit = round2(lines.reduce((s, l) => s + l.deposit, 0));
  const gstEnabled = settings.gst_enabled !== false;
  const gst = gstEnabled ? round2((subtotal * (Number(settings.gst_percent) || 0)) / 100) : 0;
  const delivery = opts.delivery ? round2(computeDeliveryCharge(subtotal, settings.delivery_fee_slabs, settings.delivery_fee)) : 0;
  const commission = round2((subtotal * (Number(settings.commission_percent) || 0)) / 100);
  const platformFee = round2(
    (opts.feeInputs ?? []).reduce(
      (s, f) => s + computePlatformFee(f.unitPrice, f.quantity, f.days, settings.platform_fee_slabs),
      0,
    ),
  );
  const grandTotal = round2(subtotal + gst + delivery + deposit + platformFee);
  const vendorEarnings = round2(subtotal - commission);
  return { subtotal, discount, deposit, gst, delivery, platformFee, commission, grandTotal, vendorEarnings };
}


function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
