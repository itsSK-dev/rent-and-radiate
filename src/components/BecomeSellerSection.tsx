import { Button } from "@/components/ui/button";
import { ArrowRight, Layers, LayoutDashboard, MapPin, Package, Store } from "lucide-react";
import { Link } from "react-router-dom";

const SELLER_FEATURES = [
  {
    icon: Store,
    title: "Open Your Store",
    description: "Launch your boutique in minutes with a verified seller profile and custom storefront.",
    gradient: "from-primary/20 to-rose-deep/20",
    iconColor: "text-primary",
  },
  {
    icon: MapPin,
    title: "Reach Nearby Customers",
    description: "Get discovered by local renters and buyers searching for products in your city.",
    gradient: "from-info/15 to-primary/15",
    iconColor: "text-info",
  },
  {
    icon: Package,
    title: "Rent & Sell Products",
    description: "List items for both rental and purchase. Set once, earn from every order.",
    gradient: "from-gold/20 to-accent/20",
    iconColor: "text-gold",
  },
  {
    icon: LayoutDashboard,
    title: "Seller Dashboard",
    description: "Track orders, earnings, commissions, inventory, and payouts from one clean view.",
    gradient: "from-success/15 to-info/15",
    iconColor: "text-success",
  },
  {
    icon: Layers,
    title: "Easy Product Management",
    description: "Upload photos, manage stock, set availability, and edit listings with a few clicks.",
    gradient: "from-warning/15 to-gold/15",
    iconColor: "text-warning",
  },
];

export function BecomeSellerSection() {
  return (
    <section className="container pb-16 md:pb-24">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-secondary via-petal to-card border border-border p-8 md:p-14 lg:p-16 shadow-petal">
        {/* Decorative glows */}
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-gradient-to-br from-primary/15 to-rose-deep/15 blur-3xl opacity-60 pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-gradient-to-br from-gold/10 to-accent/10 blur-3xl opacity-60 pointer-events-none" />

        <div className="relative grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left column */}
          <div className="space-y-6 md:space-y-8">
            <p className="text-xs uppercase tracking-[0.25em] text-rose-deep font-medium flex items-center gap-2">
              <span className="inline-block h-px w-8 bg-rose-deep/60" />
              For boutique owners
            </p>
            <div>
              <h2 className="font-display text-4xl md:text-5xl lg:text-6xl leading-[1.05] mb-4">
                Turn your wardrobe into a business
              </h2>
              <p className="text-base md:text-lg text-muted-foreground max-w-md leading-relaxed">
                Join thousands of verified sellers. List once, reach nearby customers, and earn from every rent and sale.
              </p>
            </div>

            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-success/15 text-success">
                  <Store className="h-4 w-4" />
                </span>
                <span className="text-muted-foreground">Free to start</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-warning/15 text-warning">
                  <Package className="h-4 w-4" />
                </span>
                <span className="text-muted-foreground">Unlimited listings</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-info/15 text-info">
                  <LayoutDashboard className="h-4 w-4" />
                </span>
                <span className="text-muted-foreground">Real-time dashboard</span>
              </div>
            </div>

            <Button asChild size="lg" className="rounded-full px-8 py-6 text-base font-medium shadow-petal hover:shadow-soft hover:-translate-y-0.5 transition-smooth">
              <Link to="/become-vendor" className="inline-flex items-center gap-2">
                Start Selling
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>

          {/* Right column — feature cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            {SELLER_FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`group relative overflow-hidden rounded-3xl bg-card/80 border border-border p-6 shadow-soft hover:shadow-petal hover:-translate-y-1 transition-all duration-300 animate-fade-up ${index === 4 ? "sm:col-span-2 lg:col-span-1" : ""}`}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${feature.gradient} opacity-40 blur-2xl group-hover:opacity-70 transition-opacity duration-500`} />
                  <div className="relative">
                    <div className={`inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-br ${feature.gradient} ${feature.iconColor} shadow-sm mb-4 group-hover:scale-110 group-hover:rotate-[-3deg] transition-transform duration-300`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-display text-xl mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
