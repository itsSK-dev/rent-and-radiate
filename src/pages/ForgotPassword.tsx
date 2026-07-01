import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.string().trim().email("Enter a valid email").max(255);

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    document.title = "Reset your password · Rent & Radiate";
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(email);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Password reset link sent — check your inbox.");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-16 md:py-24 flex justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-display text-4xl md:text-5xl">Forgot password?</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              We'll email you a link to set a new one.
            </p>
          </div>
          {sent ? (
            <div className="rounded-3xl border border-border bg-card p-6 shadow-card text-sm space-y-3">
              <p>
                If an account exists for <strong>{email}</strong>, a reset link is on its way. The
                link expires in 1 hour.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-card">
              <div>
                <Label htmlFor="em">Email</Label>
                <Input id="em" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} className="mt-2" />
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                {busy ? "Sending…" : "Send reset link"}
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                Remembered it?{" "}
                <Link to="/auth" className="text-primary hover:underline">Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default ForgotPassword;
