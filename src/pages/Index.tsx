import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { HeroCarousel } from "@/components/HeroCarousel";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { HomeRail, RailItem } from "@/components/home/HomeRail";
import { TrustBadges } from "@/components/home/TrustBadges";
import { readRecentlyViewed } from "@/lib/recentlyViewed";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { useServiceCity, cityOrExpr as cityOrExprFor } from "@/lib/serviceArea";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { useCategories, getCategoryIcon } from "@/hooks/useCategories";
import { NEARBY_RADIUS_KM, haversineKm, setSavedCoords, useUserCoords } from "@/lib/geo";
import { catalogLog } from "@/lib/catalogDebug";
import { discountedUnitPrice } from "@/lib/pricing";
import { Seo } from "@/components/Seo";

// Below-the-fold sections are code-split so the first screen stays fast.
const ShopTheLook = lazy(() => import("@/components/ShopTheLook").then((m) => ({ default: m.ShopTheLook })));
const WhyChooseSection = lazy(() => import("@/components/WhyChooseSection").then((m) => ({ default: m.WhyChooseSection })));
const PromoBanners = lazy(() => import("@/components/PromoBanners").then((m) => ({ default: m.PromoBanners })));
const ShareAppSection = lazy(() => import("@/components/ShareAppSection").then((m) => ({ default: m.ShareAppSection })));
const BecomeSellerSection = lazy(() => import("@/components/BecomeSellerSection").then((m) => ({ default: m.BecomeSellerSection })));


// NOTE: We intentionally do NOT seed demo products from the client.
// Client-side seeding only works for the user who owns the target store
// (RLS blocks everyone else), which produced "I see it but others don't"
// bugs. All product data must come from the moderated vendor upload flow
// so every visitor sees the same approved rows.
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Camera,
  Dumbbell,
  Flame,
  Gem,
  Gift,
  LayoutGrid,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Package,
  Search,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sofa,
  Search as SearchIcon,
  CalendarCheck,
  PackagePlus,
  Star,
  Store as StoreIcon,
  UtensilsCrossed,
} from "lucide-react";

type NearbyShop = {
  id: string;
  name: string;
  city: string | null;
  rating: number;
  rating_count: number;
  logo_url: string | null;
  lat: number | null;
  lng: number | null;
  product_count: number;
  distance_km: number | null;
};

// Category catalog is data-driven from `public.product_categories`. To launch
// a category, an admin flips `is_active = true` on the row (or uses the Admin →
// Categories tab) — no code changes required. The Postgres enum already
// includes every planned slug, so vendors and orders can begin using it the
// moment it's activated. See `useCategories()` in `src/hooks/useCategories.ts`.




// Shops on the marketplace are open 10:00 – 21:00 IST by convention (no per-shop hours stored).
function isShopOpenNow() {
  const now = new Date();
  const istHour = (now.getUTCHours() + 5 + Math.floor((now.getUTCMinutes() + 30) / 60)) % 24;
  return istHour >= 10 && istHour < 21;
}

const POPULAR_SUGGESTIONS = [
  "Red dress under ₹2000 for rent",
  "Gold jewellery for wedding",
  "Designer lehenga",
  "Smartphones on rent",
  "Office chair near me",
  "Camera lens rental",
  "Party wear gowns",
  "Bridal collection",
];
const RECENT_KEY = "rr.recentSearches";

