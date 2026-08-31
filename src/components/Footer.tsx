import { Button } from "@/components/ui/button";
import { Facebook, Flower2, Instagram, Twitter, Youtube } from "lucide-react";
import { Link } from "react-router-dom";

const SHOP_LINKS: [string, string][] = [
  ["Dresses", "/browse?category=dress"],
  ["Jewellery", "/browse?category=jewellery"],
  ["All Stores", "/browse"],
  ["New Arrivals", "/browse?sort=newest"],
];

const SELLER_LINKS: [string, string][] = [
  ["Open Your Store", "/become-vendor"],
  ["Seller Dashboard", "/vendor"],
  ["Seller Analytics", "/vendor"],
  ["Payouts & Fees", "/vendor"],
];

const SUPPORT_LINKS: [string, string][] = [
  ["Help Center", "/help"],
  ["Contact Us", "/contact"],
  ["How it Works", "/how-it-works"],
  ["Trust & Safety", "/how-it-works"],
];

const LEGAL_LINKS: [string, string][] = [
  ["About Us", "/about"],
  ["Privacy Policy", "/privacy"],
  ["Terms & Conditions", "/terms"],
  ["Advertise with us", "/advertise"],
];

const SOCIAL_LINKS = [
  { icon: Instagram, label: "Instagram", href: "https://instagram.com/rentandradiate" },
  { icon: Facebook, label: "Facebook", href: "https://facebook.com/rentandradiate" },
  { icon: Twitter, label: "X (Twitter)", href: "https://twitter.com/rentandradiate" },
  { icon: Youtube, label: "YouTube", href: "https://youtube.com/@rentandradiate" },
];


function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="font-display text-lg mb-5 text-foreground">{title}</h4>
      <ul className="space-y-3 text-sm text-muted-foreground">
        {links.map(([label, href]) => (
          <li key={href + label}>
            <Link to={href} className="hover:text-primary transition-smooth inline-flex items-center gap-1">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-gradient-soft">
      <div className="container py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">
          {/* Brand column */}
          <div className="lg:col-span-4 space-y-6">
            <Link to="/" className="inline-flex items-center gap-2 group">
              <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-rose shadow-petal">
                <Flower2 className="h-5 w-5 text-primary-foreground" strokeWidth={1.5} />
              </span>
              <span className="font-display text-2xl text-foreground">Rent & Radiate</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Rent and buy beautiful dresses, jewellery, and lifestyle products from verified local boutiques near you.
            </p>
            <div className="flex items-center gap-3">
              {SOCIAL_LINKS.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Rent & Radiate on ${social.label}`}
                    className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-card border border-border text-foreground/80 hover:text-primary hover:border-primary/40 hover:-translate-y-0.5 transition-smooth"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link columns */}
          <div className="lg:col-span-2">
            <FooterColumn title="Shop" links={SHOP_LINKS} />
          </div>
          <div className="lg:col-span-2">
            <FooterColumn title="For Sellers" links={SELLER_LINKS} />
          </div>
          <div className="lg:col-span-2">
            <FooterColumn title="Support" links={SUPPORT_LINKS} />
          </div>
          <div className="lg:col-span-2">
            <FooterColumn title="Company" links={LEGAL_LINKS} />
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border/60">
        <div className="container py-6 md:py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} Rent & Radiate. All rights reserved.</span>
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
              <Link to="/privacy" className="hover:text-primary transition-smooth">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-primary transition-smooth">Terms & Conditions</Link>
              <Link to="/help" className="hover:text-primary transition-smooth">Help Center</Link>
              <Link to="/contact" className="hover:text-primary transition-smooth">Contact</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
