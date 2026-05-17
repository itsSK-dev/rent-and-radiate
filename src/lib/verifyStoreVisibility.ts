import { createClient } from "@supabase/supabase-js";

// Anonymous client (no session) — simulates exactly what a logged-out
// customer would see through the public RLS policy on `stores`.
const anonClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export type VisibilityResult =
  | { visible: true }
  | { visible: false; reason: string };

/**
 * Confirms an approved store is actually visible to customers.
 * Uses an anon client so RLS is evaluated as a public visitor would see it.
 */
export async function verifyStoreVisibleToCustomers(
  storeId: string,
): Promise<VisibilityResult> {
  const { data, error } = await anonClient
    .from("stores")
    .select("id,status,is_verified,is_active,is_blocked")
    .eq("id", storeId)
    .maybeSingle();

  if (error) return { visible: false, reason: error.message };
  if (!data) {
    return {
      visible: false,
      reason: "Store is not returned by the public query (RLS hides it).",
    };
  }
  const failed: string[] = [];
  if (data.status !== "approved") failed.push(`status=${data.status}`);
  if (!data.is_verified) failed.push("is_verified=false");
  if (!data.is_active) failed.push("is_active=false");
  if (data.is_blocked) failed.push("is_blocked=true");
  if (failed.length) return { visible: false, reason: failed.join(", ") };
  return { visible: true };
}
