import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export function DeliveryOTPCard({ rentalId, kind, label }: { rentalId: string; kind: "delivery" | "return"; label?: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("deliverypartner-generate-otp", {
      body: { rentalId, kind },
    });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error || error?.message || "Failed");
    setCode((data as any).code);
    setExpiresAt((data as any).expiresAt);
    toast.success("Share this OTP with your delivery partner");
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary-soft/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">{label ?? (kind === "delivery" ? "Delivery OTP" : "Return OTP")}</p>
      </div>
      {code ? (
        <>
          <p className="font-mono text-3xl tracking-[0.4em] text-center py-3">{code}</p>
          <p className="text-xs text-center text-muted-foreground">Valid until {expiresAt ? new Date(expiresAt).toLocaleTimeString() : "—"}</p>
          <Button variant="ghost" size="sm" className="w-full mt-2" onClick={generate} disabled={busy}>Regenerate</Button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-2">Share this code with your delivery partner to confirm the {kind === "delivery" ? "delivery" : "return pickup"}.</p>
          <Button variant="hero" size="sm" className="w-full" onClick={generate} disabled={busy}>
            {busy ? "Generating…" : `Show ${kind === "delivery" ? "Delivery" : "Return"} OTP`}
          </Button>
        </>
      )}
    </div>
  );
}
