// Broadcasts a pickup-ready order to all approved+online partners in the shop's city.
// Called by the shop when marking an order "ready for pickup".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt) return j({ error: "Not authenticated" }, 401);

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: ures } = await userClient.auth.getUser();
  const userId = ures?.user?.id;
  if (!userId) return j({ error: "Not authenticated" }, 401);

  const body = await req.json().catch(() => ({}));
  const rentalId = String(body?.rentalId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(rentalId)) return j({ error: "Invalid rental id" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: rental } = await admin
    .from("rentals")
    .select("id, store_id, status, store:stores(owner_id, city)")
    .eq("id", rentalId)
    .maybeSingle();
  if (!rental) return j({ error: "Rental not found" }, 404);

  const store: any = rental.store;
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
  const isOwner = store?.owner_id === userId;
  if (!isAdmin && !isOwner) return j({ error: "Not authorized" }, 403);

  const city = store?.city ?? null;
  let query = admin.from("delivery_partners").select("id, city").eq("status", "approved").eq("is_online", true);
  if (city) query = query.ilike("city", city);
  const { data: partners } = await query;
  const partnerRows = partners ?? [];

  if (partnerRows.length === 0) {
    return j({ ok: true, broadcasted: 0, message: "No partners online in this city — admin will assign manually." });
  }

  const rows = partnerRows.map((p: any) => ({
    rental_id: rentalId,
    partner_id: p.id,
    status: "broadcast",
  }));
  const { error: insErr } = await admin.from("delivery_assignments").upsert(rows, { onConflict: "rental_id,partner_id", ignoreDuplicates: true });
  if (insErr) return j({ error: insErr.message }, 500);

  await admin.from("rentals").update({ status: "ready_for_pickup" }).eq("id", rentalId);

  return j({ ok: true, broadcasted: rows.length });
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
