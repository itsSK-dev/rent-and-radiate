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
  pending_admin: "Pending admin approval",
  approved: "Approved",
  processing: "Processing refund",
  completed: "Refund completed",
  failed: "Refund failed",
  rejected: "Rejected",
};

export const REFUND_STATUS_TONE: Record<string, string> = {
  pending_admin: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-sky-100 text-sky-800 border-sky-200",
  processing: "bg-indigo-100 text-indigo-800 border-indigo-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  failed: "bg-rose-100 text-rose-800 border-rose-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
};
