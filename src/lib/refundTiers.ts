export type RefundTier = "perfect" | "minor" | "moderate" | "severe";

export const REFUND_TIERS: Array<{
  value: RefundTier;
  label: string;
  percent: number;
  description: string;
}> = [
  { value: "perfect", label: "Perfect condition", percent: 100, description: "No damage. Full deposit refunded." },
  { value: "minor", label: "Minor wear", percent: 75, description: "Light marks, easily cleanable. 25% deduction." },
  { value: "moderate", label: "Moderate damage", percent: 40, description: "Stains or small tears requiring repair. 60% deduction." },
  { value: "severe", label: "Severe damage", percent: 0, description: "Item unusable or lost. Full deposit forfeited." },
];

export function calculateRefund(deposit: number, tier: RefundTier): { percent: number; amount: number } {
  const t = REFUND_TIERS.find((x) => x.value === tier)!;
  const amount = Math.round((deposit * t.percent) / 100);
  return { percent: t.percent, amount };
}

export const REFUND_STATUS_LABEL: Record<string, string> = {
  pending_admin: "Awaiting admin approval",
  approved: "Approved",
  rejected: "Rejected",
};

export const REFUND_STATUS_TONE: Record<string, string> = {
  pending_admin: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-100 text-rose-700 border-rose-200",
};
