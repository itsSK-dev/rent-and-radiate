import { useEffect, useMemo, useState } from "react";
import { MapPin, ChevronDown, Check, Search, Sparkles } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  SERVICE_CITY,
  SERVICE_CITY_LABEL,
  isServiceableCity,
  readSavedCity,
  setSavedCity,
} from "@/lib/serviceArea";
import { INDIA_CITIES_UNIQUE } from "@/lib/indiaCities";

// Cities surfaced before the user types anything (kept short for scannability).
const PINNED_SUGGESTIONS = [
  "Purnea", "Katihar", "Araria", "Kishanganj", "Forbesganj",
  "Saharsa", "Madhepura", "Bhagalpur", "Patna", "Muzaffarpur",
  "Darbhanga", "Gaya", "Siliguri", "Kolkata", "Delhi",
];

/** City picker — free-text search across India, but only Purnea is
 * actively served right now. Persists in localStorage and broadcasts
 * a `rr:location-change` event so feature pages can react instantly. */
export function LocationSelector({ compact = false }: { compact?: boolean }) {
  const [city, setCity] = useState<string>(SERVICE_CITY);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setCity(readSavedCity());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PINNED_SUGGESTIONS;
    // Prefix matches first, then "contains" matches — feels more responsive.
    const prefix: string[] = [];
    const contains: string[] = [];
    for (const c of INDIA_CITIES_UNIQUE) {
      const lc = c.toLowerCase();
      if (lc.startsWith(q)) prefix.push(c);
      else if (lc.includes(q)) contains.push(c);
      if (prefix.length + contains.length >= 60) break;
    }
    const matches = [...prefix, ...contains].slice(0, 40);
    const typed = query.trim();
    if (typed && !matches.some((c) => c.toLowerCase() === typed.toLowerCase())) {
      matches.unshift(typed);
    }
    return matches;
  }, [query]);


  const select = (c: string) => {
    const clean = c.trim();
    if (!clean) return;
    setCity(clean);
    setSavedCity(clean);
    setOpen(false);
    setQuery("");
  };

  const serviceable = isServiceableCity(city);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs transition-colors ${
          compact ? "" : "md:px-3 md:py-2 md:text-sm"
        } ${
          serviceable
            ? "border-border/60 bg-card/60 hover:border-primary/40 hover:bg-blossom/40"
            : "border-amber-400/60 bg-amber-50 hover:bg-amber-100 text-amber-900"
        }`}
        aria-label="Choose location"
      >
        <MapPin className={`h-3.5 w-3.5 ${serviceable ? "text-rose-deep" : "text-amber-600"}`} />
        <span className="hidden xs:inline opacity-70">Deliver to</span>
        <span className="font-medium">{city}</span>
        {!serviceable && (
          <span className="hidden sm:inline ml-1 text-[10px] uppercase tracking-wider font-semibold bg-amber-500/15 text-amber-700 px-1.5 py-0.5 rounded">
            soon
          </span>
        )}
        <ChevronDown className="h-3 w-3 opacity-70 group-data-[state=open]:rotate-180 transition-transform" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0 overflow-hidden">
        <div className="p-2 border-b border-border bg-card">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search any city, town or village"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filtered[0]) {
                  e.preventDefault();
                  select(filtered[0]);
                }
              }}
              className="h-9 pl-8 text-sm"
              aria-label="Search city"
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Sparkles className="h-3 w-3 mt-0.5 text-rose-deep shrink-0" />
            <span>
              Launch phase — we currently serve only{" "}
              <span className="font-medium text-foreground">{SERVICE_CITY_LABEL}</span>. You can still
              pick any city to join the waitlist.
            </span>
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No matches. Press Enter to use "{query}".
            </div>
          ) : (
            filtered.map((c) => {
              const live = isServiceableCity(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => select(c)}
                  className="w-full px-3 py-2 text-sm flex items-center gap-2 hover:bg-blossom/50 transition-colors"
                >
                  <span className="flex-1 text-left truncate">{c}</span>
                  {live && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      live
                    </span>
                  )}
                  {c === city && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
