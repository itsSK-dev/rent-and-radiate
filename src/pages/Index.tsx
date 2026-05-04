import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { supabase } from "@/integrations/supabase/client";
import { seedDemoProductsIfEmpty } from "@/lib/seedDemo";
import { ArrowRight, MapPin, Search, Shield, Sparkles, Truck } from "lucide-react";
import hero from "@/assets/hero.jpg";

const Index = () => {
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string; city: string | null; rating: number }[]>([]);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Bloom — Rent designer dresses & jewellery near you";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Bloom is a marketplace to rent designer dresses and fine jewellery from boutiques near you. Pay rental + refundable deposit. Pickup or delivery.");

    (async () => {
      await seedDemoProductsIfEmpty();
      const { data } = await supabase
        .from("products")
        .select("id,title,category,price_per_day,security_deposit,images,actual_price,discount_percent,discount_flat,purpose,quantity,store:stores(name,city)")
        .eq("available", true)
        .limit(6);
      setProducts((data as any) ?? []);
      const { data: s } = await supabase
        .from("stores").select("id,name,city,rating").eq("approved", true).limit(6);
      setStores(s ?? []);
    })();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-blossom opacity-60" />
        <div className="container relative grid md:grid-cols-2 gap-10 items-center py-16 md:py-24">
          <div className="space-y-6 animate-fade-up">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-rose-deep">
              <Sparkles className="h-3.5 w-3.5" /> Curated boutiques near you
            </span>
            <h1 className="font-display text-5xl md:text-7xl leading-[1.05] text-foreground">
              Rent something<br />
              <em className="text-primary not-italic font-light">unforgettable.</em>
            </h1>
            <p className="text-lg text-muted-foreground max-w-md">
              Designer dresses and fine jewellery — from beloved local stores. Borrow it for the day, return it the next.
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); navigate(`/browse?q=${encodeURIComponent(query)}`); }}
              className="flex items-center gap-2 bg-background rounded-full pl-5 pr-2 py-2 shadow-soft max-w-md"
            >
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search gowns, lehengas, polki…"
                className="flex-1 bg-transparent outline-none text-sm py-1.5"
              />
              <Button type="submit" variant="hero" size="sm" className="rounded-full">
                Browse
              </Button>
            </form>
            <div className="flex items-center gap-6 pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Refundable deposit</span>
              <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Pickup or delivery</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Local stores</span>
            </div>
          </div>
          <div className="relative animate-scale-in">
            <div className="absolute -top-6 -right-6 w-72 h-72 rounded-full bg-primary/20 blur-3xl" />
            <img
              src={hero}
              alt="Model in a flowing pink gown with delicate gold jewellery"
              width={1600}
              height={1280}
              className="relative rounded-3xl shadow-petal object-cover w-full aspect-[4/5] md:aspect-[5/6]"
            />
            <div className="absolute -bottom-5 -left-5 bg-background rounded-2xl p-4 shadow-petal animate-float">
              <p className="text-xs text-muted-foreground">From</p>
              <p className="font-display text-2xl">₹600 <span className="text-sm text-muted-foreground font-body">/ day</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-6">
          <CategoryCard to="/browse?category=dress" title="Dresses" subtitle="Gowns, lehengas, sarees & more" tone="from-blossom to-primary-soft" />
          <CategoryCard to="/browse?category=jewellery" title="Jewellery" subtitle="Polki, diamonds, gold & rose gold" tone="from-petal to-blossom" />
        </div>
      </section>

      {/* Featured products */}
      <section className="container py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">In bloom this week</p>
            <h2 className="font-display text-4xl md:text-5xl">Featured pieces</h2>
          </div>
          <Link to="/browse" className="text-sm text-primary hover:underline flex items-center gap-1">
            See all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-x-6 gap-y-10">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* Stores */}
      {stores.length > 0 && (
        <section className="container py-16 md:py-24">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Boutiques you'll love</p>
            <h2 className="font-display text-4xl md:text-5xl">Stores near you</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map((s) => (
              <Link key={s.id} to={`/browse?store=${s.id}`} className="group p-6 rounded-2xl bg-card border border-border hover:shadow-petal transition-smooth">
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

      {/* How it works */}
      <section className="bg-gradient-soft py-20 md:py-28">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Effortless</p>
            <h2 className="font-display text-4xl md:text-5xl">How Bloom works</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              ["01", "Discover", "Browse boutiques & jewellers near you."],
              ["02", "Reserve", "Pick your dates. We calculate everything."],
              ["03", "Wear it", "Pickup or doorstep delivery, your call."],
              ["04", "Return", "Send it back. Deposit refunded after check."],
            ].map(([n, t, d]) => (
              <div key={n} className="text-center md:text-left">
                <div className="font-display text-5xl text-primary/40 mb-3">{n}</div>
                <h3 className="font-display text-2xl mb-2">{t}</h3>
                <p className="text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

function CategoryCard({ to, title, subtitle, tone }: { to: string; title: string; subtitle: string; tone: string }) {
  return (
    <Link to={to} className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${tone} p-10 md:p-14 min-h-[280px] flex flex-col justify-between shadow-card hover:shadow-petal transition-smooth`}>
      <div>
        <h3 className="font-display text-4xl md:text-5xl text-rose-deep">{title}</h3>
        <p className="text-sm text-rose-deep/80 mt-2">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2 text-rose-deep font-medium text-sm">
        Explore <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-smooth" />
      </div>
    </Link>
  );
}

export default Index;
