import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Shield, Truck, Camera, Sparkles } from "lucide-react";

const HowItWorks = () => {
  useEffect(() => { document.title = "How Bloom works · Trust & safety"; }, []);
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-16 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">How it works</p>
        <h1 className="font-display text-5xl md:text-6xl">A more beautiful way to dress up.</h1>
        <p className="text-lg text-muted-foreground mt-4">
          Bloom connects you with neighbourhood boutiques and fine jewellers. Rent for a day, a weekend, a wedding — without owning forever.
        </p>

        <div className="grid sm:grid-cols-2 gap-5 mt-12">
          <Card icon={<Sparkles />} title="Curated quality" desc="Only approved stores. Every piece is inspected and condition-noted." />
          <Card icon={<Truck />} title="Pickup or delivery" desc="Your call — collect from the store, or have it brought to your door." />
          <Card icon={<Shield />} title="Refundable deposit" desc="Pay rental + a refundable security deposit. Get the deposit back after the item is returned in good condition." />
          <Card icon={<Camera />} title="Photo proof" desc="Photos are taken before delivery and after return so disputes can be settled fairly." />
        </div>

        <h2 className="font-display text-3xl mt-16 mb-3">Refund tiers</h2>
        <ul className="text-muted-foreground space-y-2 text-sm">
          <li>Perfect condition · 100% deposit refund</li>
          <li>Minor wear · 70–80% refund</li>
          <li>Major damage · 30–50% refund</li>
          <li>Lost item · 0% refund</li>
        </ul>
      </section>
      <Footer />
    </div>
  );
};

function Card({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="h-10 w-10 rounded-full bg-primary-soft text-primary flex items-center justify-center mb-3">{icon}</div>
      <h3 className="font-display text-2xl mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

export default HowItWorks;
