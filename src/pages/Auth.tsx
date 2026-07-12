import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShoppingBag, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { z } from "zod";

const emailSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  fullName: z.string().trim().min(1).max(100).optional(),
  referralCode: z.string().trim().max(32).optional(),
});

// E.164: leading + then 8-15 digits.
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Enter phone in international format e.g. +919812345678");

const Auth = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const intentParam = params.get("intent");
  const intent: "customer" | "shop_owner" =
    intentParam === "shop_owner" ? "shop_owner" : "customer";
  // Phone OTP is temporarily disabled until the SMS provider is configured.
  // Flip to `true` to re-enable phone login (UI + tab). The underlying logic below is preserved.
  const PHONE_AUTH_ENABLED = false;
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");

  // Email fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState((params.get("ref") || "").toUpperCase());

  // Phone fields
  const [phone, setPhone] = useState("+91");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneFullName, setPhoneFullName] = useState("");

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { localStorage.setItem("rr_auth_intent", intent); } catch { /* noop */ }
  }, [intent]);

  useEffect(() => {
    document.title = `${mode === "signup" ? "Create your account" : "Sign in"} · Rent & Radiate`;
  }, [mode]);

  useEffect(() => {
    if (!user) return;
    const next = params.get("next");
    if (next) { navigate(next, { replace: true }); return; }
    const savedIntent = (() => {
      try { return localStorage.getItem("rr_auth_intent"); } catch { return null; }
    })();
    const effectiveIntent = savedIntent === "shop_owner" ? "shop_owner" : intent;
    if (roles.includes("admin")) { navigate("/admin", { replace: true }); return; }
    if (effectiveIntent === "shop_owner") {
      navigate(roles.includes("store_owner") ? "/vendor" : "/become-vendor", { replace: true });
      return;
    }
    navigate("/", { replace: true });
  }, [user, roles, navigate, params, intent]);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse({
      email, password,
      fullName: mode === "signup" ? fullName : undefined,
      referralCode: mode === "signup" ? referralCode : undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
            ...(referralCode.trim() ? { referral_code: referralCode.trim().toUpperCase() } : {}),
          },
        },
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success(referralCode.trim() ? "Welcome! Bonus points credited." : "Welcome to Rent & Radiate!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return toast.error(error.message);
    }
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone: parsed.data,
      options: {
        // Creates the user on first OTP if they don't exist yet.
        shouldCreateUser: true,
        data: phoneFullName.trim() ? { full_name: phoneFullName.trim() } : undefined,
      },
    });
    setBusy(false);
    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("sms") || msg.includes("provider") || msg.includes("unsupported")) {
        return toast.error("Phone sign-in isn't fully configured yet. Please use email or Google.");
      }
      return toast.error(error.message);
    }
    setOtpSent(true);
    toast.success("OTP sent. Check your messages.");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(otp.trim())) return toast.error("Enter the OTP you received");
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: phone.trim(),
      token: otp.trim(),
      type: "sms",
    });
    setBusy(false);
    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("expired")) return toast.error("OTP expired — request a new code.");
      if (msg.includes("invalid")) return toast.error("Invalid OTP. Please try again.");
      return toast.error(error.message);
    }
    toast.success("Signed in successfully.");
  }

  async function signInWithGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
      }
      if (result.redirected) return;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-16 md:py-24 flex justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-6 animate-fade-up">
            <div className={`inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs mb-4 ${intent === "shop_owner" ? "bg-primary text-primary-foreground border-primary" : "bg-primary-soft text-primary"}`}>
              {intent === "shop_owner" ? <Store className="h-3.5 w-3.5" /> : <ShoppingBag className="h-3.5 w-3.5" />}
              {intent === "shop_owner" ? "Shop Owner" : "Customer"}
              <Link to={`/role-select${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`} className="underline underline-offset-2 ml-1 opacity-80 hover:opacity-100">change</Link>
            </div>
            <h1 className="font-display text-4xl md:text-5xl">
              {mode === "signup"
                ? intent === "shop_owner" ? "Open your shop" : "Join Rent & Radiate"
                : "Welcome back"}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {mode === "signup"
                ? intent === "shop_owner"
                  ? "Create your shop owner account to start listing."
                  : "Create an account to rent and shop."
                : "Sign in to continue."}
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 shadow-card space-y-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              disabled={busy}
              onClick={signInWithGoogle}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.04 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Tabs value={method} onValueChange={(v) => setMethod(v as "email" | "phone")}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="phone">Phone</TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="mt-4">
                <form onSubmit={submitEmail} className="space-y-4">
                  {mode === "signup" && (
                    <div>
                      <Label htmlFor="fn">Full name</Label>
                      <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-2" required />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="em">Email</Label>
                    <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" required />
                  </div>
                  <div>
                    <Label htmlFor="pw">Password</Label>
                    <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2" required />
                  </div>
                  {mode === "signup" && (
                    <div>
                      <Label htmlFor="ref" className="text-sm">Referral code <span className="text-muted-foreground">(optional)</span></Label>
                      <Input id="ref" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase().slice(0, 32))}
                        placeholder="e.g. ABCD1234" className="mt-2 font-mono tracking-widest" />
                      {referralCode.trim() && (
                        <p className="text-xs text-primary mt-1">🎁 You'll receive welcome bonus points after signup.</p>
                      )}
                    </div>
                  )}
                  {mode === "signin" && (
                    <div className="text-right -mt-2">
                      <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                        Forgot password?
                      </Link>
                    </div>
                  )}
                  <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                    {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="phone" className="mt-4">
                {!otpSent ? (
                  <form onSubmit={sendOtp} className="space-y-4">
                    {mode === "signup" && (
                      <div>
                        <Label htmlFor="pfn">Full name</Label>
                        <Input id="pfn" value={phoneFullName} onChange={(e) => setPhoneFullName(e.target.value)} className="mt-2" placeholder="Your name" />
                      </div>
                    )}
                    <div>
                      <Label htmlFor="ph">Phone number</Label>
                      <Input
                        id="ph"
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="mt-2 font-mono"
                        placeholder="+919812345678"
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">Use international format with country code.</p>
                    </div>
                    <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                      {busy ? "Sending…" : "Send OTP"}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={verifyOtp} className="space-y-4">
                    <div>
                      <Label htmlFor="otp">Enter OTP</Label>
                      <Input
                        id="otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                        className="mt-2 font-mono tracking-widest text-center text-lg"
                        placeholder="123456"
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">Sent to {phone}</p>
                    </div>
                    <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                      {busy ? "Verifying…" : "Verify & continue"}
                    </Button>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline w-full text-center"
                      onClick={() => { setOtpSent(false); setOtp(""); }}
                    >
                      Change number
                    </button>
                  </form>
                )}
              </TabsContent>
            </Tabs>

            <p className="text-sm text-center text-muted-foreground">
              {mode === "signup" ? "Already have an account?" : "New to Rent & Radiate?"}{" "}
              <button type="button" className="text-primary hover:underline" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setOtpSent(false); }}>
                {mode === "signup" ? "Sign in" : "Create one"}
              </button>
            </p>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6">
            By continuing you agree to Rent & Radiate's <Link to="/how-it-works" className="underline">terms</Link>.
          </p>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Auth;
