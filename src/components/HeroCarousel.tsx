import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
// Hero images are served from /public so the LCP candidate can be
// <link rel="preload"> in index.html without waiting for the JS bundle
// to import a hashed asset URL.
const hero1 = "/hero/hero-1.jpg";
const hero2 = "/hero/hero-2.jpg";
const hero3 = "/hero/hero-3.jpg";


/**
 * Branding-only hero carousel. The model imagery is NOT a marketplace
 * product — no Rent/Buy/Wishlist/Cart actions, no product page links.
 */
type Slide = {
  image: string;
  alt: string;
  eyebrow: string;
  title: string;
  subtitle: string;
};

const SLIDES: Slide[] = [
  {
    image: hero1,
    alt: "Model wearing a designer pink saree with gold jewellery",
    eyebrow: "Rent Smart. Buy Local.",
    title: "Wear luxury\nwithout the price tag",
    subtitle: "Designer ethnic wear, jewellery & accessories from verified shops near you.",
  },
  {
    image: hero2,
    alt: "Model showcasing a pink handbag and gold watch",
    eyebrow: "Discover Premium Fashion Near You",
    title: "Bags, watches\n& everyday luxury",
    subtitle: "Curated handbags, timepieces and accessories from local boutiques.",
  },
  {
    image: hero3,
    alt: "Model in a flowing pastel evening gown with diamond jewellery",
    eyebrow: "Luxury Within Reach",
    title: "Gowns for every\nunforgettable evening",
    subtitle: "Rent for the night or take it home — the choice is yours.",
  },
];

const AUTOPLAY_MS = 5000;

export function HeroCarousel() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  const goTo = useCallback((i: number) => {
    setIndex(((i % SLIDES.length) + SLIDES.length) % SLIDES.length);
  }, []);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  // Autoplay with pause-on-interact
  useEffect(() => {
    if (paused) return;
    timerRef.current = window.setTimeout(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [index, paused]);

  // Resume autoplay shortly after the last interaction
  const resumeRef = useRef<number | null>(null);
  const bumpPause = useCallback(() => {
    setPaused(true);
    if (resumeRef.current) window.clearTimeout(resumeRef.current);
    resumeRef.current = window.setTimeout(() => setPaused(false), 6000);
  }, []);

  return (
    <section
      className="relative w-full overflow-hidden bg-gradient-to-b from-blossom/40 via-background to-background"
      aria-roledescription="carousel"
      aria-label="Featured collections"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={bumpPause}
    >
      <div className="relative h-[440px] sm:h-[520px] md:h-[600px] lg:h-[640px]">
        {SLIDES.map((slide, i) => {
          const active = i === index;
          return (
            <div
              key={i}
              className={`absolute inset-0 transition-opacity duration-[1100ms] ease-out ${
                active ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
              aria-hidden={!active}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${SLIDES.length}`}
            >
              {/* Decorative imagery — NOT a product. No links / actions. */}
              <img
                src={slide.image}
                alt={slide.alt}
                width={1920}
                height={1080}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "low"}
                decoding="async"
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover object-center select-none pointer-events-none"
              />
              {/* Soft pink / white overlay for legibility */}
              <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-background/10 md:from-background/90 md:via-background/55 md:to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />

              <div className="relative h-full container flex items-center">
                <div
                  className={`max-w-xl transition-all duration-700 ${
                    active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                  }`}
                >
                  <span className="inline-flex items-center gap-2 text-[11px] sm:text-xs uppercase tracking-[0.22em] text-rose-deep">
                    <Sparkles className="h-3.5 w-3.5" /> {slide.eyebrow}
                  </span>
                  <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.02] mt-3 whitespace-pre-line text-foreground">
                    {slide.title}
                  </h1>
                  <p className="text-sm sm:text-base md:text-lg text-muted-foreground mt-4 max-w-md">
                    {slide.subtitle}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button
                      size="lg"
                      variant="hero"
                      className="rounded-full px-6 shadow-soft"
                      onClick={() => {
                        bumpPause();
                        navigate("/browse");
                      }}
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Explore Nearby Shops
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Prev / Next arrows */}
        <button
          type="button"
          onClick={() => {
            bumpPause();
            prev();
          }}
          aria-label="Previous slide"
          className="hidden sm:flex absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-20 h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-background/80 hover:bg-background text-foreground shadow-soft backdrop-blur transition-all hover:scale-105"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            bumpPause();
            next();
          }}
          aria-label="Next slide"
          className="hidden sm:flex absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-20 h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-background/80 hover:bg-background text-foreground shadow-soft backdrop-blur transition-all hover:scale-105"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Pagination dots */}
        <div
          className="absolute bottom-5 md:bottom-7 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2"
          role="tablist"
          aria-label="Slide pagination"
        >
          {SLIDES.map((_, i) => {
            const active = i === index;
            return (
              <button
                key={i}
                role="tab"
                aria-selected={active}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => {
                  bumpPause();
                  goTo(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  active
                    ? "w-8 bg-rose-deep"
                    : "w-2.5 bg-foreground/30 hover:bg-foreground/50"
                }`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
