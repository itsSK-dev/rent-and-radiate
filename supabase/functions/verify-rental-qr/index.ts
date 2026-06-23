// Verify a rental QR token. Store owner scans/pastes the token; we confirm it
// matches a rental in their store and return rental info so they can proceed
// (the actual status change still happens via the existing rentals UPDATE path,
// which enforces photo gates).
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

  let body: any;
  try { body = await req.json(); } catch { return j({ error: "Invalid JSON" }, 400); }
  const token = String(body?.token ?? "").trim();
  if (!/^[0-9a-f-]{8,}$/i.test(token)) return j({ error: "Invalid token" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: rental, error } = await admin
    .from("rentals")
    .select("id, status, kind, customer_id, store_id, start_date, end_date, product:products(title), customer:profiles!rentals_customer_id_fkey(full_name), store:stores(owner_id, name)")
    .eq("qr_token", token).maybeSingle();

  if (error || !rental) return j({ error: "QR not found" }, 404);

  // Authorization: store owner of this rental OR an admin OR the customer themselves
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
  const isStore = (rental as any).store?.owner_id === userId;
  const isCustomer = (rental as any).customer_id === userId;
  if (!isAdmin && !isStore && !isCustomer) return j({ error: "Not authorized to verify this QR" }, 403);

  return j({
    ok: true,
    rental: {
      id: rental.id,
      status: rental.status,
      kind: rental.kind,
      start_date: rental.start_date,
      end_date: rental.end_date,
      product_title: (rental as any).product?.title ?? null,
      customer_name: (rental as any).customer?.full_name ?? null,
      store_name: (rental as any).store?.name ?? null,
    },
  });
});

function j(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
