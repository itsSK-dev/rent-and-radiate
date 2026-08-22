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
 * Static mirror of `public.product_categories`. Used only as an offline/error
 * fallback so the homepage never renders a partial (or empty) category grid.
 */
const FALLBACK_CATEGORIES: CategoryConfig[] = [
  { slug: "dress", label: "Dresses", icon_name: "Shirt", gradient: "from-rose-300 via-pink-500 to-fuchsia-500", sort_order: 10, is_active: true },
  { slug: "jewellery", label: "Jewellery", icon_name: "Gem", gradient: "from-amber-300 via-yellow-500 to-orange-500", sort_order: 20, is_active: true },
  { slug: "accessory", label: "Accessories", icon_name: "Glasses", gradient: "from-purple-300 via-violet-500 to-indigo-500", sort_order: 30, is_active: false },
  { slug: "footwear", label: "Footwear", icon_name: "Footprints", gradient: "from-red-300 via-rose-500 to-pink-500", sort_order: 40, is_active: false },
  { slug: "bag", label: "Bags", icon_name: "ShoppingBag", gradient: "from-emerald-300 via-teal-500 to-cyan-500", sort_order: 50, is_active: false },
  { slug: "watch", label: "Watches", icon_name: "Watch", gradient: "from-slate-300 via-slate-500 to-slate-700", sort_order: 60, is_active: false },
  { slug: "beauty", label: "Beauty", icon_name: "Palette", gradient: "from-pink-300 via-rose-500 to-red-500", sort_order: 70, is_active: false },
  { slug: "electronics", label: "Electronics", icon_name: "Smartphone", gradient: "from-blue-300 via-indigo-500 to-purple-500", sort_order: 80, is_active: false },
  { slug: "camera", label: "Cameras", icon_name: "Camera", gradient: "from-zinc-300 via-zinc-500 to-neutral-700", sort_order: 90, is_active: false },
  { slug: "musical_instrument", label: "Musical Instruments", icon_name: "Music", gradient: "from-amber-300 via-orange-500 to-red-500", sort_order: 100, is_active: false },
  { slug: "furniture", label: "Furniture", icon_name: "Sofa", gradient: "from-yellow-300 via-amber-500 to-orange-600", sort_order: 110, is_active: false },
  { slug: "home_decor", label: "Home Decor", icon_name: "Lamp", gradient: "from-orange-300 via-amber-500 to-yellow-500", sort_order: 120, is_active: false },
  { slug: "sports", label: "Sports Equipment", icon_name: "Dumbbell", gradient: "from-lime-300 via-green-500 to-emerald-600", sort_order: 130, is_active: false },
  { slug: "baby", label: "Baby Products", icon_name: "Baby", gradient: "from-sky-300 via-blue-400 to-indigo-500", sort_order: 140, is_active: false },
  { slug: "toys", label: "Toys & Games", icon_name: "Gamepad2", gradient: "from-fuchsia-300 via-pink-500 to-rose-500", sort_order: 150, is_active: false },
  { slug: "books", label: "Books", icon_name: "BookOpen", gradient: "from-teal-300 via-emerald-500 to-green-600", sort_order: 160, is_active: false },
  { slug: "other", label: "Other", icon_name: "Package", gradient: "from-slate-300 via-slate-400 to-slate-500", sort_order: 999, is_active: false },
].map((c) => ({ ...c, description: null, launched_at: null }));

/**
 * Data-driven catalog of categories.
 * - `includeInactive=false` → only categories currently shoppable (Browse filters, vendor forms).
 * - `includeInactive=true`  → every category, including "Coming soon" ones (homepage, admin).
 *
 * Category rows are world-readable; visibility is decided in the UI via
 * `is_active`, never by hiding rows from the query.
 */
export function useCategories(includeInactive = false) {
  const [categories, setCategories] = useState<CategoryConfig[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (!alive) return;
      const rows = error || !data || data.length === 0 ? FALLBACK_CATEGORIES : (data as CategoryConfig[]);
      setCategories(includeInactive ? rows : rows.filter((c) => c.is_active));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [includeInactive]);

  return { categories: categories ?? [], loading };
}

