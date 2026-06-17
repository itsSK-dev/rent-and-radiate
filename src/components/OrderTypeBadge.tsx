import { ShoppingBag, Repeat } from "lucide-react";
import { format } from "date-fns";

export type OrderKind = "buy" | "rent";

interface Props {
  kind: OrderKind;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Highly visible badge identifying whether an order is a purchase
 * (no return required) or a rental (must be returned).
 */
export function OrderTypeBadge({ kind, size = "md", className = "" }: Props) {
  const isBuy = kind === "buy";
  const sizing =
    size === "lg"
      ? "text-sm px-3 py-1.5"
      : size === "sm"
      ? "text-[10px] px-2 py-0.5"
      : "text-xs px-2.5 py-1";
  const tone = isBuy
    ? "bg-emerald-100 text-emerald-900 border-emerald-300"
    : "bg-sky-100 text-sky-900 border-sky-300";
  const Icon = isBuy ? ShoppingBag : Repeat;
  const dot = isBuy ? "bg-emerald-500" : "bg-sky-500";
  const label = isBuy ? "PURCHASE ORDER" : "RENTAL ORDER";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-wide ${tone} ${sizing} ${className}`}
      title={
        isBuy
          ? "Purchase — product is bought and does not need to be returned"
          : "Rental — product must be returned after the rental period"
      }
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

interface RentalDatesProps {
  startDate?: string | null;
  endDate?: string | null;
  returnDue?: string | null;
  className?: string;
}

export function RentalDates({ startDate, endDate, returnDue, className = "" }: RentalDatesProps) {
  if (!startDate && !endDate) return null;
  const due = returnDue ?? endDate;
  const fmt = (d: string) => {
    try { return format(new Date(d), "PP"); } catch { return d; }
  };
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${className}`}>
      {startDate && (
        <span className="inline-flex items-center gap-1">
          <span className="text-muted-foreground">Start:</span>
          <span className="font-medium">{fmt(startDate)}</span>
        </span>
      )}
      {endDate && (
        <span className="inline-flex items-center gap-1">
          <span className="text-muted-foreground">End:</span>
          <span className="font-medium">{fmt(endDate)}</span>
        </span>
      )}
      {due && (
        <span className="inline-flex items-center gap-1 text-rose-700">
          <span className="text-muted-foreground">Return due:</span>
          <span className="font-semibold">{fmt(due)}</span>
        </span>
      )}
    </div>
  );
}
