import { StaticPage } from "@/components/StaticPage";
import { Mail, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function Contact() {
  return (
    <StaticPage
      eyebrow="Get in touch"
      title="Contact us"
      intro="We usually reply within 24 hours. Pick the channel that works best for you."
      documentTitle="Contact · Rent & Radiate"
    >
      <div className="grid sm:grid-cols-2 gap-4 not-prose">
        <a
          href="mailto:support@rentandradiate.com"
          className="rounded-2xl border border-border bg-card p-6 hover:border-primary/40 transition-smooth"
        >
          <Mail className="h-6 w-6 text-primary mb-3" />
          <p className="font-medium">Email support</p>
          <p className="text-sm text-muted-foreground">support@rentandradiate.com</p>
        </a>
        <Link
          to="/help"
          className="rounded-2xl border border-border bg-card p-6 hover:border-primary/40 transition-smooth"
        >
          <MessageCircle className="h-6 w-6 text-primary mb-3" />
          <p className="font-medium">Help Center</p>
          <p className="text-sm text-muted-foreground">Browse common questions and guides.</p>
        </Link>
      </div>
      <p className="text-sm text-muted-foreground mt-6">
        For seller-related queries, please mention your store name so we can help faster.
      </p>
    </StaticPage>
  );
}
