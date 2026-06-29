import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { HeroCarousel } from "@/components/HeroCarousel";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { ShopTheLook } from "@/components/ShopTheLook";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
// NOTE: We intentionally do NOT seed demo products from the client.
// Client-side seeding only works for the user who owns the target store
// (RLS blocks everyone else), which produced "I see it but others don't"
// bugs. All product data must come from the moderated vendor upload flow
// so every visitor sees the same approved rows.
import {
  ArrowRight,
  Camera,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  ShoppingBag,
  Sparkles,
  Tag,
} from "lucide-react";

const Index = () => {
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string; city: string | null; rating: number }[]>([]);
  const [query, setQuery] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recogRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
          "id,title,category,price_per_day,security_deposit,images,actual_price,discount_percent,discount_flat,purpose,quantity,store:stores(name,city,is_verified)",
        )
        .eq("available", true)
        .limit(6);
      setProducts((data as any) ?? []);
      const { data: s } = await supabase
        .from("stores")
        .select("id,name,city,rating")
        .eq("status", "approved")
        .eq("is_verified", true)
        .eq("is_active", true)
        .eq("is_blocked", false)
        .limit(6);
      setStores(s ?? []);
    })();
  }, []);

  function buildBrowseUrl(filters: { q?: string; category?: string; purpose?: string; sort?: string }) {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.category && filters.category !== "all") params.set("category", filters.category);
    if (filters.purpose && filters.purpose !== "all") params.set("purpose", filters.purpose);
    if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
    const qs = params.toString();
    return qs ? `/browse?${qs}` : "/browse";
  }

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = query.trim();
    if (!text) return;
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-search", { body: { query: text } });
      if (error || !data || (data as any).error) {
        navigate(`/browse?q=${encodeURIComponent(text)}`);
        return;
      }
      navigate(buildBrowseUrl(data as any));
    } catch {
      navigate(`/browse?q=${encodeURIComponent(text)}`);
    } finally {
      setAiBusy(false);
    }
  };

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

      {/* Smart search floating bar */}
      <section className="relative">
        <div className="container pt-8 md:pt-10 pb-6">
          <div className="max-w-3xl">
            <form
              onSubmit={onSearch}
              className="flex items-center gap-2 bg-card rounded-full pl-5 pr-2 py-2 shadow-soft border border-border max-w-2xl"
              role="search"
            >
              <Sparkles className="h-4 w-4 text-rose-deep shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Try "red dress under ₹2000 for rent"…'
                className="flex-1 bg-transparent outline-none text-sm py-1.5 min-w-0"
                aria-label="AI-powered search"
                disabled={aiBusy}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onImagePicked}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Search by image"
                title="Search by image"
                disabled={imageBusy}
                className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-colors text-muted-foreground hover:bg-muted disabled:opacity-60"
              >
                {imageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={toggleVoice}
                aria-label={listening ? "Stop voice search" : "Start voice search"}
                className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                  listening ? "bg-rose-deep text-background animate-pulse" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <Button type="submit" variant="hero" size="sm" className="rounded-full" disabled={aiBusy || !query.trim()}>
                {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground mt-2 ml-5 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> AI understands text, voice & images
            </p>
          </div>
        </div>
      </section>

      {/* Two primary action cards */}
      <section className="container pt-4 pb-10 md:pb-14">
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          <PrimaryActionCard
            to="/browse?purpose=rent"
            eyebrow="Wear it for a day"
            title="Rent Products"
            subtitle="Designer pieces on rotation — pay rental + refundable deposit."
            tone="from-blossom to-primary-soft"
            icon={<Sparkles className="h-6 w-6" />}
          />
          <PrimaryActionCard
            to="/browse?purpose=buy"
            eyebrow="Make it yours"
            title="Buy Products"
            subtitle="Brand-new fashion ready to ship from local boutiques."
            tone="from-petal to-blossom"
            icon={<ShoppingBag className="h-6 w-6" />}
          />
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

      {/* Stores */}
      {stores.length > 0 && (
        <section className="container pb-16 md:pb-24">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Boutiques you'll love</p>
            <h2 className="font-display text-3xl md:text-5xl">Stores near you</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map((s) => (
              <Link
                key={s.id}
                to={`/browse?store=${s.id}`}
                className="group p-6 rounded-2xl bg-card border border-border hover:shadow-petal transition-smooth"
              >
                <h3 className="font-display text-2xl group-hover:text-primary transition-smooth">{s.name}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3.5 w-3.5" /> {s.city ?? "—"}
                </p>
                <p className="text-xs mt-3 text-gold">★ {Number(s.rating).toFixed(1)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
};

function PrimaryActionCard({
  to,
  eyebrow,
  title,
  subtitle,
  tone,
  icon,
}: {
  to: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  tone: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${tone} p-7 md:p-10 min-h-[180px] md:min-h-[220px] flex flex-col justify-between shadow-card hover:shadow-petal hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300`}
    >
      <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-background/30 blur-2xl group-hover:scale-125 transition-transform duration-700" />
      <div className="relative">
        <div className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-background/80 text-rose-deep mb-3 group-hover:rotate-[-6deg] transition-transform">
          {icon}
        </div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-rose-deep/80">{eyebrow}</p>
        <h3 className="font-display text-3xl md:text-4xl text-rose-deep mt-1">{title}</h3>
        <p className="text-sm text-rose-deep/80 mt-2 max-w-xs">{subtitle}</p>
      </div>
      <div className="relative flex items-center gap-2 text-rose-deep font-medium text-sm mt-4">
        <Tag className="h-4 w-4" /> Explore catalogue
        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-smooth" />
      </div>
    </Link>
  );
}

export default Index;
