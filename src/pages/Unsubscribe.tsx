import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type State = "loading" | "ready" | "done" | "already" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!token) { setState("error"); setErrorMsg("Missing token."); return; }
    (async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string } });
        const data = await res.json();
        if (!res.ok) { setState("error"); setErrorMsg(data?.error || "Invalid link."); return; }
        if (data?.used) { setState("already"); setEmail(data.email ?? null); return; }
        setEmail(data?.email ?? null);
        setState("ready");
      } catch (e: any) {
        setState("error"); setErrorMsg(e?.message || "Network error.");
      }
    })();
  }, [token]);

  async function confirm() {
    setState("loading");
    const { error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    if (error) { setState("error"); setErrorMsg(error.message); return; }
    setState("done");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center space-y-4">
        <h1 className="font-display text-2xl">Email preferences</h1>
        {state === "loading" && <p className="text-muted-foreground">Loading…</p>}
        {state === "ready" && (
          <>
            <p className="text-muted-foreground">
              Unsubscribe {email ? <strong>{email}</strong> : "this address"} from Rent & Radiate emails?
            </p>
            <Button onClick={confirm} className="w-full">Confirm unsubscribe</Button>
          </>
        )}
        {state === "done" && <p>You have been unsubscribed. We're sorry to see you go.</p>}
        {state === "already" && <p>{email ?? "This address"} is already unsubscribed.</p>}
        {state === "error" && <p className="text-destructive">{errorMsg}</p>}
      </div>
    </main>
  );
}
