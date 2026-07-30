import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Store, Truck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const RoleSelect = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, roles, loading } = useAuth();
  const next = params.get("next") || "";

  useEffect(() => {
    document.title = "Choose how to continue · Rent & Radiate";
  }, []);

  // Already signed in? Send them to their role's landing page (single resolver).
  useEffect(() => {
    if (loading || !ready || !user) return;
    navigate(resolvePostLoginPath({ roles, deliveryApplication, intent: null, next }), { replace: true });
  }, [user, roles, deliveryApplication, ready, loading, navigate, next]);


  const buildLink = (intent: "customer" | "shop_owner" | "delivery_partner", mode: "signin" | "signup") => {
    const qs = new URLSearchParams();
    qs.set("intent", intent);
    if (mode === "signup") qs.set("mode", "signup");
    if (next) qs.set("next", next);
    return `/auth?${qs.toString()}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container flex-1 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center mb-12 animate-fade-up">
          <h1 className="font-display text-4xl md:text-5xl">How would you like to continue?</h1>
          <p className="text-muted-foreground mt-3 text-sm md:text-base">
            Choose your journey — you can always switch later.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <RoleCard
            icon={<ShoppingBag className="h-7 w-7" strokeWidth={1.5} />}
            title="Continue as Customer"
            description="Browse, rent and buy from beautiful boutique stores."
            primaryHref={buildLink("customer", "signup")}
            primaryLabel="Create account"
            secondaryHref={buildLink("customer", "signin")}
            secondaryLabel="I already have an account"
          />
          <RoleCard
            icon={<Store className="h-7 w-7" strokeWidth={1.5} />}
            title="Continue as Shop Owner"
            description="Open your store, list products and manage rentals."
            primaryHref={buildLink("shop_owner", "signup")}
            primaryLabel="Create shop account"
            secondaryHref={buildLink("shop_owner", "signin")}
            secondaryLabel="Sign in to my shop"
            accent
          />
          <RoleCard
            icon={<Truck className="h-7 w-7" strokeWidth={1.5} />}
            title="Become a Delivery Partner"
            description="Earn by delivering rentals in your city."
            primaryHref={buildLink("delivery_partner", "signup")}
            primaryLabel="Apply now"
            secondaryHref={buildLink("delivery_partner", "signin")}
            secondaryLabel="I'm already a partner"
          />
        </div>

        <p className="text-xs text-center text-muted-foreground mt-10">
          <Link to="/" className="underline">Keep browsing as a guest</Link>
        </p>
      </section>
      <Footer />
    </div>
  );
};

function RoleCard({
  icon, title, description, primaryHref, primaryLabel, secondaryHref, secondaryLabel, accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-8 shadow-card flex flex-col text-left transition-smooth hover:border-primary/60">
      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center mb-4 ${accent ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary"}`}>
        {icon}
      </div>
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="text-sm text-muted-foreground mt-2 flex-1">{description}</p>
      <div className="mt-6 flex flex-col gap-2">
        <Link to={primaryHref}>
          <Button variant={accent ? "hero" : "default"} size="lg" className="w-full">{primaryLabel}</Button>
        </Link>
        <Link to={secondaryHref}>
          <Button variant="ghost" size="sm" className="w-full">{secondaryLabel}</Button>
        </Link>
      </div>
    </div>
  );
}

export default RoleSelect;
