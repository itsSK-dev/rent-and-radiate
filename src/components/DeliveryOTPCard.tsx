import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type Otp = { code_plain: string | null; expires_at: string; sent_channel: string | null };

export function DeliveryOTPCard({ rentalId, kind, label }: { rentalId: string; kind: "delivery" | "return"; label?: string }) {
  const [otp, setOtp] = useState<Otp | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("delivery_otps")
      .select("code_plain, expires_at, sent_channel")
      .eq("rental_id", rentalId)
      .eq("kind", kind)
      .is("verified_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setOtp((data as Otp) ?? null);
    setLoading(false);
  }, [rentalId, kind]);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`otp-${rentalId}-${kind}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_otps", filter: `rental_id=eq.${rentalId}` }, () => void load())
      .subscribe();
    const t = setInterval(() => void load(), 30_000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [load, rentalId, kind]);

  const title = label ?? (kind === "delivery" ? "Delivery verification" : "Return verification");

  return (
    <div className="rounded-xl border border-primary/30 bg-primary-soft/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">{title}</p>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Checking…</p>
      ) : !otp ? (
        <p className="text-xs text-muted-foreground">
          When your delivery partner arrives, they'll request a 6-digit code. We'll text it to your registered mobile —
          share it with them to confirm the {kind === "delivery" ? "delivery" : "return pickup"}.
        </p>
      ) : otp.code_plain ? (
        <>
          <p className="font-mono text-3xl tracking-[0.4em] text-center py-3">{otp.code_plain}</p>
          <p className="text-xs text-center text-muted-foreground">
            Valid until {new Date(otp.expires_at).toLocaleTimeString()} · share only with your delivery partner
          </p>
        </>
      ) : (
        <div className="flex items-start gap-2">
          <Smartphone className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            A 6-digit code was sent by SMS to your registered mobile, valid until{" "}
            {new Date(otp.expires_at).toLocaleTimeString()}. Share it with your delivery partner.
          </p>
        </div>
      )}

      <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => void load()} disabled={loading}>
        Refresh
      </Button>
    </div>
  );
}
