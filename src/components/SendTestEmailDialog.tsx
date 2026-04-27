import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Loader2, CheckCircle2, AlertTriangle, Mail, XCircle, Clock, Eye, ChevronLeft, Copy, Code2, FileText, GitCompare, ShieldAlert, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { renderToStaticMarkup } from "react-dom/server";
import { DisputeOpenedEmail, DisputeResolutionEmail, type DisputeResolutionData } from "@/components/email/DisputeEmailTemplates";
import { useSupportContact } from "@/hooks/useSupportContact";
import { buildPlainText, buildSampleData, buildSubject, type TemplateKey } from "@/lib/disputeEmailPreview";
import { EmailDiffView } from "@/components/EmailDiffView";
import { validatePreview, type ValidationIssue } from "@/lib/previewValidation";

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
  fromName: z.string().trim().min(1, "From name is required").max(120),
  fromEmail: z.string().trim().email("Enter a valid From email").max(255),
  replyTo: z.string().trim().email("Enter a valid Reply-To email").max(255).or(z.literal("")),
});

type SendResult = {
  email: string;
  role: "customer" | "store_owner";
  status: "queued" | "skipped" | "error";
  message: string;
};

type Step = "compose" | "preview" | "results";
type PreviewRole = "customer" | "store_owner";

