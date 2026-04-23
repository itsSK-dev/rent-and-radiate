import { supabase } from "@/integrations/supabase/client";
import dress1 from "@/assets/dress-1.jpg";
import dress2 from "@/assets/dress-2.jpg";
import dress3 from "@/assets/dress-3.jpg";
import jewel1 from "@/assets/jewel-1.jpg";
import jewel2 from "@/assets/jewel-2.jpg";
import jewel3 from "@/assets/jewel-3.jpg";

// Map demo product titles to bundled imagery so the marketplace looks rich
// even before any vendor uploads anything.
export const demoImageMap: Record<string, string> = {
  "Blush Tulle Gown": dress1,
  "Crimson Heritage Lehenga": dress2,
  "Emerald Silk Saree": dress3,
  "Diamond Garland Set": jewel1,
  "Polki Emerald Necklace": jewel2,
  "Rose Quartz Drops": jewel3,
};

/**
 * Seeds demo products for the first store in the database, only if the
 * products table is empty. Safe to call from the landing page on mount.
 */
export async function seedDemoProductsIfEmpty() {
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return;

  const { data: stores } = await supabase.from("stores").select("id, name").limit(3);
  if (!stores || stores.length === 0) return;

  const rose = stores.find((s) => s.name === "Rosé Atelier") ?? stores[0];
  const aurum = stores.find((s) => s.name === "Maison Aurum") ?? stores[Math.min(1, stores.length - 1)];
  const velvet = stores.find((s) => s.name === "Velvet & Vine") ?? stores[Math.min(2, stores.length - 1)];

  const seed = [
    { store_id: rose.id, category: "dress" as const, title: "Blush Tulle Gown", description: "Floor-length tulle gown with a hand-pleated bodice. Perfect for engagements and cocktail evenings.", images: [dress1], price_per_day: 1800, security_deposit: 8000, size: "S / M / L", color: "Blush Pink", condition_notes: "Excellent — dry-cleaned after each rental.", available: true },
    { store_id: rose.id, category: "dress" as const, title: "Crimson Heritage Lehenga", description: "Hand-embroidered crimson lehenga with antique gold zardozi. A statement piece for sangeet & reception.", images: [dress2], price_per_day: 3200, security_deposit: 15000, size: "M / L", color: "Crimson", condition_notes: "Pristine — minor sequin touch-ups annually.", available: true },
    { store_id: velvet.id, category: "dress" as const, title: "Emerald Silk Saree", description: "Pure Kanjivaram silk in deep emerald with a hand-woven gold border. Includes blouse piece.", images: [dress3], price_per_day: 1400, security_deposit: 6000, size: "Free size", color: "Emerald", condition_notes: "Like new.", available: true },
    { store_id: aurum.id, category: "jewellery" as const, title: "Diamond Garland Set", description: "Necklace and matching earrings in 18k gold with VS-clarity diamonds. Comes in a velvet case.", images: [jewel1], price_per_day: 2400, security_deposit: 25000, size: "Adjustable", color: "Gold / White", condition_notes: "Certified, regularly inspected.", available: true },
    { store_id: aurum.id, category: "jewellery" as const, title: "Polki Emerald Necklace", description: "Traditional uncut polki necklace set with natural emeralds and freshwater pearls.", images: [jewel2], price_per_day: 2800, security_deposit: 30000, size: "Adjustable", color: "Gold / Green", condition_notes: "Heritage piece — handle with care.", available: true },
    { store_id: aurum.id, category: "jewellery" as const, title: "Rose Quartz Drops", description: "Delicate rose-gold drop earrings with pear-cut pink tourmaline. Effortlessly elegant.", images: [jewel3], price_per_day: 600, security_deposit: 3500, size: "One size", color: "Rose Gold / Pink", condition_notes: "Perfect.", available: true },
  ];

  await supabase.from("products").insert(seed);
}
