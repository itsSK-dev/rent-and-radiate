import type { DeliveryApplicationStatus } from "@/hooks/useAuth";
import { authLog } from "@/hooks/useAuth";

export type AuthIntent = "customer" | "shop_owner" | "delivery_partner";

const INTENT_KEY = "rr_auth_intent";
const OAUTH_PENDING_KEY = "rr_oauth_pending";

export function saveIntent(intent: AuthIntent) {
  try { localStorage.setItem(INTENT_KEY, intent); } catch { /* noop */ }
}

export function readIntent(): AuthIntent | null {
  try {
    const v = localStorage.getItem(INTENT_KEY);
    return v === "shop_owner" || v === "delivery_partner" || v === "customer" ? v : null;
  } catch {
    return null;
  }
}

export function clearIntent() {
  try { localStorage.removeItem(INTENT_KEY); } catch { /* noop */ }
}

export function markOAuthPending(next?: string | null) {
  try { localStorage.setItem(OAUTH_PENDING_KEY, next || "1"); } catch { /* noop */ }
}

export function consumeOAuthPending(): string | null {
  try {
    const v = localStorage.getItem(OAUTH_PENDING_KEY);
    if (v) localStorage.removeItem(OAUTH_PENDING_KEY);
    return v;
  } catch {
    return null;
  }
}

/** Only same-origin relative paths are accepted as redirect targets. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

/**
 * Single source of truth for "where does this user belong after auth?".
 * Priority: explicit next → DB roles (admin) → chosen intent → DB roles → customer home.
 */
export function resolvePostLoginPath(opts: {
  roles: string[];
  deliveryApplication: DeliveryApplicationStatus;
  intent?: AuthIntent | null;
  next?: string | null;
}): string {
  const { roles, deliveryApplication } = opts;
  const next = safeNext(opts.next);
  const intent = opts.intent ?? null;

  let path: string;
  if (next) path = next;
  else if (roles.includes("admin")) path = "/admin";
  else if (intent === "delivery_partner" || roles.includes("delivery_partner") || deliveryApplication !== "none") {
    // Delivery partners must complete the application before reaching the dashboard.
    path = deliveryApplication === "none" ? "/delivery/register" : "/delivery";
  } else if (intent === "shop_owner") {
    path = roles.includes("store_owner") ? "/vendor" : "/become-vendor";
  } else if (roles.includes("store_owner")) path = "/vendor";
  else path = "/";

  authLog("redirect", { roles, deliveryApplication, intent, next, path });
  return path;
}

/** Primary role used for role-based UI (navbar, dashboards). */
export function primaryRole(
  roles: string[],
  deliveryApplication: DeliveryApplicationStatus,
): "admin" | "delivery_partner" | "store_owner" | "customer" {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("delivery_partner") || deliveryApplication !== "none") return "delivery_partner";
  if (roles.includes("store_owner")) return "store_owner";
  return "customer";
}
