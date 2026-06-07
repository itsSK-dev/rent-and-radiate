import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_EMAIL = "partnerships@rentandradiate.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { request_id, event } = await req.json();
    if (!request_id) {
      return new Response(JSON.stringify({ error: "request_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: r, error } = await supabase
      .from("advertisement_requests")
      .select("*")
      .eq("id", request_id)
      .maybeSingle();
    if (error || !r) {
      return new Response(JSON.stringify({ error: error?.message ?? "not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject =
      event === "submitted"
        ? `New advertisement request: ${r.company_name}`
        : `Advertisement update — ${r.company_name} (${r.status})`;

    const html = `
      <h2>${subject}</h2>
      <p><strong>Brand:</strong> ${r.company_name}</p>
      <p><strong>Contact:</strong> ${r.contact_person} — ${r.email} / ${r.mobile}</p>
      <p><strong>Type:</strong> ${r.ad_type}</p>
      <p><strong>Duration:</strong> ${r.duration_days} days</p>
      <p><strong>Budget:</strong> ₹${Number(r.budget).toLocaleString("en-IN")}</p>
      <p><strong>Status:</strong> ${r.status} · <strong>Payment:</strong> ${r.payment_status}</p>
      ${r.description ? `<p><strong>Description:</strong><br/>${String(r.description).replace(/</g, "&lt;")}</p>` : ""}
      ${r.admin_notes ? `<p><strong>Admin notes:</strong><br/>${String(r.admin_notes).replace(/</g, "&lt;")}</p>` : ""}
    `;

    // Notify admin partnerships inbox
    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "ad-request-admin-notification",
        recipientEmail: ADMIN_EMAIL,
        idempotencyKey: `ad-${request_id}-${event}-admin`,
        templateData: { subject, html, brand: r.company_name },
      },
    }).catch(() => null);

    // Notify advertiser on status changes
    if (event !== "submitted") {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "ad-request-status-update",
          recipientEmail: r.email,
          idempotencyKey: `ad-${request_id}-${event}-advertiser`,
          templateData: {
            brand: r.company_name,
            status: r.status,
            adminNotes: r.admin_notes ?? "",
          },
        },
      }).catch(() => null);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
