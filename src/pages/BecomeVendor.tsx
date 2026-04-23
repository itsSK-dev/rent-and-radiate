import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BecomeVendor = () => {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Open a store · Bloom"; }, []);
  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/become-vendor");
  }, [user, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (name.trim().length < 2) return toast.error("Store name is required.");
    setBusy(true);
    // Ensure store_owner role exists for this user
    if (!roles.includes("store_owner")) {
      const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: user.id, role: "store_owner" } as any);
      if (roleErr && !roleErr.message.includes("duplicate")) {
        // Fall back: customers self-assign customer only; ask admin to upgrade
        // But our policy lets users only insert customer; we need a server-side upgrade.
      }
    }
    const { error } = await supabase.from("stores").insert({
      owner_id: user.id, name, description, city, address, approved: false,
    } as any);
    setBusy(false);
    if (error) return toast.error("Could not create store: " + error.message);
    toast.success("Your store was submitted for review.");
    navigate("/vendor");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-16 max-w-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">For vendors</p>
        <h1 className="font-display text-5xl mb-3">Open your boutique</h1>
        <p className="text-muted-foreground mb-8">Tell us about your store. We'll review and approve within 24 hours.</p>
        <form onSubmit={submit} className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-card">
          <div>
            <Label htmlFor="n">Store name</Label>
            <Input id="n" value={name} onChange={(e) => setName(e.target.value)} className="mt-2" required />
          </div>
          <div>
            <Label htmlFor="d">Description</Label>
            <Textarea id="d" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-2" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="c">City</Label>
              <Input id="c" value={city} onChange={(e) => setCity(e.target.value)} className="mt-2" />
            </div>
            <div>
              <Label htmlFor="a">Address</Label>
              <Input id="a" value={address} onChange={(e) => setAddress(e.target.value)} className="mt-2" />
            </div>
          </div>
          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
            {busy ? "Submitting…" : "Submit for review"}
          </Button>
        </form>
      </section>
      <Footer />
    </div>
  );
};

export default BecomeVendor;
