import { Flower2 } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-gradient-soft mt-24">
      <div className="container py-16 grid gap-10 md:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Flower2 className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <span className="font-display text-xl">Bloom</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">
            Rent the most beautiful dresses and jewellery from local boutiques near you.
          </p>
        </div>
        <FooterCol title="Discover" links={[["Dresses","/browse?category=dress"],["Jewellery","/browse?category=jewellery"],["All stores","/browse"]]} />
        <FooterCol title="For vendors" links={[["Open a store","/become-vendor"],["Vendor dashboard","/vendor"]]} />
        <FooterCol title="Company" links={[["How it works","/how-it-works"],["Trust & safety","/how-it-works"]]} />
      </div>
      <div className="border-t border-border/60">
        <div className="container py-6 text-xs text-muted-foreground flex flex-col md:flex-row justify-between gap-2">
          <span>© {new Date().getFullYear()} Bloom Rentals. All rights reserved.</span>
          <span>Made with care, for special days.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="font-display text-lg mb-3">{title}</h4>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {links.map(([label, href]) => (
          <li key={href + label}><Link to={href} className="hover:text-primary transition-smooth">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
