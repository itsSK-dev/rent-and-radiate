import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Store as StoreIcon, AlertTriangle } from "lucide-react";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; isOpen: boolean };

/**
 * Store availability is a database-backed, vendor-controlled flag
 * (`stores.is_open`). It is intentionally independent from whether the vendor
 * is signed in: logging in never opens a store. Closing a store only blocks
 * NEW orders — existing orders remain fully manageable.
 */
export function StoreAvailabilityCard({ storeId, onChanged }: { storeId: string; onChanged?: () => void }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const { data, error } = await supabase.from("stores").select("id,is_open").eq("id", storeId).maybeSingle();
    if (error || !data) {
      setState({ kind: "error", message: error?.message ?? "Store not found" });
      return;
    }
    setState({ kind: "ready", isOpen: (data as any).is_open === true });
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the card in sync when the store row changes anywhere (other tab/device).
  useEffect(() => {
    const channel = supabase
      .channel(`store-availability-${storeId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "stores", filter: `id=eq.${storeId}` },
        (payload: any) => {
          if (payload?.new && typeof payload.new.is_open === "boolean") {
            setState({ kind: "ready", isOpen: payload.new.is_open });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [storeId]);

  async function toggle(next: boolean) {
    setBusy(true);
    // Database is the source of truth; we only trust the returned row.
    const { data, error } = await supabase
      .from("stores")
      .update({ is_open: next } as any)
      .eq("id", storeId)
      .select("id,is_open")
      .maybeSingle();
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not update store availability");
      return;
    }
    const saved = (data as any).is_open === true;
    setState({ kind: "ready", isOpen: saved });
    if (saved !== next) {
      toast.error("You are not allowed to change this store's availability.");
      return;
    }
    toast.success(
      saved
        ? "Your store is now open. Customers can place orders."
        : "Your store is now closed. Customers cannot place new orders.",
    );
    onChanged?.();
  }

  return (
    <div className="rounded-2xl border border-primary/25 bg-card/80 shadow-soft p-5 mb-8">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
        <StoreIcon className="h-3.5 w-3.5" /> Store availability
      </div>

      {state.kind === "loading" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking store status…
        </p>
      )}

      {state.kind === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> Unable to determine store status
          </p>
          <Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button>
        </div>
      )}

      {state.kind === "ready" && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-2xl flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${state.isOpen ? "bg-emerald-500 animate-pulse" : "bg-slate-500"}`}
              />
              {state.isOpen ? "STORE IS OPEN" : "STORE IS CLOSED"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {state.isOpen
                ? "Customers can place new orders."
                : "Customers cannot place new orders. Existing orders can still be managed."}
            </p>
          </div>
          <Button
            variant={state.isOpen ? "outline" : "hero"}
            disabled={busy}
            onClick={() => void toggle(!state.isOpen)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : state.isOpen ? "Close store" : "Open store"}
          </Button>
        </div>
      )}
    </div>
  );
}
