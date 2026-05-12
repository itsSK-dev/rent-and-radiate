import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  fullName: z.string().trim().min(1).max(100).optional(),
});

const Auth = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"customer" | "store_owner">("customer");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = `${mode === "signup" ? "Create your account" : "Sign in"} · Bloom`;
  }, [mode]);

  useEffect(() => {
    if (user) {
      const next = params.get("next");
      navigate(next || "/", { replace: true });
    }
  }, [user, navigate, params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, fullName: mode === "signup" ? fullName : undefined });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: fullName },
        },
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Welcome to Bloom!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return toast.error(error.message);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-16 md:py-24 flex justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 animate-fade-up">
            <h1 className="font-display text-4xl md:text-5xl">
              {mode === "signup" ? "Join Bloom" : "Welcome back"}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {mode === "signup" ? "Create an account to rent or to open your store." : "Sign in to continue."}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-card">
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
                <Label className="text-sm">I want to</Label>
                <RadioGroup value={role} onValueChange={(v) => setRole(v as any)} className="grid grid-cols-2 gap-2 mt-2">
                  <RoleOpt value="customer" label="Rent items" />
                  <RoleOpt value="store_owner" label="Open a store" />
                </RadioGroup>
              </div>
            )}
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              {mode === "signup" ? "Already have an account?" : "New to Bloom?"}{" "}
              <button type="button" className="text-primary hover:underline" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
                {mode === "signup" ? "Sign in" : "Create one"}
              </button>
            </p>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            By continuing you agree to Bloom's <Link to="/how-it-works" className="underline">terms</Link>.
          </p>
        </div>
      </section>
      <Footer />
    </div>
  );
};

function RoleOpt({ value, label }: { value: string; label: string }) {
  return (
    <Label htmlFor={value} className="flex items-center gap-2 rounded-xl border border-border bg-background p-3 cursor-pointer hover:border-primary transition-smooth has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40">
      <RadioGroupItem value={value} id={value} />
      <span className="text-sm">{label}</span>
    </Label>
  );
}

export default Auth;
