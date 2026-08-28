import { supabase } from "@/integrations/supabase/client";

export type SecuritySeverity = "info" | "low" | "medium" | "high" | "critical";

export interface LogSecurityEventArgs {
  eventType: string;
  severity: SecuritySeverity;
  summary?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Client-side helper to record a security event.
 * Fire-and-forget: swallows errors so it never blocks UX.
 * Backend RPC is rate-limited (30/min per user) and validates inputs.
 */
export async function logSecurityEvent(args: LogSecurityEventArgs) {
  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
    await (supabase.rpc as any)("log_security_event", {
      _event_type: args.eventType,
      _severity: args.severity,
      _summary: args.summary ?? null,
      _metadata: args.metadata ?? {},
      _actor_user_id: null,
      _actor_email: null,
      _ip: null,
      _user_agent: ua,
    });
  } catch (e) {
    console.warn("[logSecurityEvent] failed:", e);
  }
}

/** Track failed logins in localStorage and escalate. */
const FAILED_LOGIN_KEY = "sec.failedLogins";
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 min
const FAILED_LOGIN_THRESHOLD = 5;

export function recordFailedLogin(identifier: string, reason?: string) {
  try {
    const raw = localStorage.getItem(FAILED_LOGIN_KEY);
    const now = Date.now();
    const list: Array<{ id: string; at: number }> = raw ? JSON.parse(raw) : [];
    const pruned = list.filter((e) => now - e.at < FAILED_LOGIN_WINDOW_MS);
    pruned.push({ id: identifier, at: now });
    localStorage.setItem(FAILED_LOGIN_KEY, JSON.stringify(pruned));

    const sameId = pruned.filter((e) => e.id === identifier);
    if (sameId.length === FAILED_LOGIN_THRESHOLD) {
      void logSecurityEvent({
        eventType: "auth_repeated_failed_login",
        severity: "medium",
        summary: `${FAILED_LOGIN_THRESHOLD} failed login attempts for ${identifier} within 15 minutes`,
        metadata: { identifier, reason, attempts: sameId.length },
      });
    } else if (sameId.length > FAILED_LOGIN_THRESHOLD) {
      void logSecurityEvent({
        eventType: "auth_failed_login",
        severity: "medium",
        summary: `Failed login for ${identifier} (${sameId.length} attempts)`,
        metadata: { identifier, reason, attempts: sameId.length },
      });
    }
  } catch {
    // ignore
  }
}

export function clearFailedLogins(identifier?: string) {
  try {
    if (!identifier) return localStorage.removeItem(FAILED_LOGIN_KEY);
    const raw = localStorage.getItem(FAILED_LOGIN_KEY);
    if (!raw) return;
    const list: Array<{ id: string; at: number }> = JSON.parse(raw);
    localStorage.setItem(
      FAILED_LOGIN_KEY,
      JSON.stringify(list.filter((e) => e.id !== identifier)),
    );
  } catch {
    // ignore
  }
}
