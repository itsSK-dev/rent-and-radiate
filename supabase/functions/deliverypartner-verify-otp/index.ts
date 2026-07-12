// Delivery partner submits the 6-digit OTP the customer showed them.
// On success, advances the assignment + rental status accordingly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
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
  const code = String(body?.code ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(rentalId)) return j({ error: "Invalid rental id" }, 400);
  if (!/^\d{6}$/.test(code)) return j({ error: "OTP must be 6 digits" }, 400);
  if (kind !== "delivery" && kind !== "return") return j({ error: "Invalid kind" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Verify partner owns an active assignment for this rental
  const { data: dp } = await admin.from("delivery_partners").select("id, status").eq("user_id", userId).maybeSingle();
  if (!dp || dp.status !== "approved") return j({ error: "Not an approved delivery partner" }, 403);

  const { data: assignment } = await admin.from("delivery_assignments")
    .select("id, status").eq("rental_id", rentalId).eq("partner_id", dp.id).maybeSingle();
  if (!assignment) return j({ error: "You are not assigned to this rental" }, 403);

  const hash = await sha256Hex(code);
  const { data: otp } = await admin.from("delivery_otps")
    .select("id, expires_at, verified_at")
    .eq("rental_id", rentalId).eq("kind", kind).eq("code_hash", hash)
    .maybeSingle();
  if (!otp) return j({ error: "Incorrect OTP" }, 400);
  if (otp.verified_at) return j({ error: "OTP already used" }, 400);
  if (new Date(otp.expires_at).getTime() < Date.now()) return j({ error: "OTP expired — ask customer to regenerate" }, 400);

  await admin.from("delivery_otps").update({ verified_at: new Date().toISOString() }).eq("id", otp.id);

  const nextStatus = kind === "delivery" ? "delivered" : "return_picked_up";
  const { error: updErr } = await admin.from("delivery_assignments")
    .update({ status: nextStatus }).eq("id", assignment.id);
  if (updErr) return j({ error: updErr.message }, 500);

  return j({ ok: true, status: nextStatus });
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
