import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2, CheckCircle2, AlertTriangle, Mail } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type TemplateKey = "dispute-opened" | "dispute-resolved" | "dispute-rejected";

const templateLabels: Record<TemplateKey, string> = {
  "dispute-opened": "Dispute opened",
  "dispute-resolved": "Dispute resolved",
  "dispute-rejected": "Dispute rejected",
};

const recipientSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required").max(120),
  customerEmail: z.string().trim().email("Enter a valid customer email").max(255),
  storeName: z.string().trim().min(1, "Store contact name is required").max(120),
  storeEmail: z.string().trim().email("Enter a valid store email").max(255),
});

type SendResult = {
  email: string;
  role: "customer" | "store_owner";
  status: "queued" | "skipped" | "error";
  message: string;
};

export function SendTestEmailDialog() {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<TemplateKey>("dispute-opened");
  const [form, setForm] = useState({
    customerName: "Aanya Kapoor",
    customerEmail: "",
    storeName: "Petals & Pearls",
    storeEmail: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [infraReady, setInfraReady] = useState<boolean | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSend() {
    const parsed = recipientSchema.safeParse(form);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0]])) as typeof errors);
      return;
    }
    setSending(true);
    setResults(null);
    const { data, error } = await supabase.functions.invoke("send-dispute-test-email", {
      body: {
        template,
        recipients: [
          { email: form.customerEmail, role: "customer", name: form.customerName },
          { email: form.storeEmail, role: "store_owner", name: form.storeName },
        ],
      },
    });
    setSending(false);
    if (error) {
      toast.error("Couldn't send test email", { description: error.message });
      setResults([
        { email: form.customerEmail, role: "customer", status: "error", message: error.message || "Unknown error contacting the email service." },
        { email: form.storeEmail, role: "store_owner", status: "error", message: error.message || "Unknown error contacting the email service." },
      ]);
      setInfraReady(false);
      setSentAt(new Date().toISOString());
      return;
    }
    setResults(data?.results ?? []);
    setInfraReady(!!data?.infraReady);
    setSentAt(data?.sentAt ?? new Date().toISOString());
    if (data?.infraReady) {
      const failed = (data?.results ?? []).filter((r: SendResult) => r.status === "error").length;
      if (failed === 0) toast.success("Test emails queued for delivery");
      else toast.warning(`${failed} of ${data.results.length} recipients failed`);
    } else {
      toast("Send skipped — email infrastructure isn't ready yet", { icon: "⚠️" });
    }
  }

  function reset() {
    setResults(null);
    setInfraReady(null);
    setErrors({});
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="hero" size="sm">
          <Send className="h-4 w-4 mr-1.5" /> Send test email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <Mail className="h-5 w-5 text-rose-deep" /> Send a test dispute email
          </DialogTitle>
          <DialogDescription>
            Sends the selected branded template to both parties so you can verify branding and delivery before going live.
          </DialogDescription>
        </DialogHeader>

        {!results ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={template} onValueChange={(v) => setTemplate(v as TemplateKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(templateLabels).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-2xl border border-border bg-secondary/30 p-4 space-y-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Customer recipient</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Name</Label>
                  <Input value={form.customerName} onChange={(e) => update("customerName", e.target.value)} />
                  {errors.customerName && <p className="text-xs text-destructive">{errors.customerName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" placeholder="customer@example.com" value={form.customerEmail} onChange={(e) => update("customerEmail", e.target.value)} />
                  {errors.customerEmail && <p className="text-xs text-destructive">{errors.customerEmail}</p>}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-secondary/30 p-4 space-y-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Store recipient</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Store name</Label>
                  <Input value={form.storeName} onChange={(e) => update("storeName", e.target.value)} />
                  {errors.storeName && <p className="text-xs text-destructive">{errors.storeName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" placeholder="store@example.com" value={form.storeEmail} onChange={(e) => update("storeEmail", e.target.value)} />
                  {errors.storeEmail && <p className="text-xs text-destructive">{errors.storeEmail}</p>}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {!infraReady && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span>Email infrastructure isn't provisioned yet. Verify a sender domain in Cloud → Emails to enable real sends. Your test was logged but no email left the system.</span>
              </div>
            )}
            {results.map((r) => (
              <div key={r.email} className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
                {r.status === "queued" ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
                )}
                <div>
                  <p className="font-medium">{r.email} <span className="text-xs text-muted-foreground">({r.role.replace("_", " ")})</span></p>
                  <p className="text-xs text-muted-foreground">{r.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {!results ? (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={sending}>Cancel</Button>
              <Button variant="hero" onClick={handleSend} disabled={sending}>
                {sending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Sending…</> : <><Send className="h-4 w-4 mr-1.5" /> Send test email</>}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={reset}>Send another</Button>
              <Button variant="hero" onClick={() => setOpen(false)}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
