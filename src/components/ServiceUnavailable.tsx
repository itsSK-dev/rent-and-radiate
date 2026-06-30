import { useState } from "react";
import { z } from "zod";
import { Rocket, MapPin, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SERVICE_CITY_LABEL, setSavedCity, SERVICE_CITY } from "@/lib/serviceArea";

const interestSchema = z.object({
  city: z.string().trim().min(1).max(120),
  email: z
    .string()
    .trim()
    .max(254)
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^[0-9+\-\s()]{6,32}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
});

export function ServiceUnavailable({ city, source = "browse" }: { city: string; source?: string }) {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function notifyMe(e: React.FormEvent) {
    e.preventDefault();
    const parsed = interestSchema.safeParse({ city, email, phone });
    if (!parsed.success) {
      const first =
        parsed.error.flatten().fieldErrors.email?.[0] ||
        parsed.error.flatten().fieldErrors.phone?.[0] ||
        "Please check the details and try again.";
      toast.error(first);
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from("location_interest").insert({
        user_id: user?.id ?? null,
        city: parsed.data.city,
        email: parsed.data.email || user?.email || null,
        phone: parsed.data.phone || null,
        source,
      });
      if (error) throw error;
      setDone(true);
      toast.success("Thanks! We'll let you know when we launch in your city.");
    } catch (err: any) {
      toast.error(err?.message || "Couldn't register interest right now.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="container py-16 md:py-24">
      <div className="max-w-2xl mx-auto rounded-3xl border border-border bg-card/90 shadow-petal p-6 md:p-10 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 text-white mb-6 shadow-md">
          <Rocket className="h-7 w-7" />
        </div>
        <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2 flex items-center justify-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> {city}
        </p>
        <h1 className="font-display text-3xl md:text-4xl mb-3">
          🚀 We're currently serving only {SERVICE_CITY_LABEL}
        </h1>
        <p className="text-muted-foreground md:text-lg mb-6">
          We'll reach <span className="font-medium text-foreground">{city}</span> soon. Stay tuned!
        </p>


        {done ? (
          <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50 text-emerald-800 p-4 flex items-center justify-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            You're on the waitlist for {city}.
          </div>
        ) : (
          <form
            onSubmit={notifyMe}
            className="flex flex-col sm:flex-row gap-2 max-w-xl mx-auto text-left"
          >
            <Input
              type="email"
              placeholder="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              className="flex-1"
              aria-label="Email"
            />
            <Input
              type="tel"
              placeholder="Phone (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={32}
              className="sm:max-w-[180px]"
              aria-label="Phone"
            />
            <Button type="submit" variant="hero" disabled={submitting} className="shrink-0">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Notify Me"}
            </Button>
          </form>
        )}

        <div className="mt-8 text-sm text-muted-foreground">
          Want to browse meanwhile?{" "}
          <button
            type="button"
            onClick={() => setSavedCity(SERVICE_CITY)}
            className="text-rose-deep font-medium hover:underline"
          >
            Switch to {SERVICE_CITY}
          </button>
        </div>
      </div>
    </section>
  );
}
