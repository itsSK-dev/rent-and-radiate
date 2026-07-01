import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  BadgeCheck, Clock, X, Check, ExternalLink, FileText, ShieldCheck, Loader2,
} from "lucide-react";
import { format } from "date-fns";

type Row = {
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
  created_at: string;
  updated_at: string;
  store?: { name: string; city: string | null } | null;
  owner?: { full_name: string | null } | null;
};

type Tab = "submitted" | "approved" | "rejected" | "draft";

export function AdminVerificationsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<Tab>("submitted");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<Row | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("store_verifications")
      .select("*")
      .order("submitted_at", { ascending: false, nullsFirst: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const list = (data as Row[]) ?? [];
    const storeIds = Array.from(new Set(list.map((r) => r.store_id)));
    const ownerIds = Array.from(new Set(list.map((r) => r.owner_id)));
    const [{ data: stores }, { data: profs }] = await Promise.all([
      supabase.from("stores").select("id,name,city").in("id", storeIds.length ? storeIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("profiles").select("id,full_name").in("id", ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const sMap = new Map((stores ?? []).map((s: any) => [s.id, s]));
    const pMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    setRows(list.map((r) => ({
      ...r,
      store: sMap.get(r.store_id) ?? null,
      owner: pMap.get(r.owner_id) ?? null,
    })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = rows
    .filter((r) => r.status === tab)
    .filter((r) => {
      const term = q.trim().toLowerCase();
      if (!term) return true;
      return (r.store?.name ?? "").toLowerCase().includes(term)
        || (r.owner?.full_name ?? "").toLowerCase().includes(term);
    });

  const counts = {
    submitted: rows.filter((r) => r.status === "submitted").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    draft: rows.filter((r) => r.status === "draft").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Shop verification submissions
          </h2>
          <p className="text-sm text-muted-foreground">
            Review KYC documents (license, GST, Aadhaar/PAN, shop photos, bank) submitted by sellers.
          </p>
        </div>
        <Input placeholder="Search shop or owner…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap h-auto">
          {(["submitted", "approved", "rejected", "draft"] as Tab[]).map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t} <span className="ml-1.5 text-xs opacity-70">({counts[t]})</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {(["submitted", "approved", "rejected", "draft"] as Tab[]).map((t) => (
          <TabsContent key={t} value={t} className="mt-6">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
                No {t} submissions.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filtered.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-border bg-card p-5 shadow-card flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-lg">{r.store?.name ?? "Untitled shop"}</h3>
                        <p className="text-xs text-muted-foreground">
                          {r.owner?.full_name ?? "—"} · {r.store?.city ?? "—"}
                        </p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1">
                      <span>License: <b className="text-foreground">{r.business_license_number ?? "—"}</b></span>
                      <span>ID: <b className="text-foreground uppercase">{r.id_type ?? "—"}</b></span>
                      <span>GST: <b className="text-foreground">{r.gst_number ?? "—"}</b></span>
                      <span>Photos: <b className="text-foreground">{r.shop_photos?.length ?? 0}</b></span>
                    </div>
                    {r.submitted_at && (
                      <p className="text-xs text-muted-foreground">
                        Submitted {format(new Date(r.submitted_at), "dd MMM yyyy, HH:mm")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      <Button size="sm" variant="outline" onClick={() => setReviewing(r)}>
                        <FileText className="h-4 w-4" /> Review documents
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <ReviewDialog row={reviewing} onClose={() => setReviewing(null)} onDone={async () => { setReviewing(null); await load(); }} />
    </div>
  );
}

function StatusBadge({ status }: { status: Row["status"] }) {
  const map = {
    approved: { icon: BadgeCheck, tone: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Approved" },
    submitted: { icon: Clock, tone: "bg-amber-100 text-amber-800 border-amber-200", label: "Pending" },
    rejected: { icon: X, tone: "bg-rose-100 text-rose-800 border-rose-200", label: "Rejected" },
    draft: { icon: FileText, tone: "bg-muted text-muted-foreground border-border", label: "Draft" },
  } as const;
  const it = map[status]; const Icon = it.icon;
  return <Badge variant="outline" className={it.tone}><Icon className="h-3 w-3 mr-1" />{it.label}</Badge>;
}

function ReviewDialog({ row, onClose, onDone }: { row: Row | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);

  useEffect(() => { setReason(row?.rejection_reason ?? ""); }, [row?.id]);

  if (!row) return null;

  async function decide(next: "approved" | "rejected") {
    if (!row) return;
    if (next === "rejected" && !reason.trim()) return toast.error("Provide a rejection reason for the seller");
    setBusy(next === "approved" ? "approve" : "reject");
    const patch: any = { status: next };
    if (next === "rejected") patch.rejection_reason = reason.trim();
    const { error } = await (supabase as any)
      .from("store_verifications").update(patch).eq("id", row.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(next === "approved" ? "Approved — shop is now verified" : "Sent back to seller");
    onDone();
  }

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row.store?.name ?? "Shop"} — verification review</DialogTitle>
          <DialogDescription>Owner: {row.owner?.full_name ?? "—"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Section title="Business license">
            <KV k="License number" v={row.business_license_number} />
            <DocLink label="License document" url={row.business_license_url} />
          </Section>

          <Section title="GST (optional)">
            <KV k="GST number" v={row.gst_number ?? "—"} />
            <DocLink label="GST certificate" url={row.gst_certificate_url} />
          </Section>

          <Section title="ID proof">
            <KV k="Type" v={(row.id_type ?? "—").toUpperCase()} />
            <KV k="Number" v={row.id_number} />
            <DocLink label="ID document" url={row.id_document_url} />
          </Section>

          <Section title="Shop photos">
            {row.shop_photos?.length ? (
              <div className="grid grid-cols-3 gap-2 col-span-2">
                {row.shop_photos.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-border">
                    <img src={u} alt="shop" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground col-span-2">No photos uploaded</p>}
          </Section>

          <Section title="Bank details">
            <KV k="Account holder" v={row.bank_account_holder} />
            <KV k="Bank" v={row.bank_name} />
            <KV k="Account number" v={row.bank_account_number} />
            <KV k="IFSC" v={row.bank_ifsc} />
          </Section>

          {row.status === "submitted" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Rejection reason (required to reject)</label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                placeholder="Explain what the seller needs to fix…" />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {row.status === "submitted" ? (
            <>
              <Button variant="outline" disabled={!!busy} onClick={() => decide("rejected")}
                className="text-destructive border-destructive/40 hover:bg-destructive/10">
                {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Reject
              </Button>
              <Button variant="hero" disabled={!!busy} onClick={() => decide("approved")}>
                {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Approve & verify shop
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">{title}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{k}</p>
      <p className="font-medium truncate">{v || "—"}</p>
    </div>
  );
}

function DocLink({ label, url }: { label: string; url: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
          Open <ExternalLink className="h-3 w-3" />
        </a>
      ) : <p className="text-sm text-muted-foreground">—</p>}
    </div>
  );
}
