import { Link } from "react-router-dom";
import { MapPin, ShoppingBag, Sparkles, Star } from "lucide-react";
import { demoImageMap } from "@/lib/seedDemo";
import { Badge } from "@/components/ui/badge";
import { discountedUnitPrice, inr } from "@/lib/pricing";
import { WishlistButton } from "@/components/WishlistButton";
import { VerifiedSellerBadge } from "@/components/VerifiedSellerBadge";

export interface ProductCardData {
  id: string;
  title: string;
  category: string;
  price_per_day: number;
  security_deposit: number;
  images: string[];
  actual_price?: number;
  discount_percent?: number;
  discount_flat?: number;
  purpose?: "rent" | "buy" | "both";
  quantity?: number;
  store?: {
    name: string;
    city: string | null;
    is_verified?: boolean | null;
    rating?: number | null;
    distance_km?: number | null;
  } | null;
}

function formatDistance(km?: number | null, city?: string | null) {
  if (km != null && Number.isFinite(km)) {
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  }
  return city ?? null;
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

  const showRent = purpose === "rent" || purpose === "both";
  const showBuy = (purpose === "buy" || purpose === "both") && actual > 0;
  const rating = p.store?.rating != null ? Number(p.store.rating) : null;
  const distance = formatDistance(p.store?.distance_km, p.store?.city ?? null);

  return (
    <div
      onClickCapture={() => pushRecentlyViewed(p)}
      className="group relative flex flex-col rounded-2xl bg-card border border-border/60 shadow-soft hover:shadow-[0_22px_50px_-22px_hsl(var(--rose-deep)/0.45)] hover:-translate-y-1 transition-all duration-300 overflow-hidden animate-fade-up"
    >

      {/* Image — large, the hero of the card */}
      <Link
        to={`/product/${p.id}`}
        className={`relative block aspect-[4/5] overflow-hidden bg-petal ${
          isTopMatch ? "ring-2 ring-rose-deep ring-offset-2 ring-offset-background" : ""
        }`}
      >
        {img ? (
          <img
            src={img}
            alt={p.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            <Sparkles className="h-8 w-8" />
          </div>
        )}
        {/* Bottom gradient for legibility of overlaid pills */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        <span className="absolute top-3 left-3 text-[10px] uppercase tracking-widest bg-background/85 backdrop-blur px-2 py-1 rounded-full">
          {p.category}
        </span>
        {score !== null && (
          <Badge
            className={`absolute bottom-3 left-3 gap-1 ${
              isTopMatch ? "bg-rose-deep text-primary-foreground" : "bg-background/85 text-foreground backdrop-blur"
            }`}
          >
            <Sparkles className="h-3 w-3" /> {score}% match
          </Badge>
        )}
        {hasDiscount && (
          <Badge className="absolute top-3 right-12 bg-rose-deep text-primary-foreground shadow-md">
            {discountPct > 0 ? `${discountPct}% OFF` : `${inr(p.discount_flat ?? 0)} OFF`}
          </Badge>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-background/65 backdrop-blur-sm flex items-center justify-center">
            <Badge variant="outline">Out of stock</Badge>
          </div>
        )}
      </Link>

      {/* Wishlist floats above image, outside Link to avoid nested anchors */}
      <div className="absolute top-3 right-3 z-10">
        <WishlistButton productId={p.id} title={p.title} size="sm" />
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2.5 p-4">
        <Link to={`/product/${p.id}`} className="block">
          <h3 className="font-display text-lg md:text-xl leading-snug line-clamp-1 group-hover:text-rose-deep transition-colors">
            {p.title}
          </h3>
        </Link>

        {/* Shop name + verified */}
        {p.store && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <span className="truncate font-medium text-foreground/80">{p.store.name}</span>
            <VerifiedSellerBadge verified={p.store.is_verified} />
          </div>
        )}

        {/* Rating + distance meta */}
        {(rating !== null || distance) && (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {rating !== null && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                {rating.toFixed(1)}
              </span>
            )}
            {distance && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-rose-deep" />
                {distance}
              </span>
            )}
          </div>
        )}

        {/* Price block — rent + buy presented side by side */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="rounded-xl bg-blossom/60 px-2.5 py-1.5">
            <p className="text-[10px] uppercase tracking-wider text-rose-deep/80">Rent / day</p>
            <p className="text-sm font-semibold text-foreground">
              {showRent ? inr(p.price_per_day) : <span className="text-muted-foreground">—</span>}
            </p>
          </div>
          <div className="rounded-xl bg-muted px-2.5 py-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Buy</p>
            <p className="text-sm font-semibold text-foreground flex items-baseline gap-1">
              {showBuy ? (
                <>
                  <span>{inr(finalPrice)}</span>
                  {hasDiscount && (
                    <span className="text-[10px] line-through text-muted-foreground">{inr(actual)}</span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </p>
          </div>
        </div>

        {/* Premium dual CTA — both route to existing product detail workflow */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link
            to={`/product/${p.id}`}
            aria-label={`Rent ${p.title}`}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full text-xs font-semibold py-2.5 transition-all shadow-md hover:shadow-lg active:scale-[0.98] ${
              showRent
                ? "bg-gradient-rose text-primary-foreground hover:opacity-95"
                : "bg-muted text-muted-foreground pointer-events-none opacity-60"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Rent
          </Link>
          <Link
            to={`/product/${p.id}`}
            aria-label={`Buy ${p.title}`}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full text-xs font-semibold py-2.5 transition-all border active:scale-[0.98] ${
              showBuy
                ? "bg-foreground text-background border-foreground hover:opacity-90 shadow-md hover:shadow-lg"
                : "bg-card text-muted-foreground border-border pointer-events-none opacity-60"
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Buy
          </Link>
        </div>
      </div>
    </div>
  );
}

