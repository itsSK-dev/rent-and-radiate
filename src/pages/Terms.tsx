import { StaticPage } from "@/components/StaticPage";

export default function Terms() {
  return (
    <StaticPage
      eyebrow="Legal"
      title="Terms & Conditions"
      intro="The rules that apply when you use Rent & Radiate."
      documentTitle="Terms & Conditions · Rent & Radiate"
    >
      <p className="text-sm text-muted-foreground">Last updated: June 30, 2026</p>

      <h2 className="font-display text-2xl mt-8">1. Using the platform</h2>
      <p>
        You must be 18+ to rent, buy or sell. By using Rent & Radiate you agree to follow
        these terms and our community guidelines.
      </p>

      <h2 className="font-display text-2xl mt-8">2. Rentals & deposits</h2>
      <p>
        Every rental includes a refundable security deposit. Deposits are returned after
        the product is inspected upon return. Damages may be deducted from the deposit.
      </p>

      <h2 className="font-display text-2xl mt-8">3. Refunds</h2>
      <p>
        Eligible refunds are processed within 7 business days. The platform mediates
        disputes between buyers and sellers.
      </p>

      <h2 className="font-display text-2xl mt-8">4. Seller responsibilities</h2>
      <p>
        Sellers must list accurate information, honour bookings, and ship on time. Pricing
        rules and platform fees are governed by current platform settings.
      </p>

      <h2 className="font-display text-2xl mt-8">5. Liability</h2>
      <p>
        Rent & Radiate is a marketplace; we are not the manufacturer of listed products.
        Our liability is limited to the amounts paid through the platform.
      </p>
    </StaticPage>
  );
}
