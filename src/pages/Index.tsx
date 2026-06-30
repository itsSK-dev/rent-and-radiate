import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { HeroCarousel } from "@/components/HeroCarousel";
import { Footer } from "@/components/Footer";
import { BecomeSellerSection } from "@/components/BecomeSellerSection";
import { Button } from "@/components/ui/button";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { ShopTheLook } from "@/components/ShopTheLook";
import { WhyChooseSection } from "@/components/WhyChooseSection";
import { PromoBanners } from "@/components/PromoBanners";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { useServiceCity } from "@/lib/serviceArea";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";
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
  Sparkles,
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

const CATEGORY_CIRCLES = [
  { label: "Fashion", slug: "fashion", icon: Shirt, gradient: "from-rose-400 via-pink-500 to-fuchsia-500" },
  { label: "Jewellery", slug: "jewellery", icon: Gem, gradient: "from-amber-300 via-yellow-500 to-orange-500" },
  { label: "Electronics", slug: "electronics", icon: Smartphone, gradient: "from-sky-400 via-blue-500 to-indigo-600" },
  { label: "Home & Kitchen", slug: "home-kitchen", icon: UtensilsCrossed, gradient: "from-emerald-400 via-teal-500 to-cyan-600" },
  { label: "Furniture", slug: "furniture", icon: Sofa, gradient: "from-amber-500 via-orange-500 to-rose-500" },
  { label: "Sports", slug: "sports", icon: Dumbbell, gradient: "from-lime-400 via-green-500 to-emerald-600" },
  { label: "Books", slug: "books", icon: BookOpen, gradient: "from-violet-400 via-purple-500 to-fuchsia-600" },
  { label: "Others", slug: "others", icon: Package, gradient: "from-slate-400 via-slate-500 to-slate-700" },
];

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

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
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [stores, setStores] = useState<NearbyShop[]>([]);
  const [shopsOpen] = useState<boolean>(() => isShopOpenNow());
  const [query, setQuery] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [nearbyCity, setNearbyCity] = useState<string | null>(null);
  const recogRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Rent & Radiate — Rent or buy designer fashion near you";
    const meta = document.querySelector('meta[name="description"]');
    if (meta)
      meta.setAttribute(
        "content",
        "Shop the look: rent or buy designer dresses, jewellery and accessories from boutiques near you. Tap any piece on the model to view, rent, or buy.",
      );

    (async () => {
      // Product catalogue is fully DB-driven via vendor uploads + admin approval.
      const { data } = await supabase
        .from("products")
        .select(
          "id,title,category,price_per_day,security_deposit,images,actual_price,discount_percent,discount_flat,purpose,quantity,store:stores(name,city,is_verified,rating)",
        )
        .eq("available", true)
        .limit(6);
      setProducts((data as any) ?? []);
      const { data: s } = await supabase
        .from("stores")
        .select("id,name,city,rating,rating_count,logo_url,lat,lng")
        .eq("status", "approved")
        .eq("is_verified", true)
        .eq("is_active", true)
        .eq("is_blocked", false)
        .limit(8);
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

      // Optional distance, only if the user already shared geolocation in this session.
      const userPos: { lat: number; lng: number } | null = await new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 1500, maximumAge: 5 * 60 * 1000 },
        );
      });

      const enriched: NearbyShop[] = rawStores.map((st, i) => ({
        ...st,
        product_count: counts[i],
        distance_km:
          userPos && st.lat != null && st.lng != null
            ? haversineKm(userPos, { lat: st.lat, lng: st.lng })
            : null,
      }));
      enriched.sort((a, b) => {
        if (a.distance_km != null && b.distance_km != null) return a.distance_km - b.distance_km;
        if (a.distance_km != null) return -1;
        if (b.distance_km != null) return 1;
        return b.rating - a.rating;
      });
      setStores(enriched);
    })();

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
      () => {
        const target = nearbyCity ?? "";
        navigate(target ? `/browse?city=${encodeURIComponent(target)}` : "/browse");
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



  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* Premium branding-only hero carousel (no product actions) */}
      <HeroCarousel />

      {/* Smart floating search bar */}
      <section className="relative">
        <div className="container pt-8 md:pt-10 pb-4">
          <div ref={searchWrapRef} className="relative max-w-3xl mx-auto md:mx-0">
            <form
              onSubmit={onSearch}
              className={`group flex items-center gap-1.5 md:gap-2 bg-card/95 backdrop-blur rounded-full pl-4 md:pl-5 pr-1.5 md:pr-2 py-1.5 md:py-2 border border-border shadow-petal transition-all duration-300 ${
                focused ? "ring-2 ring-rose-deep/30 shadow-[0_18px_45px_-20px_hsl(var(--rose-deep)/0.45)]" : ""
              }`}
              role="search"
            >
              <Sparkles className="h-4 w-4 text-rose-deep shrink-0" />
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

            <p className="text-[11px] text-muted-foreground mt-2 ml-5 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> AI understands text, voice & images
            </p>
          </div>
        </div>
      </section>

      {/* Quick action cards */}
      <section className="container pt-2 pb-10 md:pb-14">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          <QuickActionCard
            to="/browse?purpose=rent"
            label="Rent Products"
            icon={<Sparkles className="h-5 w-5" />}
            gradient="from-rose-400 to-pink-500"
          />
          <QuickActionCard
            to="/browse?purpose=buy"
            label="Buy Products"
            icon={<ShoppingBag className="h-5 w-5" />}
            gradient="from-amber-400 to-orange-500"
          />
          <QuickActionCard
            to={nearbyCity ? `/browse?city=${encodeURIComponent(nearbyCity)}` : "/browse"}
            label="Nearby Shops"
            icon={<StoreIcon className="h-5 w-5" />}
            gradient="from-emerald-400 to-teal-500"
          />
          <QuickActionCard
            to="/browse?sort=popular"
            label="Trending"
            icon={<Flame className="h-5 w-5" />}
            gradient="from-fuchsia-500 to-purple-600"
          />
          <QuickActionCard
            to="/browse?sort=discount"
            label="Offers"
            icon={<Gift className="h-5 w-5" />}
            gradient="from-red-400 to-rose-600"
          />
          <QuickActionCard
            to="/browse"
            label="Categories"
            icon={<LayoutGrid className="h-5 w-5" />}
            gradient="from-sky-400 to-indigo-500"
          />
        </div>
      </section>

      {/* Shop by category — premium circular icons */}
      <section className="container pb-12 md:pb-16">
        <div className="flex items-end justify-between mb-6 md:mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Shop by category</p>
            <h2 className="font-display text-3xl md:text-5xl">Browse categories</h2>
          </div>
          <Link to="/browse" className="text-sm text-primary hover:underline hidden sm:flex items-center gap-1">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-4 md:gap-6">
          {CATEGORY_CIRCLES.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.slug}
                to={`/browse?category=${encodeURIComponent(c.slug)}`}
                className="group flex flex-col items-center gap-2.5 text-center"
              >
                <span className="relative inline-flex items-center justify-center">
                  <span
                    className={`absolute inset-0 rounded-full bg-gradient-to-br ${c.gradient} opacity-30 blur-xl group-hover:opacity-60 transition-opacity duration-500`}
                  />
                  <span
                    className={`relative inline-flex items-center justify-center h-16 w-16 md:h-20 md:w-20 rounded-full bg-gradient-to-br ${c.gradient} text-white shadow-[0_12px_30px_-10px_rgba(0,0,0,0.35)] ring-1 ring-white/30 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300`}
                  >
                    <Icon className="h-7 w-7 md:h-9 md:w-9" />
                  </span>
                </span>
                <span className="text-xs md:text-sm font-medium text-foreground group-hover:text-rose-deep transition-colors">
                  {c.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>




      {/* Interactive Shop the Look */}
      <section className="container pb-16 md:pb-24">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Interactive showcase</p>
            <h2 className="font-display text-3xl md:text-5xl">The fitting room</h2>
          </div>
          <Link to="/browse" className="text-sm text-primary hover:underline hidden sm:flex items-center gap-1">
            See everything <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <ShopTheLook />
      </section>

      {/* Featured products */}
      {products.length > 0 && (
        <section className="container pb-16">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">In bloom this week</p>
              <h2 className="font-display text-3xl md:text-5xl">Featured pieces</h2>
            </div>
            <Link to="/browse" className="text-sm text-primary hover:underline flex items-center gap-1">
              See all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10">
            {products.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}

      {/* Nearby Verified Shops */}
      {stores.length > 0 && (
        <section className="container pb-16 md:pb-24">
          <div className="flex items-end justify-between mb-6 md:mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2 flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5" /> Verified boutiques
              </p>
              <h2 className="font-display text-3xl md:text-5xl">Nearby Verified Shops</h2>
            </div>
            <Link
              to={nearbyCity ? `/browse?city=${encodeURIComponent(nearbyCity)}` : "/browse"}
              className="text-sm text-primary hover:underline hidden sm:flex items-center gap-1"
            >
              See all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {stores.map((s) => (
              <NearbyShopCard key={s.id} shop={s} open={shopsOpen} />
            ))}
          </div>
        </section>
      )}


      {/* Why choose Rent & Radiate */}
      <WhyChooseSection />

      {/* Promotional banners */}
      <PromoBanners />

      {/* Become a seller */}
      <BecomeSellerSection />

      <Footer />
    </div>
  );
};

function QuickActionCard({
  to,
  label,
  icon,
  gradient,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl md:rounded-3xl bg-card border border-border p-4 md:p-5 flex flex-col items-center justify-center gap-3 text-center shadow-soft hover:shadow-[0_18px_40px_-18px_hsl(var(--rose-deep)/0.45)] hover:-translate-y-1 active:translate-y-0 transition-all duration-300"
    >
      <span
        className={`absolute inset-x-0 -top-12 h-24 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-500`}
      />
      <span
        className={`relative inline-flex items-center justify-center h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-md group-hover:scale-110 group-hover:rotate-[-4deg] transition-transform duration-300`}
      >
        {icon}
      </span>
      <span className="relative text-xs md:text-sm font-medium text-foreground group-hover:text-rose-deep transition-colors">
        {label}
      </span>
    </Link>
  );
}

function NearbyShopCard({ shop, open }: { shop: NearbyShop; open: boolean }) {
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
      : shop.city
        ? shop.city
        : "Distance unavailable";

  return (
    <div className="group relative flex flex-col rounded-3xl bg-card border border-border overflow-hidden shadow-soft hover:shadow-[0_22px_50px_-22px_hsl(var(--rose-deep)/0.45)] hover:-translate-y-1 transition-all duration-300">
      {/* Shop image / logo */}
      <div className="relative h-40 bg-gradient-to-br from-blossom via-card to-muted overflow-hidden">
        {shop.logo_url ? (
          <img
            src={shop.logo_url}
            alt={`${shop.name} storefront`}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-5xl text-rose-deep/70">{initials || <StoreIcon className="h-10 w-10" />}</span>
          </div>
        )}
        {/* Open / closed pill */}
        <span
          className={`absolute top-3 left-3 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur ${
            open
              ? "bg-emerald-500/90 text-white"
              : "bg-slate-700/85 text-white"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-white animate-pulse" : "bg-white/70"}`} />
          {open ? "Open now" : "Closed"}
        </span>
        {/* Verified badge */}
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-card/95 text-rose-deep border border-rose-deep/20 shadow-sm">
          <BadgeCheck className="h-3.5 w-3.5" />
          Verified
        </span>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl leading-tight group-hover:text-rose-deep transition-colors">
            {shop.name}
          </h3>
          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
            {Number(shop.rating ?? 0).toFixed(1)}
            {shop.rating_count > 0 && (
              <span className="text-amber-600/70 font-normal">({shop.rating_count})</span>
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-rose-deep" />
            {distanceLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <Package className="h-3.5 w-3.5 text-rose-deep" />
            {shop.product_count} {shop.product_count === 1 ? "product" : "products"}
          </span>
        </div>

        <Link
          to={`/browse?store=${shop.id}`}
          className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-deep to-pink-500 text-white text-sm font-medium py-2.5 shadow-md hover:shadow-lg hover:opacity-95 active:opacity-90 transition-all"
        >
          View Shop
          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}


export default Index;
