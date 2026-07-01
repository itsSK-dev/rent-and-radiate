import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload } from "lucide-react";

type Props = { storeId: string; onSaved?: () => void };

export function VendorStoreProfileForm({ storeId, onSaved }: Props) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("stores")
        .select("name,city,address,logo_url")
        .eq("id", storeId)
        .maybeSingle();
      if (data) {
        setName(data.name ?? "");
        setCity(data.city ?? "");
        setAddress(data.address ?? "");
        setLogoUrl(data.logo_url ?? null);
      }
      setLoading(false);
    })();
  }, [storeId]);

  async function uploadLogo(): Promise<string | null> {
    if (!file) return logoUrl;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return logoUrl;
    const path = `${uid}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("store-logos").upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from("store-logos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Store name is required.");
    setBusy(true);
    try {
      const newLogo = await uploadLogo();
      const { error } = await supabase
        .from("stores")
        .update({
          name: name.trim(),
          city: city.trim() || null,
          address: address.trim() || null,
          logo_url: newLogo,
        })
        .eq("id", storeId);
      if (error) throw new Error(error.message);
      setLogoUrl(newLogo);
      setFile(null);
      toast.success("Store profile updated");
      onSaved?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-5 max-w-2xl">
      <div>
        <Label>Store name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required className="mt-1" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>City</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} className="mt-1" />
        </div>
        <div>
          <Label>Shop logo</Label>
          <label className="mt-1 flex items-center gap-2 rounded-xl border border-dashed border-border bg-background p-3 cursor-pointer hover:border-primary transition-smooth">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground truncate">
              {file ? file.name : logoUrl ? "Replace logo" : "Upload logo"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </div>
      <div>
        <Label>Address</Label>
        <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} maxLength={500} className="mt-1" />
      </div>
      {logoUrl && (
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="Current logo" className="h-16 w-16 rounded-lg object-cover border border-border" />
          <span className="text-xs text-muted-foreground">Current logo</span>
        </div>
      )}
      <Button type="submit" variant="hero" disabled={busy}>
        {busy ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
