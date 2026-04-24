import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, ShieldAlert, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Stage = "before_delivery" | "at_delivery" | "after_return";
type ProofImage = { id: string; image_url: string; stage: Stage; uploaded_by: string; created_at: string };

interface Props {
  rentalId: string;
  /** "store" allowed to upload before/at_delivery; "customer" allowed to upload after_return */
  role: "store" | "customer" | "admin";
  /** stages this viewer should focus on; defaults to all */
  stages?: Stage[];
  className?: string;
}

type StageInfo = {
  label: string;
  hint: string;
  uploader: "store" | "customer" | "either";
  unlocks: string;
  checklist: string[];
};

const stageMeta: Record<Stage, StageInfo> = {
  before_delivery: {
    label: "Before delivery",
    hint: "Document the item's condition before it leaves the store.",
    uploader: "store",
    unlocks: "Required to mark this rental as Delivered.",
    checklist: [
      "Full-length shot of the piece on a hanger or display",
      "Close-up of any existing marks, beading or embroidery",
      "Tag, size label and accessories included",
    ],
  },
  at_delivery: {
    label: "At delivery (optional)",
    hint: "Optional handover photos — useful if a dispute arises later.",
    uploader: "either",
    unlocks: "Not required, but strongly recommended for proof of handover.",
    checklist: [
      "Photo of the item as handed to the customer",
      "Packaging or garment bag at handover",
    ],
  },
  after_return: {
    label: "After return",
    hint: "Document the item's condition the moment it's returned.",
    uploader: "customer",
    unlocks: "Required before the store can mark this rental as Returned and refund your deposit.",
    checklist: [
      "Full-length shot of the returned piece",
      "Close-up of any new stains, tears or damage (if any)",
      "All accessories and tags included",
    ],
  },
};

export function RentalProofPanel({ rentalId, role, stages = ["before_delivery", "after_return"], className }: Props) {
  const { user } = useAuth();
  const [images, setImages] = useState<ProofImage[]>([]);
  const [busyStage, setBusyStage] = useState<Stage | null>(null);

  async function load() {
    const { data } = await supabase
      .from("rental_images")
      .select("id,image_url,stage,uploaded_by,created_at")
      .eq("rental_id", rentalId)
      .order("created_at", { ascending: true });
    setImages((data as ProofImage[]) ?? []);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rentalId]);

  function canUpload(stage: Stage): boolean {
    if (role === "admin") return true;
    if (role === "store") return stage === "before_delivery" || stage === "at_delivery";
    if (role === "customer") return stage === "after_return";
    return false;
  }

  async function upload(stage: Stage, file: File) {
    if (!user) return toast.error("Please sign in.");
    if (file.size > 8 * 1024 * 1024) return toast.error("Image must be under 8 MB.");
    setBusyStage(stage);
    const path = `${rentalId}/${stage}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("rental-proofs").upload(path, file, { upsert: false });
    if (upErr) { setBusyStage(null); return toast.error(upErr.message); }
    const { data: pub } = supabase.storage.from("rental-proofs").getPublicUrl(path);
    const { error } = await supabase.from("rental_images").insert({
      rental_id: rentalId,
      uploaded_by: user.id,
      image_url: pub.publicUrl,
      stage,
    });
    setBusyStage(null);
    if (error) return toast.error(error.message);
    toast.success("Photo uploaded");
    load();
  }

  return (
    <div className={cn("space-y-5", className)}>
      {stages.map((stage) => {
        const meta = stageMeta[stage];
        const stageImgs = images.filter((i) => i.stage === stage);
        const has = stageImgs.length > 0;
        const allowed = canUpload(stage);

        return (
          <div key={stage} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-rose-deep" />
                  <h4 className="font-medium">{meta.label}</h4>
                  {has ? (
                    <Badge className="bg-primary-soft text-rose-deep gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {stageImgs.length}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-muted-foreground">
                      <ShieldAlert className="h-3 w-3" /> Required
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{meta.hint}</p>
              </div>
              {allowed && (
                <label className={cn(
                  "shrink-0 inline-flex items-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 py-2 text-sm cursor-pointer hover:border-primary transition-smooth",
                  busyStage === stage && "opacity-60 pointer-events-none"
                )}>
                  <Upload className="h-3.5 w-3.5" />
                  {busyStage === stage ? "Uploading…" : "Add photo"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(stage, f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            {stageImgs.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {stageImgs.map((img) => (
                  <a key={img.id} href={img.image_url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden bg-petal block">
                    <img src={img.image_url} alt="proof" className="w-full h-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No photos yet.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function OpenDisputeButton({ rentalId, className }: { rentalId: string; className?: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user) return;
    if (reason.trim().length < 10) return toast.error("Please describe the issue (min 10 chars).");
    setBusy(true);
    const { error } = await supabase.from("disputes").insert({
      rental_id: rentalId,
      opened_by: user.id,
      reason: reason.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Dispute opened. An admin will review.");
    setOpen(false);
    setReason("");
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        <ShieldAlert className="h-3.5 w-3.5 mr-1.5" /> Open dispute
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3 space-y-2 w-full">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Describe the issue (damage, missing item, late return…)"
        rows={3}
        maxLength={500}
        className="w-full rounded-lg border border-border bg-background p-2 text-sm"
      />
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setReason(""); }}>Cancel</Button>
        <Button size="sm" onClick={submit} disabled={busy}>{busy ? "Sending…" : "Submit dispute"}</Button>
      </div>
    </div>
  );
}
