import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Result = {
  id: string;
  status: string;
  kind: string;
  start_date: string | null;
  end_date: string | null;
  product_title: string | null;
  customer_name: string | null;
  store_name: string | null;
};

export function VendorQRVerify() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    const t = token.trim();
    if (!t) return;
    setBusy(true); setResult(null); setError(null);
    const { data, error: err } = await supabase.functions.invoke("verify-rental-qr", { body: { token: t } });
    setBusy(false);
    if (err || (data as any)?.error) {
      setError((data as any)?.error ?? err?.message ?? "Could not verify");
      return;
    }
    setResult((data as any).rental);
    toast.success("QR verified");
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <QrCode className="h-4 w-4 text-rose-deep" />
        <h3 className="font-medium">Verify rental QR</h3>
      </div>
      <p className="text-xs text-muted-foreground">Paste the customer's QR token (or scan into the field) to confirm their rental before handover or return.</p>
      <div className="flex gap-2">
        <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="QR token (UUID)" className="font-mono text-xs" />
        <Button onClick={verify} disabled={busy || !token.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
        </Button>
      </div>
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex gap-2 items-start">
          <XCircle className="h-4 w-4 mt-0.5" /> {error}
        </div>
      )}
      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm space-y-1">
          <p className="font-medium text-emerald-800 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Valid rental</p>
          <p><strong>{result.product_title}</strong> · <Badge variant="outline">{result.kind}</Badge> · {result.status}</p>
          <p className="text-xs text-muted-foreground">Customer: {result.customer_name ?? "—"}</p>
          {result.start_date && <p className="text-xs text-muted-foreground">Period: {result.start_date} → {result.end_date}</p>}
          <p className="text-xs text-muted-foreground">Order ID: {result.id.slice(0, 8).toUpperCase()}</p>
        </div>
      )}
    </Card>
  );
}
