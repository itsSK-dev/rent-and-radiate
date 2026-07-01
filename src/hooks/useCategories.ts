import { useEffect, useState } from "react";
import * as LucideIcons from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type CategoryConfig = {
  slug: string;
  label: string;
  description: string | null;
  icon_name: string;
  gradient: string;
  sort_order: number;
  is_active: boolean;
  launched_at: string | null;
};

/** Resolve a Lucide icon by name, with a safe fallback. */
export function getCategoryIcon(name: string) {
  const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[name];
  return Icon ?? LucideIcons.Package;
}

/**
 * Data-driven catalog of categories.
 * - `includeInactive=false` → only categories currently visible to customers.
 * - `includeInactive=true`  → all categories (for admin + vendor gating UIs).
 *
 * Falls back to the two launch categories if the request fails, so the
 * homepage never renders empty on a cold cache.
 */
export function useCategories(includeInactive = false) {
  const [categories, setCategories] = useState<CategoryConfig[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const query = supabase
        .from("product_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      const { data, error } = includeInactive ? await query : await query.eq("is_active", true);
      if (!alive) return;
      if (error || !data) {
        setCategories([
          { slug: "dress", label: "Dresses", description: null, icon_name: "Shirt", gradient: "from-rose-400 via-pink-500 to-fuchsia-500", sort_order: 10, is_active: true, launched_at: null },
          { slug: "jewellery", label: "Jewellery", description: null, icon_name: "Gem", gradient: "from-amber-300 via-yellow-500 to-orange-500", sort_order: 20, is_active: true, launched_at: null },
        ]);
      } else {
        setCategories(data as CategoryConfig[]);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [includeInactive]);

  return { categories: categories ?? [], loading };
}
