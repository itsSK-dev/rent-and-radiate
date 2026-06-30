import { StaticPage } from "@/components/StaticPage";
import { Link } from "react-router-dom";

const FAQS: { q: string; a: string }[] = [
  {
    q: "How does renting work?",
    a: "Pick your dates on a product page, pay the rental + refundable deposit, and the seller ships or hands it over. Return on time to get your full deposit back.",
  },
  {
    q: "When do I get my deposit back?",
    a: "Deposits are released after the seller confirms the product was returned in good condition — typically within 3–5 business days.",
  },
  {
    q: "Can I extend my rental?",
    a: "Yes — go to My Rentals and request an extension. The seller is notified and you'll only be charged for the additional days.",
  },
  {
    q: "How do I become a seller?",
    a: "Tap Start Selling on the home page, fill out the short onboarding form, and our team will review your store within 24 hours.",
  },
  {
    q: "Are sellers verified?",
    a: "Yes. Every seller goes through identity and store verification before products go live to customers.",
  },
];

export default function Help() {
  return (
    <StaticPage
      eyebrow="Help center"
      title="How can we help?"
      intro="Answers to the questions we hear most often. Can't find what you need? We're one click away."
      documentTitle="Help Center · Rent & Radiate"
    >
      <div className="space-y-4 not-prose">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="rounded-2xl border border-border bg-card p-5 group"
          >
            <summary className="cursor-pointer font-medium list-none flex justify-between items-center">
              {f.q}
              <span className="text-primary text-xl group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
      <p className="mt-8 text-sm">
        Still stuck?{" "}
        <Link to="/contact" className="text-primary hover:underline">
          Contact our team
        </Link>
        .
      </p>
    </StaticPage>
  );
}
