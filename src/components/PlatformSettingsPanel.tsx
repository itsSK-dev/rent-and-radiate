import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Settings = {
  gst_percent: number; gst_enabled: boolean;
  delivery_fee: number; commission_percent: number;
  gateway_fee_percent: number; payout_hold_days: number; rental_price_percent: number;
  deposit_percent_of_price: number;
  protection_plan_percent: number; protection_plan_min: number;
  late_fee_multiplier: number; late_fee_grace_hours: number;
  reminder_intervals_hours: number[];
  rent_to_own_enabled: boolean; rent_to_own_credit_percent: number;
  referrals_enabled: boolean;
  referral_signup_bonus: number; referral_referrer_bonus: number; referral_min_order_amount: number;
  platform_fee_slabs: any; delivery_fee_slabs: any;
};


const DEFAULT_PLATFORM_SLABS = {
  tiers: [{ max: 499, fee: 50 }, { max: 999, fee: 70 }, { max: 1999, fee: 120 }],
  above: { base_fee: 120, threshold: 1999, step: 1000, step_fee: 50 },
};
const DEFAULT_DELIVERY_SLABS = {
  tiers: [{ max_order: 499, fee: 50 }, { max_order: 999, fee: 40 }, { max_order: 100000000, fee: 25 }],
};

