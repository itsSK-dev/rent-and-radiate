import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useServiceCity } from "@/lib/serviceArea";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";

type Sort = "newest" | "price_asc" | "price_desc";

const STOPWORDS = new Set(["a","an","the","and","or","of","with","for","in","on","to","is","this","that","it","at","by","be","as"]);
function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(t => t.length > 2 && !STOPWORDS.has(t));
}
function similarity(productText: string, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const pTokens = new Set(tokenize(productText));
  let hits = 0;
  for (const t of queryTokens) if (pTokens.has(t)) hits++;
  return hits / queryTokens.length;
}


const Browse = () => {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);

  const category = params.get("category") ?? "all";
  const q = params.get("q") ?? "";
  const sort = (params.get("sort") as Sort) ?? "newest";
  const storeId = params.get("store");
  const purpose = params.get("purpose") ?? "all";
  const match = params.get("match") ?? "";
  const matchTokens = useMemo(() => tokenize(match), [match]);

  const scoredProducts = useMemo(() => {
    if (matchTokens.length === 0) return products.map(p => ({ p, score: 0 }));
    return products
      .map(p => ({ p, score: similarity(`${p.title} ${p.category}`, matchTokens) }))
      .sort((a, b) => b.score - a.score);
  }, [products, matchTokens]);


  useEffect(() => {
    document.title = `Browse ${category === "all" ? "all" : category} · Rent & Radiate`;
  }, [category]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase
        .from("products")
        .select("id,title,category,price_per_day,security_deposit,images,actual_price,discount_percent,discount_flat,purpose,quantity,store:stores!inner(name,city,status,is_verified,is_active,is_blocked,rating)")
        .eq("available", true);
      if (category !== "all") query = query.eq("category", category as any);
      if (storeId) query = query.eq("store_id", storeId);
      if (q) query = query.ilike("title", `%${q}%`);
      if (purpose === "rent") query = query.in("purpose", ["rent", "both"] as any);
      else if (purpose === "buy") query = query.in("purpose", ["buy", "both"] as any);
      if (sort === "price_asc") query = query.order("price_per_day", { ascending: true });
      else if (sort === "price_desc") query = query.order("price_per_day", { ascending: false });
      else query = query.order("created_at", { ascending: false });
      const { data } = await query;
      const filtered = (data ?? []).filter((p: any) =>
        p.store?.status === "approved" &&
        p.store?.is_verified === true &&
        p.store?.is_active === true &&
        p.store?.is_blocked === false,
      );
      setProducts(filtered as any);
      setLoading(false);
    })();
  }, [category, q, sort, storeId, purpose]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key); else next.set(key, value);
    setParams(next);
  }

  const heading = useMemo(() => {
    if (purpose === "rent") return "Rent the look";
    if (purpose === "buy") return "Buy something new";
    if (category === "dress") return "Dresses to fall for";
    if (category === "jewellery") return "Jewellery that sparkles";
    return "Everything in bloom";
  }, [category, purpose]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-12">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Marketplace</p>
          <h1 className="font-display text-5xl md:text-6xl">{heading}</h1>
          <p className="text-muted-foreground mt-3">Curated pieces from approved boutiques.</p>
        </div>

        {match && (
          <div className="mb-8 rounded-2xl border border-rose-deep/20 bg-rose-deep/5 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-1 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Visual search results
              </p>
              <p className="text-sm">
                Matching against: <span className="italic">"{match}"</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Ranked by similarity to your image — top matches are highlighted with a rose border. Scores reflect overlap between your image's keywords and each product's title and category.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { const n = new URLSearchParams(params); n.delete("match"); setParams(n); }}>
              Clear visual search
            </Button>
          </div>
        )}


        <div className="flex flex-col md:flex-row gap-3 md:items-center mb-10">
          <Input
            placeholder="Search…"
            defaultValue={q}
            onKeyDown={(e) => { if (e.key === "Enter") update("q", (e.target as HTMLInputElement).value); }}
            className="md:max-w-xs"
          />
          <Select value={purpose} onValueChange={(v) => update("purpose", v)}>
            <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Rent & buy</SelectItem>
              <SelectItem value="rent">For rent</SelectItem>
              <SelectItem value="buy">For sale</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(v) => update("category", v)}>
            <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="dress">Dresses</SelectItem>
              <SelectItem value="jewellery">Jewellery</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => update("sort", v)}>
            <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="price_asc">Price: low to high</SelectItem>
              <SelectItem value="price_desc">Price: high to low</SelectItem>
            </SelectContent>
          </Select>
          {(q || storeId || category !== "all" || purpose !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams())}>Clear filters</Button>
          )}
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : products.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            No pieces found. Try a different search.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
            {scoredProducts.map(({ p, score }) => (
              <ProductCard key={p.id} p={p} matchScore={match ? score : undefined} />
            ))}
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
};

export default Browse;
