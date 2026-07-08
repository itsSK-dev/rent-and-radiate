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
  name: "list_my_rentals",
  title: "List my rentals & orders",
  description:
    "List the signed-in user's rentals and purchase orders on Rent & Radiate, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20),
    status: z
      .string()
      .optional()
      .describe("Optional rental status filter, e.g. pending, confirmed, shipped, delivered, returned."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = supabaseForUser(ctx)
      .from("rentals")
      .select(
        "id,kind,status,payment_status,grand_total,start_date,end_date,created_at,product_id,quantity",
      )
      .eq("customer_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status as any);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { rentals: data ?? [] },
    };
  },
});
