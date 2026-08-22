import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import {
  Megaphone,
  Target,
  Eye,
  Wallet,
  BarChart3,
  Users,
  TrendingUp,
  Globe2,
  Mail,
  MessageCircle,
  Check,
} from "lucide-react";

type Pkg = {
  id: string;
  name: string;
  tier: "basic" | "premium" | "featured";
  price: number;
  duration_days: number;
  perks: string[];
};

type Stats = {
  users_count: number;
  monthly_views: number;
  engagement_pct: number;
  reach_count: number;
  partners_count: number;
};

type Ad = {
  id: string;
  headline: string;
  image_url: string;
  link_url: string | null;
};

const FAQS = [
  {
    q: "What kinds of brands can advertise?",
    a: "Fashion boutiques, jewellery houses, beauty brands, event services, wedding planners, photographers, and any lifestyle brand whose audience overlaps with our renters and buyers.",
  },
  {
    q: "How do you measure performance?",
    a: "Every campaign comes with impression and click reports. Premium and Featured tiers also include weekly performance summaries delivered to your email.",
  },
  {
    q: "How long does approval take?",
    a: "Most requests are reviewed within 24 business hours. Once approved, your campaign goes live on your chosen start date.",
  },
  {
    q: "Can I cancel or pause my campaign?",
    a: "Yes. Reach out to our partnerships team and we will pause or refund the remaining days based on our refund policy.",
  },
  {
    q: "Do you offer custom packages?",
    a: "Absolutely. Pick the Custom Campaign option in the booking form and our team will design a tailored plan for you.",
  },
];

const BENEFITS = [
  { icon: Target, title: "Targeted audience", body: "Reach fashion-forward users actively browsing premium dresses and accessories." },
  { icon: Eye, title: "High visibility", body: "Premium homepage and feed placements designed to convert browsers into buyers." },
  { icon: Wallet, title: "Affordable advertising", body: "Plans for every budget — from a one-week boost to month-long featured exposure." },
  { icon: BarChart3, title: "Performance tracking", body: "Transparent dashboards with impressions, clicks, and engagement insights." },
];

function formatCompact(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M+";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K+";
  return n.toString();
}

const TIER_BADGE: Record<Pkg["tier"], string> = {
  basic: "bg-secondary text-foreground",
  premium: "bg-primary-soft text-rose-deep",
  featured: "bg-gradient-rose text-primary-foreground",
};