export function SendTestEmailDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("compose");
  const [template, setTemplate] = useState<TemplateKey>("dispute-opened");
  const [form, setForm] = useState({
    customerName: "Aanya Kapoor",
    customerEmail: "",
    storeName: "Petals & Pearls",
    storeEmail: "",
    fromName: "Bloom Disputes",
    fromEmail: "disputes@bloom.example",
    replyTo: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [infraReady, setInfraReady] = useState<boolean | null>(null);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [previewRole, setPreviewRole] = useState<PreviewRole>("customer");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { contact } = useSupportContact();

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validateAndPreview() {
    const parsed = recipientSchema.safeParse(form);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0]])) as typeof errors);
      return;
    }
    setErrors({});
    setStep("preview");
  }

  // Build the rendered HTML + text for the currently-previewed recipient
  const preview = useMemo(() => {
    const recipient = previewRole === "customer"
      ? { name: form.customerName || "Customer", email: form.customerEmail || "customer@example.com", role: "customer" as const }
      : { name: form.storeName || "Store", email: form.storeEmail || "store@example.com", role: "store_owner" as const };

    const data = buildSampleData(template, recipient, form.storeName || "Petals & Pearls");
    const node = template === "dispute-opened"
      ? <DisputeOpenedEmail data={data} contact={contact} />
      : <DisputeResolutionEmail data={data as DisputeResolutionData} contact={contact} />;

    const innerHtml = renderToStaticMarkup(node);
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preview</title></head><body style="margin:0;background:#fafafa">${innerHtml}</body></html>`;
    const text = buildPlainText(template, data, contact);
    const subject = buildSubject(template, data);
    return { html, text, subject, recipient, data };
  }, [template, previewRole, form.customerName, form.customerEmail, form.storeName, form.storeEmail, contact]);

  // Validate the resolved preview for missing variables, placeholder tokens,
  // and bad sender headers. Recomputes whenever any input changes.
  const validation = useMemo(() => validatePreview({
    template,
    data: preview.data,
    html: preview.html,
    text: preview.text,
    subject: preview.subject,
    from: { name: form.fromName, email: form.fromEmail },
    replyTo: form.replyTo.trim() || undefined,
  }), [template, preview, form.fromName, form.fromEmail, form.replyTo]);

  async function handleConfirmSend() {
    if (!validation.ok) {
      toast.error("Fix the validation issues before sending the test email.");
      return;
    }
    setSending(true);
    setResults(null);
    const replyTo = form.replyTo.trim() || undefined;
    const { data, error } = await supabase.functions.invoke("send-dispute-test-email", {
      body: {
        template,
        from: { name: form.fromName.trim(), email: form.fromEmail.trim() },
        replyTo,
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
      setStep("results");
      window.dispatchEvent(new CustomEvent("test-email-log:refresh"));
      return;
    }
    setResults(data?.results ?? []);
    setInfraReady(!!data?.infraReady);
    setSentAt(data?.sentAt ?? new Date().toISOString());
    setStep("results");
    // Notify the admin log to refresh
    window.dispatchEvent(new CustomEvent("test-email-log:refresh"));
    if (data?.infraReady) {
      const failed = (data?.results ?? []).filter((r: SendResult) => r.status === "error").length;
      if (failed === 0) toast.success("Test emails queued for delivery");
      else toast.warning(`${failed} of ${data.results.length} recipients failed`);
    } else {
      toast("Send skipped — email infrastructure isn't ready yet", { icon: "⚠️" });
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied to clipboard`),
      () => toast.error("Couldn't copy to clipboard"),
    );
  }

  function reset() {
    setResults(null);
    setInfraReady(null);
    setSentAt(null);
    setErrors({});
    setStep("compose");
  }

  const summary = results
    ? {
        queued: results.filter((r) => r.status === "queued").length,
        skipped: results.filter((r) => r.status === "skipped").length,
        failed: results.filter((r) => r.status === "error").length,
      }
    : null;

  const statusStyles: Record<SendResult["status"], { icon: typeof CheckCircle2; wrap: string; iconClass: string; label: string }> = {
    queued: { icon: CheckCircle2, wrap: "border-emerald-500/30 bg-emerald-500/5", iconClass: "text-emerald-600", label: "Queued" },
    skipped: { icon: AlertTriangle, wrap: "border-amber-500/30 bg-amber-500/5", iconClass: "text-amber-600", label: "Skipped" },
    error: { icon: XCircle, wrap: "border-destructive/30 bg-destructive/5", iconClass: "text-destructive", label: "Failed" },
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="hero" size="sm">
          <Send className="h-4 w-4 mr-1.5" /> Send test email
        </Button>
      </DialogTrigger>
      <DialogContent className={step === "preview" ? "max-w-3xl" : "max-w-lg"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <Mail className="h-5 w-5 text-rose-deep" />
            {step === "preview" ? "Preview the test email" : step === "results" ? "Test email results" : "Send a test dispute email"}
          </DialogTitle>
          <DialogDescription>
            {step === "preview"
              ? "This is the exact rendered email each recipient will receive. Confirm to send."
              : step === "results"
              ? "Per-recipient delivery status from the email service."
              : "Sends the selected branded template to both parties so you can verify branding and delivery before going live."}
          </DialogDescription>
        </DialogHeader>

        {step === "compose" && (
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
            <div className="rounded-2xl border border-border bg-secondary/30 p-4 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Sender · From & Reply-To</p>
                <p className="text-[10px] text-muted-foreground">Shown in the inbox header</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">From name</Label>
                  <Input value={form.fromName} onChange={(e) => update("fromName", e.target.value)} placeholder="Bloom Disputes" />
                  {errors.fromName && <p className="text-xs text-destructive">{errors.fromName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">From email</Label>
                  <Input type="email" value={form.fromEmail} onChange={(e) => update("fromEmail", e.target.value)} placeholder="disputes@yourdomain.com" />
                  {errors.fromEmail && <p className="text-xs text-destructive">{errors.fromEmail}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reply-To <span className="text-muted-foreground font-normal">(optional — defaults to From)</span></Label>
                <Input type="email" value={form.replyTo} onChange={(e) => update("replyTo", e.target.value)} placeholder="support@yourdomain.com" />
                {errors.replyTo && <p className="text-xs text-destructive">{errors.replyTo}</p>}
              </div>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3 py-2">
            <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm space-y-1">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span>
                  <span className="text-muted-foreground">From:</span>{" "}
                  {form.fromName || "Sender"} &lt;{form.fromEmail || "no-reply@example.com"}&gt;
                </span>
                <span>
                  <span className="text-muted-foreground">To:</span> {preview.recipient.name} &lt;{preview.recipient.email}&gt;
                </span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span>
                  <span className="text-muted-foreground">Reply-To:</span>{" "}
                  {form.replyTo.trim() ? (
                    <>{form.replyTo.trim()}</>
                  ) : (
                    <span className="text-muted-foreground italic">(defaults to From address)</span>
                  )}
                </span>
              </div>
              <div><span className="text-muted-foreground">Subject:</span> <span className="font-medium">{preview.subject}</span></div>
            </div>

            <ValidationPanel report={validation} />

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Tabs value={previewRole} onValueChange={(v) => setPreviewRole(v as PreviewRole)}>
                <TabsList>
                  <TabsTrigger value="customer">Customer view</TabsTrigger>
                  <TabsTrigger value="store_owner">Store view</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(preview.html, "HTML")}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy HTML
                </Button>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(preview.text, "Plain text")}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy text
                </Button>
              </div>
            </div>

            <Tabs defaultValue="rendered" className="w-full">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="rendered"><Eye className="h-3.5 w-3.5 mr-1.5" /> Rendered</TabsTrigger>
                <TabsTrigger value="html"><Code2 className="h-3.5 w-3.5 mr-1.5" /> HTML source</TabsTrigger>
                <TabsTrigger value="text"><FileText className="h-3.5 w-3.5 mr-1.5" /> Plain text</TabsTrigger>
                <TabsTrigger value="diff"><GitCompare className="h-3.5 w-3.5 mr-1.5" /> Diff</TabsTrigger>
              </TabsList>
              <TabsContent value="rendered" className="mt-3">
                <iframe
                  ref={iframeRef}
                  title="Email preview"
                  srcDoc={preview.html}
                  className="w-full h-[420px] rounded-xl border border-border bg-white"
                  sandbox=""
                />
              </TabsContent>
              <TabsContent value="html" className="mt-3">
                <pre className="w-full h-[420px] overflow-auto rounded-xl border border-border bg-muted/40 p-3 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-all">
                  {preview.html}
                </pre>
              </TabsContent>
              <TabsContent value="text" className="mt-3">
                <pre className="w-full h-[420px] overflow-auto rounded-xl border border-border bg-muted/40 p-3 text-xs leading-relaxed font-mono whitespace-pre-wrap">
                  {preview.text}
                </pre>
              </TabsContent>
              <TabsContent value="diff" className="mt-3">
                <EmailDiffView html={preview.html} text={preview.text} />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {step === "results" && results && (
          <div className="space-y-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {summary && summary.queued > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 px-2.5 py-1 font-medium">
                  <CheckCircle2 className="h-3 w-3" /> {summary.queued} queued
                </span>
              )}
              {summary && summary.skipped > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 px-2.5 py-1 font-medium">
                  <AlertTriangle className="h-3 w-3" /> {summary.skipped} skipped
                </span>
              )}
              {summary && summary.failed > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2.5 py-1 font-medium">
                  <XCircle className="h-3 w-3" /> {summary.failed} failed
                </span>
              )}
              {sentAt && (
                <span className="inline-flex items-center gap-1 text-muted-foreground ml-auto">
                  <Clock className="h-3 w-3" /> {new Date(sentAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            {!infraReady && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Email infrastructure isn't provisioned yet. Verify a sender domain in Cloud → Emails to enable real sends. Your test was logged but no email left the system.</span>
              </div>
            )}

            {results.map((r) => {
              const meta = statusStyles[r.status];
              const Icon = meta.icon;
              return (
                <div key={r.email} className={`rounded-xl border ${meta.wrap} px-3 py-2.5 text-sm`}>
                  <div className="flex items-start gap-2">
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${meta.iconClass}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="font-medium truncate">
                          {r.email} <span className="text-xs text-muted-foreground font-normal">({r.role.replace("_", " ")})</span>
                        </p>
                        <span className={`text-[10px] uppercase tracking-wider font-semibold ${meta.iconClass}`}>{meta.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          {step === "compose" && (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="hero" onClick={validateAndPreview}>
                <Eye className="h-4 w-4 mr-1.5" /> Preview email
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={() => setStep("compose")} disabled={sending}>
                <ChevronLeft className="h-4 w-4 mr-1.5" /> Back to edit
              </Button>
              <Button variant="hero" onClick={handleConfirmSend} disabled={sending || !validation.ok} title={!validation.ok ? "Resolve validation errors first" : undefined}>
                {sending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Sending…</> : <><Send className="h-4 w-4 mr-1.5" /> Confirm &amp; send test</>}
              </Button>
            </>
          )}
          {step === "results" && (
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
