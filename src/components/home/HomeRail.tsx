import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Compact horizontal carousel used across the homepage so more content fits
 * above the fold. Purely presentational — no data logic lives here.
 */
export function HomeRail({
  eyebrow,
  title,
  to,
  linkLabel = "See all",
  children,
  id,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: string;
  to?: string;
  linkLabel?: string;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <section id={id} className={`container pb-6 md:pb-8 scroll-mt-32 ${className}`}>
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] md:text-[11px] uppercase tracking-[0.18em] text-primary flex items-center gap-1.5">
              {eyebrow}
            </p>
          )}
          <h2 className="font-display text-xl md:text-2xl leading-tight truncate">{title}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {to && (
            <Link to={to} className="text-xs md:text-sm text-primary hover:underline flex items-center gap-1">
              {linkLabel} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              aria-label={`Scroll ${title} left`}
              onClick={() => scrollBy(-1)}
              className="h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={`Scroll ${title} right`}
              onClick={() => scrollBy(1)}
              className="h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={trackRef}
        className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  );
}

/** Fixed-width slide so cards keep a consistent rhythm inside a rail. */
export function RailItem({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div
      className={`snap-start shrink-0 ${
        wide ? "w-[78%] sm:w-[320px]" : "w-[44%] sm:w-[200px] lg:w-[210px]"
      }`}
    >
      {children}
    </div>
  );
}
