import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, ShieldAlert, Flag, Loader2, RefreshCw, CheckCircle2, XCircle, Eye } from "lucide-react";
import { format } from "date-fns";

type Alert = {
  id: string;
  kind: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "reviewing" | "resolved" | "dismissed";
  subject_user_id: string | null;
  subject_store_id: string | null;
  rental_id: string | null;
  title: string;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: any;
  resolution_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const sevTone: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  critical: "bg-destructive/15 text-destructive",
};

const statusTone: Record<string, string> = {
  open: "bg-destructive/15 text-destructive",
  reviewing: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  dismissed: "bg-muted text-muted-foreground",
};

const KIND_LABELS: Record<string, string> = {
  suspicious_login: "Suspicious login",
  suspicious_payment: "Suspicious payment",
  repeated_failed_payment: "Repeated failed payments",
  flagged_user: "Flagged user",
  flagged_seller: "Flagged seller",
  chargeback: "Chargeback",
  other: "Other",
};

export function AdminFraudPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("open");
  const [reviewing, setReviewing] = useState<Alert | null>(null);
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [newAlert, setNewAlert] = useState({
    kind: "flagged_user",
    severity: "medium" as Alert["severity"],
    subject_kind: "user" as "user" | "store",
    subject_id: "",
    title: "",
    description: "",
  });

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("fraud_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setAlerts((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { open: 0, reviewing: 0, resolved: 0, dismissed: 0, all: alerts.length };
    alerts.forEach((a) => { c[a.status] = (c[a.status] || 0) + 1; });
    return c;
  }, [alerts]);

  const filtered = useMemo(
    () => (tab === "all" ? alerts : alerts.filter((a) => a.status === tab)),
    [alerts, tab]
  );

  async function updateStatus(a: Alert, status: Alert["status"], resolution_notes?: string) {
    const { error } = await supabase
      .from("fraud_alerts")
      .update({ status, resolution_notes: resolution_notes ?? a.resolution_notes, reviewed_at: new Date().toISOString() })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Alert updated");
    setReviewing(null);
    setNotes("");
    load();
  }

  async function flagSubject(a: Alert, flag: boolean) {
    const kind = a.subject_store_id ? "store" : "user";
    const id = a.subject_store_id || a.subject_user_id;
    if (!id) return toast.error("No subject linked to this alert");
    const { error } = await supabase.rpc("admin_flag_subject", {
      _kind: kind, _id: id, _flag: flag, _reason: flag ? a.title : null,
    });
    if (error) return toast.error(error.message);
    toast.success(flag ? "Subject flagged" : "Flag removed");
  }

  async function createManual() {
    if (!newAlert.title.trim()) return toast.error("Title required");
    const payload: any = {
      kind: newAlert.kind,
      severity: newAlert.severity,
      title: newAlert.title,
      description: newAlert.description || null,
    };
    if (newAlert.subject_id.trim()) {
      payload[newAlert.subject_kind === "user" ? "subject_user_id" : "subject_store_id"] = newAlert.subject_id.trim();
    }
    const { error } = await supabase.from("fraud_alerts").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Alert created");
    setCreating(false);
    setNewAlert({ kind: "flagged_user", severity: "medium", subject_kind: "user", subject_id: "", title: "", description: "" });
    load();
  }

  const summary = useMemo(() => {
    const s = {
      logins: alerts.filter((a) => a.kind === "suspicious_login").length,
      payments: alerts.filter((a) => a.kind === "suspicious_payment" || a.kind === "chargeback").length,
      failures: alerts.filter((a) => a.kind === "repeated_failed_payment").length,
      flagged: alerts.filter((a) => a.kind === "flagged_user" || a.kind === "flagged_seller").length,
    };
    return s;
  }, [alerts]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard icon={<ShieldAlert className="h-4 w-4" />} label="Suspicious logins" value={summary.logins} />
        <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="Payment activity" value={summary.payments} />
        <SummaryCard icon={<XCircle className="h-4 w-4" />} label="Repeated failures" value={summary.failures} />
        <SummaryCard icon={<Flag className="h-4 w-4" />} label="Flagged users / sellers" value={summary.flagged} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Fraud alerts</CardTitle>
            <CardDescription>Review and resolve suspicious activity across the platform.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
            <Button size="sm" onClick={() => setCreating(true)}>New alert</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex-wrap h-auto">
              {(["open", "reviewing", "resolved", "dismissed", "all"] as const).map((k) => (
                <TabsTrigger key={k} value={k}>
                  {k[0].toUpperCase() + k.slice(1)} <span className="ml-1 text-xs text-muted-foreground">({counts[k] ?? 0})</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={tab} className="mt-4">
              {loading ? (
                <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin inline" /></div>
              ) : filtered.length === 0 ? (
                <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
                  No {tab === "all" ? "" : tab} alerts.
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((a) => (
                    <div key={a.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={sevTone[a.severity]}>{a.severity}</Badge>
                            <Badge variant="outline">{KIND_LABELS[a.kind] ?? a.kind}</Badge>
                            <Badge className={statusTone[a.status]}>{a.status}</Badge>
                            <span className="text-xs text-muted-foreground">{format(new Date(a.created_at), "dd MMM yyyy HH:mm")}</span>
                          </div>
                          <div className="font-medium mt-2">{a.title}</div>
                          {a.description && <div className="text-sm text-muted-foreground">{a.description}</div>}
                          <div className="text-xs text-muted-foreground mt-1 space-x-3">
                            {a.subject_user_id && <span>User: <code>{a.subject_user_id.slice(0, 8)}</code></span>}
                            {a.subject_store_id && <span>Store: <code>{a.subject_store_id.slice(0, 8)}</code></span>}
                            {a.rental_id && <span>Rental: <code>{a.rental_id.slice(0, 8)}</code></span>}
                            {a.ip_address && <span>IP: {a.ip_address}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => { setReviewing(a); setNotes(a.resolution_notes || ""); }}>
                            <Eye className="h-3 w-3 mr-1" />Review
                          </Button>
                          {(a.subject_user_id || a.subject_store_id) && (
                            <Button size="sm" variant="outline" onClick={() => flagSubject(a, true)}>
                              <Flag className="h-3 w-3 mr-1" />Flag
                            </Button>
                          )}
                          {a.status !== "resolved" && (
                            <Button size="sm" onClick={() => updateStatus(a, "resolved")}>
                              <CheckCircle2 className="h-3 w-3 mr-1" />Resolve
                            </Button>
                          )}
                          {a.status !== "dismissed" && a.status !== "resolved" && (
                            <Button size="sm" variant="ghost" onClick={() => updateStatus(a, "dismissed")}>
                              Dismiss
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review fraud alert</DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="font-medium">{reviewing.title}</div>
                <div className="text-sm text-muted-foreground">{reviewing.description}</div>
              </div>
              {reviewing.metadata && Object.keys(reviewing.metadata).length > 0 && (
                <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-48">
                  {JSON.stringify(reviewing.metadata, null, 2)}
                </pre>
              )}
              <div>
                <label className="text-sm font-medium">Resolution notes</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={reviewing.status} onValueChange={(v) => updateStatus(reviewing, v as Alert["status"], notes)}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["open", "reviewing", "resolved", "dismissed"] as const).map((s) =>
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {(reviewing.subject_user_id || reviewing.subject_store_id) && (
                  <>
                    <Button variant="outline" onClick={() => flagSubject(reviewing, true)}>
                      <Flag className="h-4 w-4 mr-1" />Mark suspicious
                    </Button>
                    <Button variant="ghost" onClick={() => flagSubject(reviewing, false)}>
                      Clear flag
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create fraud alert</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 grid-cols-2">
              <div>
                <label className="text-sm">Kind</label>
                <Select value={newAlert.kind} onValueChange={(v) => setNewAlert({ ...newAlert, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(KIND_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm">Severity</label>
                <Select value={newAlert.severity} onValueChange={(v: any) => setNewAlert({ ...newAlert, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["low", "medium", "high", "critical"] as const).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm">Subject type</label>
                <Select value={newAlert.subject_kind} onValueChange={(v: any) => setNewAlert({ ...newAlert, subject_kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="store">Store</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm">Subject ID (optional)</label>
                <Input value={newAlert.subject_id} onChange={(e) => setNewAlert({ ...newAlert, subject_id: e.target.value })} placeholder="uuid" />
              </div>
            </div>
            <div>
              <label className="text-sm">Title</label>
              <Input value={newAlert.title} onChange={(e) => setNewAlert({ ...newAlert, title: e.target.value })} />
            </div>
            <div>
              <label className="text-sm">Description</label>
              <Textarea rows={3} value={newAlert.description} onChange={(e) => setNewAlert({ ...newAlert, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={createManual}>Create alert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
