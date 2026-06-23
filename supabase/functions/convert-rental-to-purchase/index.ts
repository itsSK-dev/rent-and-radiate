// Convert a completed rental into a purchase order, applying the rent-to-own
// credit from this customer's past rentals of the same product.
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
  const sourceId = String(body?.rentalId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(sourceId)) return j({ error: "Invalid rentalId" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: settings } = await admin
    .from("platform_settings")
    .select("rent_to_own_enabled, rent_to_own_credit_percent, gst_percent")
    .eq("id", true).maybeSingle();
  if (!settings?.rent_to_own_enabled) return j({ error: "Rent-to-own is disabled on this platform." }, 400);

  const { data: source, error: srcErr } = await admin
    .from("rentals")
    .select("id, customer_id, product_id, store_id, status, kind, converted_to_purchase_rental_id")
    .eq("id", sourceId).maybeSingle();
  if (srcErr || !source) return j({ error: "Rental not found" }, 404);
  if (source.customer_id !== userId) return j({ error: "Not your rental" }, 403);
  if (source.kind === "buy") return j({ error: "Already a purchase" }, 400);
  if (!["delivered", "returned"].includes(source.status)) return j({ error: "Rental must be completed first." }, 400);
  if (source.converted_to_purchase_rental_id) return j({ error: "Already converted." }, 400);

  const { data: product } = await admin
    .from("products")
    .select("id, store_id, rent_to_own_enabled, actual_price, discount_percent, discount_flat, quantity")
    .eq("id", source.product_id).maybeSingle();
  if (!product) return j({ error: "Product missing" }, 404);
  if (!product.rent_to_own_enabled) return j({ error: "This product is not enrolled in rent-to-own." }, 400);
  if (!product.quantity || product.quantity < 1) return j({ error: "Out of stock" }, 409);

  // Past rental spend by this customer on this product (delivered or returned)
  const { data: past } = await admin
    .from("rentals")
    .select("rental_total")
    .eq("customer_id", userId)
    .eq("product_id", product.id)
    .neq("kind", "buy")
    .in("status", ["delivered", "returned"]);
  const pastSpend = (past ?? []).reduce((s: number, r: any) => s + Number(r.rental_total || 0), 0);

  const pct = Math.max(0, Math.min(100, Number(product.discount_percent || 0)));
  const flat = Math.max(0, Number(product.discount_flat || 0));
  const basePrice = Math.max(0, Math.round(((Number(product.actual_price) || 0) - (Number(product.actual_price) || 0) * pct / 100 - flat) * 100) / 100);
  const credit = Math.min(basePrice, Math.round(pastSpend * Number(settings.rent_to_own_credit_percent ?? 50) / 100 * 100) / 100);
  const subtotal = Math.max(0, Math.round((basePrice - credit) * 100) / 100);
  const gst = Math.round((subtotal * Number(settings.gst_percent ?? 18) / 100) * 100) / 100;
  const grand = Math.round((subtotal + gst) * 100) / 100;

  // Insert the buy order. We bypass the rentals price-compute guard by using
  // the service role; admins/service can set their own values.
  const { data: created, error: insErr } = await admin
    .from("rentals")
    .insert({
      customer_id: userId,
      product_id: product.id,
      store_id: product.store_id,
      kind: "buy",
      quantity: 1,
      rental_total: 0,
      deposit: 0,
      subtotal,
      discount_amount: credit,
      gst_amount: gst,
      delivery_fee: 0,
      commission_amount: Math.round(subtotal * 10) / 100,
      grand_total: grand,
      delivery_method: "pickup",
      payment_status: "unpaid",
      status: "pending",
      converted_to_purchase_rental_id: sourceId,
      rent_to_own_credit: credit,
    })
    .select("id")
    .single();

  if (insErr || !created) return j({ error: insErr?.message ?? "Could not create purchase order" }, 500);

  // Link source rental so we don't allow double-conversion
  await admin.from("rentals").update({ converted_to_purchase_rental_id: created.id } as any).eq("id", sourceId);

  await admin.rpc("create_notification", {
    _user_id: userId,
    _type: "order_update",
    _title: "✨ Buy-out order created",
    _body: `You earned ₹${credit.toLocaleString("en-IN")} rental credit. Complete payment to own this item.`,
    _link_url: `/checkout/${created.id}`,
    _image_url: null,
    _metadata: { rental_id: created.id, source_rental_id: sourceId, credit },
  });

  return j({ ok: true, rentalId: created.id, credit, basePrice, grand });
});

function j(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
