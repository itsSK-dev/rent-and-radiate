import { Link } from "react-router-dom";
import { ArrowRight, Gift, Sparkles, Star, Sun, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const BANNERS = [
  {
    icon: Zap,
    title: "Flash Sales",
    subtitle: "Up to 60% off on trending rentals. Limited time only.",
    cta: "Shop now",
    to: "/browse?sort=discount",
    gradient: "from-rose-deep/15 to-primary/15",
    iconColor: "text-rose-deep",
  },
  {
    icon: Gift,
    title: "Referral Rewards",
    subtitle: "Invite friends and earn rewards when they rent their first product.",
    cta: "Invite friends",
    to: "/rewards",
    gradient: "from-gold/15 to-accent/15",
    iconColor: "text-gold",
  },
  {
    icon: Star,
    title: "Reward Points",
    subtitle: "Earn Radiate Points on every order and redeem them at checkout.",
    cta: "View rewards",
    to: "/rewards",
    gradient: "from-warning/15 to-gold/15",
    iconColor: "text-warning",
  },
  {
    icon: Sun,
    title: "Seasonal Discounts",
    subtitle: "Curated picks for the season at special prices.",
    cta: "Explore",
    to: "/browse?collection=seasonal",
    gradient: "from-info/15 to-success/15",
    iconColor: "text-info",
  },
  {
    icon: Sparkles,
    title: "Featured Collections",
    subtitle: "Handpicked collections by our style experts.",
    cta: "Discover",
    to: "/browse?collection=featured",
    gradient: "from-primary/15 to-rose-deep/15",
    iconColor: "text-primary",
  },
];

export function PromoBanners() {
  return (
    <section className="container pb-16 md:pb-24">
      <div className="flex items-end justify-between mb-8 md:mb-10">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Offers & rewards</p>
          <h2 className="font-display text-3xl md:text-5xl">Promotional banners</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {BANNERS.map((banner, index) => {
          const Icon = banner.icon;
          const isWide = index === 0;
          return (
            <div
              key={banner.title}
              className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${banner.gradient} border border-border/60 p-6 md:p-8 min-h-[220px] shadow-soft hover:shadow-petal hover:-translate-y-1 transition-all duration-300 animate-fade-up ${
                isWide ? "md:col-span-2 lg:col-span-2" : ""
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-gradient-to-br from-white/30 to-transparent blur-2xl opacity-40 group-hover:opacity-70 transition-opacity" />
              <div className="relative flex flex-col h-full">
                <div
                  className={`inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-card/80 backdrop-blur ${banner.iconColor} shadow-sm mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-2xl md:text-3xl mb-2">{banner.title}</h3>
                <p className="text-sm text-muted-foreground mb-5 max-w-md">{banner.subtitle}</p>
                <div className="mt-auto">
                  <Button asChild variant="hero" size="sm" className="rounded-full gap-2">
                    <Link to={banner.to}>
                      {banner.cta}
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
