import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ShieldAlert } from "lucide-react";
import { DisputeStatusTimeline } from "./DisputeStatusTimeline";

type Dispute = {
  id: string;
  reason: string;
  status: "open" | "reviewing" | "resolved" | "rejected";
  resolution: string | null;
  evidence_images: string[];
  created_at: string;
};

const tone: Record<string, string> = {
  open: "bg-destructive/10 text-destructive",
  reviewing: "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-secondary text-muted-foreground",
};

export function RentalDisputesList({ rentalId }: { rentalId: string }) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const { data } = await supabase
        .from("disputes")
        .select("id,reason,status,resolution,evidence_images,created_at")
        .eq("rental_id", rentalId)
        .order("created_at", { ascending: false });
      if (!ignore) setDisputes((data as any) ?? []);
    })();
    return () => { ignore = true; };
  }, [rentalId]);

  if (disputes.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-rose-deep" />
        <p className="text-sm font-medium">Disputes ({disputes.length})</p>
      </div>
      {disputes.map((d) => (
        <div key={d.id} className="rounded-xl border border-border bg-card p-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm whitespace-pre-wrap">{d.reason}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Opened {format(new Date(d.created_at), "PPp")}</p>
            </div>
            <Badge className={tone[d.status]}>{d.status}</Badge>
          </div>

          {d.evidence_images?.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Evidence</p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {d.evidence_images.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden bg-petal block">
                    <img src={url} alt="dispute evidence" className="w-full h-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {d.resolution && (
            <div className="rounded-lg bg-secondary p-2 text-xs">
              <span className="font-medium">Resolution: </span>{d.resolution}
            </div>
          )}

          <DisputeStatusTimeline disputeId={d.id} />
        </div>
      ))}
    </div>
  );
}
