import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Live count of rentals/orders awaiting vendor action (status='pending')
 * across all stores owned by the current user.
 */
export function useNewOrderCount() {
  const { user, roles } = useAuth();
  const [count, setCount] = useState(0);
  const isVendor = roles.includes("store_owner");

  useEffect(() => {
    if (!user || !isVendor) {
      setCount(0);
      return;
    }
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: stores } = await supabase
        .from("stores")
        .select("id")
        .eq("owner_id", user.id);
      const storeIds = (stores ?? []).map((s) => s.id);
      if (cancelled || storeIds.length === 0) return;

      const refresh = async () => {
        const { count: c } = await supabase
          .from("rentals")
          .select("id", { count: "exact", head: true })
          .in("store_id", storeIds)
          .eq("status", "pending");
        if (!cancelled) setCount(c ?? 0);
      };

      await refresh();

      channel = supabase
        .channel("vendor-new-orders")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "rentals" },
          (payload) => {
            const row: any = payload.new ?? payload.old;
            if (row && storeIds.includes(row.store_id)) refresh();
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, isVendor]);

  return count;
}
