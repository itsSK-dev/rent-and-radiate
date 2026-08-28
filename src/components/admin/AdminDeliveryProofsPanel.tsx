import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, XCircle } from "lucide-react";

type Row = {
  id: string;
  assignment_id: string;
  rental_id: string;
  kind: "delivery" | "return";
  file_path: string;
  notes: string | null;
  review_status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  signedUrl?: string;
  partner?: { full_name: string; mobile: string } | null;
  rental?: {
    id: string;
    kind: string;
    status: string;
    product: { title: string } | null;
    store: { name: string } | null;
    customer: { full_name: string | null } | null;
  } | null;
};

const tone: Record<string, string> = {
  pending: "bg-secondary text-foreground",
  approved: "bg-blossom text-rose-deep",
  rejected: "bg-destructive/10 text-destructive",
};

export function AdminDeliveryProofsPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");

  async function load() {
    const { data } = await supabase
      .from("delivery_proofs")
      .select(
        `id, assignment_id, rental_id, kind, file_path, notes, review_status, review_notes, reviewed_at, created_at,
         partner:delivery_partners(full_name, mobile),
         rental:rentals(id, kind, status,
           product:products(title),
           store:stores(name),
           customer:profiles!rentals_customer_profiles_fkey(full_name))`,
      )
      .order("created_at", { ascending: false })
      .limit(500);
    const list = (data as any as Row[]) ?? [];
    const withUrls = await Promise.all(
      list.map(async (r) => {
        const { data: s } = await supabase.storage.from("delivery-proofs").createSignedUrl(r.file_path, 60 * 30);
        return { ...r, signedUrl: s?.signedUrl };
      }),
    );
    setRows(withUrls);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => rows.filter((r) => r.review_status === tab), [rows, tab]);

  async function decide(row: Row, decision: "approved" | "rejected", reviewNotes?: string) {
    const { error } = await supabase
      .from("delivery_proofs")
      .update({
        review_status: decision,
        review_notes: reviewNotes ?? null,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return toast.error(error.message);

    if (decision === "approved") {
      // Advance the linked assignment + rental status to reflect the reviewed handoff.
      if (row.kind === "delivery") {
        await supabase.from("delivery_assignments").update({ status: "delivered" }).eq("id", row.assignment_id);
        await supabase.from("rentals").update({ status: "delivered" }).eq("id", row.rental_id);
      } else {
        await supabase.from("delivery_assignments").update({ status: "returned_to_store" }).eq("id", row.assignment_id);
        await supabase.from("rentals").update({ status: "returned" }).eq("id", row.rental_id);
      }
    }

    toast.success(`Proof ${decision}`);
    load();
  }

  const counts = {
    pending: rows.filter((r) => r.review_status === "pending").length,
    approved: rows.filter((r) => r.review_status === "approved").length,
    rejected: rows.filter((r) => r.review_status === "rejected").length,
  };

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize">
              {s} <Badge className="ml-1">{counts[s]}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-10">
            No {tab} proofs.
          </p>
        )}
        {filtered.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-card overflow-hidden">
            {r.signedUrl && (
              <a href={r.signedUrl} target="_blank" rel="noreferrer">
                <img src={r.signedUrl} alt="proof" className="w-full h-56 object-cover bg-muted" />
              </a>
            )}
            <div className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge className={`capitalize ${tone[r.review_status]}`}>{r.kind} · {r.review_status}</Badge>
                <span className="text-[11px] text-muted-foreground">{format(new Date(r.created_at), "PPp")}</span>
              </div>
              <p className="text-sm font-medium">{r.rental?.product?.title ?? "Order"}</p>
              <p className="text-xs text-muted-foreground">
                #{r.rental_id.slice(0, 8)} · {r.rental?.store?.name} · Customer: {r.rental?.customer?.full_name ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                Partner: {r.partner?.full_name} · {r.partner?.mobile}
              </p>
              {r.notes && <p className="text-xs">Partner note: {r.notes}</p>}
              {r.review_notes && <p className="text-xs text-destructive">Reviewer: {r.review_notes}</p>}

              {r.review_status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="hero" onClick={() => decide(r, "approved")}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Approve & mark {r.kind === "delivery" ? "delivered" : "returned"}
                  </Button>
                  <RejectDialog onSubmit={(n) => decide(r, "rejected", n)} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RejectDialog({ onSubmit }: { onSubmit: (note: string) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <XCircle className="h-4 w-4 mr-1" /> Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject proof</DialogTitle>
        </DialogHeader>
        <Textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why is this being rejected? Visible to the delivery partner."
        />
        <Button
          variant="hero"
          onClick={() => {
            if (!note.trim()) return toast.error("Add a reason");
            onSubmit(note.trim());
            setOpen(false);
            setNote("");
          }}
        >
          Send rejection
        </Button>
      </DialogContent>
    </Dialog>
  );
}
