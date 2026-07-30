import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, CheckCircle2 } from "lucide-react";

type Vehicle = "bike" | "cycle" | "scooter" | "car";
type DocKey = "profile_photo" | "aadhaar_front" | "aadhaar_back" | "pan" | "driving_licence" | "rc" | "insurance";

const DOC_LABELS: Record<DocKey, string> = {
  profile_photo: "Profile Photo",
  aadhaar_front: "Aadhaar Front",
  aadhaar_back: "Aadhaar Back",
  pan: "PAN Card (optional)",
  driving_licence: "Driving Licence",
  rc: "Vehicle RC",
  insurance: "Vehicle Insurance",
};

export default function DeliveryPartnerRegister() {
  const { user, loading, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existing, setExisting] = useState<any>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [currentAddress, setCurrentAddress] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [vehicleType, setVehicleType] = useState<Vehicle>("bike");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [hasExp, setHasExp] = useState(false);
  const [prevCompany, setPrevCompany] = useState("");
  const [expDuration, setExpDuration] = useState("");
  const [additional, setAdditional] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [bank, setBank] = useState("");
  const [upi, setUpi] = useState("");
  const [files, setFiles] = useState<Partial<Record<DocKey, File>>>({});

  useEffect(() => { document.title = "Become a Delivery Partner · Rent & Radiate"; }, []);
  useEffect(() => {
    if (!loading && !user) navigate("/auth?intent=delivery_partner&next=/delivery/register");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("delivery_partners").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setExisting(data);
        if (data.status === "pending" || data.status === "approved") setSubmitted(true);
      }
      setEmail(user.email ?? "");
    })();
  }, [user]);

  const needsDL = vehicleType === "bike" || vehicleType === "scooter" || vehicleType === "car";
  const needsRC = needsDL;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!fullName || !mobile || !currentAddress || !city || !state || !pinCode || !emergencyName || !emergencyPhone) {
      return toast.error("Please fill all required fields.");
    }
    if (!files.profile_photo || !files.aadhaar_front || !files.aadhaar_back) {
      return toast.error("Profile photo and both Aadhaar sides are required.");
    }
    if (needsDL && !files.driving_licence) return toast.error("Driving Licence required for this vehicle.");
    if (needsRC && !files.rc) return toast.error("Vehicle RC required for this vehicle.");
    if (!bank && !upi) return toast.error("Provide a bank account or UPI ID for payouts.");

    setBusy(true);
    try {
      const { data: dp, error: insErr } = await supabase.from("delivery_partners").insert({
        user_id: user.id,
        full_name: fullName, mobile, email: email || null,
        date_of_birth: dob || null, gender: gender || null,
        current_address: currentAddress, permanent_address: permanentAddress || currentAddress,
        city, state, pin_code: pinCode,
        vehicle_type: vehicleType, vehicle_number: vehicleNumber || null,
        has_experience: hasExp, previous_company: prevCompany || null, experience_duration: expDuration || null,
        additional_info: additional || null,
        emergency_contact_name: emergencyName, emergency_contact_number: emergencyPhone,
        bank_account: bank || null, upi_id: upi || null,
      }).select("id").single();
      if (insErr) throw insErr;

      // Upload docs
      for (const key of Object.keys(files) as DocKey[]) {
        const f = files[key];
        if (!f) continue;
        const path = `${user.id}/${dp.id}/${key}-${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("delivery-partner-docs").upload(path, f, { upsert: true });
        if (upErr) throw upErr;
        await supabase.from("delivery_partner_documents").insert({ partner_id: dp.id, doc_type: key, file_path: path });
        if (key === "profile_photo") {
          const { data: pub } = supabase.storage.from("delivery-partner-docs").createSignedUrl
            ? await supabase.storage.from("delivery-partner-docs").createSignedUrl(path, 60 * 60 * 24 * 365)
            : { data: null };
          if (pub?.signedUrl) {
            await supabase.from("delivery_partners").update({ profile_photo_url: pub.signedUrl }).eq("id", dp.id);
          }
        }
      }

      toast.success("Application submitted — awaiting admin verification.");
      setSubmitted(true);
      await refreshRoles();
    } catch (err: any) {
      toast.error(err.message ?? "Submission failed");
    } finally { setBusy(false); }
  }

  if (submitted || (existing && (existing.status === "pending" || existing.status === "approved"))) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <section className="container flex-1 py-16 flex items-center justify-center">
          <div className="max-w-lg text-center rounded-3xl border border-border bg-card p-10 shadow-card">
            <CheckCircle2 className="h-14 w-14 text-primary mx-auto mb-4" />
            <h1 className="font-display text-3xl mb-2">
              {existing?.status === "approved" ? "You're approved!" : "Application submitted"}
            </h1>
            <p className="text-muted-foreground text-sm mb-6">
              {existing?.status === "approved"
                ? "You can now start accepting deliveries."
                : "Our team is reviewing your documents. You'll receive a notification once approved."}
            </p>
            {existing?.status === "approved" ? (
              <Button variant="hero" onClick={() => navigate("/delivery")}>Open Dashboard</Button>
            ) : (
              <Button variant="outline" onClick={() => navigate("/")}>Back home</Button>
            )}
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  if (existing?.status === "rejected") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <section className="container flex-1 py-16 flex items-center justify-center">
          <div className="max-w-lg text-center rounded-3xl border border-destructive/40 bg-card p-10 shadow-card">
            <h1 className="font-display text-2xl mb-2">Application rejected</h1>
            <p className="text-sm text-muted-foreground mb-4">{existing.rejection_reason || "Please contact support."}</p>
            <Button variant="outline" onClick={() => setSubmitted(false)}>Re-apply</Button>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-10 max-w-3xl mx-auto">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Delivery Partner</p>
          <h1 className="font-display text-4xl">Become a Delivery Partner</h1>
          <p className="text-muted-foreground text-sm mt-2">Fill in your details. Our team reviews applications within 24 hours.</p>
        </div>

        <form onSubmit={submit} className="space-y-8">
          <Section title="Personal details">
            <TwoCol>
              <Field label="Full name *"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></Field>
              <Field label="Mobile *"><Input value={mobile} onChange={(e) => setMobile(e.target.value)} required inputMode="tel" /></Field>
              <Field label="Email (optional)"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label="Date of birth"><Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></Field>
              <Field label="Gender">
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </TwoCol>
          </Section>

          <Section title="Address">
            <Field label="Current address *"><Textarea value={currentAddress} onChange={(e) => setCurrentAddress(e.target.value)} rows={2} required /></Field>
            <Field label="Permanent address"><Textarea value={permanentAddress} onChange={(e) => setPermanentAddress(e.target.value)} rows={2} placeholder="Same as current if empty" /></Field>
            <TwoCol>
              <Field label="City *"><Input value={city} onChange={(e) => setCity(e.target.value)} required /></Field>
              <Field label="State *"><Input value={state} onChange={(e) => setState(e.target.value)} required /></Field>
              <Field label="PIN code *"><Input value={pinCode} onChange={(e) => setPinCode(e.target.value)} required /></Field>
            </TwoCol>
          </Section>

          <Section title="Vehicle">
            <TwoCol>
              <Field label="Vehicle type *">
                <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as Vehicle)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bike">Bike</SelectItem><SelectItem value="cycle">Cycle</SelectItem>
                    <SelectItem value="scooter">Scooter</SelectItem><SelectItem value="car">Car</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Vehicle number"><Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())} /></Field>
            </TwoCol>
          </Section>

          <Section title="Experience">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={hasExp} onCheckedChange={(v) => setHasExp(!!v)} />
              I have previous delivery experience
            </label>
            {hasExp && (
              <TwoCol>
                <Field label="Previous company"><Input value={prevCompany} onChange={(e) => setPrevCompany(e.target.value)} /></Field>
                <Field label="Experience duration"><Input value={expDuration} onChange={(e) => setExpDuration(e.target.value)} placeholder="e.g. 1 year" /></Field>
              </TwoCol>
            )}
            <Field label="Additional information"><Textarea value={additional} onChange={(e) => setAdditional(e.target.value)} rows={2} /></Field>
          </Section>

          <Section title="Emergency contact">
            <TwoCol>
              <Field label="Name *"><Input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} required /></Field>
              <Field label="Number *"><Input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} required /></Field>
            </TwoCol>
          </Section>

          <Section title="Payout">
            <TwoCol>
              <Field label="Bank account"><Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Account no." /></Field>
              <Field label="UPI ID"><Input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@upi" /></Field>
            </TwoCol>
            <p className="text-xs text-muted-foreground">Provide at least one.</p>
          </Section>

          <Section title="Documents">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(Object.keys(DOC_LABELS) as DocKey[]).map((k) => {
                if (k === "driving_licence" && !needsDL) return null;
                if (k === "rc" && !needsRC) return null;
                if (k === "insurance" && !needsRC) return null;
                return <FileField key={k} label={DOC_LABELS[k]} file={files[k]} onChange={(f) => setFiles((s) => ({ ...s, [k]: f }))} />;
              })}
            </div>
          </Section>

          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
            {busy ? "Submitting…" : "Submit application"}
          </Button>
        </form>
      </section>
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h2 className="font-display text-xl">{title}</h2>
      {children}
    </div>
  );
}
function TwoCol({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function FileField({ label, file, onChange }: { label: string; file?: File; onChange: (f: File) => void }) {
  return (
    <label className="rounded-xl border border-dashed border-border bg-background p-3 flex items-center gap-2 text-sm cursor-pointer hover:border-primary transition-smooth">
      <Upload className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{file?.name ?? "Tap to upload"}</p>
      </div>
      <input type="file" accept="image/*,application/pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); }} />
    </label>
  );
}
