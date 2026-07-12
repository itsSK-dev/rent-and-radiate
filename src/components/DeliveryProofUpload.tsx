import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera, Upload } from "lucide-react";
import { format } from "date-fns";

type Proof = {
  id: string;
  file_path: string;
  notes: string | null;
  review_status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  signedUrl?: string;
};

const reviewTone: Record<string, string> = {
  pending: "bg-secondary text-foreground",
  approved: "bg-blossom text-rose-deep",
  rejected: "bg-destructive/10 text-destructive",
};

export function DeliveryProofUpload({
  assignmentId,
  rentalId,
  partnerId,
  partnerUserId,
  kind,
}: {
  assignmentId: string;
  rentalId: string;
  partnerId: string;
  partnerUserId: string;
  kind: "delivery" | "return";
}) {
  const [open, setOpen] = useState(false);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("delivery_proofs")
      .select("id,file_path,notes,review_status,review_notes,created_at,reviewed_at")
      .eq("assignment_id", assignmentId)
      .eq("kind", kind)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Proof[];
    const withUrls = await Promise.all(
      rows.map(async (p) => {
        const { data: s } = await supabase.storage.from("delivery-proofs").createSignedUrl(p.file_path, 60 * 30);
        return { ...p, signedUrl: s?.signedUrl };
      }),
    );
    setProofs(withUrls);
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function upload() {
    if (!file) return toast.error("Choose a photo first");
    if (file.size > 8 * 1024 * 1024) return toast.error("Max 8MB");
    setBusy(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${partnerUserId}/${assignmentId}/${kind}-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("delivery-proofs").upload(path, file, { upsert: false });
    if (up.error) {
      setBusy(false);
      return toast.error(up.error.message);
    }
    const { error } = await supabase.from("delivery_proofs").insert({
      assignment_id: assignmentId,
      rental_id: rentalId,
      partner_id: partnerId,
      kind,
      file_path: path,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Proof submitted for review");
    setFile(null);
    setNotes("");
    load();
  }

  const pendingReview = proofs.some((p) => p.review_status === "pending");
  const approved = proofs.some((p) => p.review_status === "approved");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={approved ? "outline" : "hero"}>
          <Camera className="h-4 w-4 mr-1" />
          {approved ? "Proof approved" : pendingReview ? "Proof pending" : `Upload ${kind} proof`}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="capitalize">{kind} proof</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {proofs.map((p) => (
            <div key={p.id} className="rounded-xl border border-border overflow-hidden">
              {p.signedUrl && (
                <img src={p.signedUrl} alt="proof" className="w-full max-h-64 object-cover bg-muted" />
              )}
              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <Badge className={`capitalize ${reviewTone[p.review_status]}`}>{p.review_status}</Badge>
                  <span className="text-[11px] text-muted-foreground">{format(new Date(p.created_at), "PPp")}</span>
                </div>
                {p.notes && <p className="text-xs text-muted-foreground">Note: {p.notes}</p>}
                {p.review_notes && (
                  <p className="text-xs text-destructive">Reviewer: {p.review_notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {!approved && (
          <div className="space-y-2 pt-3 border-t border-border">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
            <Textarea
              rows={2}
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
            />
            <Button variant="hero" onClick={upload} disabled={busy || !file}>
              <Upload className="h-4 w-4 mr-1" /> {busy ? "Uploading…" : "Submit for review"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
