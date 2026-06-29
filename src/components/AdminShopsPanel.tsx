import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Check, X, Trash2, RotateCcw, MapPin, Phone, Store as StoreIcon,
  ExternalLink, Settings, Loader2, Ban, AlertTriangle,
} from "lucide-react";
import { verifyStoreVisibleToCustomers } from "@/lib/verifyStoreVisibility";

async function confirmVisibilityOrAlert(storeId: string, shopName: string) {
  // Small delay to ensure triggers/replication settle
  await new Promise((r) => setTimeout(r, 400));
  const result = await verifyStoreVisibleToCustomers(storeId);
  if (result.visible) {
    toast.success(`${shopName} is now live and visible to customers.`, {
      icon: <Check className="h-4 w-4" />,
    });
  } else {
    toast.error(
      `${shopName} was approved but is NOT visible to customers. Reason: ${(result as { reason: string }).reason}`,
      { duration: 10000, icon: <AlertTriangle className="h-4 w-4" /> },
    );
  }
}

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
  is_verified: boolean;
  is_active: boolean;
  is_blocked: boolean;
  created_at: string;
  updated_at?: string | null;
  owner_id: string;
  owner: { full_name: string | null; phone: string | null } | null;
};

const tone: Record<ShopStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  deleted: "bg-muted text-muted-foreground border-border",
};

const SELECT_COLS =
  "id,name,description,city,address,logo_url,status,approved,is_verified,is_active,is_blocked,created_at,updated_at,owner_id";

