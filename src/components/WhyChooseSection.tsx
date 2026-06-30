import { BadgeCheck, CalendarCheck, Headphones, MapPin, RotateCcw, ShieldCheck, Truck } from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Secure Payments",
    description: "Razorpay & UPI checkout with bank-grade encryption on every transaction.",
    gradient: "from-primary/20 to-rose-deep/20",
    iconColor: "text-primary",
  },
  {
    icon: BadgeCheck,
    title: "Verified Sellers",
    description: "Every boutique is KYC-verified and approved before listing products.",
    gradient: "from-gold/20 to-accent/20",
    iconColor: "text-gold",
  },
  {
    icon: MapPin,
    title: "Nearby Shops",
    description: "Discover local boutiques and try before you rent or buy.",
    gradient: "from-success/20 to-info/20",
    iconColor: "text-success",
  },
  {
    icon: CalendarCheck,
    title: "Easy Rentals",
    description: "Flexible dates, instant bookings, and simple doorstep returns.",
    gradient: "from-info/20 to-primary/20",
    iconColor: "text-info",
  },
  {
    icon: RotateCcw,
    title: "Platform Managed Refunds",
    description: "Hassle-free refund protection backed by our settlement ledger.",
    gradient: "from-warning/20 to-rose-deep/20",
    iconColor: "text-warning",
  },
  {
    icon: Truck,
    title: "Fast Delivery",
    description: "Same-day delivery options from trusted local boutiques.",
    gradient: "from-success/20 to-accent/20",
    iconColor: "text-success",
  },
  {
    icon: Headphones,
    title: "24×7 Support",
    description: "AI assistant + human support, ready whenever you need help.",
    gradient: "from-info/20 to-success/20",
    iconColor: "text-info",
  },
];

export function WhyChooseSection() {
  return (
    <section className="container pb-16 md:pb-24">
      <div className="flex flex-col items-center text-center mb-10 md:mb-14">
        <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">The Rent & Radiate promise</p>
        <h2 className="font-display text-3xl md:text-5xl">Why choose Rent & Radiate</h2>
        <p className="mt-3 max-w-2xl text-sm md:text-base text-muted-foreground">
          A premium rental marketplace built around trust, convenience, and style.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {FEATURES.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="group relative overflow-hidden rounded-3xl bg-card border border-border p-6 shadow-soft hover:shadow-petal hover:-translate-y-1 transition-all duration-300 animate-fade-up"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div
                className={`absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${feature.gradient} opacity-40 blur-3xl group-hover:opacity-70 transition-opacity duration-500`}
              />
              <div className="relative">
                <div
                  className={`inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br ${feature.gradient} ${feature.iconColor} shadow-sm mb-5 group-hover:scale-110 group-hover:rotate-[-3deg] transition-transform duration-300`}
                >
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="font-display text-xl mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
