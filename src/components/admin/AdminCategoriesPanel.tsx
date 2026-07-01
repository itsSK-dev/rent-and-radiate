import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { getCategoryIcon, type CategoryConfig } from "@/hooks/useCategories";
import { Loader2 } from "lucide-react";

/**
 * Data-driven category control. Flipping "Active" here immediately updates
 * the customer homepage, browse filter, and vendor product form — no code
 * or build required. Every planned category is pre-seeded, so this list
 * is the entire scalability surface for the catalog.
 */
export function AdminCategoriesPanel() {
  const [rows, setRows] = useState<CategoryConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      toast.error(error.message);
    } else {
      setRows((data ?? []) as CategoryConfig[]);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggle(slug: string, next: boolean) {
    setBusy(slug);
    const { error } = await supabase
      .from("product_categories")
      .update({ is_active: next, launched_at: next ? new Date().toISOString() : null })
      .eq("slug", slug);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`${slug} ${next ? "activated" : "hidden"}`);
    load();
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl">Categories</h2>
          <p className="text-sm text-muted-foreground">
            Toggle a category to show it on the storefront. All planned categories are already
            supported by the database; activation is instant and reversible.
          </p>
        </div>
        <Badge variant="secondary">{rows.filter(r => r.is_active).length} / {rows.length} active</Badge>
      </div>
      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => {
            const Icon = getCategoryIcon(r.icon_name);
            return (
              <div key={r.slug} className="flex items-center gap-3 rounded-lg border p-3">
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${r.gradient} text-white shadow ring-1 ring-white/30`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{r.label}</p>
                    <code className="text-[10px] text-muted-foreground">{r.slug}</code>
                  </div>
                  {r.description && <p className="text-xs text-muted-foreground truncate">{r.description}</p>}
                </div>
                <Switch
                  checked={r.is_active}
                  disabled={busy === r.slug}
                  onCheckedChange={(v) => toggle(r.slug, v)}
                  aria-label={`Toggle ${r.label}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
