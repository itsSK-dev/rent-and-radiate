// Edge function: returns the current email-sending readiness for the project.
// It checks whether email infrastructure tables exist and whether a domain is verified.
// This intentionally runs publicly (no JWT) so the admin panel can poll it; data returned
// is non-sensitive (status booleans + domain string).

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

type Readiness = {
  domain: string | null;
  domainStatus: "active" | "awaiting_dns" | "provisioning" | "failed" | "not_configured" | "unknown";
  infrastructureReady: boolean;
  canSend: boolean;
  checkedAt: string;
  notes: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Require authenticated admin caller — readiness data is admin-only.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: userData.user.id, _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const notes: string[] = [];

  // 1. Check whether email infrastructure tables exist (proxy: try to read email_send_log)
  let infrastructureReady = false;
  const { error: logErr } = await admin.from("email_send_log").select("id").limit(1);
  if (!logErr) {
    infrastructureReady = true;
  } else if (logErr.code === "42P01" || /does not exist/i.test(logErr.message)) {
    notes.push("Email infrastructure tables haven't been provisioned yet.");
  } else {
    notes.push(`Could not read email_send_log: ${logErr.message}`);
  }

  // 2. Check email domain config table (created with email infra). We don't know the
  //    exact schema across all projects, so try a couple of common names.
  let domain: string | null = null;
  let domainStatus: Readiness["domainStatus"] = "not_configured";

  const candidates = ["email_domains", "email_config"];
  for (const table of candidates) {
    const { data, error } = await admin.from(table).select("*").limit(1);
    if (!error && Array.isArray(data) && data.length > 0) {
      const row = data[0] as Record<string, unknown>;
      domain = (row.domain as string) || (row.sender_domain as string) || null;
      const status = ((row.status as string) || (row.verification_status as string) || "").toLowerCase();
      if (status.includes("active") || status.includes("verified")) domainStatus = "active";
      else if (status.includes("awaiting")) domainStatus = "awaiting_dns";
      else if (status.includes("provision")) domainStatus = "provisioning";
      else if (status.includes("fail")) domainStatus = "failed";
      else domainStatus = "unknown";
      break;
    }
  }

  if (!domain) notes.push("No verified sender domain found yet. Add one from Cloud → Emails.");

  const canSend = infrastructureReady && domainStatus === "active" && !!domain;

  const body: Readiness = {
    domain,
    domainStatus,
    infrastructureReady,
    canSend,
    checkedAt: new Date().toISOString(),
    notes,
  };

  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
