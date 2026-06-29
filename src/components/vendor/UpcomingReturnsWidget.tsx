import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, ArrowRight } from "lucide-react";
import { format, differenceInHours, differenceInDays } from "date-fns";
import { Link } from "react-router-dom";

type Row = {
  id: string;
  end_date: string;
  status: string;
  quantity: number;
  product: { title: string | null } | null;
  customer: { full_name: string | null } | null;
};

export function UpcomingReturnsWidget({ storeId }: { storeId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 7);
      const { data } = await supabase
        .from("rentals")
        .select("id,end_date,status,quantity,product:products(title),customer:profiles!rentals_customer_id_fkey(full_name)")
        .eq("store_id", storeId)
        .eq("kind", "rent")
        .in("status", ["confirmed", "delivered"])
        .not("end_date", "is", null)
        .lte("end_date", horizon.toISOString().slice(0, 10))
        .order("end_date", { ascending: true })
        .limit(10);
      if (!cancelled) {
        setRows((data as any) ?? []);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [storeId]);

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-card mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-rose-deep" />
          <h3 className="font-display text-xl">Upcoming returns (next 7 days)</h3>
        </div>
        <Badge variant="secondary">{rows.length}</Badge>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rentals due in the next 7 days.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const due = new Date(r.end_date);
            const hrs = differenceInHours(due, new Date());
            const days = differenceInDays(due, new Date());
            const isOverdue = hrs < 0;
            const urgent = !isOverdue && hrs < 24;
            return (
              <Link
                key={r.id}
                to={`/vendor/orders`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 hover:bg-secondary/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{r.product?.title ?? "Product"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.customer?.full_name ?? "Customer"} · ×{r.quantity} · due {format(due, "PP")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="outline"
                    className={
                      isOverdue ? "border-rose-200 bg-rose-50 text-rose-700"
                      : urgent ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }
                  >
                    {isOverdue ? `${Math.abs(hrs)}h overdue` : urgent ? `${hrs}h left` : `${days}d`}
                  </Badge>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
