import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, subDays, subMonths } from "date-fns";

export type RangeKey = "7d" | "30d" | "90d" | "12m" | "all";
export type Bucket = "day" | "week" | "month" | "year";

export function rangeStart(range: RangeKey): Date | null {
  if (range === "7d") return subDays(new Date(), 7);
  if (range === "30d") return subDays(new Date(), 30);
  if (range === "90d") return subDays(new Date(), 90);
  if (range === "12m") return subMonths(new Date(), 12);
  return null;
}

export function defaultBucket(range: RangeKey): Bucket {
  if (range === "7d" || range === "30d" || range === "90d") return "day";
  if (range === "12m") return "week";
  return "month";
}

export function bucketStart(d: Date, b: Bucket): Date {
  if (b === "day") return startOfDay(d);
  if (b === "week") return startOfWeek(d, { weekStartsOn: 1 });
  if (b === "month") return startOfMonth(d);
  return startOfYear(d);
}

export function bucketLabel(d: Date, b: Bucket): string {
  if (b === "day") return format(d, "MMM d");
  if (b === "week") return `W/${format(d, "MMM d")}`;
  if (b === "month") return format(d, "MMM yyyy");
  return format(d, "yyyy");
}

async function count(table: string, build?: (q: any) => any) {
  let q: any = (supabase as any).from(table).select("id", { count: "exact", head: true });
  if (build) q = build(q);
  const { count: c } = await q;
  return c ?? 0;
}

export async function fetchOverview() {
  const PAID = ["paid", "partial_refund", "refunded"];
  const ACTIVE_RENTAL = ["confirmed", "packing", "ready_for_pickup", "shipped", "delivered"];

  const [
    totalUsers,
    totalProducts,
    totalOrders,
    pendingOrders,
    activeRentals,
    completedRentals,
    pendingRefunds,
    completedRefunds,
    sellersRes,
    revenueRes,
    commissionRes,
  ] = await Promise.all([
    count("profiles"),
    count("products"),
    count("rentals"),
    count("rentals", (q) => q.eq("status", "pending")),
    count("rentals", (q) => q.neq("kind", "buy").in("status", ACTIVE_RENTAL)),
    count("rentals", (q) => q.neq("kind", "buy").eq("status", "returned")),
    count("deposit_refunds", (q) => q.eq("status", "pending_admin")),
    count("deposit_refunds", (q) => q.in("status", ["approved", "processed"])),
    (supabase as any).from("stores").select("owner_id").eq("status", "approved"),
    (supabase as any).from("rentals").select("grand_total").in("payment_status", PAID),
    (supabase as any).from("vendor_settlements").select("platform_fee"),
  ]);

  const totalSellers = new Set(((sellersRes as any).data ?? []).map((r: any) => r.owner_id)).size;
  const totalRevenue = ((revenueRes as any).data ?? []).reduce(
    (s: number, r: any) => s + Number(r.grand_total || 0),
    0,
  );
  const platformCommission = ((commissionRes as any).data ?? []).reduce(
    (s: number, r: any) => s + Number(r.platform_fee || 0),
    0,
  );

  return {
    totalUsers,
    totalSellers,
    totalProducts,
    activeRentals,
    completedRentals,
    totalOrders,
    pendingOrders,
    totalRevenue,
    platformCommission,
    pendingRefunds,
    completedRefunds,
  };
}

export type RentalRow = {
  id: string;
  kind: string;
  status: string;
  payment_status: string;
  grand_total: number | null;
  subtotal: number | null;
  created_at: string;
  returned_at: string | null;
  product_id: string | null;
  store_id: string | null;
};

export async function fetchRentalsInRange(range: RangeKey): Promise<RentalRow[]> {
  let q: any = (supabase as any)
    .from("rentals")
    .select("id,kind,status,payment_status,grand_total,subtotal,created_at,returned_at,product_id,store_id")
    .order("created_at", { ascending: true })
    .limit(20000);
  const start = rangeStart(range);
  if (start) q = q.gte("created_at", start.toISOString());
  const { data } = await q;
  return (data as RentalRow[]) ?? [];
}

export async function fetchRefundsInRange(range: RangeKey) {
  let q: any = (supabase as any)
    .from("deposit_refunds")
    .select("id,status,refund_amount,created_at")
    .order("created_at", { ascending: true })
    .limit(20000);
  const start = rangeStart(range);
  if (start) q = q.gte("created_at", start.toISOString());
  const { data } = await q;
  return (data as { id: string; status: string; refund_amount: number; created_at: string }[]) ?? [];
}

export async function fetchSettlementsInRange(range: RangeKey) {
  let q: any = (supabase as any)
    .from("vendor_settlements")
    .select("id,platform_fee,created_at")
    .order("created_at", { ascending: true })
    .limit(20000);
  const start = rangeStart(range);
  if (start) q = q.gte("created_at", start.toISOString());
  const { data } = await q;
  return (data as { id: string; platform_fee: number; created_at: string }[]) ?? [];
}

export function bucketize<T>(
  rows: T[],
  getDate: (r: T) => string | null | undefined,
  bucket: Bucket,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const ds = getDate(r);
    if (!ds) continue;
    const key = bucketStart(new Date(ds), bucket).toISOString();
    const arr = map.get(key) ?? [];
    arr.push(r);
    map.set(key, arr);
  }
  return map;
}

export function toSeries(
  buckets: Map<string, any[]>,
  bucket: Bucket,
  reduce: (rows: any[]) => Record<string, number>,
): Array<Record<string, any>> {
  const keys = Array.from(buckets.keys()).sort();
  return keys.map((k) => ({
    date: bucketLabel(new Date(k), bucket),
    sort: k,
    ...reduce(buckets.get(k) ?? []),
  }));
}

export function csvDownload(filename: string, rows: Array<Record<string, any>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h] ?? "";
          const s = String(v).replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const inr = (n: number) =>
  `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
