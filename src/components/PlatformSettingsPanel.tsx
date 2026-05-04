import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Settings = { gst_percent: number; delivery_fee: number; commission_percent: number };

export function PlatformSettingsPanel() {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await (supabase as any)
      .from("platform_settings")
      .select("gst_percent,delivery_fee,commission_percent")
      .eq("id", true).maybeSingle();
    setS(data ?? { gst_percent: 18, delivery_fee: 50, commission_percent: 10 });
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!s) return;
    setSaving(true);
    const { error } = await (supabase as any).from("platform_settings")
      .update({
        gst_percent: Number(s.gst_percent),
        delivery_fee: Number(s.delivery_fee),
        commission_percent: Number(s.commission_percent),
      }).eq("id", true);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Platform settings saved");
  }

  if (!s) {
    return <div className="text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-card max-w-xl space-y-5">
      <div>
        <h2 className="font-display text-2xl">Platform pricing</h2>
        <p className="text-sm text-muted-foreground mt-1">Applied to all customer orders.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>GST (%)</Label>
          <Input type="number" min="0" max="100" step="0.01" value={s.gst_percent}
            onChange={(e) => setS({ ...s, gst_percent: Number(e.target.value) })} className="mt-1" />
        </div>
        <div>
          <Label>Delivery fee (₹)</Label>
          <Input type="number" min="0" step="0.01" value={s.delivery_fee}
            onChange={(e) => setS({ ...s, delivery_fee: Number(e.target.value) })} className="mt-1" />
        </div>
        <div>
          <Label>Commission (%)</Label>
          <Input type="number" min="0" max="100" step="0.01" value={s.commission_percent}
            onChange={(e) => setS({ ...s, commission_percent: Number(e.target.value) })} className="mt-1" />
        </div>
      </div>

      <Button variant="hero" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
