// Delivery partner requests an OTP for the order they are delivering / picking up.
// The code is generated server-side, SMS'd to the customer via Twilio, and NEVER returned to the partner.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OTP_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_SENDS_PER_HOUR = 5;

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;           // Indian mobile
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

function mask(p: string) {
  return `${p.slice(0, 3)}${"•".repeat(Math.max(0, p.length - 5))}${p.slice(-2)}`;
}

/** Returns { ok, error } — never throws. */
async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const twilioKey = Deno.env.get("TWILIO_API_KEY");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  if (!lovableKey || !twilioKey) return { ok: false, error: "SMS provider not configured" };
  if (!from) return { ok: false, error: "TWILIO_FROM_NUMBER is not configured" };

  try {
    const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[otp] Twilio send failed [${res.status}]: ${text}`);
      return { ok: false, error: `SMS provider error ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[otp] Twilio request threw:", e);
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return j({ error: "Not authenticated" }, 401);

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: ures } = await userClient.auth.getUser();
  const userId = ures?.user?.id;
  if (!userId) return j({ error: "Not authenticated" }, 401);

  const body = await req.json().catch(() => ({}));
  const rentalId = String(body?.rentalId ?? "");
  const kind = String(body?.kind ?? "delivery");
  if (!/^[0-9a-f-]{36}$/i.test(rentalId)) return j({ error: "Invalid rental id" }, 400);
  if (kind !== "delivery" && kind !== "return") return j({ error: "Invalid kind" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Caller must be the approved partner assigned to this rental.
  const { data: dp } = await admin.from("delivery_partners").select("id, status").eq("user_id", userId).maybeSingle();
  if (!dp || dp.status !== "approved") return j({ error: "Not an approved delivery partner" }, 403);

  const { data: assignment } = await admin.from("delivery_assignments")
    .select("id, status").eq("rental_id", rentalId).eq("partner_id", dp.id).maybeSingle();
  if (!assignment) return j({ error: "You are not assigned to this order" }, 403);
  const allowed = kind === "delivery"
    ? ["picked_up", "out_for_delivery"]
    : ["return_scheduled", "accepted", "picked_up"];
  if (!allowed.includes(assignment.status)) {
    return j({ error: `Cannot send an OTP while the delivery is "${assignment.status}"` }, 400);
  }

  const { data: rental } = await admin.from("rentals")
    .select("id, customer_id, ship_mobile, ship_full_name").eq("id", rentalId).maybeSingle();
  if (!rental) return j({ error: "Order not found" }, 404);

  // Rate limiting / cooldown on the latest OTP for this order+kind.
  const { data: recent } = await admin.from("delivery_otps")
    .select("id, last_sent_at, created_at")
    .eq("rental_id", rentalId).eq("kind", kind)
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString())
    .order("created_at", { ascending: false });
  const latest = recent?.[0];
  if (latest) {
    const since = Date.now() - new Date(latest.last_sent_at ?? latest.created_at).getTime();
    if (since < RESEND_COOLDOWN_MS) {
      return j({ error: "Please wait before requesting another OTP", retryAfter: Math.ceil((RESEND_COOLDOWN_MS - since) / 1000) }, 429);
    }
  }
  if ((recent?.length ?? 0) >= MAX_SENDS_PER_HOUR) {
    return j({ error: "Too many OTP requests for this order. Try again later." }, 429);
  }

  // Resolve the customer phone number.
  let phone = normalizePhone(rental.ship_mobile);
  if (!phone) {
    const { data: prof } = await admin.from("profiles").select("phone, addr_mobile").eq("id", rental.customer_id).maybeSingle();
    phone = normalizePhone(prof?.phone) ?? normalizePhone(prof?.addr_mobile);
  }

  // Generate the code.
  const arr = new Uint32Array(1); crypto.getRandomValues(arr);
  const code = String(100000 + (arr[0] % 900000));
  const expires = new Date(Date.now() + OTP_TTL_MS).toISOString();

  let channel = "sms";
  let sendError: string | null = null;
  if (!phone) {
    channel = "in_app";
    sendError = "No valid phone number on this order";
  } else {
    const label = kind === "delivery" ? "delivery" : "return pickup";
    const sms = await sendSms(
      phone,
      `Your Rent & Radiate ${label} verification OTP is ${code}. Valid for 10 minutes. Do not share this OTP with anyone except the delivery partner.`,
    );
    if (!sms.ok) { channel = "in_app"; sendError = sms.error ?? "SMS failed"; }
  }

  // Invalidate any previous unused OTPs of this kind.
  await admin.from("delivery_otps").update({ verified_at: new Date().toISOString() })
    .eq("rental_id", rentalId).eq("kind", kind).is("verified_at", null);

  const { error: insErr } = await admin.from("delivery_otps").insert({
    rental_id: rentalId,
    customer_id: rental.customer_id,
    kind,
    code_hash: await sha256Hex(code),
    code_plain: channel === "in_app" ? code : null,
    expires_at: expires,
    last_sent_at: new Date().toISOString(),
    sent_channel: channel,
    send_error: sendError,
  });
  if (insErr) { console.error("[otp] insert failed:", insErr.message); return j({ error: insErr.message }, 500); }

  // Tell the customer (never contains the code).
  try {
    await admin.rpc("create_notification", {
      _user_id: rental.customer_id,
      _type: "delivery_update",
      _title: channel === "sms" ? "Delivery OTP sent" : "Delivery verification code ready",
      _body: channel === "sms"
        ? "We texted a 6-digit code to your registered mobile. Share it with your delivery partner."
        : "Open My Rentals to see the 6-digit code and share it with your delivery partner.",
      _link_url: "/my-rentals",
      _image_url: null,
      _metadata: { rental_id: rentalId, kind },
    });
  } catch (e) { console.error("[otp] notification failed:", e); }

  return j({
    ok: true,
    channel,
    maskedPhone: phone ? mask(phone) : null,
    expiresAt: expires,
    cooldownSeconds: RESEND_COOLDOWN_MS / 1000,
    warning: sendError,
  });
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
