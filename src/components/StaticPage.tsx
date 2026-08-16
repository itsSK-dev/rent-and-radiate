import { useEffect, type ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Seo } from "@/components/Seo";

interface StaticPageProps {
  eyebrow?: string;
  title: string;
  intro?: string;
  documentTitle?: string;
  description?: string;
  children: ReactNode;
}

export function StaticPage({ eyebrow, title, intro, documentTitle, description, children }: StaticPageProps) {
  useEffect(() => {
    if (documentTitle) document.title = documentTitle;
  }, [documentTitle]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Seo
        title={documentTitle ?? `${title} · Rent & Radiate`}
        description={description ?? intro ?? "Rent or buy designer dresses and jewellery from verified boutiques on Rent & Radiate."}
      />
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
