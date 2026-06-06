import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, QrCode, Landmark } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

type Settings = {
  upi_id: string;
  payee_name: string;
  qr_image_url: string | null;
  instructions: string;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
};

const EMPTY: Settings = {
  upi_id: "",
  payee_name: "Rent & Radiate",
  qr_image_url: null,
  instructions: "",
  bank_account_name: "",
  bank_account_number: "",
  bank_ifsc: "",
  bank_name: "",
};

export function PaymentSettingsPanel() {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await (supabase as any)
      .from("payment_settings")
      .select("upi_id,payee_name,qr_image_url,instructions,bank_account_name,bank_account_number,bank_ifsc,bank_name")
      .eq("id", true).maybeSingle();
    setS({ ...EMPTY, ...(data ?? {}) });
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!s) return;
    setSaving(true);
    const { error } = await (supabase as any).from("payment_settings")
      .update({
        upi_id: s.upi_id.trim(),
        payee_name: s.payee_name.trim() || "Rent & Radiate",
        qr_image_url: s.qr_image_url?.trim() || null,
        instructions: s.instructions,
        bank_account_name: s.bank_account_name?.trim() || null,
        bank_account_number: s.bank_account_number?.trim() || null,
        bank_ifsc: s.bank_ifsc?.trim().toUpperCase() || null,
        bank_name: s.bank_name?.trim() || null,
      }).eq("id", true);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Payment settings saved");
  }

  if (!s) return <div className="text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  const previewUrl = s.upi_id
    ? `upi://pay?pa=${encodeURIComponent(s.upi_id)}&pn=${encodeURIComponent(s.payee_name || "Rent & Radiate")}&cu=INR`
    : "";

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-card space-y-5">
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-rose-deep" />
          <h2 className="font-display text-2xl">UPI / QR settings</h2>
        </div>
        <p className="text-sm text-muted-foreground -mt-3">Customers see this QR code at checkout.</p>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div>
              <Label>UPI ID</Label>
              <Input value={s.upi_id} onChange={(e) => setS({ ...s, upi_id: e.target.value })} placeholder="yourname@okicici" className="mt-1" />
            </div>
            <div>
              <Label>Payee name</Label>
              <Input value={s.payee_name} onChange={(e) => setS({ ...s, payee_name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Custom QR image URL (optional)</Label>
              <Input value={s.qr_image_url ?? ""} onChange={(e) => setS({ ...s, qr_image_url: e.target.value })} placeholder="https://…/qr.png" className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">Leave blank to auto-generate a dynamic QR with the order amount.</p>
            </div>
            <div>
              <Label>Instructions</Label>
              <Textarea rows={3} value={s.instructions} onChange={(e) => setS({ ...s, instructions: e.target.value })} className="mt-1" maxLength={500} />
            </div>
          </div>

          <div className="rounded-2xl bg-blossom/30 p-4 flex flex-col items-center justify-center gap-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Preview</p>
            {s.qr_image_url ? (
              <img src={s.qr_image_url} alt="QR" className="h-44 w-44 object-contain rounded-xl bg-white p-2" />
            ) : previewUrl ? (
              <div className="rounded-xl bg-white p-2"><QRCodeSVG value={previewUrl} size={176} /></div>
            ) : (
              <p className="text-sm text-muted-foreground">Enter a UPI ID to preview</p>
            )}
            <p className="text-xs font-mono">{s.upi_id || "—"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-card space-y-5">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-rose-deep" />
          <h2 className="font-display text-2xl">Bank account (for payouts)</h2>
        </div>
        <p className="text-sm text-muted-foreground -mt-3">Used for shop payouts and Razorpay settlement records. Visible only to admins.</p>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Account holder name</Label>
            <Input value={s.bank_account_name ?? ""} onChange={(e) => setS({ ...s, bank_account_name: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Bank name</Label>
            <Input value={s.bank_name ?? ""} onChange={(e) => setS({ ...s, bank_name: e.target.value })} placeholder="HDFC Bank" className="mt-1" />
          </div>
          <div>
            <Label>Account number</Label>
            <Input value={s.bank_account_number ?? ""} onChange={(e) => setS({ ...s, bank_account_number: e.target.value.replace(/\D/g, "") })} inputMode="numeric" maxLength={20} className="mt-1" />
          </div>
          <div>
            <Label>IFSC code</Label>
            <Input value={s.bank_ifsc ?? ""} onChange={(e) => setS({ ...s, bank_ifsc: e.target.value.toUpperCase() })} maxLength={11} placeholder="HDFC0001234" className="mt-1 font-mono" />
          </div>
        </div>
      </div>

      <div>
        <Button variant="hero" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save all payment settings"}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Razorpay API keys are stored as encrypted backend secrets — manage them from the Cloud secrets panel, not from this page.
        </p>
      </div>
    </div>
  );
}
