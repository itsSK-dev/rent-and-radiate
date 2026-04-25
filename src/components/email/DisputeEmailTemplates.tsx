// Brand-styled HTML previews of the dispute notification emails.
// These render the same markup we'll send once email infrastructure is wired up,
// so admins can review tone, layout, and content ahead of time.
//
// Inline styles are used intentionally so the markup mirrors what email clients
// will receive (no Tailwind, no external CSS).

const BRAND = {
  rose: "#b23a5c",       // rose-deep
  blossom: "#fff5f7",    // soft background
  petal: "#fde9ee",      // accent fill
  border: "#e9d6dc",
  ink: "#2a1a20",
  muted: "#7a6a70",
  gold: "#c8a96a",
  card: "#ffffff",
  body: "#fafafa",
};

const SITE_NAME = "Bloom";
const APP_URL = "https://rent-my-dresses.lovable.app";

import type { SupportContact } from "@/hooks/useSupportContact";
import { SUPPORT_CONTACT_FALLBACK } from "@/hooks/useSupportContact";

function SupportLine({ contact }: { contact: SupportContact }) {
  const parts: React.ReactNode[] = [];
  if (contact.email) parts.push(<a key="e" href={`mailto:${contact.email}`} style={{ color: BRAND.rose }}>{contact.email}</a>);
  if (contact.phone) parts.push(<a key="p" href={`tel:${contact.phone.replace(/\s+/g, "")}`} style={{ color: BRAND.rose }}>{contact.phone}</a>);
  if (contact.link_url) parts.push(<a key="l" href={contact.link_url} style={{ color: BRAND.rose }}>{contact.link_label || "Help centre"}</a>);
  if (parts.length === 0) return <>our support team</>;
  return (
    <>
      {parts.map((node, i) => (
        <span key={i}>{i > 0 ? " · " : ""}{node}</span>
      ))}
    </>
  );
}

function Shell({ children, preview, contact }: { children: React.ReactNode; preview: string; contact: SupportContact }) {
  return (
    <div style={{ background: BRAND.body, padding: "32px 12px", fontFamily: "Georgia, 'Times New Roman', serif", color: BRAND.ink }}>
      <div style={{ display: "none", fontSize: 0, lineHeight: 0, color: "transparent" }}>{preview}</div>
      <table cellPadding={0} cellSpacing={0} role="presentation" style={{ width: "100%", maxWidth: 560, margin: "0 auto", background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: 16, overflow: "hidden" }}>
        <tbody>
          <tr>
            <td style={{ background: BRAND.blossom, padding: "28px 32px", borderBottom: `1px solid ${BRAND.border}` }}>
              <p style={{ margin: 0, fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: BRAND.rose }}>Bloom · Rentals</p>
              <h1 style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 400, color: BRAND.ink, fontFamily: "Georgia, serif" }}>{SITE_NAME}</h1>
            </td>
          </tr>
          <tr><td style={{ padding: "28px 32px", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 14, lineHeight: 1.65, color: BRAND.ink }}>{children}</td></tr>
          <tr>
            <td style={{ padding: "20px 32px 28px", borderTop: `1px solid ${BRAND.border}`, background: "#fcfafa", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 12, color: BRAND.muted }}>
              Need help? Reach <SupportLine contact={contact} />.{contact.hours ? <> Available {contact.hours}.</> : null}<br />
              © {new Date().getFullYear()} {SITE_NAME}. You're receiving this because you're a party to this rental.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ padding: "6px 0", fontSize: 12, color: BRAND.muted, textTransform: "uppercase", letterSpacing: 1.5, width: "40%" }}>{label}</td>
      <td style={{ padding: "6px 0", fontSize: 13, color: BRAND.ink, fontWeight: 500 }}>{value}</td>
    </tr>
  );
}

function Button({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} style={{ display: "inline-block", background: BRAND.rose, color: "#fff", padding: "12px 22px", borderRadius: 999, textDecoration: "none", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: 0.4 }}>
      {label}
    </a>
  );
}

export type DisputeEmailData = {
  recipientName: string;
  recipientRole: "customer" | "store_owner";
  productTitle: string;
  storeName: string;
  rentalId: string;
  startDate: string;
  endDate: string;
  grandTotal: string;
  reason: string;
};

export type DisputeResolutionData = DisputeEmailData & {
  outcome: "resolved" | "rejected";
  resolution: string;
  refundAmount?: string;
  depositReturned?: string;
};

