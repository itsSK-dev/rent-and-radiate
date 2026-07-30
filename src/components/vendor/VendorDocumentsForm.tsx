import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";
import {
  Upload, FileCheck2, Loader2, X, Send, BadgeCheck, Clock, AlertCircle, Image as ImageIcon,
} from "lucide-react";
import { catalogLog } from "@/lib/catalogDebug";

const AADHAAR = /^\d{12}$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const schema = z.object({
  business_license_number: z.string().trim().min(3).max(40),
  business_license_url: z.string().url(),
  gst_number: z.string().trim().regex(GST, "Invalid GST number").optional().or(z.literal("")),
  gst_certificate_url: z.string().url().optional().or(z.literal("")),
  id_type: z.enum(["aadhaar", "pan"]),
  id_number: z.string().trim().min(6).max(20),
  id_document_url: z.string().url(),
  shop_photos: z.array(z.string().url()).min(1, "Upload at least one shop photo").max(6),
  bank_account_holder: z.string().trim().min(2).max(80),
  bank_account_number: z.string().trim().min(6).max(20),
  bank_ifsc: z.string().trim().regex(IFSC, "Invalid IFSC code"),
  bank_name: z.string().trim().min(2).max(80),
});

type Verification = {
  id: string;
  store_id: string;
  owner_id: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  rejection_reason: string | null;
  business_license_number: string | null;
  business_license_url: string | null;
  gst_number: string | null;
  gst_certificate_url: string | null;
  id_type: "aadhaar" | "pan" | null;
  id_number: string | null;
  id_document_url: string | null;
  shop_photos: string[];
  bank_account_holder: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

export function VendorDocumentsForm({ storeId, onSaved }: { storeId: string; onSaved?: () => void }) {
  const { user } = useAuth();
  const [record, setRecord] = useState<Verification | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    business_license_number: "",
    business_license_url: "",
    gst_number: "",
    gst_certificate_url: "",
    id_type: "aadhaar",
    id_number: "",
    id_document_url: "",
    shop_photos: [] as string[],
    bank_account_holder: "",
    bank_account_number: "",
    bank_ifsc: "",
    bank_name: "",
  });

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [storeId]);

  async function load() {
    const { data } = await (supabase as any)
      .from("store_verifications")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();
    if (data) {
      setRecord(data as Verification);
      setForm({
        business_license_number: data.business_license_number ?? "",
        business_license_url: data.business_license_url ?? "",
        gst_number: data.gst_number ?? "",
        gst_certificate_url: data.gst_certificate_url ?? "",
        id_type: data.id_type ?? "aadhaar",
        id_number: data.id_number ?? "",
        id_document_url: data.id_document_url ?? "",
        shop_photos: data.shop_photos ?? [],
        bank_account_holder: data.bank_account_holder ?? "",
        bank_account_number: data.bank_account_number ?? "",
        bank_ifsc: data.bank_ifsc ?? "",
        bank_name: data.bank_name ?? "",
      });
    }
  }

  const locked = record?.status === "approved" || record?.status === "submitted";

  async function uploadFile(field: string, file: File) {
    if (!user) return;
    if (file.size > 8 * 1024 * 1024) return toast.error("Max file size 8MB");
    setUploading(field);
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${user.id}/${storeId}/${field}-${Date.now()}.${ext}`;
    catalogLog("verification-file-upload-start", { storeId, field, path, size: file.size, type: file.type });
    const { error } = await supabase.storage.from("verification-docs").upload(path, file, {
      upsert: true, contentType: file.type,
    });
    setUploading(null);
    if (error) return toast.error(error.message);
    const { data: signed } = await supabase.storage.from("verification-docs").createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl ?? "";
    catalogLog("verification-file-upload-success", { storeId, field, path, hasUrl: !!url });
    if (field === "shop_photos") {
      setForm((f: any) => ({ ...f, shop_photos: [...(f.shop_photos || []), url].slice(0, 6) }));
    } else {
      setForm((f: any) => ({ ...f, [field]: url }));
    }
    toast.success("Uploaded");
  }

  function removePhoto(url: string) {
    setForm((f: any) => ({ ...f, shop_photos: (f.shop_photos || []).filter((u: string) => u !== url) }));
  }

  async function save(nextStatus: "draft" | "submitted") {
    if (!user) return;
    if (nextStatus === "submitted") {
      const parsed = schema.safeParse(form);
      if (!parsed.success) {
        return toast.error(parsed.error.issues[0].message);
      }
      if (form.id_type === "aadhaar" && !AADHAAR.test(form.id_number)) return toast.error("Invalid Aadhaar (12 digits)");
      if (form.id_type === "pan" && !PAN.test(form.id_number.toUpperCase())) return toast.error("Invalid PAN (ABCDE1234F)");
    }
    setBusy(true);
    const payload: any = {
      store_id: storeId,
      owner_id: user.id,
      status: nextStatus,
      business_license_number: form.business_license_number || null,
      business_license_url: form.business_license_url || null,
      gst_number: form.gst_number ? form.gst_number.toUpperCase() : null,
      gst_certificate_url: form.gst_certificate_url || null,
      id_type: form.id_type,
      id_number: form.id_type === "pan" ? (form.id_number || "").toUpperCase() : form.id_number || null,
      id_document_url: form.id_document_url || null,
      shop_photos: form.shop_photos || [],
      bank_account_holder: form.bank_account_holder || null,
      bank_account_number: form.bank_account_number || null,
      bank_ifsc: form.bank_ifsc ? form.bank_ifsc.toUpperCase() : null,
      bank_name: form.bank_name || null,
    };
    const q = record?.id
      ? (supabase as any).from("store_verifications").update(payload).eq("id", record.id)
      : (supabase as any).from("store_verifications").insert(payload);
    catalogLog("verification-save-start", { storeId, status: nextStatus, isUpdate: !!record?.id });
    const { error } = await q;
    setBusy(false);
    if (error) return toast.error(error.message);
    catalogLog("verification-save-success", { storeId, status: nextStatus, isUpdate: !!record?.id });
    toast.success(nextStatus === "submitted" ? "Submitted for admin review" : "Draft saved");
    await load();
    onSaved?.();
  }

  const StatusBadge = () => {
    if (!record) return null;
    const map = {
      approved: { icon: BadgeCheck, tone: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Approved" },
      submitted: { icon: Clock, tone: "bg-amber-100 text-amber-700 border-amber-200", label: "Awaiting admin review" },
      rejected: { icon: AlertCircle, tone: "bg-rose-100 text-rose-700 border-rose-200", label: "Changes requested" },
      draft: { icon: FileCheck2, tone: "bg-muted text-muted-foreground border-border", label: "Draft" },
    } as const;
    const it = map[record.status];
    const Icon = it.icon;
    return <Badge variant="outline" className={it.tone}><Icon className="h-3 w-3 mr-1" />{it.label}</Badge>;
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-card mb-8 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">KYC & shop verification</p>
          <h3 className="font-display text-2xl">Upload verification documents</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Only admins can view your documents. GST is optional.
          </p>
        </div>
        <StatusBadge />
      </div>

      {record?.status === "rejected" && record.rejection_reason && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700">
          <p className="font-medium mb-1">Admin feedback</p>
          <p>{record.rejection_reason}</p>
        </div>
      )}

      <fieldset disabled={locked || busy} className="space-y-6 disabled:opacity-70">
        {/* Business license */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Business license number *</Label>
            <Input value={form.business_license_number}
              onChange={(e) => setForm((f: any) => ({ ...f, business_license_number: e.target.value }))} />
          </div>
          <FileField
            label="Business license (PDF/JPG) *"
            value={form.business_license_url}
            uploading={uploading === "business_license_url"}
            onFile={(f) => uploadFile("business_license_url", f)}
          />
        </div>

        {/* GST (optional) */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>GST number <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={form.gst_number} placeholder="22ABCDE1234F1Z5"
              onChange={(e) => setForm((f: any) => ({ ...f, gst_number: e.target.value.toUpperCase() }))} />
          </div>
          <FileField
            label="GST certificate (optional)"
            value={form.gst_certificate_url}
            uploading={uploading === "gst_certificate_url"}
            onFile={(f) => uploadFile("gst_certificate_url", f)}
          />
        </div>

        {/* ID proof */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>ID type *</Label>
            <Select value={form.id_type} onValueChange={(v) => setForm((f: any) => ({ ...f, id_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aadhaar">Aadhaar</SelectItem>
                <SelectItem value="pan">PAN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{form.id_type === "aadhaar" ? "Aadhaar number *" : "PAN *"}</Label>
            <Input value={form.id_number}
              placeholder={form.id_type === "aadhaar" ? "12 digits" : "ABCDE1234F"}
              onChange={(e) => setForm((f: any) => ({ ...f, id_number: e.target.value }))} />
          </div>
          <FileField
            label="ID document *"
            value={form.id_document_url}
            uploading={uploading === "id_document_url"}
            onFile={(f) => uploadFile("id_document_url", f)}
          />
        </div>

        {/* Shop photos */}
        <div className="space-y-2">
          <Label>Shop photos * <span className="text-muted-foreground">(1–6 images)</span></Label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(form.shop_photos || []).map((url: string) => (
              <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                <img src={url} alt="shop" className="w-full h-full object-cover" />
                {!locked && (
                  <button type="button" onClick={() => removePhoto(url)}
                    className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            {(form.shop_photos?.length ?? 0) < 6 && !locked && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-border grid place-items-center cursor-pointer hover:border-primary transition">
                {uploading === "shop_photos"
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile("shop_photos", f); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </div>

        {/* Bank */}
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Bank details for payouts</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Account holder name *</Label>
              <Input value={form.bank_account_holder}
                onChange={(e) => setForm((f: any) => ({ ...f, bank_account_holder: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Bank name *</Label>
              <Input value={form.bank_name}
                onChange={(e) => setForm((f: any) => ({ ...f, bank_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Account number *</Label>
              <Input value={form.bank_account_number} inputMode="numeric"
                onChange={(e) => setForm((f: any) => ({ ...f, bank_account_number: e.target.value.replace(/\D/g, "") }))} />
            </div>
            <div className="space-y-2">
              <Label>IFSC *</Label>
              <Input value={form.bank_ifsc} placeholder="HDFC0001234"
                onChange={(e) => setForm((f: any) => ({ ...f, bank_ifsc: e.target.value.toUpperCase() }))} />
            </div>
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-border">
        {record?.status === "approved" ? (
          <p className="text-sm text-emerald-700 flex items-center gap-2">
            <BadgeCheck className="h-4 w-4" /> Documents approved — your shop is verified.
          </p>
        ) : record?.status === "submitted" ? (
          <p className="text-sm text-muted-foreground">Submitted. An admin will review shortly.</p>
        ) : (
          <>
            <Button variant="outline" disabled={busy} onClick={() => save("draft")}>Save draft</Button>
            <Button variant="hero" disabled={busy} onClick={() => save("submitted")}>
              <Send className="h-4 w-4" /> Submit for review
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function FileField({
  label, value, uploading, onFile,
}: { label: string; value: string; uploading: boolean; onFile: (f: File) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <label className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 cursor-pointer hover:border-primary transition text-sm">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        <span className="truncate flex-1">
          {value ? "Uploaded ✓ (click to replace)" : "Click to upload"}
        </span>
        {value && (
          <a href={value} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            className="text-primary text-xs underline">View</a>
        )}
        <input type="file" accept="image/*,application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      </label>
    </div>
  );
}
