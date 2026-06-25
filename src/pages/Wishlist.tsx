import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/hooks/useWishlist";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { WishlistButton } from "@/components/WishlistButton";
import { Heart, Loader2 } from "lucide-react";

type Row = ProductCardData & { available: boolean };

export default function Wishlist() {
  const { user, loading: authLoading } = useAuth();
  const { ids, loading: wlLoading } = useWishlist();
  const navigate = useNavigate();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth?next=/wishlist"); return; }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      if (wlLoading) return;
      setLoading(true);
      const list = Array.from(ids);
      if (list.length === 0) { setItems([]); setLoading(false); return; }
      const { data } = await supabase
        .from("products")
        .select("id,title,category,price_per_day,security_deposit,images,actual_price,discount_percent,discount_flat,purpose,quantity,available,store:stores!products_store_id_fkey(name,city)")
        .in("id", list);
      if (cancelled) return;
      setItems((data as unknown as Row[]) ?? []);
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [user, ids, wlLoading]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-10 space-y-8">
        <header className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-4xl flex items-center gap-3">
              <Heart className="h-7 w-7 text-rose-deep fill-rose-deep" strokeWidth={1.5} />
              My Wishlist
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {items.length} {items.length === 1 ? "item" : "items"} saved · tap the heart on any product to add or remove
            </p>
          </div>
          <Button variant="soft" onClick={() => navigate("/browse")}>Browse more</Button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your saved items…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center space-y-4">
            <Heart className="h-12 w-12 mx-auto text-muted-foreground" strokeWidth={1.25} />
            <div>
              <h2 className="font-display text-2xl">Your wishlist is empty</h2>
              <p className="text-muted-foreground mt-1">
                Save dresses and jewellery you love and come back later.
              </p>
            </div>
            <Button variant="hero" asChild>
              <Link to="/browse">Explore products</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {items.map((p) => (
              <div key={p.id} className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <WishlistButton productId={p.id} title={p.title} size="md" />
                </div>
                <ProductCard p={p} />
                {!p.available && (
                  <p className="text-xs text-amber-600 mt-1 px-1">Currently unavailable</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
