// AI natural-language search: parses a user query into Browse filters.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";


const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { query } = await req.json();
    if (typeof query !== "string" || !query.trim()) {
      return new Response(JSON.stringify({ error: "query required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = `You translate fashion shopping queries into JSON filters for a rent-or-buy marketplace.
Available categories: "dress", "jewellery". Available purposes: "rent" (rent only), "buy" (buy only), "all".
Return ONLY a compact JSON object with keys: q (string, free-text keywords to match against title), category ("dress"|"jewellery"|"all"), purpose ("rent"|"buy"|"all"), sort ("newest"|"price_asc"|"price_desc"), max_price (number or null).
Infer purpose from words like "rent/rental/borrow" => rent, "buy/purchase/own" => buy.
If unsure use "all". Keep q short (the descriptive words, no price/category/rent words).`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: query },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return new Response(JSON.stringify({ error: "AI gateway error", status: res.status, detail: text }), {
        status: res.status === 429 || res.status === 402 ? res.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    const cleaned = {
      q: typeof parsed.q === "string" ? parsed.q.slice(0, 100) : "",
      category: ["dress", "jewellery", "all"].includes(parsed.category) ? parsed.category : "all",
      purpose: ["rent", "buy", "all"].includes(parsed.purpose) ? parsed.purpose : "all",
      sort: ["newest", "price_asc", "price_desc"].includes(parsed.sort) ? parsed.sort : "newest",
      max_price: typeof parsed.max_price === "number" ? parsed.max_price : null,
    };

    return new Response(JSON.stringify(cleaned), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
