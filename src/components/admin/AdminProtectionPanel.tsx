import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";

type Settings = {
  protection_plan_enabled: boolean;
  protection_plan_percent: number;
  protection_plan_min: number;
  protection_claim_window_days: number;
  protection_max_claim_percent: number;
  protection_requires_photos: boolean;
  protection_min_photos: number;
  protection_refund_window_days: number;
  protection_refund_on_cancel_percent: number;
  protection_non_refundable_after_delivery: boolean;
  protection_claim_rules: string;
  protection_refund_rules: string;
};

const DEFAULTS: Settings = {
  protection_plan_enabled: true,
  protection_plan_percent: 5,
  protection_plan_min: 49,
  protection_claim_window_days: 7,
  protection_max_claim_percent: 100,
  protection_requires_photos: true,
  protection_min_photos: 2,
  protection_refund_window_days: 3,
  protection_refund_on_cancel_percent: 100,
  protection_non_refundable_after_delivery: true,
  protection_claim_rules: "",
  protection_refund_rules: "",
};

export function AdminProtectionPanel() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_settings")
      .select("protection_plan_enabled, protection_plan_percent, protection_plan_min, protection_claim_window_days, protection_max_claim_percent, protection_requires_photos, protection_min_photos, protection_refund_window_days, protection_refund_on_cancel_percent, protection_non_refundable_after_delivery, protection_claim_rules, protection_refund_rules")
      .eq("id", true)
      .maybeSingle();
    if (!error && data) setS({ ...DEFAULTS, ...(data as any) });
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("platform_settings").update(s as any).eq("id", true);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Rental protection settings saved");
  }

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS((p) => ({ ...p, [k]: v }));
  }

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin inline" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Rental Protection Plan</CardTitle>
          <CardDescription>Configure the optional protection plan offered to renters at checkout.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <div className="font-medium">Enable rental protection</div>
              <div className="text-sm text-muted-foreground">When off, the protection plan is hidden from checkout.</div>
            </div>
            <Switch checked={s.protection_plan_enabled} onCheckedChange={(v) => set("protection_plan_enabled", v)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Protection fee (% of rental)</Label>
              <Input type="number" min={0} step={0.1} value={s.protection_plan_percent}
                onChange={(e) => set("protection_plan_percent", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Minimum protection fee (₹)</Label>
              <Input type="number" min={0} value={s.protection_plan_min}
                onChange={(e) => set("protection_plan_min", parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Claim rules</CardTitle>
          <CardDescription>Limits and requirements for filing a protection claim.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Claim window (days after return)</Label>
              <Input type="number" min={0} value={s.protection_claim_window_days}
                onChange={(e) => set("protection_claim_window_days", parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Max claim (% of product value)</Label>
              <Input type="number" min={0} max={100} value={s.protection_max_claim_percent}
                onChange={(e) => set("protection_max_claim_percent", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Min evidence photos</Label>
              <Input type="number" min={0} value={s.protection_min_photos}
                disabled={!s.protection_requires_photos}
                onChange={(e) => set("protection_min_photos", parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <div className="font-medium">Require evidence photos</div>
              <div className="text-sm text-muted-foreground">Claims without photos are rejected automatically.</div>
            </div>
            <Switch checked={s.protection_requires_photos} onCheckedChange={(v) => set("protection_requires_photos", v)} />
          </div>
          <div>
            <Label>Claim rules (shown to customers)</Label>
            <Textarea rows={4} value={s.protection_claim_rules}
              onChange={(e) => set("protection_claim_rules", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Refund rules</CardTitle>
          <CardDescription>When and how the protection fee itself is refundable.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Refund window before delivery (days)</Label>
              <Input type="number" min={0} value={s.protection_refund_window_days}
                onChange={(e) => set("protection_refund_window_days", parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Refund on cancellation (%)</Label>
              <Input type="number" min={0} max={100} value={s.protection_refund_on_cancel_percent}
                onChange={(e) => set("protection_refund_on_cancel_percent", parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <div className="font-medium">Non-refundable after delivery</div>
              <div className="text-sm text-muted-foreground">Once the item is delivered, the protection fee is kept.</div>
            </div>
            <Switch checked={s.protection_non_refundable_after_delivery}
              onCheckedChange={(v) => set("protection_non_refundable_after_delivery", v)} />
          </div>
          <div>
            <Label>Refund rules (shown to customers)</Label>
            <Textarea rows={4} value={s.protection_refund_rules}
              onChange={(e) => set("protection_refund_rules", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save protection settings
        </Button>
      </div>
    </div>
  );
}
