import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_SETTINGS,
  DEFAULT_PLATFORM_FEE_SLABS,
  DEFAULT_DELIVERY_FEE_SLABS,
  type PlatformSettings,
} from "@/lib/pricing";

export function usePlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await (supabase as any).rpc("get_public_platform_settings");

      if (mounted && data) {
        setSettings({
          gst_percent: Number(data.gst_percent),
          gst_enabled: data.gst_enabled !== false,
          delivery_fee: Number(data.delivery_fee),
          commission_percent: Number(data.commission_percent),
          rental_price_percent: Math.max(10, Number(data.rental_price_percent ?? 10)),
          deposit_percent_of_price: Number(data.deposit_percent_of_price ?? 100),
          protection_plan_percent: Number(data.protection_plan_percent ?? 5),
          protection_plan_min: Number(data.protection_plan_min ?? 49),
          late_fee_multiplier: Number(data.late_fee_multiplier ?? 1.5),
          late_fee_grace_hours: Number(data.late_fee_grace_hours ?? 2),
          rent_to_own_enabled: Boolean(data.rent_to_own_enabled ?? false),
          rent_to_own_credit_percent: Number(data.rent_to_own_credit_percent ?? 50),
          platform_fee_slabs: data.platform_fee_slabs ?? DEFAULT_PLATFORM_FEE_SLABS,
          delivery_fee_slabs: data.delivery_fee_slabs ?? DEFAULT_DELIVERY_FEE_SLABS,
        });
      }
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  return { settings, loading };
}
