import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SETTINGS, type PlatformSettings } from "@/lib/pricing";

export function usePlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("platform_settings")
        .select("gst_percent,delivery_fee,commission_percent")
        .eq("id", true)
        .maybeSingle();
      if (mounted && data) {
        setSettings({
          gst_percent: Number(data.gst_percent),
          delivery_fee: Number(data.delivery_fee),
          commission_percent: Number(data.commission_percent),
        });
      }
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  return { settings, loading };
}
