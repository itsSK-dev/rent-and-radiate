// AI visual search: analyzes an uploaded image and returns Browse filters.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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
    const { image } = await req.json();
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return new Response(JSON.stringify({ error: "image (data URL) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = `You are a fashion visual-search assistant for a rent-or-buy marketplace.
Available categories: "dress", "jewellery".
Look at the image and return ONLY a compact JSON object with keys:
  q (string: 2-6 descriptive keywords for the garment/item — colour + style + silhouette, no brand names),
  category ("dress" | "jewellery" | "all"),
  purpose ("all"),
  sort ("newest"),
  description (string: one short sentence describing what you see).
Keep q short and matchable against product titles.`;

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
          {
            role: "user",
            content: [
              { type: "text", text: "Find products that visually match this image." },
              { type: "image_url", image_url: { url: image } },
            ],
          },
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
      q: typeof parsed.q === "string" ? parsed.q.slice(0, 120) : "",
      category: ["dress", "jewellery", "all"].includes(parsed.category) ? parsed.category : "all",
      purpose: "all",
      sort: "newest",
      description: typeof parsed.description === "string" ? parsed.description.slice(0, 200) : "",
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
