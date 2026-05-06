import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RentalProofPanel } from "@/components/RentalProofPanel";
import { RentalStatusTimeline } from "@/components/RentalStatusTimeline";
import { DisputeEmailLog } from "@/components/DisputeEmailLog";
import { format } from "date-fns";
import { ShieldAlert, Upload, Trash2, FileImage } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminRefundsPanel } from "@/components/AdminRefundsPanel";
import { DisputeStatusTimeline } from "@/components/DisputeStatusTimeline";
import { PlatformSettingsPanel } from "@/components/PlatformSettingsPanel";
import { AdminShopsPanel } from "@/components/AdminShopsPanel";

type Dispute = {
  id: string;
  rental_id: string;
  opened_by: string;
  reason: string;
  status: "open" | "reviewing" | "resolved" | "rejected";
  resolution: string | null;
  admin_notes: string | null;
  evidence_images: string[];
  created_at: string;
  rental: {
    id: string;
    start_date: string;
    end_date: string;
    grand_total: number;
    status: string;
    product: { title: string } | null;
    store: { name: string } | null;
  } | null;
  opener: { full_name: string | null } | null;
};

const statusTone: Record<string, string> = {
  open: "bg-destructive/10 text-destructive",
  reviewing: "bg-gold/20 text-rose-deep",
  resolved: "bg-primary-soft text-rose-deep",
  rejected: "bg-secondary text-muted-foreground",
};

