import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { z } from "zod";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

const AD_TYPES = [
  { value: "banner", label: "Banner Ad" },
  { value: "featured_listing", label: "Featured Listing" },
  { value: "sponsored_product", label: "Sponsored Product" },
  { value: "homepage_promotion", label: "Homepage Promotion" },
  { value: "custom", label: "Custom Campaign" },
] as const;

const schema = z.object({
  company_name: z.string().trim().min(1, "Required").max(200),
  contact_person: z.string().trim().min(1, "Required").max(200),
  email: z.string().trim().email("Invalid email").max(255),
  mobile: z.string().trim().min(7, "Invalid mobile").max(20),
  website: z.string().trim().url("Invalid URL").max(300).optional().or(z.literal("")),
  ad_type: z.enum(["banner", "featured_listing", "sponsored_product", "homepage_promotion", "custom"]),
  duration_days: z.number().int().min(1).max(365),
  budget: z.number().min(0),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

type Pkg = { id: string; name: string; tier: string; price: number; duration_days: number };

export default function AdvertiseBook() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [packageId, setPackageId] = useState<string | null>(sp.get("package"));
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [website, setWebsite] = useState("");
  const [adType, setAdType] = useState<typeof AD_TYPES[number]["value"]>("banner");
  const [durationDays, setDurationDays] = useState(7);
  const [budget, setBudget] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { document.title = "Book Your Advertisement · Rent & Radiate"; }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) nav("/auth?next=/advertise/book");
  }, [user, loading, nav]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("ad_packages").select("*").eq("is_active", true).order("sort_order");
      setPackages(((data as Pkg[]) ?? []));
    })();
  }, []);

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user, email]);

  useEffect(() => {
    if (packageId) {
      const p = packages.find((x) => x.id === packageId);
      if (p) {
        setDurationDays(p.duration_days);
        setBudget(Number(p.price));
      }
    }
  }, [packageId, packages]);

  async function uploadLogo(): Promise<string | null> {
    if (!logoFile || !user) return null;
    if (!logoFile.type.startsWith("image/")) {
      toast.error("Logo must be an image");
      return null;
    }
    if (logoFile.size > 5 * 1024 * 1024) {
      toast.error("Logo too large (max 5 MB)");
      return null;
    }
    const path = `${user.id}/${Date.now()}-${logoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("advertiser-assets").upload(path, logoFile);
    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      return null;
    }
    return path;
  }

  async function save(status: "draft" | "pending") {
    if (!user) return;
    const parsed = schema.safeParse({
      company_name: companyName,
      contact_person: contactPerson,
      email,
      mobile,
      website,
      ad_type: adType,
      duration_days: durationDays,
      budget,
      description,
    });
    if (!parsed.success) {
      const errs = parsed.error.flatten().fieldErrors;
      toast.error(Object.values(errs).flat()[0] ?? "Please check your inputs");
      return;
    }
    setSubmitting(true);
    const logoPath = await uploadLogo();
    const payload = {
      advertiser_id: user.id,
      company_name: parsed.data.company_name,
      contact_person: parsed.data.contact_person,
      email: parsed.data.email,
      mobile: parsed.data.mobile,
      website: parsed.data.website || null,
      ad_type: parsed.data.ad_type,
      duration_days: parsed.data.duration_days,
      budget: parsed.data.budget,
      description: parsed.data.description || null,
      logo_url: logoPath,
      package_id: packageId || null,
      status,
    };
    const { data, error } = await (supabase as any).from("advertisement_requests").insert(payload).select("id").single();
    setSubmitting(false);
    if (error) return toast.error(error.message);

    if (status === "pending") {
      try {
        await supabase.functions.invoke("notify-ad-request", {
          body: { request_id: data.id, event: "submitted" },
        });
      } catch { /* non-blocking */ }
      toast.success("Advertisement request submitted!");
    } else {
      toast.success("Draft saved");
    }
    nav("/my-advertisements");
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-12 max-w-3xl">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Advertiser</p>
          <h1 className="font-display text-5xl">Book Your Advertisement</h1>
          <p className="text-muted-foreground mt-2">
            Tell us about your brand and campaign. We'll review and respond within 24 business hours.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-card space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Company / Brand Name *">
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} maxLength={200} />
            </Field>
            <Field label="Contact Person *">
              <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} maxLength={200} />
            </Field>
            <Field label="Email Address *">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
            </Field>
            <Field label="Mobile Number *">
              <Input value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={20} />
            </Field>
            <Field label="Website (optional)">
              <Input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" maxLength={300} />
            </Field>
            <Field label="Advertisement Type *">
              <Select value={adType} onValueChange={(v) => setAdType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Campaign Duration (days) *">
              <Input type="number" min={1} max={365} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} />
            </Field>
            <Field label="Budget (₹) *">
              <Input type="number" min={0} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
            </Field>
            <Field label="Package (optional)">
              <Select value={packageId ?? "none"} onValueChange={(v) => setPackageId(v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Select a package" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No package</SelectItem>
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} · ₹{Number(p.price).toLocaleString("en-IN")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Advertisement Description">
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="Tell us about your brand, goals, and creative direction." />
          </Field>

          <div>
            <Label className="text-sm">Upload Logo / Image</Label>
            <label className="mt-1 flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 cursor-pointer hover:border-primary transition-smooth">
              <Upload className="h-4 w-4" />
              <span className="text-sm">{logoFile ? logoFile.name : "Choose an image (max 5 MB)"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3 justify-end pt-2">
            <Button variant="outline" disabled={submitting} onClick={() => save("draft")}>
              Save Draft
            </Button>
            <Button variant="hero" disabled={submitting} onClick={() => save("pending")}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Advertisement Request
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Already submitted a request? <Link to="/my-advertisements" className="text-primary underline">Track its status</Link>.
        </p>
      </section>
      <Footer />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
