import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShareInvite } from "@/components/ShareInvite";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Copy, Gift, Users, Award, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Stats = {
  total: number;
  successful: number;
  pending: number;
  pointsEarned: number;
};

type Row = {
  id: string;
  status: string;
  created_at: string;
  referrer_bonus_points: number;
  referred_user_id: string;
  referred_name?: string | null;
};

type Settings = {
  referral_signup_bonus: number;
  referral_referrer_bonus: number;
  referral_min_order_amount: number;
};

export default function Refer() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, successful: 0, pending: 0, pointsEarned: 0 });
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => { document.title = "Refer a friend · Rent & Radiate"; }, []);
  useEffect(() => { if (!loading && !user) navigate("/auth?next=/refer"); }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: refData }, { data: setData }] = await Promise.all([
        supabase.from("profiles").select("referral_code").eq("id", user.id).maybeSingle(),
        (supabase as any).from("referrals")
          .select("id, status, created_at, referrer_bonus_points, referred_user_id")
          .eq("referrer_id", user.id)
          .order("created_at", { ascending: false }),
        (supabase as any).rpc("get_public_platform_settings"),
      ]);

      setCode((prof as any)?.referral_code ?? null);
      setSettings((setData ?? null) as Settings);


      const list = ((refData ?? []) as Row[]);
      if (list.length) {
        const ids = list.map(r => r.referred_user_id);
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        const byId = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
        list.forEach(r => { r.referred_name = byId.get(r.referred_user_id) ?? null; });
      }
      setRows(list);
      const successful = list.filter(r => r.status === "rewarded" || r.status === "qualified").length;
      const pending = list.filter(r => r.status === "pending").length;
      const pointsEarned = list.filter(r => r.status === "rewarded").reduce((s, r) => s + (r.referrer_bonus_points || 0), 0);
      setStats({ total: list.length, successful, pending, pointsEarned });
    })();
  }, [user]);

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast.success("Code copied");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container max-w-4xl py-10">
        <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Invite friends</p>
        <h1 className="font-display text-4xl">Refer a friend</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Share your unique code. Friends get <b>{settings?.referral_signup_bonus ?? 100}</b> bonus points on signup.
          You earn <b>{settings?.referral_referrer_bonus ?? 200}</b> points when they place an order of ₹{settings?.referral_min_order_amount ?? 500}+.
        </p>

        <div className="grid sm:grid-cols-3 gap-4 mt-8">
          <StatCard icon={<Users className="h-4 w-4" />} label="Total referrals" value={stats.total} />
          <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Successful" value={stats.successful} />
          <StatCard icon={<Award className="h-4 w-4" />} label="Points earned" value={stats.pointsEarned} />
        </div>

        <div className="mt-8 rounded-3xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="h-4 w-4 text-rose-deep" />
            <h2 className="font-display text-xl">Your referral code</h2>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-dashed border-primary px-5 py-3 font-mono text-2xl tracking-widest bg-primary/5">
              {code || "—"}
            </div>
            <Button variant="outline" size="sm" onClick={copyCode} disabled={!code}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy code
            </Button>
          </div>
          <div className="mt-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Invite via</p>
            <ShareInvite code={code ?? undefined} />
          </div>
        </div>

        <div className="mt-8 rounded-3xl border bg-card p-6">
          <h2 className="font-display text-xl mb-4">Your invites</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No referrals yet. Share your code with friends to start earning rewards.</p>
          ) : (
            <ul className="divide-y">
              {rows.map(r => (
                <li key={r.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{r.referred_name || "Friend"}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</p>
                  </div>
                  <Badge variant={r.status === "rewarded" ? "default" : "outline"} className="capitalize">
                    {r.status === "rewarded" ? `+${r.referrer_bonus_points} pts` : r.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">{icon} {label}</div>
      <p className="font-display text-4xl mt-2">{value}</p>
    </div>
  );
}
