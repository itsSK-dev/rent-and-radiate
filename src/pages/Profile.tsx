import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, MapPin } from "lucide-react";
import { DeliveryAddressDialog, useSavedAddress } from "@/components/DeliveryAddressDialog";
import { addressLines, isAddressComplete } from "@/lib/address";

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(100),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});

const Profile = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const { address, setAddress } = useSavedAddress();

  useEffect(() => {
    document.title = "Your profile · Rent & Radiate";
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/profile", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    setBusy(true);
    supabase
      .from("profiles")
      .select("full_name,phone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFullName(data?.full_name ?? "");
        setPhone(data?.phone ?? "");
      })
      .then(() => setBusy(false));
  }, [user]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = profileSchema.safeParse({ full_name: fullName, phone });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: parsed.data.full_name, phone: parsed.data.phone || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated.");
  }

  async function handleDelete() {
    if (deleteConfirm.trim().toUpperCase() !== "DELETE") {
      return toast.error("Type DELETE to confirm.");
    }
    setDeleting(true);
    const { error } = await supabase.functions.invoke("delete-my-account");
    if (error) {
      setDeleting(false);
      return toast.error(error.message ?? "Could not delete account.");
    }
    toast.success("Your account has been deleted.");
    await signOut();
    navigate("/", { replace: true });
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-12 md:py-16 max-w-2xl">
        <h1 className="font-display text-4xl md:text-5xl mb-8">Your profile</h1>

        <form onSubmit={saveProfile} className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-card">
          <div>
            <Label htmlFor="em">Email</Label>
            <Input id="em" type="email" value={email} readOnly disabled className="mt-2 bg-muted" />
            <p className="text-[11px] text-muted-foreground mt-1">
              Email changes aren't supported yet — contact support if you need to update it.
            </p>
          </div>
          <div>
            <Label htmlFor="fn">Full name</Label>
            <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="mt-2" required disabled={busy} />
          </div>
          <div>
            <Label htmlFor="ph">Phone</Label>
            <Input id="ph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="mt-2" placeholder="+91…" disabled={busy} />
          </div>
          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={saving || busy}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>

        <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-card">
          <h2 className="font-display text-2xl mb-1 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Delivery address
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Used for every delivery order. A complete address is required before placing an order.
          </p>
          {isAddressComplete(address) ? (
            <div className="text-sm">
              <p className="font-medium">{address.full_name} · {address.mobile}</p>
              {addressLines(address).map((l, i) => (
                <p key={i} className="text-muted-foreground">{l}</p>
              ))}
              {address.instructions && (
                <p className="text-muted-foreground italic">Note: {address.instructions}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No delivery address saved yet.</p>
          )}
          <DeliveryAddressDialog
            value={address}
            onSaved={setAddress}
            trigger={
              <Button variant="soft" className="mt-4">
                {isAddressComplete(address) ? "Edit address" : "Add delivery address"}
              </Button>
            }
          />
        </section>

        <div className="mt-10 rounded-3xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="font-display text-2xl mb-2">Danger zone</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Deleting your account is permanent. Your profile, wishlists, rewards, and rentals
            history will be removed. Active rentals must be completed or cancelled first.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete my account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This cannot be undone. Type <strong>DELETE</strong> to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE" />
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConfirm("")}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); handleDelete(); }}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Deleting…" : "Delete permanently"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Profile;
