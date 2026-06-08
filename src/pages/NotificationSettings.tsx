import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Prefs = {
  new_products: boolean;
  discounts_offers: boolean;
  order_updates: boolean;
  rental_updates: boolean;
  promotional: boolean;
};

const ROWS: { key: keyof Prefs; label: string; desc: string }[] = [
  { key: "new_products", label: "New Product Notifications", desc: "When stores add new items you might love." },
  { key: "discounts_offers", label: "Discounts & Offers", desc: "Flash sales, coupons and seasonal discounts." },
  { key: "order_updates", label: "Order Updates", desc: "Order confirmed, shipped, delivered, returned." },
  { key: "rental_updates", label: "Rental Updates", desc: "Rental approved, pickup scheduled, return due." },
  { key: "promotional", label: "Promotional Notifications", desc: "Admin announcements and campaigns." },
];

export default function NotificationSettings() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.title = "Notification settings · Rent & Radiate"; }, []);
  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/settings/notifications");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setPrefs(data as Prefs);
      } else {
        const defaults: Prefs = {
          new_products: true, discounts_offers: true, order_updates: true,
          rental_updates: true, promotional: true,
        };
        await supabase.from("notification_preferences").insert({ user_id: user.id, ...defaults });
        setPrefs(defaults);
      }
    })();
  }, [user]);

  async function update(key: keyof Prefs, value: boolean) {
    if (!user || !prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(true);
    const patch = { [key]: value } as never;
    const { error } = await supabase
      .from("notification_preferences").update(patch).eq("user_id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container max-w-2xl py-10">
        <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Preferences</p>
        <h1 className="font-display text-4xl mb-2">Notification settings</h1>
        <p className="text-sm text-muted-foreground mb-8">Choose what you'd like to hear about.</p>

        {!prefs ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <ul className="rounded-2xl border bg-card divide-y">
            {ROWS.map((r) => (
              <li key={r.key} className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="font-medium">{r.label}</p>
                  <p className="text-sm text-muted-foreground">{r.desc}</p>
                </div>
                <Switch
                  checked={prefs[r.key]}
                  onCheckedChange={(v) => update(r.key, v)}
                  disabled={saving}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 flex justify-end">
          <Button variant="outline" onClick={() => navigate("/notifications")}>View notifications</Button>
        </div>
      </section>
      <Footer />
    </div>
  );
}