const Admin = () => {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [filter, setFilter] = useState<"all" | "open" | "reviewing" | "resolved" | "rejected">("open");

  useEffect(() => { document.title = "Admin · Disputes · Bloom"; }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth?next=/admin"); return; }
    if (!roles.includes("admin")) { toast.error("Admin access required."); navigate("/"); }
  }, [user, roles, loading, navigate]);

  async function load() {
    const { data, error } = await supabase
      .from("disputes")
      .select(`
        id,rental_id,opened_by,reason,status,resolution,admin_notes,evidence_images,created_at,
        rental:rentals(id,start_date,end_date,grand_total,status,product:products(title),store:stores(name)),
        opener:profiles!disputes_opened_by_profiles_fkey(full_name)
      `)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setDisputes((data as any) ?? []);
  }
  useEffect(() => { if (roles.includes("admin")) load(); /* eslint-disable-next-line */ }, [roles]);

  async function updateDispute(id: string, patch: Partial<Dispute>) {
    const { error } = await supabase.from("disputes").update(patch as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dispute updated");
    load();
  }

  if (!user || !roles.includes("admin")) return null;

  const filtered = filter === "all" ? disputes : disputes.filter((d) => d.status === filter);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-12">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Admin</p>
            <h1 className="font-display text-5xl">Admin console</h1>
            <p className="text-muted-foreground mt-1 text-sm">Disputes, deposit refunds, and more.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/email-previews")}>
              Email previews
            </Button>
          </div>
        </div>

        <Tabs defaultValue="disputes">
          <TabsList>
            <TabsTrigger value="disputes">Disputes</TabsTrigger>
            <TabsTrigger value="refunds">Deposit refunds</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="disputes" className="mt-6 space-y-6">
            <div className="flex justify-end">
              <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["open", "reviewing", "resolved", "rejected", "all"].map((s) => (
                    <SelectItem key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
                No {filter === "all" ? "" : filter} disputes.
              </div>
            ) : (
              <div className="space-y-6">
                {filtered.map((d) => (
                  <DisputeCard key={d.id} d={d} onUpdate={(patch) => updateDispute(d.id, patch)} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="refunds" className="mt-6">
            <AdminRefundsPanel />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <PlatformSettingsPanel />
          </TabsContent>
        </Tabs>
      </section>
      <Footer />
    </div>
  );
};

function DisputeCard({ d, onUpdate }: { d: Dispute; onUpdate: (patch: Partial<Dispute>) => void }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState(d.admin_notes ?? "");
  const [resolution, setResolution] = useState(d.resolution ?? "");
  const [uploading, setUploading] = useState(false);
  const evidence = d.evidence_images ?? [];

  async function uploadAdminEvidence(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("Only image files are accepted.");
    if (file.size > 8 * 1024 * 1024) {
      return toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 8 MB.`);
    }
    setUploading(true);
    const path = `disputes/${d.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("rental-proofs").upload(path, file);
    if (upErr) { setUploading(false); return toast.error(`Upload failed: ${upErr.message}`); }
    const { data: pub } = supabase.storage.from("rental-proofs").getPublicUrl(path);
    const next = [...evidence, pub.publicUrl];
    const { error } = await supabase.from("disputes").update({ evidence_images: next }).eq("id", d.id);
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Evidence added.");
    onUpdate({ evidence_images: next });
  }

  async function removeAdminEvidence(url: string) {
    const next = evidence.filter((u) => u !== url);
    const { error } = await supabase.from("disputes").update({ evidence_images: next }).eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Evidence removed.");
    onUpdate({ evidence_images: next });
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-card space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <h3 className="font-display text-2xl">{d.rental?.product?.title ?? "Rental"}</h3>
            <Badge className={statusTone[d.status]}>{d.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {d.rental?.store?.name} · Opened by {d.opener?.full_name ?? "—"} · {format(new Date(d.created_at), "PPp")}
          </p>
          {d.rental && (
            <p className="text-xs text-muted-foreground">
              Rental {format(new Date(d.rental.start_date), "PP")} → {format(new Date(d.rental.end_date), "PP")} · ₹{Number(d.rental.grand_total).toLocaleString("en-IN")} · status: {d.rental.status}
            </p>
          )}
        </div>
        <Select value={d.status} onValueChange={(v) => onUpdate({ status: v as Dispute["status"] })}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["open", "reviewing", "resolved", "rejected"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl bg-secondary p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Reason</p>
        <p className="text-sm whitespace-pre-wrap">{d.reason}</p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Rental evidence photos</p>
        <RentalProofPanel rentalId={d.rental_id} role="admin" stages={["before_delivery", "at_delivery", "after_return"]} />
      </div>

      <div className="rounded-xl bg-secondary/50 p-3">
        <RentalStatusTimeline rentalId={d.rental_id} currentStatus="" />
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <DisputeStatusTimeline disputeId={d.id} />
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <DisputeEmailLog disputeId={d.id} />
      </div>

      {/* Admin-only evidence area */}
      <div className="rounded-2xl border border-dashed border-rose-deep/30 bg-blossom/30 p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <FileImage className="h-4 w-4 text-rose-deep" />
              <h4 className="font-medium">Admin evidence</h4>
              <Badge variant="outline" className="text-rose-deep border-rose-deep/40">{evidence.length}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Attach extra photos (e.g. courier receipts, lab assessments, screenshots) before resolving or rejecting.
              Visible to both parties alongside the resolution.
            </p>
          </div>
          <label className={`shrink-0 inline-flex items-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 py-2 text-sm cursor-pointer hover:border-primary transition-smooth ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Uploading…" : "Add evidence"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAdminEvidence(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>

        {evidence.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No admin evidence attached yet.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {evidence.map((url) => (
              <div key={url} className="relative group aspect-square rounded-lg overflow-hidden bg-petal">
                <a href={url} target="_blank" rel="noreferrer" className="block w-full h-full">
                  <img src={url} alt="admin evidence" className="w-full h-full object-cover" loading="lazy" />
                </a>
                <button
                  type="button"
                  onClick={() => removeAdminEvidence(url)}
                  className="absolute top-1 right-1 rounded-full bg-background/90 p-1 opacity-0 group-hover:opacity-100 transition-smooth hover:bg-destructive hover:text-destructive-foreground"
                  aria-label="Remove evidence"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground/80 mt-2">JPG, PNG or HEIC · up to 8 MB per photo.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 pt-2">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Internal notes</label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1" maxLength={1000} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Resolution (visible to parties)</label>
          <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} className="mt-1" maxLength={1000} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => onUpdate({ admin_notes: notes, resolution })}>
          Save notes
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onUpdate({ admin_notes: notes, resolution, status: "rejected" })}>
          Reject
        </Button>
        <Button variant="hero" size="sm" onClick={() => onUpdate({ admin_notes: notes, resolution, status: "resolved" })}>
          Resolve
        </Button>
      </div>
    </div>
  );
}

export default Admin;
