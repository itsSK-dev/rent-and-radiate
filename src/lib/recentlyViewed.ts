import type { ProductCardData } from "@/components/ProductCard";

const KEY = "rr.recentlyViewed";
const MAX = 12;

/** Remember a product the visitor opened (client-only, no PII). */
export function pushRecentlyViewed(p: ProductCardData) {
  try {
    const list = readRecentlyViewed().filter((x) => x.id !== p.id);
    const slim: ProductCardData = {
      id: p.id,
      title: p.title,
      category: p.category,
      price_per_day: p.price_per_day,
      security_deposit: p.security_deposit,
      images: (p.images ?? []).slice(0, 1),
      actual_price: p.actual_price,
      discount_percent: p.discount_percent,
      discount_flat: p.discount_flat,
      purpose: p.purpose,
      quantity: p.quantity,
      store: p.store ?? null,
    };
    localStorage.setItem(KEY, JSON.stringify([slim, ...list].slice(0, MAX)));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function readRecentlyViewed(): ProductCardData[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? (raw as ProductCardData[]) : [];
  } catch {
    return [];
  }
}
