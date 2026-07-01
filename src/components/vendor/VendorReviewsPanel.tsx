import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { format } from "date-fns";

type Rating = {
  id: string;
  stars: number;
  comment: string | null;
  created_at: string;
  rater: { full_name: string | null } | null;
  rental: { product: { title: string } | null } | null;
};

export function VendorReviewsPanel({ storeId }: { storeId: string }) {
  const [rows, setRows] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("ratings")
        .select(
          "id,stars,comment,created_at,rater:profiles!ratings_rater_id_fkey(full_name),rental:rentals(product:products(title))"
        )
        .eq("ratee_store_id", storeId)
        .order("created_at", { ascending: false });
      if (!cancel) {
        setRows((data as any) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [storeId]);

  const avg = rows.length ? rows.reduce((a, r) => a + r.stars, 0) / rows.length : 0;

  if (loading) return <p className="text-sm text-muted-foreground">Loading reviews…</p>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-6">
        <div className="text-center">
          <p className="font-display text-4xl">{avg.toFixed(1)}</p>
          <div className="flex justify-center mt-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-4 w-4 ${s <= Math.round(avg) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{rows.length} review{rows.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((s) => {
            const count = rows.filter((r) => r.stars === s).length;
            const pct = rows.length ? (count / rows.length) * 100 : 0;
            return (
              <div key={s} className="flex items-center gap-2 text-xs">
                <span className="w-6">{s}★</span>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No reviews yet. Once customers rate their orders, you'll see them here.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${s <= r.stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium">{r.rater?.full_name ?? "Customer"}</span>
                  {r.rental?.product?.title && (
                    <Badge variant="outline" className="text-[10px]">{r.rental.product.title}</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), "PP")}</span>
              </div>
              {r.comment && <p className="text-sm mt-2 text-foreground/90">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
