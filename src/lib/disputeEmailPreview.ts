// Builds sample dispute data for previewing test emails and renders a
// plain-text version that mirrors the HTML template content.

import type { SupportContact } from "@/hooks/useSupportContact";
import type { DisputeEmailData, DisputeResolutionData } from "@/components/email/DisputeEmailTemplates";

export type TemplateKey = "dispute-opened" | "dispute-resolved" | "dispute-rejected";

export type PreviewRecipient = {
  name: string;
  email: string;
  role: "customer" | "store_owner";
};

export function buildSampleData(
  template: TemplateKey,
  recipient: PreviewRecipient,
  storeName: string,
): DisputeEmailData | DisputeResolutionData {
  const base: DisputeEmailData = {
    recipientName: recipient.name,
    recipientRole: recipient.role,
    productTitle: "Ivory Silk Lehenga",
    storeName,
    rentalId: "a1b2c3d4-5678-9abc-def0-123456789abc",
    startDate: "12 May 2026",
    endDate: "15 May 2026",
    grandTotal: "₹14,500",
    reason:
      "The lehenga arrived with a tear along the inner seam and a faded patch near the hem that wasn't visible in the listing photos.",
    evidenceImages: [
      "https://example.com/evidence/photo-1.jpg",
      "https://example.com/evidence/photo-2.jpg",
    ],
  };

  if (template === "dispute-opened") return base;

  const isResolved = template === "dispute-resolved";
  const resolution: DisputeResolutionData = {
    ...base,
    outcome: isResolved ? "resolved" : "rejected",
    resolution: isResolved
      ? "After reviewing the photos and courier slip, we agree the item arrived damaged. The rental fee is refunded and the deposit is returned in full."
      : "The damage shown in the photos appears consistent with normal wear and was disclosed in the listing notes. The original charges stand.",
    refundAmount: isResolved ? "₹9,500" : undefined,
    depositReturned: isResolved ? "₹5,000" : undefined,
  };
  return resolution;
}

function supportLineText(contact: SupportContact): string {
  const parts: string[] = [];
  if (contact.email) parts.push(contact.email);
  if (contact.phone) parts.push(contact.phone);
  if (contact.link_url) parts.push(`${contact.link_label || "Help centre"} (${contact.link_url})`);
  return parts.length ? parts.join(" · ") : "our support team";
}

export function buildPlainText(
  template: TemplateKey,
  data: DisputeEmailData | DisputeResolutionData,
  contact: SupportContact,
): string {
  const support = supportLineText(contact);
  const hours = contact.hours ? ` Available ${contact.hours}.` : "";
  const dashboard =
    data.recipientRole === "customer"
      ? "https://rent-my-dresses.lovable.app/my-rentals"
      : "https://rent-my-dresses.lovable.app/vendor";

  const evidence =
    data.evidenceImages && data.evidenceImages.length
      ? `EVIDENCE UPLOADS (${data.evidenceImages.length})\n` +
        data.evidenceImages.map((u, i) => `  ${i + 1}. ${u}`).join("\n") +
        "\n"
      : "EVIDENCE UPLOADS\n  No photos attached yet — upload from your dashboard.\n";

  const details =
    `RENTAL DETAILS\n` +
    `  Item:           ${data.productTitle}\n` +
    `  Store:          ${data.storeName}\n` +
    `  Rental window:  ${data.startDate} → ${data.endDate}\n` +
    `  Order total:    ${data.grandTotal}\n` +
    `  Rental ID:      ${data.rentalId.slice(0, 8)}…\n`;

  if (template === "dispute-opened") {
    return [
      `BLOOM · RENTALS`,
      ``,
      `Hi ${data.recipientName},`,
      ``,
      `A dispute has been opened on your rental of "${data.productTitle}". Our team is reviewing it now.`,
      ``,
      details,
      `REASON GIVEN`,
      `  "${data.reason}"`,
      ``,
      evidence,
      `WHAT HAPPENS NEXT`,
      `  1. An admin reviews the rental, photos, and messages from both sides.`,
      `  2. Upload any extra evidence within 48 hours.`,
      `  3. You'll receive a final decision by email with any refund or deposit outcome.`,
      ``,
      `Open your rental dashboard: ${dashboard}`,
      ``,
      `Need help? Reach ${support}.${hours}`,
      `© ${new Date().getFullYear()} Bloom`,
    ].join("\n");
  }

  const r = data as DisputeResolutionData;
  const isResolved = r.outcome === "resolved";
  const refund =
    `REFUND & DEPOSIT SUMMARY\n` +
    `  Rental refund:   ${r.refundAmount ?? "No refund issued"}\n` +
    `  Security deposit:${r.depositReturned ? ` ${r.depositReturned} returned` : " Withheld by store"}\n` +
    `  Original total:  ${r.grandTotal}\n` +
    (r.refundAmount || r.depositReturned
      ? `  Funds appear in 5–7 business days.\n`
      : `  Reply within 7 days with new evidence to re-open.\n`);

  return [
    `BLOOM · RENTALS`,
    ``,
    `Hi ${r.recipientName},`,
    ``,
    `Our team has finished reviewing the dispute on your rental of "${r.productTitle}" from ${r.storeName}.`,
    ``,
    `FINAL DECISION`,
    `  ${isResolved ? "Resolved in favour of the claim" : "Closed — no further action"}`,
    ``,
    `ADMIN'S NOTE`,
    `  ${r.resolution}`,
    ``,
    evidence,
    refund,
    `WHAT YOU SHOULD DO NEXT`,
    isResolved
      ? `  • Watch for the refund/deposit return in your payment account.\n  • If anything looks wrong, reply within 7 days and we'll re-open the case.`
      : `  • The rental will continue under its original terms.\n  • If new evidence emerges, contact support and we'll review again.`,
    `  • Leave a rating once the rental is fully closed.`,
    ``,
    `View rental: ${dashboard}`,
    ``,
    `Questions? Reach ${support}.${hours}`,
    `© ${new Date().getFullYear()} Bloom`,
  ].join("\n");
}

export function buildSubject(template: TemplateKey, data: DisputeEmailData): string {
  switch (template) {
    case "dispute-opened":
      return `A dispute was opened on your rental of ${data.productTitle}`;
    case "dispute-resolved":
      return `Your dispute has been resolved — ${data.productTitle}`;
    case "dispute-rejected":
      return `Your dispute has been closed — ${data.productTitle}`;
  }
}