export function AdminShopsPanel() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [tab, setTab] = useState<ShopStatus>("pending");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Shop | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("stores")
      .select(SELECT_COLS as any)
      .order("created_at", { ascending: false });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    const rows = (data as any[]) ?? [];
    const ids = Array.from(new Set(rows.map((s) => s.owner_id)));
    let byId = new Map<string, any>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id,full_name,phone").in("id", ids);
      byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
    }
    setShops(rows.map((s) => ({
      ...s,
      owner: byId.get(s.owner_id)
        ? { full_name: byId.get(s.owner_id).full_name, phone: byId.get(s.owner_id).phone }
        : null,
    })) as Shop[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function quickUpdate(id: string, patch: Partial<Shop>, msg: string) {
    setBusyId(id);
    const { data, error } = await supabase
      .from("stores")
      .update(patch as any)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    setBusyId(null);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("Save failed. Admin access is required for this shop update.");
    toast.success(msg);
    await load();
  }

  async function hardDelete(id: string) {
    setBusyId(id);
    const { data, error } = await supabase.from("stores").delete().eq("id", id).select("id").maybeSingle();
    setBusyId(null);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("Delete failed. Admin access is required for this shop.");
    toast.success("Shop permanently deleted");
    await load();
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
          <p className="text-sm text-muted-foreground">
            Approve, reject, hide, block, restore or delete registered shops.
          </p>
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
                    onApprove={async () => {
                      await quickUpdate(shop.id, { status: "approved" }, "Shop approved");
                      await confirmVisibilityOrAlert(shop.id, shop.name);
                    }}
                    onReject={() => quickUpdate(shop.id, { status: "rejected" }, "Shop rejected")}
                    onSoftDelete={() => quickUpdate(shop.id, { status: "deleted" }, "Shop moved to deleted")}
                    onRestore={() => quickUpdate(shop.id, { status: "pending" }, "Shop restored to pending")}
                    onToggleBlock={() => quickUpdate(shop.id, { is_blocked: !shop.is_blocked }, shop.is_blocked ? "Shop unblocked" : "Shop blocked")}
                    onHardDelete={() => hardDelete(shop.id)}
                    onManage={() => setEditing(shop)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <ManageShopDialog
        shop={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => { setEditing(null); await load(); }}
      />
    </div>
  );
}

function ShopCard({
  shop, busy, onApprove, onReject, onSoftDelete, onRestore, onToggleBlock, onHardDelete, onManage,
}: {
  shop: Shop; busy: boolean;
  onApprove: () => void; onReject: () => void;
  onSoftDelete: () => void; onRestore: () => void;
  onToggleBlock: () => void; onHardDelete: () => void;
  onManage: () => void;
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
            <Badge variant="outline" className={tone[shop.status]}>{shop.status}</Badge>
          <Badge
            variant="outline"
            className={shop.is_verified ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-amber-100 text-amber-800 border-amber-200"}
          >
            {shop.is_verified ? "Verified" : "Pending"}
          </Badge>
            {shop.is_blocked && (
              <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-200">Blocked</Badge>
            )}
            {!shop.is_active && (
              <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Hidden</Badge>
            )}
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
        {shop.status !== "approved" && shop.status !== "deleted" && (
          <Button size="sm" variant="hero" disabled={busy} onClick={onApprove}>
            <Check className="h-4 w-4" /> Approve
          </Button>
        )}
        {shop.status !== "rejected" && shop.status !== "deleted" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={onReject}
            className="text-destructive border-destructive/40 hover:bg-destructive/10">
            <X className="h-4 w-4" /> Reject
          </Button>
        )}
        {shop.status !== "deleted" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={onToggleBlock}>
            <Ban className="h-4 w-4" /> {shop.is_blocked ? "Unblock" : "Block"}
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={busy} onClick={onManage}>
          <Settings className="h-4 w-4" /> Manage
        </Button>

        {shop.status !== "deleted" ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={busy}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Move shop to deleted?</AlertDialogTitle>
                <AlertDialogDescription>
                  <strong>{shop.name}</strong> will be hidden from the public site. You can
                  restore it later from the Deleted tab.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onSoftDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={onRestore}>
              <RotateCcw className="h-4 w-4" /> Restore
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" disabled={busy}>
                  <Trash2 className="h-4 w-4" /> Delete permanently
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Permanently delete this shop?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove <strong>{shop.name}</strong> and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={onHardDelete}
                  >
                    Delete forever
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
}

function ManageShopDialog({
  shop, onClose, onSaved,
}: {
  shop: Shop | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [status, setStatus] = useState<ShopStatus>("pending");
  const [isActive, setIsActive] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    if (shop) {
      setStatus(shop.status);
      setIsActive(shop.is_active);
      setIsBlocked(shop.is_blocked);
      setRejectionReason((shop as any).rejection_reason ?? "");
    }
  }, [shop]);


  async function handleSave() {
    if (!shop) return;
    setSaving(true);
    const nextVerified = status === "approved";
    const { data, error } = await supabase
      .from("stores")
      .update({
        status,
        is_verified: nextVerified,
        approved: nextVerified,
        is_active: isActive,
        is_blocked: isBlocked,
        rejection_reason: status === "rejected" ? (rejectionReason.trim() || null) : null,
      } as any)
      .eq("id", shop.id)
      .select("id")
      .maybeSingle();

    setSaving(false);
    if (error) {
      toast.error(error.message || "Failed to save changes");
      return;
    }
    if (!data) {
      toast.error("Save failed. Admin access is required for this shop update.");
      return;
    }
    toast.success("Shop updated successfully");
    if (status === "approved") {
      await confirmVisibilityOrAlert(shop.id, shop.name);
    }
    await onSaved();
  }

  return (
    <Dialog open={!!shop} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage shop</DialogTitle>
          <DialogDescription>
            {shop?.name} — update verification, visibility and block status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>Verification status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ShopStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved (verified)</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === "rejected" && (
            <div className="space-y-2">
              <Label>Rejection reason (visible to seller)</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain what the seller needs to fix before resubmitting…"
                rows={3}
              />
            </div>
          )}


          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm">Active (visible on website)</Label>
              <p className="text-xs text-muted-foreground">
                When off, the shop is hidden from the public site.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm">Blocked</Label>
              <p className="text-xs text-muted-foreground">
                Blocked shops cannot list products to customers.
              </p>
            </div>
            <Switch checked={isBlocked} onCheckedChange={setIsBlocked} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="hero" onClick={handleSave} disabled={saving}>
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
