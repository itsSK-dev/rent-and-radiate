import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/hooks/useWishlist";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { WishlistButton } from "@/components/WishlistButton";
import { Heart, Loader2, CalendarIcon, Sparkles } from "lucide-react";
import { addDays, format, differenceInCalendarDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Row = ProductCardData & { available: boolean };

export default function Wishlist() {
  const { user, loading: authLoading } = useAuth();
  const { ids, loading: wlLoading } = useWishlist();
  const navigate = useNavigate();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // Shared default range applied to all cards; each card can override.
  const defaultRange = useMemo<DateRange>(
    () => ({ from: addDays(new Date(), 1), to: addDays(new Date(), 3) }),
    [],
  );
  const [ranges, setRanges] = useState<Record<string, DateRange | undefined>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      toast.info("Please sign in to continue with your order.");
      navigate("/auth?next=/wishlist");
    }
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

  function rentNow(p: Row) {
    const r = ranges[p.id] ?? defaultRange;
    const params = new URLSearchParams({ mode: "rent" });
    if (r?.from) params.set("start", format(r.from, "yyyy-MM-dd"));
    if (r?.to) params.set("end", format(r.to, "yyyy-MM-dd"));
    navigate(`/product/${p.id}?${params.toString()}`);
  }

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
              {items.length} {items.length === 1 ? "item" : "items"} saved · pick dates and tap Rent now to start checkout
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((p) => {
              const range = ranges[p.id] ?? defaultRange;
              const purpose = p.purpose ?? "rent";
              const canRent = purpose === "rent" || purpose === "both";
              const outOfStock = (p.quantity ?? 1) <= 0 || !p.available;
              const days = range?.from && range?.to
                ? Math.max(1, differenceInCalendarDays(range.to, range.from) + 1)
                : 0;
              const label = range?.from && range?.to
                ? `${format(range.from, "MMM d")} – ${format(range.to, "MMM d")}`
                : range?.from
                  ? `${format(range.from, "MMM d")} – pick end`
                  : "Pick rental dates";
              return (
                <div key={p.id} className="space-y-3">
                  <div className="relative">
                    <div className="absolute top-3 right-3 z-10">
                      <WishlistButton productId={p.id} title={p.title} size="md" />
                    </div>
                    <ProductCard p={p} />
                  </div>
                  {canRent ? (
                    <div className="space-y-2 px-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !range?.from && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="h-4 w-4" />
                            <span className="truncate">{label}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="range"
                            selected={range}
                            onSelect={(r) => setRanges((prev) => ({ ...prev, [p.id]: r }))}
                            numberOfMonths={1}
                            disabled={{ before: new Date() }}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <Button
                        type="button"
                        variant="hero"
                        size="sm"
                        className="w-full"
                        disabled={outOfStock}
                        onClick={() => rentNow(p)}
                      >
                        <Sparkles className="h-4 w-4" />
                        {outOfStock
                          ? "Currently unavailable"
                          : days > 0
                            ? `Rent now · ${days} ${days === 1 ? "day" : "days"}`
                            : "Rent now"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground px-1">Buy-only item</p>
                  )}
                  {!p.available && canRent && (
                    <p className="text-xs text-amber-600 px-1">Currently unavailable</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
