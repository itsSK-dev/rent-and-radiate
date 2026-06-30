import { useEffect, type ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

interface StaticPageProps {
  eyebrow?: string;
  title: string;
  intro?: string;
  documentTitle?: string;
  children: ReactNode;
}

export function StaticPage({ eyebrow, title, intro, documentTitle, children }: StaticPageProps) {
  useEffect(() => {
    if (documentTitle) document.title = documentTitle;
  }, [documentTitle]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-16 max-w-3xl">
        {eyebrow && (
          <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">{eyebrow}</p>
        )}
        <h1 className="font-display text-4xl md:text-5xl mb-4">{title}</h1>
        {intro && <p className="text-muted-foreground text-lg mb-8">{intro}</p>}
        <div className="prose prose-neutral max-w-none space-y-6 text-foreground/90 leading-relaxed">
          {children}
        </div>
      </section>
      <Footer />
    </div>
  );
}
