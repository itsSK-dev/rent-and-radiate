import { useEffect, useState } from "react";
import { MapPin, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STORAGE_KEY = "rr.location";
const CITIES = [
  "Mumbai",
  "Delhi",
  "Bengaluru",
  "Hyderabad",
  "Chennai",
  "Pune",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Lucknow",
];

/** Lightweight, client-side location chip. Persists in localStorage only —
 * no backend changes. Other features can read the saved city if needed. */
export function LocationSelector({ compact = false }: { compact?: boolean }) {
  const [city, setCity] = useState<string>("Mumbai");

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v) setCity(v);
    } catch {
      /* ignore */
    }
  }, []);

  const select = (c: string) => {
    setCity(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* ignore */
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs hover:border-primary/40 hover:bg-blossom/40 transition-colors ${
          compact ? "" : "md:px-3 md:py-2 md:text-sm"
        }`}
        aria-label="Choose location"
      >
        <MapPin className="h-3.5 w-3.5 text-rose-deep" />
        <span className="hidden xs:inline text-muted-foreground">Deliver to</span>
        <span className="font-medium text-foreground">{city}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs">Choose your city</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-72 overflow-y-auto">
          {CITIES.map((c) => (
            <DropdownMenuItem
              key={c}
              onSelect={() => select(c)}
              className="text-sm cursor-pointer"
            >
              <span className="flex-1">{c}</span>
              {c === city && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
