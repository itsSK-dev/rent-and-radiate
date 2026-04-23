import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { demoImageMap } from "@/lib/seedDemo";

export interface ProductCardData {
  id: string;
  title: string;
  category: "dress" | "jewellery";
  price_per_day: number;
  security_deposit: number;
  images: string[];
  store?: { name: string; city: string | null } | null;
}

export function ProductCard({ p }: { p: ProductCardData }) {
  const img = p.images?.[0] || demoImageMap[p.title] || "";
  return (
    <Link to={`/product/${p.id}`} className="group block animate-fade-up">
      <div className="aspect-[4/5] overflow-hidden rounded-xl bg-petal shadow-card relative">
        {img ? (
          <img
            src={img}
            alt={p.title}
            loading="lazy"
            className="h-full w-full object-cover transition-smooth group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            <Sparkles className="h-8 w-8" />
          </div>
        )}
        <span className="absolute top-3 left-3 text-[10px] uppercase tracking-widest bg-background/80 backdrop-blur px-2 py-1 rounded-full">
          {p.category}
        </span>
      </div>
      <div className="pt-3 px-1 space-y-1">
        <h3 className="font-display text-xl leading-tight group-hover:text-primary transition-smooth">{p.title}</h3>
        {p.store && (
          <p className="text-xs text-muted-foreground">
            {p.store.name}{p.store.city ? ` · ${p.store.city}` : ""}
          </p>
        )}
        <p className="text-sm pt-1">
          <span className="font-semibold">₹{p.price_per_day.toLocaleString("en-IN")}</span>
          <span className="text-muted-foreground"> / day</span>
        </p>
      </div>
    </Link>
  );
}
