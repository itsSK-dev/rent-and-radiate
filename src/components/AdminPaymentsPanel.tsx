import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Wallet, Download } from "lucide-react";
import { format } from "date-fns";
import { VendorSettlementsPanel } from "@/components/VendorSettlementsPanel";

type Row = {
  id: string;
  rental_id: string;
  user_id: string;
  store_id: string;
  amount: number;
  upi_id: string;
  user_reference: string | null;
  status: "pending_verification" | "verified" | "failed";
  admin_notes: string | null;
  verified_at: string | null;
  payout_status: "unpaid" | "paid";
  payout_amount: number | null;
  payout_paid_at: string | null;
  payout_notes: string | null;
  commission_amount: number;
  created_at: string;
  store?: { name: string | null } | null;
  customer?: { full_name: string | null } | null;
  rental?: { id: string; status: string } | null;
};

const statusTone: Record<string, string> = {
  pending_verification: "bg-gold/20 text-rose-deep",
  verified: "bg-primary-soft text-rose-deep",
  failed: "bg-destructive/10 text-destructive",
};

export function AdminPaymentsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending_verification" | "verified" | "failed" | "all">("pending_verification");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("manual_payments")
      .select(`
        id,rental_id,user_id,store_id,amount,upi_id,user_reference,status,admin_notes,
        verified_at,payout_status,payout_amount,payout_paid_at,payout_notes,commission_amount,created_at,
        store:stores(name),
        customer:profiles!manual_payments_user_profiles_fkey(full_name),
        rental:rentals(id,status)
      `)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      // foreign key alias may not exist; retry without
      const { data: d2, error: e2 } = await (supabase as any)
        .from("manual_payments")
        .select(`id,rental_id,user_id,store_id,amount,upi_id,user_reference,status,admin_notes,
          verified_at,payout_status,payout_amount,payout_paid_at,payout_notes,commission_amount,created_at,
          store:stores(name),rental:rentals(id,status)`)
        .order("created_at", { ascending: false });
      if (e2) return toast.error(e2.message);
      setRows((d2 as any) ?? []);
      return;
    }
    setRows((data as any) ?? []);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.id.toLowerCase().includes(q) ||
        r.rental_id.toLowerCase().includes(q) ||
        (r.user_reference ?? "").toLowerCase().includes(q) ||
        (r.store?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, filter, search]);

  const totals = useMemo(() => {
    const verified = rows.filter((r) => r.status === "verified");
    const pendingPayouts = verified.filter((r) => r.payout_status === "unpaid");
    return {
      pendingCount: rows.filter((r) => r.status === "pending_verification").length,
      verifiedCount: verified.length,
      grossVerified: verified.reduce((s, r) => s + Number(r.amount), 0),
      commissionEarned: verified.reduce((s, r) => s + Number(r.commission_amount || 0), 0),
      pendingPayoutAmount: pendingPayouts.reduce((s, r) => s + (Number(r.amount) - Number(r.commission_amount || 0)), 0),
    };
  }, [rows]);

  function exportCsv() {
    const header = ["id","created_at","status","amount","commission","store","rental_id","user_reference","payout_status","payout_paid_at"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push([
        r.id, r.created_at, r.status, r.amount, r.commission_amount,
        JSON.stringify(r.store?.name ?? ""), r.rental_id,
        JSON.stringify(r.user_reference ?? ""),
        r.payout_status, r.payout_paid_at ?? "",
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `payments-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Pending verify" value={totals.pendingCount.toString()} />
        <Stat label="Verified" value={totals.verifiedCount.toString()} />
        <Stat label="Gross collected" value={`₹${totals.grossVerified.toLocaleString("en-IN")}`} />
        <Stat label="Commission" value={`₹${totals.commissionEarned.toLocaleString("en-IN")}`} />
        <Stat label="Owed to shops" value={`₹${totals.pendingPayoutAmount.toLocaleString("en-IN")}`} />
      </div>

      <Tabs defaultValue="verify">
        <TabsList>
          <TabsTrigger value="verify">Verification</TabsTrigger>
          <TabsTrigger value="payouts">Shop payouts</TabsTrigger>
          <TabsTrigger value="settlements">Platform fees</TabsTrigger>
        </TabsList>

        <TabsContent value="verify" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending_verification">Pending verification</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search id, ref, store…" className="w-72" />
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Export CSV</Button>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>{loading ? "…" : "Refresh"}</Button>
          </div>

          {loading ? (
            <div className="text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">No payments.</div>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => <VerifyCard key={r.id} row={r} onChanged={load} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payouts" className="mt-4 space-y-3">
          <PayoutsList rows={rows.filter((r) => r.status === "verified")} onChanged={load} />
        </TabsContent>

        <TabsContent value="settlements" className="mt-4">
          <VendorSettlementsPanel admin />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-xl mt-0.5">{value}</p>
    </div>
  );
}

function VerifyCard({ row, onChanged }: { row: Row; onChanged: () => void }) {
  const [notes, setNotes] = useState(row.admin_notes ?? "");
  const [busy, setBusy] = useState(false);

  async function setStatus(status: "verified" | "failed") {
    setBusy(true);
    const { error } = await (supabase as any).from("manual_payments")
      .update({ status, admin_notes: notes || null })
      .eq("id", row.id).select().maybeSingle();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(status === "verified" ? "Payment verified — order confirmed" : "Marked failed");
    onChanged();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">₹{Number(row.amount).toLocaleString("en-IN")}</p>
            <Badge className={statusTone[row.status]}>{row.status.replace("_", " ")}</Badge>
            {row.payout_status === "paid" && <Badge variant="outline">payout paid</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Order {row.rental_id.slice(0, 8).toUpperCase()} · {row.store?.name ?? "—"} · {format(new Date(row.created_at), "PPp")}
          </p>
          <p className="text-xs text-muted-foreground">UPI: {row.upi_id} {row.user_reference ? `· ref ${row.user_reference}` : ""}</p>
        </div>
        {row.status === "pending_verification" && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setStatus("failed")} disabled={busy}><XCircle className="h-3.5 w-3.5" /> Reject</Button>
            <Button size="sm" variant="hero" onClick={() => setStatus("verified")} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Verify
            </Button>
          </div>
        )}
      </div>
      <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Admin notes (optional)" maxLength={500} />
    </div>
  );
}

function PayoutsList({ rows, onChanged }: { rows: Row[]; onChanged: () => void }) {
  const [tab, setTab] = useState<"unpaid" | "paid">("unpaid");
  const list = rows.filter((r) => r.payout_status === tab);

  // group by store
  const grouped = list.reduce<Record<string, { name: string; items: Row[]; total: number }>>((acc, r) => {
    const key = r.store_id;
    const due = Number(r.amount) - Number(r.commission_amount || 0);
    acc[key] = acc[key] ?? { name: r.store?.name ?? "—", items: [], total: 0 };
    acc[key].items.push(r);
    acc[key].total += due;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant={tab === "unpaid" ? "hero" : "outline"} onClick={() => setTab("unpaid")}>Pending payouts</Button>
        <Button size="sm" variant={tab === "paid" ? "hero" : "outline"} onClick={() => setTab("paid")}>Completed payouts</Button>
      </div>
      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">No {tab} payouts.</div>
      ) : (
        Object.entries(grouped).map(([sid, g]) => (
          <div key={sid} className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium flex items-center gap-2"><Wallet className="h-4 w-4 text-rose-deep" /> {g.name}</p>
              <p className="text-sm">Owed: <span className="font-semibold">₹{g.total.toLocaleString("en-IN")}</span></p>
            </div>
            <div className="space-y-2">
              {g.items.map((r) => <PayoutRow key={r.id} row={r} onChanged={onChanged} />)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function PayoutRow({ row, onChanged }: { row: Row; onChanged: () => void }) {
  const due = Number(row.amount) - Number(row.commission_amount || 0);
  const [notes, setNotes] = useState(row.payout_notes ?? "");
  const [busy, setBusy] = useState(false);

  async function togglePaid() {
    setBusy(true);
    const next = row.payout_status === "paid" ? "unpaid" : "paid";
    const { error } = await (supabase as any).from("manual_payments")
      .update({
        payout_status: next,
        payout_amount: next === "paid" ? due : null,
        payout_paid_at: next === "paid" ? new Date().toISOString() : null,
        payout_notes: notes || null,
      }).eq("id", row.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(next === "paid" ? "Marked paid" : "Reverted to unpaid");
    onChanged();
  }

  return (
    <div className="rounded-xl border border-border bg-background p-3 text-sm space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p>Order {row.rental_id.slice(0, 8).toUpperCase()} · ₹{Number(row.amount).toLocaleString("en-IN")} <span className="text-muted-foreground">(− ₹{Number(row.commission_amount || 0).toLocaleString("en-IN")} commission)</span></p>
          <p className="text-xs text-muted-foreground">Verified {row.verified_at ? format(new Date(row.verified_at), "PPp") : "—"} {row.payout_paid_at ? `· Paid ${format(new Date(row.payout_paid_at), "PPp")}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Due ₹{due.toLocaleString("en-IN")}</span>
          <Button size="sm" variant={row.payout_status === "paid" ? "outline" : "hero"} onClick={togglePaid} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {row.payout_status === "paid" ? "Mark unpaid" : "Mark paid"}
          </Button>
        </div>
      </div>
      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payout reference / notes" />
    </div>
  );
}
