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
import { format } from "date-fns";
import { ShieldAlert, Upload, Trash2, FileImage } from "lucide-react";
import { toast } from "sonner";

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
        id,rental_id,opened_by,reason,status,resolution,admin_notes,created_at,
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
            <h1 className="font-display text-5xl">Disputes</h1>
            <p className="text-muted-foreground mt-1 text-sm">Review proof images, party notes, and resolve cases.</p>
          </div>
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
      </section>
      <Footer />
    </div>
  );
};

function DisputeCard({ d, onUpdate }: { d: Dispute; onUpdate: (patch: Partial<Dispute>) => void }) {
  const [notes, setNotes] = useState(d.admin_notes ?? "");
  const [resolution, setResolution] = useState(d.resolution ?? "");

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
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Evidence photos</p>
        <RentalProofPanel rentalId={d.rental_id} role="admin" stages={["before_delivery", "at_delivery", "after_return"]} />
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
        <Button variant="hero" size="sm" onClick={() => onUpdate({ admin_notes: notes, resolution, status: "resolved" })}>
          Resolve
        </Button>
      </div>
    </div>
  );
}

export default Admin;
