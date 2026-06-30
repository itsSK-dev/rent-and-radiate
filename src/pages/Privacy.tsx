import { StaticPage } from "@/components/StaticPage";

export default function Privacy() {
  return (
    <StaticPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro="How we collect, use, and protect your personal information."
      documentTitle="Privacy Policy · Rent & Radiate"
    >
      <p className="text-sm text-muted-foreground">Last updated: June 30, 2026</p>

      <h2 className="font-display text-2xl mt-8">1. Information we collect</h2>
      <p>
        We collect information you provide when you create an account, place an order,
        list products, or contact support — including name, email, phone number, address,
        and payment details.
      </p>

      <h2 className="font-display text-2xl mt-8">2. How we use information</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>To process rentals, purchases, deposits and refunds.</li>
        <li>To verify identity and prevent fraud.</li>
        <li>To send transactional notifications and (with consent) marketing.</li>
        <li>To improve product recommendations and platform safety.</li>
      </ul>

      <h2 className="font-display text-2xl mt-8">3. Sharing</h2>
      <p>
        We share data with sellers only as needed to fulfil your order, and with payment
        and logistics partners. We never sell your data.
      </p>

      <h2 className="font-display text-2xl mt-8">4. Your rights</h2>
      <p>
        You can access, correct, or delete your data at any time from your account
        settings, or by writing to <a href="mailto:privacy@rentandradiate.com">privacy@rentandradiate.com</a>.
      </p>
    </StaticPage>
  );
}
