import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "search_products",
  title: "Search products",
  description:
    "Search the Rent & Radiate catalog for dresses or jewellery available to rent or buy. Filter by keywords, category, and max price.",
  inputSchema: {
    query: z.string().trim().max(120).optional().describe("Keywords to match in product title."),
    category: z.enum(["dress", "jewellery", "all"]).default("all"),
    purpose: z.enum(["rent", "buy", "all"]).default("all"),
    max_price: z.number().positive().optional().describe("Max selling price (INR)."),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, category, purpose, max_price, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = supabaseForUser(ctx)
      .from("products")
      .select("id,title,category,purpose,price_per_day,actual_price,security_deposit,images,available")
      .eq("available", true)
      .limit(limit);
    if (query) q = q.ilike("title", `%${query}%`);
    if (category !== "all") q = q.eq("category", category);
    if (purpose !== "all") q = q.in("purpose", [purpose, "both"]);
    if (max_price) q = q.lte("actual_price", max_price);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