const Index = () => {
  const { city: serviceCity, isServiceable } = useServiceCity();
  const { categories: categoryConfigs } = useCategories(true);

  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [stores, setStores] = useState<NearbyShop[]>([]);
  const [topRated, setTopRated] = useState<NearbyShop[]>([]);
  const [ratingsTick, setRatingsTick] = useState(0);
  const [shopsOpen] = useState<boolean>(() => isShopOpenNow());
  const [query, setQuery] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [nearbyCity, setNearbyCity] = useState<string | null>(null);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<ProductCardData[]>([]);

  const coords = useUserCoords();
  const recogRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const catalogRequestSeq = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Rent & Radiate — Rent or buy designer fashion near you";
    const meta = document.querySelector('meta[name="description"]');
    if (meta)
      meta.setAttribute(
        "content",
        "Shop the look: rent or buy designer dresses, jewellery and accessories from boutiques near you. Tap any piece on the model to view, rent, or buy.",
      );

    setRecentlyViewed(readRecentlyViewed());

    try {
      const r = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      if (Array.isArray(r)) setRecent(r.slice(0, 5));
      const city = localStorage.getItem("rr.location");
      if (city) setNearbyCity(city);
    } catch {
      /* ignore */
    }


    function onDocClick(ev: MouseEvent) {
      if (!searchWrapRef.current?.contains(ev.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const fetchCatalog = useCallback(async () => {
    const seq = ++catalogRequestSeq.current;
    // Skip catalog fetches entirely when the user is outside the service area.
    if (!isServiceable) {
      setProducts([]);
      setStores([]);
      setTopRated([]);
      setCatalogLoaded(true);
      catalogLog("home-skip", { serviceCity, isServiceable });
      return;
    }
    const cityOr = cityOrExprFor(serviceCity);

    // Product catalogue is fully DB-driven via vendor uploads + admin approval.
    // Only approved + verified + active + not-blocked stores surface products
    // — same predicate used by Browse and Universal Search for consistency.
    const { data, error: productError } = await supabase
      .from("products")
      .select(
        "id,title,category,price_per_day,security_deposit,images,actual_price,discount_percent,discount_flat,purpose,quantity,store:stores!inner(name,city,status,is_verified,is_active,is_blocked,rating)",
      )
      .eq("available", true)
      .eq("stores.status", "approved")
      .eq("stores.is_verified", true)
      .eq("stores.is_active", true)
      .eq("stores.is_blocked", false)
      .or(cityOr, { foreignTable: "stores" })
      .order("created_at", { ascending: false })
      .limit(24);
    if (seq !== catalogRequestSeq.current) {
      catalogLog("home-products-stale-response", { seq, current: catalogRequestSeq.current });
      return;
    }
    catalogLog("home-products-fetch", {
      seq,
      serviceCity,
      cityOr,
      rows: data?.length ?? 0,
      error: productError?.message,
      firstIds: (data ?? []).slice(0, 6).map((p: any) => p.id),
    });
    setProducts((data as any) ?? []);

    const { data: s, error: storesError } = await supabase
      .from("stores")
      .select("id,name,city,rating,rating_count,logo_url,lat,lng")
      .eq("status", "approved")
      .eq("is_verified", true)
      .eq("is_active", true)
      .eq("is_blocked", false)
      .or(cityOr)
      .limit(20);
    if (seq !== catalogRequestSeq.current) {
      catalogLog("home-stores-stale-response", { seq, current: catalogRequestSeq.current });
      return;
    }
    const rawStores = (s ?? []) as Array<{
      id: string;
      name: string;
      city: string | null;
      rating: number;
      rating_count: number;
      logo_url: string | null;
      lat: number | null;
      lng: number | null;
    }>;

    // Per-shop available product counts (small N, parallel and cheap).
    const counts = await Promise.all(
      rawStores.map(async (st) => {
        const { count } = await supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("store_id", st.id)
          .eq("available", true);
        return count ?? 0;
      }),
    );
    if (seq !== catalogRequestSeq.current) {
      catalogLog("home-counts-stale-response", { seq, current: catalogRequestSeq.current });
      return;
    }

    // Distance is only calculated after the user explicitly taps "Use my
    // location" via the Nearby button — never on page load. Lighthouse Best
    // Practices flags automatic geolocation prompts, and it's poor UX to ask
    // for a permission the visitor didn't request.
    const enriched: NearbyShop[] = rawStores.map((st, i) => ({
      ...st,
      product_count: counts[i],
      distance_km:
        coords && st.lat != null && st.lng != null
          ? haversineKm(coords, { lat: st.lat, lng: st.lng })
          : null,
    }));

    // Top rated ranking: avg rating × total ratings. Ties broken by rating,
    // then by number of listed products so newly-launched shops with 0
    // ratings still get a fair, deterministic order.
    const ranked = [...enriched]
      .sort((a, b) => {
        const sa = (a.rating || 0) * (a.rating_count || 0);
        const sb = (b.rating || 0) * (b.rating_count || 0);
        if (sb !== sa) return sb - sa;
        if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
        return (b.product_count || 0) - (a.product_count || 0);
      })
      .slice(0, 5);
    setTopRated(ranked);

    // Nearby = verified shops within NEARBY_RADIUS_KM of the visitor's shared
    // location. Without a shared location we fall back to the service-city
    // shops (never random out-of-area shops).
    const nearby = (coords
      ? enriched.filter((st) => st.distance_km == null || st.distance_km <= NEARBY_RADIUS_KM)
      : enriched)
      .slice()
      .sort((a, b) => {
        if (a.distance_km != null && b.distance_km != null) return a.distance_km - b.distance_km;
        if (a.distance_km != null) return -1;
        if (b.distance_km != null) return 1;
        return b.rating - a.rating;
      });
    setStores(nearby.slice(0, 8));
    catalogLog("home-stores-fetch", {
      seq,
      serviceCity,
      cityOr,
      rows: s?.length ?? 0,
      enriched: enriched.length,
      nearby: nearby.length,
      coords: !!coords,
      error: storesError?.message,
      firstIds: rawStores.slice(0, 8).map((st) => st.id),
    });
    setCatalogLoaded(true);
  }, [isServiceable, serviceCity, coords]);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog, ratingsTick]);

  // Live sync: any product insert/update/delete, or any store change (new
  // shop, admin verification, disable/block) refreshes the home catalogue.
  useEffect(() => {
    const ch = supabase
      .channel(`home-catalog-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, (payload) => { catalogLog("home-realtime-products", payload); void fetchCatalog(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "stores" }, (payload) => { catalogLog("home-realtime-stores", payload); void fetchCatalog(); })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchCatalog]);


  // Realtime: re-rank Top Rated when any rating is added, edited or removed.
  // (Store row changes are already handled by the catalog channel above.)
  useEffect(() => {
    const bump = () => setRatingsTick((n) => n + 1);
    const ch = supabase
      .channel(`home-ratings-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ratings" }, bump)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);





  function pushRecent(text: string) {
    try {
      const next = [text, ...recent.filter((r) => r.toLowerCase() !== text.toLowerCase())].slice(0, 5);
      setRecent(next);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function buildBrowseUrl(filters: { q?: string; category?: string; purpose?: string; sort?: string }) {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.category && filters.category !== "all") params.set("category", filters.category);
    if (filters.purpose && filters.purpose !== "all") params.set("purpose", filters.purpose);
    if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
    const qs = params.toString();
    return qs ? `/browse?${qs}` : "/browse";
  }

  const runSearch = async (text: string) => {
    const q = text.trim();
    if (!q) return;
    setFocused(false);
    pushRecent(q);
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-search", { body: { query: q } });
      if (error || !data || (data as any).error) {
        navigate(`/browse?q=${encodeURIComponent(q)}`);
        return;
      }
      navigate(buildBrowseUrl(data as any));
    } catch {
      navigate(`/browse?q=${encodeURIComponent(q)}`);
    } finally {
      setAiBusy(false);
    }
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  function useNearby() {
    if (!navigator.geolocation) {
      if (nearbyCity) {
        toast.success(`Showing shops near ${nearbyCity}`);
        navigate(`/browse?city=${encodeURIComponent(nearbyCity)}`);
      } else {
        toast.error("Geolocation isn't supported. Pick a city from the top-left location chip.");
      }
      return;
    }
    toast.message("Finding shops near you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Persist coordinates so the Nearby rail can filter shops by real
        // distance (within NEARBY_RADIUS_KM) instead of city name alone.
        setSavedCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success(`Showing verified shops within ${NEARBY_RADIUS_KM} km`);
        document.getElementById("nearby-shops")?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      () => {
        if (nearbyCity) navigate(`/browse?city=${encodeURIComponent(nearbyCity)}`);
        else toast.error("Couldn't detect location. Pick a city from the top-left chip.");
      },
      { timeout: 6000 },
    );
  }



  function toggleVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice search isn't supported in this browser. Try Chrome.");
      return;
    }
    if (listening) {
      recogRef.current?.stop();
      return;
    }
    const recog = new SR();
    recog.lang = "en-IN";
    recog.interimResults = true;
    recog.maxAlternatives = 1;
    recog.onresult = (ev: any) => {
      const transcript = Array.from(ev.results)
        .map((r: any) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) setQuery(transcript);
    };
    recog.onerror = () => setListening(false);
    recog.onend = () => setListening(false);
    recogRef.current = recog;
    setListening(true);
    recog.start();
  }

  async function onImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image is too large (max 8 MB).");
      return;
    }
    setImageBusy(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("image-search", { body: { image: dataUrl } });
      if (error || !data || (data as any).error) {
        toast.error("Couldn't analyse that image. Try another one.");
        return;
      }
      const d = data as any;
      if (d.description) toast.success(`Looking for: ${d.description}`);
      const params = new URLSearchParams();
      if (d.category && d.category !== "all") params.set("category", d.category);
      const matchTerms = [d.q, d.description].filter(Boolean).join(" ").trim();
      if (matchTerms) params.set("match", matchTerms);
      navigate(`/browse?${params.toString()}`);
    } catch {
      toast.error("Image search failed. Please try again.");
    } finally {
      setImageBusy(false);
    }
  }



  // Derived rails — one fetch, several views, so the first screen is dense
  // without extra network round-trips.
  const newArrivals = products.slice(0, 12);
  const trending = useMemo(
    () =>
      [...products]
        .sort((a, b) => {
          const da = Number(a.actual_price ?? 0) - discountedUnitPrice(Number(a.actual_price ?? 0), a.discount_percent ?? 0, a.discount_flat ?? 0);
          const db = Number(b.actual_price ?? 0) - discountedUnitPrice(Number(b.actual_price ?? 0), b.discount_percent ?? 0, b.discount_flat ?? 0);
          return db - da;
        })
        .slice(0, 12),
    [products],
  );
  const topRatedProducts = useMemo(
    () =>
      [...products]
        .sort((a, b) => Number(b.store?.rating ?? 0) - Number(a.store?.rating ?? 0))
        .slice(0, 12),
    [products],
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Seo
        title="Rent & Radiate — Rent designer dresses & jewellery"
        description="Rent or buy designer dresses, jewellery and accessories from verified boutiques near you — refundable deposits, tracked delivery, transparent pricing."
        path="/"
      />
      <Navbar />
      <main id="main-content" className="flex-1">

      {/* Sticky smart search + quick filters */}
      <section className="sticky top-16 z-30 bg-background/95 backdrop-blur-xl border-b border-border/60">
        <div className="container pt-2.5 pb-2">
          <div ref={searchWrapRef} className="relative">

            <form
              onSubmit={onSearch}
              className={`group flex items-center gap-1.5 md:gap-2 bg-card/95 backdrop-blur rounded-full pl-4 md:pl-5 pr-1.5 md:pr-2 py-1.5 md:py-2 border border-border shadow-petal transition-all duration-300 ${
                focused ? "ring-2 ring-rose-deep/30 shadow-[0_18px_45px_-20px_hsl(var(--rose-deep)/0.45)]" : ""
              }`}
              role="search"
            >
              <SearchIcon className="h-4 w-4 text-rose-deep shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                placeholder="Search dresses, jewellery, electronics, furniture near you..."
                className="flex-1 bg-transparent outline-none text-sm py-1.5 min-w-0 placeholder:text-muted-foreground/80"
                aria-label="Smart product search"
                disabled={aiBusy}
              />
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onImagePicked} />
              <button
                type="button"
                onClick={useNearby}
                aria-label="Find nearby shops"
                title={nearbyCity ? `Nearby: ${nearbyCity}` : "Find nearby shops"}
                className="hidden sm:flex shrink-0 h-9 px-3 rounded-full items-center gap-1.5 text-xs font-medium text-rose-deep bg-blossom/60 hover:bg-blossom transition-colors"
              >
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate max-w-[80px]">{nearbyCity ?? "Nearby"}</span>
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Search by image"
                title="Search by image"
                disabled={imageBusy}
                className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-colors text-muted-foreground hover:bg-muted hover:text-rose-deep disabled:opacity-60"
              >
                {imageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={toggleVoice}
                aria-label={listening ? "Stop voice search" : "Start voice search"}
                title="Voice search"
                className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                  listening ? "bg-rose-deep text-background animate-pulse" : "text-muted-foreground hover:bg-muted hover:text-rose-deep"
                }`}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <Button
                type="submit"
                variant="hero"
                size="sm"
                className="rounded-full shrink-0 h-9 px-3 md:px-5"
                disabled={aiBusy}
              >
                {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 md:hidden" />}
                <span className="hidden md:inline">{aiBusy ? "Searching" : "Search"}</span>
              </Button>
            </form>

            {/* Suggestions dropdown */}
            {focused && (
              <div className="absolute left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-petal overflow-hidden z-30 animate-fade-in">
                {recent.length > 0 && (
                  <div className="p-3 border-b border-border/60">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Recent</p>
                    <div className="flex flex-wrap gap-1.5">
                      {recent.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setQuery(r);
                            runSearch(r);
                          }}
                          className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-blossom hover:text-rose-deep transition-colors"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                    {query.trim() ? "Suggestions" : "Popular searches"}
                  </p>
                  <ul className="flex flex-col">
                    {(query.trim()
                      ? POPULAR_SUGGESTIONS.filter((s) => s.toLowerCase().includes(query.trim().toLowerCase()))
                      : POPULAR_SUGGESTIONS
                    )
                      .slice(0, 6)
                      .map((s) => (
                        <li key={s}>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setQuery(s);
                              runSearch(s);
                            }}
                            className="w-full text-left text-sm px-2 py-2 rounded-lg hover:bg-blossom/60 flex items-center gap-2 transition-colors"
                          >
                            <Search className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate">{s}</span>
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            )}

          </div>

          {/* Quick filters — always one tap away */}
          <div className="mt-2 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { label: "Rent", to: "/browse?purpose=rent", icon: CalendarCheck },
              { label: "Buy", to: "/browse?purpose=buy", icon: ShoppingBag },
              { label: "Nearby", to: nearbyCity ? `/browse?city=${encodeURIComponent(nearbyCity)}` : "/browse", icon: StoreIcon },
              { label: "Trending", to: "/browse?sort=popular", icon: Flame },
              { label: "Offers", to: "/browse?sort=discount", icon: Gift },
              { label: "All categories", to: "/browse", icon: LayoutGrid },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <Link
                  key={f.label}
                  to={f.to}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  {f.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Categories — horizontal rail right under the search bar */}
      <section className="container pt-3 pb-2">
        <div className="flex gap-4 md:gap-6 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categoryConfigs.map((c) => {
            const Icon = getCategoryIcon(c.icon_name);
            const active = c.is_active;

            const inner = (
              <>
                <span className="relative inline-flex items-center justify-center">
                  <span
                    className={`relative inline-flex items-center justify-center h-12 w-12 md:h-14 md:w-14 rounded-full bg-gradient-to-br ${c.gradient} text-white shadow-[0_10px_24px_-12px_rgba(0,0,0,0.4)] ring-1 ring-white/30 ${active ? "group-hover:scale-110" : "opacity-70"} transition-transform duration-300`}
                  >
                    <Icon className="h-5 w-5 md:h-6 md:w-6" />
                  </span>
                </span>
                <span
                  className={`text-[11px] md:text-xs font-medium leading-tight text-center line-clamp-2 transition-colors ${
                    active ? "text-foreground group-hover:text-primary" : "text-muted-foreground"
                  }`}
                >
                  {c.label}
                </span>
              </>
            );
            return active ? (
              <Link
                key={c.slug}
                to={`/browse?category=${encodeURIComponent(c.slug)}`}
                className="group shrink-0 w-[68px] md:w-[78px] flex flex-col items-center gap-1.5"
              >
                {inner}
              </Link>
            ) : (
              <button
                key={c.slug}
                type="button"
                aria-disabled="true"
                onClick={() => toast.info(`${c.label} launches soon — stay tuned!`)}
                className="group shrink-0 w-[68px] md:w-[78px] flex flex-col items-center gap-1.5 cursor-not-allowed"
                title="Coming soon"
              >
                {inner}
              </button>
            );
          })}
        </div>
      </section>

      {/* Compact branding hero (no product actions) */}
      <div className="pb-3">
        <HeroCarousel />
      </div>

      {/* Trust badges */}
      <TrustBadges />

      {!isServiceable ? (
        <ServiceUnavailable city={serviceCity} source="home" />
      ) : (
        <>
          {/* Featured / verified stores right near the top */}
          {stores.length > 0 && (
            <HomeRail
              id="nearby-shops"
              eyebrow={<><BadgeCheck className="h-3 w-3" /> Verified boutiques</>}
              title="Featured Stores Near You"
              to={nearbyCity ? `/browse?city=${encodeURIComponent(nearbyCity)}` : "/browse"}
            >
              {stores.map((s) => (
                <RailItem key={s.id} wide>
                  <CompactShopCard shop={s} open={shopsOpen} />
                </RailItem>
              ))}
            </HomeRail>
          )}

          {trending.length > 0 && (
            <HomeRail
              eyebrow={<><Flame className="h-3 w-3" /> Best value today</>}
              title="Trending Rentals"
              to="/browse?sort=popular"
            >
              {trending.map((p) => (
                <RailItem key={p.id}>
                  <ProductCard p={p} />
                </RailItem>
              ))}
            </HomeRail>
          )}

          {newArrivals.length > 0 && (
            <HomeRail
              eyebrow={<><PackagePlus className="h-3 w-3" /> Fresh in this week</>}
              title="New Arrivals"
              to="/browse?sort=newest"
            >
              {newArrivals.map((p) => (
                <RailItem key={p.id}>
                  <ProductCard p={p} />
                </RailItem>
              ))}
            </HomeRail>
          )}

          {topRatedProducts.length > 0 && (
            <HomeRail
              eyebrow={<><Star className="h-3 w-3" /> Loved by customers</>}
              title="Top Rated"
              to="/browse?sort=rating"
            >
              {topRatedProducts.map((p) => (
                <RailItem key={p.id}>
                  <ProductCard p={p} />
                </RailItem>
              ))}
            </HomeRail>
          )}

          {recentlyViewed.length > 0 && (
            <HomeRail
              eyebrow={<><Package className="h-3 w-3" /> Pick up where you left off</>}
              title="Recently Viewed"
              to="/browse"
            >
              {recentlyViewed.map((p) => (
                <RailItem key={p.id}>
                  <ProductCard p={p} />
                </RailItem>
              ))}
            </HomeRail>
          )}

          {/* Top rated shops */}
          {topRated.length > 0 && (
            <HomeRail
              eyebrow={<><Star className="h-3 w-3" /> Rated by real customers</>}
              title="Top Rated Stores"
              to="/browse"
            >
              {topRated.map((s, i) => (
                <RailItem key={s.id} wide>
                  <CompactShopCard shop={s} open={shopsOpen} rank={i + 1} />
                </RailItem>
              ))}
            </HomeRail>
          )}

          {stores.length === 0 && catalogLoaded && (
            <section className="container pb-6">
              <div className="rounded-2xl border border-border bg-card px-6 py-8 text-center">
                <MapPin className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No nearby shops found in your area.</p>
                {coords && (
                  <p className="text-xs text-muted-foreground mt-1">
                    We looked within {NEARBY_RADIUS_KM} km of your location.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Interactive Shop the Look */}
          <section className="container pb-8">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[10px] md:text-[11px] uppercase tracking-[0.18em] text-primary">Interactive showcase</p>
                <h2 className="font-display text-xl md:text-2xl">The fitting room</h2>
              </div>
              <Link to="/browse" className="text-xs md:text-sm text-primary hover:underline hidden sm:flex items-center gap-1">
                See everything <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <Suspense fallback={<div className="h-48 rounded-2xl bg-muted/50 animate-pulse" />}>
              <ShopTheLook />
            </Suspense>
          </section>
        </>
      )}

      <Suspense fallback={<div className="container pb-8"><div className="h-40 rounded-2xl bg-muted/40 animate-pulse" /></div>}>
        {/* Offers */}
        <PromoBanners />

        {/* Why choose Rent & Radiate */}
        <WhyChooseSection />

        {/* Refer & share app */}
        <ShareAppSection />

        {/* Become a seller */}
        <BecomeSellerSection />
      </Suspense>
      </main>
      <Footer />
    </div>
  );

};


/** Compact store card sized for horizontal rails. */
function CompactShopCard({ shop, open, rank }: { shop: NearbyShop; open: boolean; rank?: number }) {
  const initials = shop.name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const distanceLabel =
    shop.distance_km != null
      ? shop.distance_km < 1
        ? `${Math.round(shop.distance_km * 1000)} m away`
        : `${shop.distance_km.toFixed(1)} km away`
      : shop.city ?? "Distance unavailable";

  return (
    <Link
      to={`/browse?store=${shop.id}`}
      className="group relative flex h-full flex-col rounded-2xl bg-card border border-border/60 overflow-hidden shadow-soft hover:shadow-[0_22px_50px_-22px_hsl(var(--primary)/0.4)] hover:-translate-y-1 transition-all duration-300"
    >
      <div className="relative h-24 bg-gradient-to-br from-secondary via-card to-muted overflow-hidden">
        {shop.logo_url ? (
          <img
            src={shop.logo_url}
            alt={`${shop.name} storefront`}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-3xl text-primary/70">
              {initials || <StoreIcon className="h-8 w-8" />}
            </span>
          </div>
        )}
        <span
          className={`absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur ${
            open ? "bg-emerald-500/90 text-white" : "bg-slate-700/85 text-white"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-white animate-pulse" : "bg-white/70"}`} />
          {open ? "Open" : "Closed"}
        </span>
        {rank != null && (
          <span className="absolute bottom-2 left-2 inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 text-white shadow">
            #{rank}
          </span>
        )}
        <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-card/95 text-primary border border-primary/20">
          <BadgeCheck className="h-3 w-3" />
          Verified
        </span>
      </div>

      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base leading-tight line-clamp-1 group-hover:text-primary transition-colors">
            {shop.name}
          </h3>
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
            {Number(shop.rating ?? 0).toFixed(1)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3 text-primary" />
            {distanceLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <Package className="h-3 w-3 text-primary" />
            {shop.product_count}
          </span>
        </div>
        <span className="mt-auto pt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
          View shop <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </Link>
  );
}



export default Index;