export function PlatformSettingsPanel() {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [remindersText, setRemindersText] = useState("24,6,1");
  const [platformSlabsText, setPlatformSlabsText] = useState("");
  const [deliverySlabsText, setDeliverySlabsText] = useState("");

  async function load() {
    const { data } = await (supabase as any)
      .from("platform_settings")
      .select("gst_percent,gst_enabled,delivery_fee,commission_percent,gateway_fee_percent,payout_hold_days,rental_price_percent,deposit_percent_of_price,protection_plan_percent,protection_plan_min,late_fee_multiplier,late_fee_grace_hours,reminder_intervals_hours,rent_to_own_enabled,rent_to_own_credit_percent,referrals_enabled,referral_signup_bonus,referral_referrer_bonus,referral_min_order_amount,platform_fee_slabs,delivery_fee_slabs")
      .eq("id", true).maybeSingle();
    const d = data ?? {};
    const merged: Settings = {
      gst_percent: d.gst_percent ?? 18,
      gst_enabled: d.gst_enabled ?? true,
      delivery_fee: d.delivery_fee ?? 50,
      commission_percent: d.commission_percent ?? 10,
      gateway_fee_percent: d.gateway_fee_percent ?? 0,
      payout_hold_days: d.payout_hold_days ?? 7,
      rental_price_percent: d.rental_price_percent ?? 10,
      deposit_percent_of_price: d.deposit_percent_of_price ?? 100,
      protection_plan_percent: d.protection_plan_percent ?? 5,
      protection_plan_min: d.protection_plan_min ?? 49,
      late_fee_multiplier: d.late_fee_multiplier ?? 1.5,
      late_fee_grace_hours: d.late_fee_grace_hours ?? 2,
      reminder_intervals_hours: d.reminder_intervals_hours ?? [24, 6, 1],
      rent_to_own_enabled: d.rent_to_own_enabled ?? false,
      rent_to_own_credit_percent: d.rent_to_own_credit_percent ?? 50,
      referrals_enabled: d.referrals_enabled ?? true,
      referral_signup_bonus: d.referral_signup_bonus ?? 100,
      referral_referrer_bonus: d.referral_referrer_bonus ?? 200,
      referral_min_order_amount: d.referral_min_order_amount ?? 500,
      platform_fee_slabs: d.platform_fee_slabs ?? DEFAULT_PLATFORM_SLABS,
      delivery_fee_slabs: d.delivery_fee_slabs ?? DEFAULT_DELIVERY_SLABS,
    };
    setS(merged);
    setRemindersText(merged.reminder_intervals_hours.join(","));
    setPlatformSlabsText(JSON.stringify(merged.platform_fee_slabs, null, 2));
    setDeliverySlabsText(JSON.stringify(merged.delivery_fee_slabs, null, 2));
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!s) return;
    if (Number(s.rental_price_percent) < 10) return toast.error("Daily rental percentage cannot be below 10%.");
    const intervals = remindersText.split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isFinite(n) && n > 0);
    if (!intervals.length) return toast.error("Add at least one reminder interval (hours).");
    let platformSlabs: any, deliverySlabs: any;
    try { platformSlabs = JSON.parse(platformSlabsText); } catch { return toast.error("Platform fee slabs: invalid JSON."); }
    try { deliverySlabs = JSON.parse(deliverySlabsText); } catch { return toast.error("Delivery slabs: invalid JSON."); }
    if (!platformSlabs?.tiers || !platformSlabs?.above) return toast.error("Platform fee slabs must have 'tiers' and 'above'.");
    if (!Array.isArray(deliverySlabs?.tiers)) return toast.error("Delivery slabs must have a 'tiers' array.");
    setSaving(true);
    const { error } = await (supabase as any).from("platform_settings")
      .update({
        gst_percent: Number(s.gst_percent),
        gst_enabled: Boolean(s.gst_enabled),
        delivery_fee: Number(s.delivery_fee),
        commission_percent: Number(s.commission_percent),
        gateway_fee_percent: Number(s.gateway_fee_percent),
        payout_hold_days: Number(s.payout_hold_days),
        rental_price_percent: Math.max(10, Number(s.rental_price_percent) || 10),
        deposit_percent_of_price: Math.max(0, Number(s.deposit_percent_of_price) || 0),
        protection_plan_percent: Math.max(0, Number(s.protection_plan_percent) || 0),
        protection_plan_min: Math.max(0, Number(s.protection_plan_min) || 0),
        late_fee_multiplier: Math.max(1, Number(s.late_fee_multiplier) || 1),
        late_fee_grace_hours: Math.max(0, Number(s.late_fee_grace_hours) || 0),
        reminder_intervals_hours: intervals,
        rent_to_own_enabled: Boolean(s.rent_to_own_enabled),
        rent_to_own_credit_percent: Math.max(0, Math.min(100, Number(s.rent_to_own_credit_percent) || 0)),
        referrals_enabled: Boolean(s.referrals_enabled),
        referral_signup_bonus: Math.max(0, Math.floor(Number(s.referral_signup_bonus) || 0)),
        referral_referrer_bonus: Math.max(0, Math.floor(Number(s.referral_referrer_bonus) || 0)),
        referral_min_order_amount: Math.max(0, Number(s.referral_min_order_amount) || 0),
        platform_fee_slabs: platformSlabs,
        delivery_fee_slabs: deliverySlabs,
      }).eq("id", true);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Platform settings saved.");
  }


  if (!s) return <div className="text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-card max-w-3xl space-y-5">
      <div>
        <h2 className="font-display text-2xl">Platform settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Pricing, protection plan, late fees, reminders and rent-to-own.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div><Label>GST (%)</Label><Input type="number" min="0" max="100" step="0.01" value={s.gst_percent} onChange={(e) => setS({ ...s, gst_percent: Number(e.target.value) })} className="mt-1" /></div>
        <div><Label>Delivery fee (₹)</Label><Input type="number" min="0" step="0.01" value={s.delivery_fee} onChange={(e) => setS({ ...s, delivery_fee: Number(e.target.value) })} className="mt-1" /></div>
        <div><Label>Platform fee (%)</Label><Input type="number" min="0" max="100" step="0.01" value={s.commission_percent} onChange={(e) => setS({ ...s, commission_percent: Number(e.target.value) })} className="mt-1" /></div>
        <div><Label>Gateway fee (%)</Label><Input type="number" min="0" max="100" step="0.01" value={s.gateway_fee_percent} onChange={(e) => setS({ ...s, gateway_fee_percent: Number(e.target.value) })} className="mt-1" /></div>
        <div><Label>Payout hold (days)</Label><Input type="number" min="0" max="60" step="1" value={s.payout_hold_days} onChange={(e) => setS({ ...s, payout_hold_days: Number(e.target.value) })} className="mt-1" /></div>
        <div>
          <Label>Rental price (% of selling price)</Label>
          <Input type="number" min="10" max="100" step="0.1" value={s.rental_price_percent} onChange={(e) => setS({ ...s, rental_price_percent: Number(e.target.value) })} className="mt-1" />
          <p className="text-[11px] text-muted-foreground mt-1">Minimum 10%.</p>
        </div>
        <div>
          <Label>Security deposit (% of price)</Label>
          <Input type="number" min="0" max="500" step="1" value={s.deposit_percent_of_price} onChange={(e) => setS({ ...s, deposit_percent_of_price: Number(e.target.value) })} className="mt-1" />
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <h3 className="font-medium">Rental Protection Plan</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><Label>Plan rate (% of rental)</Label><Input type="number" min="0" max="50" step="0.1" value={s.protection_plan_percent} onChange={(e) => setS({ ...s, protection_plan_percent: Number(e.target.value) })} className="mt-1" /></div>
          <div><Label>Plan minimum (₹)</Label><Input type="number" min="0" step="1" value={s.protection_plan_min} onChange={(e) => setS({ ...s, protection_plan_min: Number(e.target.value) })} className="mt-1" /></div>
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <h3 className="font-medium">Late return charges</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><Label>Late fee multiplier</Label><Input type="number" min="1" step="0.1" value={s.late_fee_multiplier} onChange={(e) => setS({ ...s, late_fee_multiplier: Number(e.target.value) })} className="mt-1" /><p className="text-[11px] text-muted-foreground mt-1">× per-day rate per late day.</p></div>
          <div><Label>Grace period (hours)</Label><Input type="number" min="0" step="1" value={s.late_fee_grace_hours} onChange={(e) => setS({ ...s, late_fee_grace_hours: Number(e.target.value) })} className="mt-1" /></div>
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <h3 className="font-medium">Return reminders</h3>
        <div>
          <Label>Hours before due (comma-separated)</Label>
          <Input value={remindersText} onChange={(e) => setRemindersText(e.target.value)} placeholder="24,6,1" className="mt-1" />
          <p className="text-[11px] text-muted-foreground mt-1">Each customer gets a notification at every interval before their rental due time.</p>
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <h3 className="font-medium">Rent-to-Own</h3>
        <label className="flex items-center gap-3"><Switch checked={s.rent_to_own_enabled} onCheckedChange={(v) => setS({ ...s, rent_to_own_enabled: v })} /><span className="text-sm">Enable rent-to-own conversion platform-wide</span></label>
        <div className="max-w-xs">
          <Label>Credit percent</Label>
          <Input type="number" min="0" max="100" step="1" value={s.rent_to_own_credit_percent} onChange={(e) => setS({ ...s, rent_to_own_credit_percent: Number(e.target.value) })} className="mt-1" />
          <p className="text-[11px] text-muted-foreground mt-1">% of past rental spend on the same product applied as discount when buying it out.</p>
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <h3 className="font-medium">Referral rewards</h3>
        <label className="flex items-center gap-3">
          <Switch checked={s.referrals_enabled} onCheckedChange={(v) => setS({ ...s, referrals_enabled: v })} />
          <span className="text-sm">Enable the referral program (signup bonus + referrer bonus)</span>
        </label>
        <p className="text-[11px] text-muted-foreground">When off, no new referral bonuses are credited. Existing balances and referral codes are preserved.</p>
        <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${s.referrals_enabled ? "" : "opacity-50 pointer-events-none"}`}>
          <div><Label>Signup bonus (points)</Label><Input type="number" min="0" step="1" value={s.referral_signup_bonus} onChange={(e) => setS({ ...s, referral_signup_bonus: Number(e.target.value) })} className="mt-1" /></div>
          <div><Label>Referrer bonus (points)</Label><Input type="number" min="0" step="1" value={s.referral_referrer_bonus} onChange={(e) => setS({ ...s, referral_referrer_bonus: Number(e.target.value) })} className="mt-1" /></div>
          <div><Label>Min qualifying order (₹)</Label><Input type="number" min="0" step="1" value={s.referral_min_order_amount} onChange={(e) => setS({ ...s, referral_min_order_amount: Number(e.target.value) })} className="mt-1" /></div>
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <h3 className="font-medium">Platform fee (charged to customer)</h3>
        <p className="text-[11px] text-muted-foreground">Applied per rental day (or once for purchase) based on the final discounted price. Edit the JSON below to change slabs without touching code.</p>
        <textarea
          className="w-full min-h-[160px] rounded-md border border-border bg-background p-3 text-xs font-mono"
          value={platformSlabsText}
          onChange={(e) => setPlatformSlabsText(e.target.value)}
        />
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <h3 className="font-medium">Delivery charge slabs</h3>
        <p className="text-[11px] text-muted-foreground">Delivery fee (₹25–₹50) picked from the first slab whose <code>max_order</code> ≥ order subtotal.</p>
        <textarea
          className="w-full min-h-[120px] rounded-md border border-border bg-background p-3 text-xs font-mono"
          value={deliverySlabsText}
          onChange={(e) => setDeliverySlabsText(e.target.value)}
        />
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <h3 className="font-medium">GST</h3>
        <label className="flex items-center gap-3">
          <Switch checked={s.gst_enabled} onCheckedChange={(v) => setS({ ...s, gst_enabled: v })} />
          <span className="text-sm">Charge GST on orders (uses the GST % above)</span>
        </label>
      </div>

      <Button variant="hero" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>

    </div>
  );
}
