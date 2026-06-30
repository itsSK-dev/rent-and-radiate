import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, ShieldCheck, Sparkles } from "lucide-react";

const storeSchema = z.object({
  name: z.string().trim().min(2, "Store name must be at least 2 characters").max(80),
  description: z.string().trim().max(500).optional(),
  city: z.string().trim().max(80).optional(),
  address: z.string().trim().max(200).optional(),
});

const BecomeVendor = () => {
  const { user, roles, loading, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [existingStore, setExistingStore] = useState<{ id: string; name: string; status: string; is_verified: boolean; is_active: boolean; is_blocked: boolean } | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    document.title = "Open a store · Rent & Radiate";
  }, []);

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo must be under 2MB");
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }


  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/become-vendor");
  }, [user, loading, navigate]);

  // If the vendor already has a store, send them to the right place.
  useEffect(() => {
    if (!user) return;
    (async () => {
      setChecking(true);
      const { data } = await supabase
        .from("stores")
        .select("id,name,status,is_verified,is_active,is_blocked")
        .eq("owner_id", user.id)
        .maybeSingle();
      setExistingStore(data ?? null);
      setChecking(false);
    })();
  }, [user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const parsed = storeSchema.safeParse({ name, description, city, address });
    if (!parsed.success) {
      return toast.error(parsed.error.issues[0].message);
    }

    setBusy(true);

    let logo_url: string | null = null;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("store-logos")
        .upload(path, logoFile, { cacheControl: "3600", upsert: false, contentType: logoFile.type });
      if (upErr) {
        setBusy(false);
        return toast.error("Logo upload failed: " + upErr.message);
      }
      logo_url = supabase.storage.from("store-logos").getPublicUrl(path).data.publicUrl;
    }

    // Submit the store as pending. The store_owner role is granted automatically
    // by the backend only after an admin approves the store — users cannot
    // self-assign the role.
    const { data: created, error } = await supabase
      .from("stores")
      .insert({
        owner_id: user.id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        city: parsed.data.city || null,
        address: parsed.data.address || null,
        logo_url,
        approved: false,
      })
      .select("id,name,status,is_verified,is_active,is_blocked")
      .maybeSingle();

    setBusy(false);
    if (error) return toast.error("Could not submit store: " + error.message);

    toast.success("Submitted! We'll review your store within 24 hours.");
    setExistingStore(created ?? null);
  }


  if (checking || loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="container py-20 text-muted-foreground">Loading…</div>
        <Footer />
      </div>
    );
  }

  // Already submitted — show status panel instead of the form.
  if (existingStore) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <section className="container py-16 max-w-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">For vendors</p>
          <h1 className="font-display text-5xl mb-3">{existingStore.name}</h1>

          {existingStore.status === "approved" && existingStore.is_verified && existingStore.is_active && !existingStore.is_blocked ? (
            <div className="rounded-3xl bg-gradient-blossom p-8 mt-6 shadow-card">
              <ShieldCheck className="h-8 w-8 text-rose-deep mb-3" />
              <h2 className="font-display text-3xl mb-2">You're approved ✨</h2>
              <p className="text-muted-foreground mb-6">
                Your boutique is live. Start adding pieces customers can rent.
              </p>
              <Button variant="hero" onClick={() => navigate("/vendor")}>
                Go to vendor dashboard
              </Button>
            </div>
          ) : (
            <div className="rounded-3xl border border-border bg-card p-8 mt-6 shadow-card">
              <Clock className="h-8 w-8 text-primary mb-3" />
              <h2 className="font-display text-3xl mb-2">Awaiting review</h2>
              <p className="text-muted-foreground mb-2">
                Thanks for submitting <strong className="text-foreground">{existingStore.name}</strong>.
                Our team typically reviews new boutiques within 24 hours.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                You'll be able to add products and accept rentals as soon as your store is approved.
              </p>
              <div className="flex gap-3">
                <Button variant="soft" onClick={() => navigate("/vendor")}>
                  View pending dashboard
                </Button>
                <Button variant="ghost" onClick={() => navigate("/")}>
                  Back to home
                </Button>
              </div>
            </div>
          )}
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-16 max-w-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">For vendors</p>
        <h1 className="font-display text-5xl mb-3">Open your boutique</h1>
        <p className="text-muted-foreground mb-8">
          Tell us about your store. We'll review and approve within 24 hours — then you can list pieces and accept rentals.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <Perk icon={<Sparkles className="h-4 w-4" />} title="Curated" desc="Be part of a hand-picked marketplace." />
          <Perk icon={<ShieldCheck className="h-4 w-4" />} title="Protected" desc="Refundable deposits on every rental." />
          <Perk icon={<Clock className="h-4 w-4" />} title="24h review" desc="Quick approval by our team." />
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-card">
          <div>
            <Label htmlFor="n">Store name</Label>
            <Input
              id="n"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="mt-2"
              placeholder="e.g. Rosé Atelier"
              required
            />
          </div>
          <div>
            <Label htmlFor="d">Description</Label>
            <Textarea
              id="d"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className="mt-2"
              rows={3}
              placeholder="What makes your boutique special? Specialties, signature styles…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="c">City</Label>
              <Input id="c" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} className="mt-2" placeholder="Mumbai" />
            </div>
            <div>
              <Label htmlFor="a">Address</Label>
              <Input id="a" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} className="mt-2" placeholder="Bandra West" />
            </div>
          </div>
          <div>
            <Label htmlFor="logo">Shop logo</Label>
            <div className="mt-2 flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-secondary border border-border overflow-hidden flex items-center justify-center text-xs text-muted-foreground shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" />
                ) : (
                  "Logo"
                )}
              </div>
              <Input id="logo" type="file" accept="image/*" onChange={onLogoChange} className="cursor-pointer" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">PNG or JPG, up to 2MB. Optional.</p>
          </div>

          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
            {busy ? "Submitting…" : "Submit for review"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Your store stays hidden from customers until an admin approves it.
          </p>
        </form>
      </section>
      <Footer />
    </div>
  );
};

function Perk({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl bg-secondary p-3">
      <div className="h-7 w-7 rounded-full bg-primary-soft text-primary flex items-center justify-center mb-2">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

export default BecomeVendor;
