import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Supabase delivers recovery links that put `type=recovery` in the URL hash.
// The auth client picks that up automatically and creates a session in
// "recovery" mode; `updateUser({ password })` then rotates the password.
const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Set a new password · Rent & Radiate";
  }, []);

  useEffect(() => {
    // Wait for the recovery session to hydrate — Supabase parses the hash on load.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Fallback: session may already be present when we mount.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters.");
    if (password.length > 128) return toast.error("Password must be 128 characters or fewer.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated — you're signed in.");
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-16 md:py-24 flex justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-display text-4xl md:text-5xl">Set a new password</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Pick something you'll remember — at least 6 characters.
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-card">
            {!ready && (
              <p className="text-xs text-muted-foreground">
                Verifying your reset link…
              </p>
            )}
            <div>
              <Label htmlFor="pw">New password</Label>
              <Input id="pw" type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)} className="mt-2" />
            </div>
            <div>
              <Label htmlFor="pw2">Confirm new password</Label>
              <Input id="pw2" type="password" required value={confirm}
                onChange={(e) => setConfirm(e.target.value)} className="mt-2" />
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy || !ready}>
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default ResetPassword;
