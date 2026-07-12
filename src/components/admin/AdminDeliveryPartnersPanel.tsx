import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { Phone, Mail } from "lucide-react";

type Partner = {
  id: string; user_id: string; full_name: string; mobile: string; email: string | null;
  city: string; state: string; pin_code: string;
  vehicle_type: string; vehicle_number: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  rejection_reason: string | null;
  is_online: boolean; created_at: string;
};

export function AdminDeliveryPartnersPanel() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "suspended">("pending");
  const [search, setSearch] = useState("");

  async function load() {
    const { data } = await supabase.from("delivery_partners").select("*").order("created_at", { ascending: false });
    setPartners((data as any) ?? []);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return partners.filter((p) => p.status === tab && (
      !search || p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.mobile.includes(search) || p.city.toLowerCase().includes(search.toLowerCase())
    ));
  }, [partners, tab, search]);

  async function updateStatus(id: string, status: Partner["status"], reason?: string) {
    const { error } = await supabase.from("delivery_partners")
      .update({ status, rejection_reason: reason ?? null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            {(["pending", "approved", "rejected", "suspended"] as const).map((s) => (
              <TabsTrigger key={s} value={s} className="capitalize">
                {s} <Badge className="ml-1">{partners.filter((p) => p.status === s).length}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input placeholder="Search name, phone, city…" className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No {tab} partners.</p>}
        {filtered.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{p.full_name} <Badge variant="outline" className="ml-1 capitalize">{p.vehicle_type}</Badge></p>
                <p className="text-xs text-muted-foreground">{p.city}, {p.state} · {p.pin_code}</p>
                <p className="text-xs text-muted-foreground">Applied {format(new Date(p.created_at), "PP")}</p>
                {p.rejection_reason && <p className="text-xs text-destructive mt-1">Reason: {p.rejection_reason}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a href={`tel:${p.mobile}`} className="text-xs inline-flex items-center gap-1 text-primary"><Phone className="h-3 w-3" /> {p.mobile}</a>
                {p.email && <a href={`mailto:${p.email}`} className="text-xs inline-flex items-center gap-1 text-primary"><Mail className="h-3 w-3" /> {p.email}</a>}
                <DocsDialog partnerId={p.id} />
                {p.status === "pending" && (
                  <>
                    <Button size="sm" variant="hero" onClick={() => updateStatus(p.id, "approved")}>Approve</Button>
                    <RejectDialog onSubmit={(reason) => updateStatus(p.id, "rejected", reason)} />
                  </>
                )}
                {p.status === "approved" && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, "suspended")}>Suspend</Button>
                )}
                {p.status === "suspended" && (
                  <Button size="sm" variant="hero" onClick={() => updateStatus(p.id, "approved")}>Reactivate</Button>
                )}
                {p.status === "rejected" && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, "pending")}>Re-open</Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RejectDialog({ onSubmit }: { onSubmit: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost">Reject</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Rejection reason</DialogTitle></DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason visible to the applicant" />
        <Button variant="hero" onClick={() => { if (!reason.trim()) return toast.error("Add a reason"); onSubmit(reason.trim()); setOpen(false); }}>Send rejection</Button>
      </DialogContent>
    </Dialog>
  );
}

function DocsDialog({ partnerId }: { partnerId: string }) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<{ doc_type: string; url: string }[]>([]);

  async function load() {
    const { data } = await supabase.from("delivery_partner_documents").select("doc_type, file_path").eq("partner_id", partnerId);
    const withUrls = await Promise.all((data ?? []).map(async (d: any) => {
      const { data: signed } = await supabase.storage.from("delivery-partner-docs").createSignedUrl(d.file_path, 60 * 30);
      return { doc_type: d.doc_type, url: signed?.signedUrl ?? "" };
    }));
    setDocs(withUrls);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      <DialogTrigger asChild><Button size="sm" variant="outline">View documents</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Uploaded documents</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
          {docs.map((d) => (
            <a key={d.doc_type} href={d.url} target="_blank" rel="noreferrer" className="rounded-lg border border-border overflow-hidden hover:border-primary">
              <img src={d.url} alt={d.doc_type} className="w-full h-48 object-cover bg-muted" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <p className="p-2 text-xs capitalize">{d.doc_type.replace(/_/g, " ")}</p>
            </a>
          ))}
          {docs.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-6">No documents.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
