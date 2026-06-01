import { supabase } from "@/integrations/supabase/client";

export type NotifyAudience = "customer" | "store";

export interface NotifyArgs {
  rentalId: string;
  eventKey: string; // unique per event, used as idempotency key suffix
  headline: string;
  statusLine?: string;
  message?: string;
  audience?: NotifyAudience[];
}

/**
 * Fire-and-forget email notification for a rental status change.
 * Errors are logged but never thrown, so UI flows continue uninterrupted.
 */
export async function notifyRentalStatus(args: NotifyArgs) {
  try {
    const { error } = await supabase.functions.invoke("notify-rental-status", { body: args });
    if (error) console.warn("[notifyRentalStatus] failed:", error.message);
  } catch (e) {
    console.warn("[notifyRentalStatus] threw:", e);
  }
}
