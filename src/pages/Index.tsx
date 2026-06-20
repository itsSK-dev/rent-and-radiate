import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { ShopTheLook } from "@/components/ShopTheLook";
import { supabase } from "@/integrations/supabase/client";
// NOTE: We intentionally do NOT seed demo products from the client.
// Client-side seeding only works for the user who owns the target store
// (RLS blocks everyone else), which produced "I see it but others don't"
// bugs. All product data must come from the moderated vendor upload flow
// so every visitor sees the same approved rows.
import {
  ArrowRight,
  MapPin,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
} from "lucide-react";

const Index = () => {
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string; city: string | null; rating: number }[]>([]);
  const [query, setQuery] = useState("");
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
          "id,title,category,price_per_day,security_deposit,images,actual_price,discount_percent,discount_flat,purpose,quantity,store:stores(name,city)",
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

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/browse?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* Hero: smart search */}
      <section className="relative">
        <div className="container pt-10 md:pt-14 pb-6">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-rose-deep">
              <Sparkles className="h-3.5 w-3.5" /> Rent it. Buy it. Wear it.
            </span>
            <h1 className="font-display text-4xl md:text-6xl leading-[1.05] mt-3">
              Shop the look —{" "}
              <em className="text-primary not-italic font-light">your way.</em>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mt-3 max-w-xl">
              Designer dresses, jewellery and accessories from boutiques near you. Rent for the day or take it home.
            </p>
            <form
              onSubmit={onSearch}
              className="mt-6 flex items-center gap-2 bg-card rounded-full pl-5 pr-2 py-2 shadow-soft border border-border max-w-xl"
              role="search"
            >
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search dresses, jewellery, brand, shop, colour…"
                className="flex-1 bg-transparent outline-none text-sm py-1.5 min-w-0"
                aria-label="Search products"
              />
              <Button type="submit" variant="hero" size="sm" className="rounded-full">
                Search
              </Button>
            </form>
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
