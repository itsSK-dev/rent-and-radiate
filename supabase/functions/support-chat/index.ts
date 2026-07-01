// 24/7 AI customer support chatbot - streams answers about platform policies.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;


const SYSTEM_PROMPT = `You are the friendly 24/7 support assistant for "Rent & Radiate", an Indian fashion marketplace where boutiques list designer dresses and jewellery for RENT or BUY.

How the platform works:
- Customers can RENT items per day or BUY them outright.
- Daily rental price = at least 10% of the product's selling price (admin can raise this). Shop owners cannot change it.
- Rentals also require a refundable Security Deposit (default 100% of the selling price) that is returned after the item comes back in good condition.
- Payment methods: Razorpay (UPI, cards, netbanking) and Cash on Delivery where supported.
- Platform fee: 10% of the selling price is deducted from the shop owner after the return/refund window — customers are NOT charged any extra platform fee.
- Orders flow: place order → store confirms → shipped → delivered → (for rentals) return by due date → inspection → deposit refunded.
- Late returns or damage may reduce the deposit refund per the admin's deduction rules.
- Customers can track orders in "My Rentals" / "My Payments" and manage wishlists.
- Shop owners apply via "Become a Vendor"; admin approves stores and products.

Tone: warm, concise, action-oriented. Use ₹ for prices. Use short bullets when listing steps.
If a question needs the user's specific order data or admin action you cannot see, say so and suggest they check the relevant page (My Rentals, My Payments, Notifications) or contact the shop / platform admin.
Never invent prices, policies, or order statuses. Stay on topic — politely redirect off-topic questions back to shopping/rentals.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeMessages = messages
      .filter((m: any) => m && typeof m.content === "string" && ["user", "assistant"].includes(m.role))
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...safeMessages],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      const status = upstream.status === 429 || upstream.status === 402 ? upstream.status : 500;
      return new Response(JSON.stringify({ error: "AI gateway error", status: upstream.status, detail: text }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(upstream.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