export function DisputeOpenedEmail({ data, contact = SUPPORT_CONTACT_FALLBACK }: { data: DisputeEmailData; contact?: SupportContact }) {
  const youAre = data.recipientRole === "customer" ? "the customer" : "the store";
  const counterparty = data.recipientRole === "customer" ? data.storeName : "the customer";
  return (
    <Shell preview={`A dispute was opened on your rental of ${data.productTitle}.`} contact={contact}>
      <p style={{ margin: "0 0 14px", fontSize: 18, color: BRAND.ink }}>Hi {data.recipientName},</p>
      <p style={{ margin: "0 0 18px" }}>
        A dispute has been opened on your rental of <strong>{data.productTitle}</strong>. As {youAre}, your account is involved and our team is reviewing it now.
      </p>

      <div style={{ background: BRAND.blossom, border: `1px solid ${BRAND.border}`, borderRadius: 12, padding: "16px 18px", margin: "0 0 22px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <InfoRow label="Item" value={data.productTitle} />
            <InfoRow label="Store" value={data.storeName} />
            <InfoRow label="Rental window" value={`${data.startDate} → ${data.endDate}`} />
            <InfoRow label="Order total" value={data.grandTotal} />
            <InfoRow label="Rental ID" value={data.rentalId.slice(0, 8) + "…"} />
          </tbody>
        </table>
      </div>

      <p style={{ margin: "0 0 6px", fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5, color: BRAND.muted }}>Reason given</p>
      <blockquote style={{ margin: "0 0 22px", padding: "12px 16px", borderLeft: `3px solid ${BRAND.rose}`, background: BRAND.petal, fontStyle: "italic", color: BRAND.ink, borderRadius: 4 }}>
        “{data.reason}”
      </blockquote>

      <p style={{ margin: "0 0 8px", fontWeight: 600 }}>What happens next</p>
      <ol style={{ margin: "0 0 22px", paddingLeft: 20, color: BRAND.ink }}>
        <li style={{ marginBottom: 6 }}>An admin reviews the rental, photos, and messages from both sides.</li>
        <li style={{ marginBottom: 6 }}>Upload any extra evidence — invoices, photos, courier slips — within 48 hours.</li>
        <li style={{ marginBottom: 6 }}>You'll receive a final decision by email with any refund or deposit outcome.</li>
      </ol>

      <p style={{ margin: "0 0 24px" }}>
        You can view the full case and add evidence with {counterparty} from your dashboard. If you need a hand at any point, reach <SupportLine contact={contact} />.
      </p>

      <Button href={`${APP_URL}/${data.recipientRole === "customer" ? "my-rentals" : "vendor"}`} label="Open rental dashboard" />

      <p style={{ margin: "28px 0 0", fontSize: 12, color: BRAND.muted }}>
        Please don't reply directly to the other party through email — keep all evidence inside Bloom so our team can review it.
      </p>
    </Shell>
  );
}

export function DisputeResolutionEmail({ data, contact = SUPPORT_CONTACT_FALLBACK }: { data: DisputeResolutionData; contact?: SupportContact }) {
  const isResolved = data.outcome === "resolved";
  const headline = isResolved ? "Your dispute has been resolved" : "Your dispute has been closed";
  const accent = isResolved ? BRAND.rose : BRAND.muted;
  return (
    <Shell preview={`${headline} — ${data.productTitle}`} contact={contact}>
      <p style={{ margin: "0 0 14px", fontSize: 18, color: BRAND.ink }}>Hi {data.recipientName},</p>
      <p style={{ margin: "0 0 18px" }}>
        Our team has finished reviewing the dispute on your rental of <strong>{data.productTitle}</strong> from {data.storeName}.
      </p>

      <div style={{ background: isResolved ? BRAND.blossom : "#f4f1f2", border: `1px solid ${BRAND.border}`, borderRadius: 12, padding: "18px 20px", margin: "0 0 22px" }}>
        <p style={{ margin: 0, fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: accent }}>Final decision</p>
        <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 500, color: BRAND.ink, fontFamily: "Georgia, serif" }}>
          {isResolved ? "Resolved in favour of the claim" : "Closed — no further action"}
        </p>
      </div>

      <p style={{ margin: "0 0 6px", fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5, color: BRAND.muted }}>Admin's note</p>
      <blockquote style={{ margin: "0 0 22px", padding: "12px 16px", borderLeft: `3px solid ${accent}`, background: "#fbf6f7", color: BRAND.ink, borderRadius: 4 }}>
        {data.resolution}
      </blockquote>

      {(data.refundAmount || data.depositReturned) && (
        <div style={{ background: "#fff", border: `1px solid ${BRAND.border}`, borderRadius: 12, padding: "16px 18px", margin: "0 0 22px" }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5, color: BRAND.muted }}>Financial outcome</p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {data.refundAmount && <InfoRow label="Refund issued" value={data.refundAmount} />}
              {data.depositReturned && <InfoRow label="Deposit returned" value={data.depositReturned} />}
              <InfoRow label="Order total" value={data.grandTotal} />
            </tbody>
          </table>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: BRAND.muted }}>
            Refunds typically appear in the original payment method within 5–7 business days.
          </p>
        </div>
      )}

      <p style={{ margin: "0 0 8px", fontWeight: 600 }}>What you should do next</p>
      <ul style={{ margin: "0 0 22px", paddingLeft: 20 }}>
        {isResolved ? (
          <>
            <li style={{ marginBottom: 6 }}>Watch for the refund or deposit return in your payment account.</li>
            <li style={{ marginBottom: 6 }}>If anything looks wrong, reply within 7 days and we'll re-open the case.</li>
          </>
        ) : (
          <>
            <li style={{ marginBottom: 6 }}>The rental will continue under its original terms.</li>
            <li style={{ marginBottom: 6 }}>If new evidence emerges, contact support and we'll review again.</li>
          </>
        )}
        <li style={{ marginBottom: 6 }}>Leave a rating once the rental is fully closed — it helps the community.</li>
      </ul>

      <Button href={`${APP_URL}/${data.recipientRole === "customer" ? "my-rentals" : "vendor"}`} label="View rental" />

      <p style={{ margin: "28px 0 0", fontSize: 12, color: BRAND.muted }}>
        Questions about this decision? Reach <SupportLine contact={contact} /> and a human will get back to you within one business day.{contact.hours ? <> We're available {contact.hours}.</> : null}
      </p>
    </Shell>
  );
}
