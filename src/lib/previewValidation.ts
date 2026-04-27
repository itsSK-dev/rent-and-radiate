// Validates that the resolved dispute template data + rendered HTML/text
// don't contain unfilled variables, empty required fields, or stale
// placeholder tokens. Run BEFORE confirming a test send so admins can fix
// missing values before anything leaves the system.

import type { DisputeEmailData, DisputeResolutionData } from "@/components/email/DisputeEmailTemplates";
import type { TemplateKey } from "@/lib/disputeEmailPreview";

export type ValidationLevel = "error" | "warning";

export type ValidationIssue = {
  level: ValidationLevel;
  field: string;        // e.g. "productTitle", "evidenceImages"
  message: string;      // human-readable explanation
  hint?: string;        // optional remediation guidance
};

export type ValidationReport = {
  ok: boolean;          // true when no errors (warnings allowed)
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

// Shared field labels used in messages.
const LABELS: Record<string, string> = {
  recipientName: "Recipient name",
  productTitle: "Product title",
  storeName: "Store name",
  rentalId: "Rental ID",
  startDate: "Rental start date",
  endDate: "Rental end date",
  grandTotal: "Order total",
  reason: "Customer's reason",
  evidenceImages: "Evidence uploads",
  resolution: "Admin resolution note",
  refundAmount: "Refund amount",
  depositReturned: "Deposit returned",
};

// Tokens that strongly suggest unfilled / templated content slipped through.
// e.g. "{{productTitle}}", "${reason}", "<%= name %>", "[NAME]", "TBD".
const UNFILLED_PATTERNS: { rx: RegExp; label: string }[] = [
  { rx: /\{\{\s*[\w.-]+\s*\}\}/g, label: "Mustache placeholder ({{ … }})" },
  { rx: /\$\{[\s\w.-]+\}/g,       label: "Template literal placeholder (${ … })" },
  { rx: /<%=?[\s\S]*?%>/g,        label: "EJS placeholder (<% … %>)" },
  { rx: /\[\s*[A-Z_][A-Z0-9_ ]{1,30}\s*\]/g, label: "ALL-CAPS placeholder ([NAME])" },
  { rx: /\bTBD\b|\bTODO\b|\bFIXME\b/gi,      label: "TBD / TODO marker" },
  { rx: /\bundefined\b|\bnull\b/gi,          label: "Literal 'undefined' / 'null'" },
];

function isBlank(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

function isLikelyUrl(s: string): boolean {
  return /^https?:\/\/\S+\.\S+/i.test(s.trim());
}

export function validatePreview(args: {
  template: TemplateKey;
  data: DisputeEmailData | DisputeResolutionData;
  html: string;
  text: string;
  subject: string;
  from?: { name: string; email: string };
  replyTo?: string;
}): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const push = (level: ValidationLevel, field: string, message: string, hint?: string) => {
    (level === "error" ? errors : warnings).push({ level, field, message, hint });
  };

  const data = args.data;

  // 1. Required base fields
  const requiredBase: (keyof DisputeEmailData)[] = [
    "recipientName",
    "productTitle",
    "storeName",
    "rentalId",
    "startDate",
    "endDate",
    "grandTotal",
    "reason",
  ];
  for (const key of requiredBase) {
    if (isBlank(data[key])) {
      push("error", String(key), `${LABELS[key] ?? key} is missing.`, "Fill it in the sample data editor before sending.");
    }
  }

  // 2. Evidence: warn if empty (shown as "no photos attached" in the email)
  const ev = data.evidenceImages ?? [];
  if (ev.length === 0) {
    push("warning", "evidenceImages", "No evidence images attached.", "The email will say 'no photos attached yet'. Add at least one URL if applicable.");
  } else {
    const bad = ev.filter((u) => !isLikelyUrl(u));
    if (bad.length > 0) {
      push("error", "evidenceImages",
        `${bad.length} evidence ${bad.length === 1 ? "entry" : "entries"} ${bad.length === 1 ? "isn't" : "aren't"} a valid http(s) URL.`,
        "Each evidence line must be a full URL starting with https://");
    }
  }

  // 3. Resolution-specific fields
  if (args.template !== "dispute-opened") {
    const r = data as DisputeResolutionData;
    if (isBlank(r.resolution)) {
      push("error", "resolution", "Admin resolution note is missing.", "Required for resolved/rejected templates.");
    }
    if (r.outcome === "resolved") {
      if (isBlank(r.refundAmount) && isBlank(r.depositReturned)) {
        push("warning", "refundAmount",
          "Resolved dispute has no refund or returned deposit.",
          "Most resolved disputes specify at least one. Add an amount or confirm this is correct.");
      }
    }
  }

  // 4. Sender headers
  if (args.from) {
    if (isBlank(args.from.name)) push("error", "fromName", "From name is missing.");
    if (isBlank(args.from.email)) push("error", "fromEmail", "From email is missing.");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.from.email)) {
      push("error", "fromEmail", "From email is not a valid address.");
    }
    // Sample / placeholder domains
    if (/@(?:example\.(?:com|org|net)|test\.com|bloom\.example)$/i.test(args.from.email)) {
      push("warning", "fromEmail",
        `From address "${args.from.email}" looks like a sample placeholder.`,
        "Replace it with your verified sender (e.g. notify@yourdomain.com) before going live.");
    }
  } else {
    push("warning", "from", "No From address set — the system default will be used.");
  }

  if (args.replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.replyTo)) {
    push("error", "replyTo", "Reply-To is not a valid email address.");
  }

  // 5. Subject sanity
  if (isBlank(args.subject)) {
    push("error", "subject", "Subject line is empty.");
  } else if (args.subject.length > 140) {
    push("warning", "subject", `Subject is ${args.subject.length} characters — many inboxes truncate after ~70.`);
  }

  // 6. Scan rendered HTML + plain text for unfilled placeholder tokens.
  // We run the patterns against the actual outputs the recipient would see.
  const haystack = `${args.html}\n${args.text}\n${args.subject}`;
  const seen = new Set<string>();
  for (const { rx, label } of UNFILLED_PATTERNS) {
    const matches = haystack.match(rx);
    if (!matches) continue;
    for (const m of matches.slice(0, 5)) {
      const key = `${label}:${m}`;
      if (seen.has(key)) continue;
      seen.add(key);
      push("error", "rendered", `Unfilled variable in preview: ${m.trim()}`, `Detected as ${label}. Make sure all dynamic fields resolved correctly.`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
