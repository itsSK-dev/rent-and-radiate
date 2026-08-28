import { supabase } from "@/integrations/supabase/client";

export type StoreAvailability = { id: string; name: string; is_open: boolean };

/**
 * Re-reads live availability straight from the database. Used right before an
 * order is created so a stale page/tab can never slip past a closed store.
 * The database also enforces this (trigger on rentals) — this is the friendly
 * client-side half of the same rule.
 */
export async function fetchStoreAvailability(storeIds: string[]): Promise<Map<string, StoreAvailability>> {
  const ids = Array.from(new Set(storeIds.filter(Boolean)));
  const map = new Map<string, StoreAvailability>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase.from("stores").select("id,name,is_open").in("id", ids);
  if (error) throw error;
  (data ?? []).forEach((s: any) => map.set(s.id, { id: s.id, name: s.name, is_open: s.is_open === true }));
  return map;
}

/** Returns the name of the first closed store, or null when every store is open. */
export async function findClosedStore(storeIds: string[]): Promise<string | null> {
  const map = await fetchStoreAvailability(storeIds);
  for (const id of storeIds) {
    const s = map.get(id);
    if (!s) return "This store";
    if (!s.is_open) return s.name;
  }
  return null;
}

export const storeClosedMessage = (name: string) =>
  `${name} is currently closed and is not accepting new orders.`;
