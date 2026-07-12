// Customer generates a 6-digit OTP for their delivery or return handoff.
// Plaintext code is returned only to the customer; only the SHA-256 hash is stored.
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
  if (!/^[0-9a-f-]{36}$/i.test(rentalId)) return j({ error: "Invalid rental id" }, 400);
  if (kind !== "delivery" && kind !== "return") return j({ error: "Invalid kind" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rental } = await admin.from("rentals").select("id, customer_id").eq("id", rentalId).maybeSingle();
  if (!rental) return j({ error: "Rental not found" }, 404);
  if (rental.customer_id !== userId) return j({ error: "Not authorized" }, 403);

  // Generate 6-digit code
  const arr = new Uint32Array(1); crypto.getRandomValues(arr);
  const code = String(100000 + (arr[0] % 900000));
  const codeHash = await sha256Hex(code);
  const expires = new Date(Date.now() + 30 * 60_000).toISOString(); // 30 min

  // Invalidate previous unused OTPs of same kind
  await admin.from("delivery_otps").update({ verified_at: new Date().toISOString() })
    .eq("rental_id", rentalId).eq("kind", kind).is("verified_at", null);

  const { error } = await admin.from("delivery_otps").insert({
    rental_id: rentalId, kind, code_hash: codeHash, expires_at: expires,
  });
  if (error) return j({ error: error.message }, 500);

  return j({ ok: true, code, expiresAt: expires });
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
