import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, Clock, TrendingUp, X, Store, Tag, ShoppingBag, MapPin, Star } from "lucide-react";
import { useSearchIndex, pickTrending, type SearchProduct, type SearchShop, type SearchCategory } from "@/hooks/useSearchIndex";
import { cn } from "@/lib/utils";
import { useServiceCity } from "@/lib/serviceArea";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

const RECENT_KEY = "rr.recentSearches";
const TRENDING_TERMS = ["Lehenga", "Gold necklace", "Sherwani", "Bridal", "Party dress", "Earrings"];

function loadRecent(): string[] {
  try { const r = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); return Array.isArray(r) ? r.slice(0, 8) : []; }
  catch { return []; }
}
function saveRecent(term: string) {
  try {
    const cur = loadRecent().filter((r) => r.toLowerCase() !== term.toLowerCase());
    const next = [term, ...cur].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

// Highlight query characters inside a string using fuse match indices.
function Highlight({ text, indices }: { text: string; indices?: ReadonlyArray<readonly [number, number]> }) {
  if (!indices || indices.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  const sorted = [...indices].sort((a, b) => a[0] - b[0]);
  for (const [start, end] of sorted) {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(<mark key={`${start}-${end}`} className="bg-primary/20 text-primary rounded px-0.5">{text.slice(start, end + 1)}</mark>);
    cursor = end + 1;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export function UniversalSearchDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { city } = useServiceCity();
  const { products, shops, productFuse, shopFuse, categoryFuse, loading } = useSearchIndex(open);
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      setQ("");
      // small delay so dialog focus doesn't fight the input
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Global Cmd/Ctrl+K to open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const term = q.trim();
  const productResults = useMemo(() => term ? productFuse.search(term, { limit: 8 }) : [], [term, productFuse]);
  const shopResults = useMemo(() => term ? shopFuse.search(term, { limit: 5 }) : [], [term, shopFuse]);
  const categoryResults = useMemo(() => term ? categoryFuse.search(term, { limit: 4 }) : [], [term, categoryFuse]);

  // Fallback closest matches if nothing hit strict threshold: relax by scanning all with substring/first-letter match.
  const noHits = term && productResults.length === 0 && shopResults.length === 0 && categoryResults.length === 0;
  const fallback = useMemo(() => {
    if (!noHits) return [] as SearchProduct[];
    const lower = term.toLowerCase();
    return products
      .filter((p) => p.title.toLowerCase().includes(lower.slice(0, Math.max(2, Math.floor(lower.length / 2)))))
      .slice(0, 6);
  }, [noHits, products, term]);

  const trending = useMemo(() => pickTrending(products, 6), [products]);

  function submit(text: string) {
    const t = text.trim();
    if (!t) return;
    saveRecent(t);
    onOpenChange(false);
    navigate(`/browse?q=${encodeURIComponent(t)}`);
  }

  function goProduct(p: SearchProduct) {
    saveRecent(p.title);
    onOpenChange(false);
    navigate(`/product/${p.id}`);
  }
  function goShop(s: SearchShop) {
    saveRecent(s.name);
    onOpenChange(false);
    navigate(`/browse?store=${s.id}`);
  }
  function goCategory(c: SearchCategory) {
    onOpenChange(false);
    navigate(`/browse?category=${c.slug}`);
  }

  function clearRecent() {
    localStorage.removeItem(RECENT_KEY);
    setRecent([]);
  }

  const matchFor = (matches: readonly any[] | undefined, key: string) =>
    matches?.find((m) => m.key === key)?.indices as ReadonlyArray<readonly [number, number]> | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl top-[10%] translate-y-0 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(q); }}
            placeholder="Search products, shops, categories…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            aria-label="Universal search"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear" className="p-1 rounded hover:bg-muted">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="hidden md:inline text-[10px] uppercase tracking-widest text-muted-foreground border border-border rounded px-1.5 py-0.5">
            Esc
          </span>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {loading && !products.length && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading catalogue…</div>
          )}

          {/* Empty state = recent + trending */}
          {!term && (
            <div className="p-4 space-y-6">
              {recent.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Recent searches
                    </h3>
                    <button onClick={clearRecent} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <button key={r} onClick={() => submit(r)} className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors">
                        {r}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> Trending in {city}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {TRENDING_TERMS.map((t) => (
                    <button key={t} onClick={() => submit(t)} className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                      {t}
                    </button>
                  ))}
                </div>
              </section>

              {trending.length > 0 && (
                <section>
                  <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Fresh in the catalogue</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {trending.map((p) => (
                      <button key={p.id} onClick={() => goProduct(p)} className="flex gap-2 p-2 rounded-lg hover:bg-muted text-left">
                        <img src={p.images[0] || "/placeholder.svg"} alt="" className="h-12 w-12 rounded-md object-cover shrink-0" loading="lazy" />
                        <div className="min-w-0">
                          <p className="text-sm truncate">{p.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.store_name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Results */}
          {term && (
            <div className="p-2">
              {categoryResults.length > 0 && (
                <Section icon={<Tag className="h-3.5 w-3.5" />} title="Categories">
                  {categoryResults.map(({ item, matches }) => (
                    <button key={item.slug} onClick={() => goCategory(item)} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-left">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm"><Highlight text={item.label} indices={matchFor(matches, "label")} /></span>
                    </button>
                  ))}
                </Section>
              )}

              {shopResults.length > 0 && (
                <Section icon={<Store className="h-3.5 w-3.5" />} title="Shops">
                  {shopResults.map(({ item, matches }) => (
                    <button key={item.id} onClick={() => goShop(item)} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-left">
                      {item.logo_url ? (
                        <img src={item.logo_url} alt="" className="h-8 w-8 rounded-full object-cover" loading="lazy" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"><Store className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate"><Highlight text={item.name} indices={matchFor(matches, "name")} /></p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          {item.city && (<span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{item.city}</span>)}
                          {item.rating > 0 && (<span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-current" />{item.rating.toFixed(1)}</span>)}
                        </p>
                      </div>
                    </button>
                  ))}
                </Section>
              )}

              {productResults.length > 0 && (
                <Section icon={<ShoppingBag className="h-3.5 w-3.5" />} title="Products">
                  {productResults.map(({ item, matches }) => (
                    <button key={item.id} onClick={() => goProduct(item)} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-left">
                      <img src={item.images[0] || "/placeholder.svg"} alt="" className="h-11 w-11 rounded-md object-cover shrink-0" loading="lazy" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate"><Highlight text={item.title} indices={matchFor(matches, "title")} /></p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.store_name} · <span className="capitalize">{item.category}</span>
                        </p>
                      </div>
                      <div className="text-xs text-right shrink-0">
                        {(item.purpose === "rent" || item.purpose === "both") && (<div>₹{item.price_per_day}/day</div>)}
                        {(item.purpose === "buy" || item.purpose === "both") && (<div className="text-muted-foreground">₹{item.actual_price}</div>)}
                      </div>
                    </button>
                  ))}
                  <button onClick={() => submit(term)} className="w-full text-center text-xs text-primary hover:underline py-2">
                    See all results for "{term}" →
                  </button>
                </Section>
              )}

              {noHits && (
                <div className="px-3 py-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    No exact match for <span className="italic">"{term}"</span>. {fallback.length > 0 ? "You might like:" : "Try a different keyword."}
                  </p>
                  {fallback.map((p) => (
                    <button key={p.id} onClick={() => goProduct(p)} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-left">
                      <img src={p.images[0] || "/placeholder.svg"} alt="" className="h-11 w-11 rounded-md object-cover shrink-0" loading="lazy" />
                      <div className="min-w-0">
                        <p className="text-sm truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.store_name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>Fuzzy search across {products.length} products · {shops.length} shops in {city}</span>
          <span className="hidden sm:inline">↵ to see all results</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        {icon}{title}
      </div>
      <div>{children}</div>
    </div>
  );
}
