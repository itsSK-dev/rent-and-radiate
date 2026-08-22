import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shirt, ArrowUpRight } from "lucide-react";
import { inr } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { useServiceCity, cityOrExpr } from "@/lib/serviceArea";
import { catalogLog } from "@/lib/catalogDebug";

interface Look {
  id: string;
  title: string;
  category: string;
  price_per_day: number;
  actual_price: number | null;
  purpose: "rent" | "buy" | "both";
  images: string[];
  store?: { name: string | null } | null;
}

export function ShopTheLook() {
  const { city: serviceCity, isServiceable } = useServiceCity();
  const [items, setItems] = useState<Look[]>([]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const fetchLooks = useCallback(async () => {
    if (!isServiceable) {
      setItems([]);
      setLoaded(true);
      catalogLog("shop-look-skip", { serviceCity, isServiceable });
      return;
    }
    // Same visibility predicate as Home/Browse: approved + verified + active
    // store INSIDE the visitor's service city. Without the city scope this rail
    // rotated in products from out-of-area shops, which looked like a freshly
    // uploaded local product being "replaced" by an older one.
    const cityFilter = cityOrExpr(serviceCity);
    const { data, error } = await supabase
      .from("products")
      .select(
        "id,title,category,price_per_day,actual_price,purpose,images,quantity,available,store:stores!inner(name,city,status,is_verified,is_active,is_blocked)",
      )
      .eq("available", true)
      .gt("quantity", 0)
      .eq("stores.status", "approved")
      .eq("stores.is_verified", true)
      .eq("stores.is_active", true)
      .eq("stores.is_blocked", false)
      .or(cityFilter, { foreignTable: "stores" })
      .order("created_at", { ascending: false })
      .limit(40);

    const ok = (data ?? []).filter((p: any) => (p.images?.length ?? 0) > 0) as any as Look[];
    catalogLog("shop-look-fetch", {
      serviceCity,
      cityFilter,
      rows: data?.length ?? 0,
      rendered: ok.length,
      error: error?.message,
      firstIds: (data ?? []).slice(0, 5).map((p: any) => p.id),
    });
    setItems(ok);
    setLoaded(true);
  }, [isServiceable, serviceCity]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchLooks();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchLooks]);

  // Live sync: new/updated/deleted products and store verification changes
  // are reflected without a manual refresh.
  useEffect(() => {
    const ch = supabase
      .channel(`shop-the-look-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, (payload) => { catalogLog("shop-look-realtime-products", payload); void fetchLooks(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "stores" }, (payload) => { catalogLog("shop-look-realtime-stores", payload); void fetchLooks(); })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchLooks]);


  // Build looks: pair a dress as the hero with up to 4 accessories.
  const looks = useMemo(() => {
    const dresses = items.filter((i) => i.category === "dress");
    const jewels = items.filter((i) => i.category === "jewellery");
    const heroes = dresses.length > 0 ? dresses : items;
    return heroes.slice(0, 8).map((hero, i) => {
      const picks = jewels.length
        ? [0, 1, 2, 3].map((k) => jewels[(i + k) % jewels.length]).filter(Boolean)
        : items.filter((x) => x.id !== hero.id).slice(0, 3);
      const unique = Array.from(new Map(picks.map((p) => [p.id, p])).values()).slice(0, 4);
      return { hero, picks: unique };
    });
  }, [items]);

  useEffect(() => {
    if (looks.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % looks.length), 6500);
    return () => clearInterval(t);
  }, [looks.length]);

  if (!loaded) {
    return (
      <div className="aspect-[4/5] md:aspect-[16/10] rounded-3xl bg-muted animate-pulse" />
    );
  }
  if (looks.length === 0) {
    return (
      <div className="aspect-[16/10] rounded-3xl bg-muted flex items-center justify-center text-muted-foreground">
        <Shirt className="h-6 w-6 mr-2" /> No looks available yet.
      </div>
    );
  }

  const current = looks[Math.min(index, looks.length - 1)];
  // hotspot positions for up to 4 picks
  const hotspots = [
    { top: "18%", left: "14%" },
    { top: "42%", left: "82%" },
    { top: "68%", left: "12%" },
    { top: "84%", left: "78%" },
  ];

  return (
    <div className="relative grid lg:grid-cols-[1.1fr_1fr] gap-6 lg:gap-10 items-stretch">
      {/* Stage */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-petal to-blossom shadow-petal aspect-[4/5] md:aspect-[3/4] lg:aspect-[4/5]">
        {looks.map((l, i) => (
          <img
            key={l.hero.id}
            src={l.hero.images[0]}
            alt={l.hero.title}
            loading={i === 0 ? "eager" : "lazy"}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}

        {/* Clickable hotspots over the model */}
        {current.picks.map((p, i) => (
          <Link
            key={p.id}
            to={`/product/${p.id}`}
            aria-label={`Shop ${p.title}`}
            className="group absolute -translate-x-1/2 -translate-y-1/2"
            style={hotspots[i]}
          >
            <span className="relative flex h-7 w-7 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-background/90 animate-ping opacity-60" />
              <span className="relative h-3.5 w-3.5 rounded-full bg-primary ring-4 ring-background shadow-card" />
            </span>
            <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-background/95 px-3 py-1 text-[11px] font-medium shadow-card opacity-0 group-hover:opacity-100 transition-opacity">
              {p.title} · {inr(p.price_per_day)}/day
            </span>
          </Link>
        ))}

        {/* Hero product chip */}
        <Link
          to={`/product/${current.hero.id}`}
          className="absolute bottom-4 left-4 right-4 md:left-6 md:right-auto md:max-w-[60%] bg-background/95 backdrop-blur rounded-2xl p-3 md:p-4 shadow-petal flex items-center gap-3 hover:bg-background transition-smooth"
        >
          <div className="h-14 w-14 rounded-xl overflow-hidden bg-petal shrink-0">
            <img src={current.hero.images[0]} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-rose-deep">Featured look</p>
            <p className="font-display text-lg leading-tight truncate">{current.hero.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {current.hero.store?.name ?? "Boutique"} ·{" "}
              <span className="font-medium text-foreground">{inr(current.hero.price_per_day)}/day</span>
              {current.hero.actual_price ? <> · {inr(current.hero.actual_price)} to buy</> : null}
            </p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-primary shrink-0" />
        </Link>

        {/* Pagination dots */}
        <div className="absolute top-4 right-4 flex gap-1.5">
          {looks.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Show look ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-6 bg-background" : "w-1.5 bg-background/50"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Side: shoppable list */}
      <div className="flex flex-col">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Shop the look</p>
          <h3 className="font-display text-3xl md:text-4xl">Tap any piece she's wearing</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Every dot on the model is a real product from an approved boutique. Tap to view, rent, or buy.
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-3 flex-1">
          {[current.hero, ...current.picks].slice(0, 5).map((p) => {
            const isRent = p.purpose === "rent" || p.purpose === "both";
            const isBuy = p.purpose === "buy" || p.purpose === "both";
            return (
              <li key={p.id}>
                <Link
                  to={`/product/${p.id}`}
                  className="group block rounded-2xl border border-border bg-card overflow-hidden hover:shadow-petal transition-smooth"
                >
                  <div className="aspect-square bg-petal overflow-hidden">
                    <img
                      src={p.images[0]}
                      alt={p.title}
                      loading="lazy"
                      className="h-full w-full object-cover group-hover:scale-105 transition-smooth"
                    />
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{p.category}</p>
                    <p className="font-medium text-sm leading-tight line-clamp-1">{p.title}</p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {isRent && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {inr(p.price_per_day)}/day
                        </Badge>
                      )}
                      {isBuy && p.actual_price ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Buy {inr(p.actual_price)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
