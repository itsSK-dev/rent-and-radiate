import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import { supabase } from "@/integrations/supabase/client";
import { useServiceCity, cityOrExpr } from "@/lib/serviceArea";

export type SearchProduct = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  color: string | null;
  size: string | null;
  price_per_day: number;
  actual_price: number;
  purpose: string;
  images: string[];
  store_id: string;
  store_name: string;
  store_city: string | null;
};

export type SearchShop = {
  id: string;
  name: string;
  city: string | null;
  rating: number;
  logo_url: string | null;
};

export type SearchCategory = { slug: string; label: string };

const CATEGORY_CATALOG: SearchCategory[] = [
  { slug: "dress", label: "Dresses" },
  { slug: "jewellery", label: "Jewellery" },
];

// Module-level cache keyed by city (short TTL) — keeps opening the search snappy.
type CacheEntry = { at: number; products: SearchProduct[]; shops: SearchShop[] };
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

async function fetchIndex(city: string): Promise<{ products: SearchProduct[]; shops: SearchShop[] }> {
  const cached = CACHE.get(city);
  if (cached && Date.now() - cached.at < TTL_MS) return { products: cached.products, shops: cached.shops };

  const [productsRes, storesRes] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id,title,category,description,color,size,price_per_day,actual_price,purpose,images,store_id,store:stores!inner(id,name,city,status,is_verified,is_active,is_blocked)"
      )
      .eq("available", true)
      .ilike("stores.city", city)
      .limit(2000),
    supabase
      .from("stores")
      .select("id,name,city,rating,logo_url")
      .eq("status", "approved")
      .eq("is_verified", true)
      .eq("is_active", true)
      .eq("is_blocked", false)
      .ilike("city", city)
      .limit(500),
  ]);

  const products: SearchProduct[] = ((productsRes.data as any[]) ?? [])
    .filter((p) => p.store?.status === "approved" && p.store?.is_verified && p.store?.is_active && !p.store?.is_blocked)
    .map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      description: p.description,
      color: p.color,
      size: p.size,
      price_per_day: p.price_per_day,
      actual_price: p.actual_price,
      purpose: p.purpose,
      images: p.images ?? [],
      store_id: p.store_id,
      store_name: p.store?.name ?? "",
      store_city: p.store?.city ?? null,
    }));

  const shops: SearchShop[] = (storesRes.data as SearchShop[]) ?? [];
  CACHE.set(city, { at: Date.now(), products, shops });
  return { products, shops };
}

export function useSearchIndex(enabled: boolean) {
  const { city, isServiceable } = useServiceCity();
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [shops, setShops] = useState<SearchShop[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !isServiceable) return;
    let cancelled = false;
    setLoading(true);
    fetchIndex(city)
      .then((r) => {
        if (cancelled) return;
        setProducts(r.products);
        setShops(r.shops);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [enabled, isServiceable, city]);

  const productFuse = useMemo(
    () =>
      new Fuse(products, {
        keys: [
          { name: "title", weight: 0.5 },
          { name: "category", weight: 0.2 },
          { name: "description", weight: 0.15 },
          { name: "color", weight: 0.05 },
          { name: "size", weight: 0.05 },
          { name: "store_name", weight: 0.05 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
        includeMatches: true,
        includeScore: true,
        minMatchCharLength: 2,
      }),
    [products]
  );

  const shopFuse = useMemo(
    () =>
      new Fuse(shops, {
        keys: [
          { name: "name", weight: 0.7 },
          { name: "city", weight: 0.3 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
        includeMatches: true,
        includeScore: true,
        minMatchCharLength: 2,
      }),
    [shops]
  );

  const categoryFuse = useMemo(
    () =>
      new Fuse(CATEGORY_CATALOG, {
        keys: ["label", "slug"],
        threshold: 0.4,
        includeMatches: true,
        includeScore: true,
      }),
    []
  );

  return { products, shops, categories: CATEGORY_CATALOG, productFuse, shopFuse, categoryFuse, loading };
}

// Trending = most recently listed products (simple, no analytics dep).
export function pickTrending(products: SearchProduct[], n = 6): SearchProduct[] {
  return products.slice(0, n);
}
