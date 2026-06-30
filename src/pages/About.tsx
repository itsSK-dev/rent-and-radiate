import { StaticPage } from "@/components/StaticPage";

export default function About() {
  return (
    <StaticPage
      eyebrow="Our story"
      title="About Rent & Radiate"
      intro="A curated marketplace where you can rent or buy beautiful fashion from verified local boutiques."
      documentTitle="About · Rent & Radiate"
    >
      <p>
        Rent & Radiate connects you with hand-picked boutiques across the country. Whether
        you need an outfit for a wedding, a festival, or a once-in-a-lifetime moment, you
        can rent or buy the look — backed by refundable deposits and platform-managed
        refunds.
      </p>
      <h2 className="font-display text-2xl mt-8">What we stand for</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Conscious consumption: rent once, radiate forever.</li>
        <li>Real boutiques, real stories — every seller is verified.</li>
        <li>Transparent pricing with no hidden fees.</li>
        <li>Safety first: secure payments, protected rentals.</li>
      </ul>
    </StaticPage>
  );
}
