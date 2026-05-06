import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Check, X, Trash2, RotateCcw, MapPin, Mail, Phone, Store as StoreIcon, ExternalLink } from "lucide-react";

type ShopStatus = "pending" | "approved" | "rejected" | "deleted";

type Shop = {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  address: string | null;
  logo_url: string | null;
  status: ShopStatus;
  approved: boolean;
  created_at: string;
  owner_id: string;
  owner: { full_name: string | null; phone: string | null } | null;
};

const tone: Record<ShopStatus, string> = {
  pending: "bg-gold/20 text-rose-deep",
  approved: "bg-primary-soft text-rose-deep",
  rejected: "bg-destructive/10 text-destructive",
  deleted: "bg-secondary text-muted-foreground",
};

export function AdminShopsPanel() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [tab, setTab] = useState<ShopStatus>("pending");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("stores")
      .select("id,name,description,city,address,logo_url,status,approved,created_at,owner_id,owner:profiles!stores_owner_id_fkey(full_name,phone)" as any)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      // Fallback without join if FK alias unavailable
      const { data: d2, error: e2 } = await supabase
        .from("stores")
        .select("id,name,description,city,address,logo_url,status,approved,created_at,owner_id")
        .order("created_at", { ascending: false });
      if (e2) return toast.error(e2.message);
      const ids = Array.from(new Set((d2 ?? []).map((s) => s.owner_id)));
      const { data: profs } = await supabase
        .from("profiles").select("id,full_name,phone").in("id", ids);
      const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
      setShops(((d2 as any) ?? []).map((s: any) => ({
        ...s,
        owner: byId.get(s.owner_id)
          ? { full_name: byId.get(s.owner_id)!.full_name, phone: byId.get(s.owner_id)!.phone }
          : null,
      })));
      return;
    }
    setShops((data as any) ?? []);
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: ShopStatus, successMsg: string) {
    setBusyId(id);
    const { error } = await supabase.from("stores").update({ status } as any).eq("id", id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(successMsg);
    setShops((prev) => prev.map((s) => (s.id === id ? { ...s, status, approved: status === "approved" } : s)));
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return shops
      .filter((s) => s.status === tab)
      .filter((s) =>
        !term ||
        s.name.toLowerCase().includes(term) ||
        (s.city ?? "").toLowerCase().includes(term) ||
        (s.owner?.full_name ?? "").toLowerCase().includes(term),
      );
  }, [shops, tab, q]);

  const counts = useMemo(() => ({
    pending: shops.filter((s) => s.status === "pending").length,
    approved: shops.filter((s) => s.status === "approved").length,
    rejected: shops.filter((s) => s.status === "rejected").length,
    deleted: shops.filter((s) => s.status === "deleted").length,
  }), [shops]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Shop verification</h2>
          <p className="text-sm text-muted-foreground">Approve, reject, delete or restore registered shops.</p>
        </div>
        <Input
          placeholder="Search by name, city, owner…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ShopStatus)}>
        <TabsList className="flex-wrap h-auto">
          {(["pending", "approved", "rejected", "deleted"] as ShopStatus[]).map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize">
              {s} <span className="ml-1.5 text-xs opacity-70">({counts[s]})</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {(["pending", "approved", "rejected", "deleted"] as ShopStatus[]).map((s) => (
          <TabsContent key={s} value={s} className="mt-6">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
                No {s} shops.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filtered.map((shop) => (
                  <ShopCard
                    key={shop.id}
                    shop={shop}
                    busy={busyId === shop.id}
                    onApprove={() => setStatus(shop.id, "approved", "Shop approved successfully")}
                    onReject={() => setStatus(shop.id, "rejected", "Shop rejected successfully")}
                    onDelete={() => setStatus(shop.id, "deleted", "Shop deleted successfully")}
                    onRestore={() => setStatus(shop.id, "pending", "Shop restored to pending")}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ShopCard({
  shop, busy, onApprove, onReject, onDelete, onRestore,
}: {
  shop: Shop; busy: boolean;
  onApprove: () => void; onReject: () => void; onDelete: () => void; onRestore: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 rounded-xl bg-petal overflow-hidden shrink-0 grid place-items-center">
          {shop.logo_url ? (
            <img src={shop.logo_url} alt={shop.name} className="h-full w-full object-cover" />
          ) : (
            <StoreIcon className="h-6 w-6 text-rose-deep" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-xl truncate">{shop.name}</h3>
            <Badge className={tone[shop.status]}>{shop.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Owner: {shop.owner?.full_name ?? "—"}
          </p>
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        {shop.owner?.phone && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3.5 w-3.5" /> {shop.owner.phone}
          </p>
        )}
        {(shop.city || shop.address) && (
          <p className="flex items-start gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 mt-0.5" />
            <span>{[shop.address, shop.city].filter(Boolean).join(", ")}</span>
          </p>
        )}
        {shop.description && (
          <p className="text-muted-foreground line-clamp-2">{shop.description}</p>
        )}
        {shop.logo_url && (
          <a
            href={shop.logo_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-rose-deep hover:underline"
          >
            View logo / document <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        {shop.status !== "approved" && (
          <Button size="sm" variant="hero" disabled={busy} onClick={onApprove}>
            <Check className="h-4 w-4" /> {busy ? "Processing…" : "Approve"}
          </Button>
        )}
        {shop.status !== "rejected" && shop.status !== "deleted" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={onReject}
            className="text-destructive border-destructive/40 hover:bg-destructive/10">
            <X className="h-4 w-4" /> {busy ? "Processing…" : "Reject"}
          </Button>
        )}
        {shop.status !== "deleted" ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={busy}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this shop?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete <strong>{shop.name}</strong>? It will be hidden from the
                  public site but the data will be preserved and can be restored later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button size="sm" variant="outline" disabled={busy} onClick={onRestore}>
            <RotateCcw className="h-4 w-4" /> {busy ? "Processing…" : "Restore"}
          </Button>
        )}
      </div>
    </div>
  );
}
