import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { demoImageMap } from "@/lib/seedDemo";
import { Badge } from "@/components/ui/badge";
import { discountedUnitPrice, inr } from "@/lib/pricing";
import { WishlistButton } from "@/components/WishlistButton";
import { VerifiedSellerBadge } from "@/components/VerifiedSellerBadge";

export interface ProductCardData {
  id: string;
  title: string;
  category: "dress" | "jewellery";
  price_per_day: number;
  security_deposit: number;
  images: string[];
  actual_price?: number;
  discount_percent?: number;
  discount_flat?: number;
  purpose?: "rent" | "buy" | "both";
  quantity?: number;
  store?: { name: string; city: string | null; is_verified?: boolean | null } | null;
}


export function ProductCard({ p, matchScore }: { p: ProductCardData; matchScore?: number }) {
  const img = p.images?.[0] || demoImageMap[p.title] || "";
  const purpose = p.purpose ?? "rent";
  const actual = Number(p.actual_price ?? 0);
  const finalPrice = discountedUnitPrice(actual, p.discount_percent ?? 0, p.discount_flat ?? 0);
  const hasDiscount = actual > 0 && finalPrice < actual;
  const discountPct = p.discount_percent ?? 0;
  const outOfStock = (p.quantity ?? 1) <= 0;
  const score = typeof matchScore === "number" ? Math.round(matchScore * 100) : null;
  const isTopMatch = score !== null && score >= 70;

  return (
    <Link to={`/product/${p.id}`} className="group block animate-fade-up">
      <div
        className={`aspect-[4/5] overflow-hidden rounded-xl bg-petal shadow-card relative ${
          isTopMatch ? "ring-2 ring-rose-deep ring-offset-2 ring-offset-background" : ""
        }`}
      >
        {img ? (
          <img src={img} alt={p.title} loading="lazy"
            className="h-full w-full object-cover transition-smooth group-hover:scale-105" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            <Sparkles className="h-8 w-8" />
          </div>
        )}
        <span className="absolute top-3 left-3 text-[10px] uppercase tracking-widest bg-background/80 backdrop-blur px-2 py-1 rounded-full">
          {p.category}
        </span>
        {score !== null && (
          <Badge
            className={`absolute bottom-3 left-3 gap-1 ${
              isTopMatch ? "bg-rose-deep text-white" : "bg-background/85 text-foreground backdrop-blur"
            }`}
          >
            <Sparkles className="h-3 w-3" /> {score}% match
          </Badge>
        )}
        {hasDiscount && (
          <Badge className="absolute top-3 right-3 bg-rose-deep text-white">
            {discountPct > 0 ? `${discountPct}% OFF` : `${inr(p.discount_flat ?? 0)} OFF`}
          </Badge>
        )}
        <div className={`absolute ${hasDiscount ? "top-12" : "top-3"} right-3 z-10`}>
          <WishlistButton productId={p.id} title={p.title} size="sm" />
        </div>
        {outOfStock && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <Badge variant="outline">Out of stock</Badge>
          </div>
        )}
      </div>
      <div className="pt-3 px-1 space-y-1">
        <h3 className="font-display text-xl leading-tight group-hover:text-primary transition-smooth">{p.title}</h3>
        {p.store && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="truncate">{p.store.name}{p.store.city ? ` · ${p.store.city}` : ""}</span>
            <VerifiedSellerBadge verified={p.store.is_verified} />
          </p>
        )}

        <div className="text-sm pt-1 space-y-0.5">
          {(purpose === "buy" || purpose === "both") && actual > 0 && (
            <p>
              {hasDiscount && <span className="line-through text-muted-foreground mr-1">{inr(actual)}</span>}
              <span className="font-semibold">{inr(finalPrice)}</span>
              <span className="text-muted-foreground text-xs"> · buy</span>
            </p>
          )}
          {(purpose === "rent" || purpose === "both") && (
            <p>
              <span className="font-semibold">{inr(p.price_per_day)}</span>
              <span className="text-muted-foreground"> / day</span>
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