export default function Advertise() {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);

  useEffect(() => {
    document.title = "Advertise With Us · Rent & Radiate";
  }, []);

  useEffect(() => {
    (async () => {
      const [pkgRes, statsRes, adsRes] = await Promise.all([
        (supabase as any).from("ad_packages").select("*").eq("is_active", true).order("sort_order"),
        (supabase as any).from("ad_platform_stats").select("*").eq("id", true).maybeSingle(),
        (supabase as any).from("advertisements").select("id,headline,image_url,link_url").eq("is_active", true).order("sort_order"),
      ]);
      setPackages((pkgRes.data as Pkg[]) ?? []);
      setStats((statsRes.data as Stats) ?? null);
      setAds((adsRes.data as Ad[]) ?? []);
    })();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-soft">
        <div className="container py-20 md:py-28 grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <Badge className="bg-primary-soft text-rose-deep">Brand Collaboration Hub</Badge>
            <h1 className="font-display text-5xl md:text-6xl leading-tight">Advertise With Us</h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              Promote your brand, products, services, events, or offers to our growing community of
              fashion-conscious renters and buyers across India.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg">
                <Link to="/advertise/book">
                  <Megaphone className="mr-2 h-4 w-4" /> Run Your Ad
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#packages">View packages</a>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[5/4] rounded-3xl bg-gradient-rose shadow-petal flex items-center justify-center p-10">
              <div className="text-center text-primary-foreground space-y-3">
                <Megaphone className="h-12 w-12 mx-auto" />
                <p className="font-display text-3xl">Be seen. Be remembered.</p>
                <p className="text-sm opacity-90">Premium placements built for premium brands.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="container py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Users, label: "Active users", value: formatCompact(stats?.users_count ?? 10000) },
            { icon: Eye, label: "Monthly views", value: formatCompact(stats?.monthly_views ?? 50000) },
            { icon: TrendingUp, label: "Engagement", value: `${stats?.engagement_pct ?? 18}%` },
            { icon: Globe2, label: "Total reach", value: formatCompact(stats?.reach_count ?? 100000) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-6 text-center shadow-card">
              <s.icon className="h-5 w-5 text-primary mx-auto mb-2" />
              <p className="font-display text-3xl">{s.value}</p>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Packages */}
      <section id="packages" className="container py-14">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Packages</p>
          <h2 className="font-display text-4xl">Advertising plans for every brand</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {packages.length === 0 ? (
            <p className="text-muted-foreground text-center md:col-span-3">Packages coming soon.</p>
          ) : (
            packages.map((p) => (
              <div
                key={p.id}
                className={`rounded-3xl border bg-card p-8 shadow-card flex flex-col ${
                  p.tier === "premium" ? "border-primary ring-1 ring-primary/30" : "border-border"
                }`}
              >
                <Badge className={TIER_BADGE[p.tier]}>{p.tier.toUpperCase()}</Badge>
                <h3 className="font-display text-3xl mt-3">{p.name}</h3>
                <p className="text-muted-foreground text-sm mt-1">{p.duration_days}-day campaign</p>
                <p className="font-display text-4xl mt-4">₹{Number(p.price).toLocaleString("en-IN")}</p>
                <ul className="mt-6 space-y-2 text-sm flex-1">
                  {p.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant={p.tier === "premium" ? "hero" : "outline"} className="mt-6">
                  <Link to={`/advertise/book?package=${p.id}`}>Choose {p.name}</Link>
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Live ads / partners */}
      {ads.length > 0 && (
        <section className="container py-14">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Featured Brands</p>
            <h2 className="font-display text-4xl">Currently advertising with us</h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {ads.map((a) => (
              <a
                key={a.id}
                href={a.link_url ?? "#"}
                target={a.link_url ? "_blank" : undefined}
                rel="noreferrer"
                className="block rounded-3xl overflow-hidden border border-border bg-card shadow-card hover:shadow-petal transition-smooth"
              >
                <div className="aspect-[4/3] bg-petal overflow-hidden">
                  <img src={a.image_url} alt={a.headline} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="p-5">
                  <p className="font-medium">{a.headline}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Benefits */}
      <section className="bg-gradient-soft py-16">
        <div className="container">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Why advertise with us</p>
            <h2 className="font-display text-4xl">Benefits of partnering with Rent & Radiate</h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-2xl bg-card p-6 border border-border shadow-card">
                <b.icon className="h-6 w-6 text-primary mb-3" />
                <h3 className="font-display text-xl mb-1">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container py-16">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Questions</p>
          <h2 className="font-display text-4xl">Frequently asked questions</h2>
        </div>
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible>
            {FAQS.map((f, i) => (
              <AccordionItem value={String(i)} key={f.q}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Contact */}
      <section className="container pb-20">
        <div className="rounded-3xl bg-gradient-rose p-10 md:p-14 text-primary-foreground text-center shadow-petal">
          <h2 className="font-display text-4xl mb-3">Ready to grow with us?</h2>
          <p className="opacity-90 max-w-xl mx-auto mb-6">
            Email our partnerships team or send your campaign brief — we usually respond within a few hours.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/advertise/book"><Megaphone className="h-4 w-4 mr-2" /> Book your ad</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-background/10 border-primary-foreground/40 text-primary-foreground hover:bg-background/20">
              <a href="mailto:partnerships@rentandradiate.com"><Mail className="h-4 w-4 mr-2" /> partnerships@rentandradiate.com</a>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-background/10 border-primary-foreground/40 text-primary-foreground hover:bg-background/20">
              <a href="https://wa.me/919999999999" target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 mr-2" /> WhatsApp</a>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
