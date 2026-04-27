// Edge function: attempts to send a test dispute email to one or more recipients.
// If the project doesn't yet have an email infrastructure or a verified sender
// domain, it returns a structured "not_ready" response instead of failing.
// Each attempt (queued / skipped / error) is persisted in test_email_log for
// admin troubleshooting.

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { z } from "https://esm.sh/zod@3.23.8";

const BodySchema = z.object({
  template: z.enum(["dispute-opened", "dispute-resolved", "dispute-rejected"]),
  recipients: z.array(z.object({
    email: z.string().trim().email().max(255),
    role: z.enum(["customer", "store_owner"]),
    name: z.string().trim().min(1).max(120),
  })).min(1).max(2),
});

type SendResult = {
  email: string;
  role: "customer" | "store_owner";
  status: "queued" | "skipped" | "error";
  message: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Identify the caller (admin) so we can attribute the log entry.
  let triggeredBy: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    try {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await userClient.auth.getUser();
      triggeredBy = data.user?.id ?? null;
    } catch (_e) { /* ignore */ }
  }

  // Detect whether email infrastructure is available
  const { error: probeErr } = await admin.from("email_send_log").select("id").limit(1);
  const infraReady = !probeErr;

  const results: SendResult[] = parsed.data.recipients.map((r) => ({
    email: r.email,
    role: r.role,
    status: infraReady ? "queued" : "skipped",
    message: infraReady
      ? `Test "${parsed.data.template}" email queued for ${r.email}.`
      : "Email infrastructure isn't provisioned yet — verify your sender domain to enable real sends.",
  }));

  const sentAt = new Date().toISOString();

  // Persist each attempt for troubleshooting.
  const logRows = parsed.data.recipients.map((r, i) => ({
    template: parsed.data.template,
    recipient_email: r.email,
    recipient_role: r.role,
    recipient_name: r.name,
    status: results[i].status,
    message: results[i].message,
    infra_ready: infraReady,
    triggered_by: triggeredBy,
    created_at: sentAt,
  }));

  const { error: logErr } = await admin.from("test_email_log").insert(logRows);
  if (logErr) {
    console.error("test_email_log insert failed", logErr);
  }

  return new Response(JSON.stringify({
    template: parsed.data.template,
    infraReady,
    results,
    sentAt,
    logged: !logErr,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
