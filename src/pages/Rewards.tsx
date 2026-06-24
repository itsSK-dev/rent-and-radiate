import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, Copy, Share2, Gift, Users, TrendingUp, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Profile = {
  reward_points: number;
  lifetime_reward_points: number;
  referral_code: string | null;
};
type Tx = {
  id: string; kind: string; points: number; balance_after: number;
  note: string | null; created_at: string;
};
type ReferralRow = {
  id: string; status: string; created_at: string;
  referred_user_id: string; referrer_bonus_points: number;
  referred?: { full_name: string | null } | null;
};
type Settings = {
  reward_earn_rate_percent: number;
  reward_redeem_value: number;
  reward_max_redeem_percent: number;
  referral_signup_bonus: number;
  referral_referrer_bonus: number;
  referral_min_order_amount: number;
};

export default function Rewards() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [refs, setRefs] = useState<ReferralRow[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => { document.title = "Rewards · Rent & Radiate"; }, []);
  useEffect(() => { if (!loading && !user) navigate("/auth?next=/rewards"); }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: txData }, { data: refData }, { data: setData }] = await Promise.all([
        supabase.from("profiles").select("reward_points, lifetime_reward_points, referral_code").eq("id", user.id).maybeSingle(),
        supabase.from("reward_transactions").select("id, kind, points, balance_after, note, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        (supabase as any).from("referrals").select("id, status, created_at, referred_user_id, referrer_bonus_points").eq("referrer_id", user.id).order("created_at", { ascending: false }),
        supabase.from("platform_settings").select("reward_earn_rate_percent, reward_redeem_value, reward_max_redeem_percent, referral_signup_bonus, referral_referrer_bonus, referral_min_order_amount").eq("id", true).maybeSingle(),
      ]);
      setProfile(prof as Profile);
      setTxs((txData ?? []) as Tx[]);

      const list = (refData ?? []) as ReferralRow[];
      if (list.length) {
        const ids = list.map(r => r.referred_user_id);
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
        list.forEach(r => { r.referred = byId.get(r.referred_user_id) as any; });
      }
      setRefs(list);
      setSettings(setData as Settings);
    })();

    const ch = supabase
      .channel(`rewards-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reward_transactions", filter: `user_id=eq.${user.id}` },
        (p) => setTxs(cur => [p.new as Tx, ...cur].slice(0, 50)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const code = profile?.referral_code ?? "";
  const shareLink = `${window.location.origin}/auth?mode=signup&ref=${code}`;

  async function copyCode() { await navigator.clipboard.writeText(code); toast.success("Code copied"); }
  async function copyLink() { await navigator.clipboard.writeText(shareLink); toast.success("Link copied"); }
  async function share() {
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({
          title: "Join Rent & Radiate",
          text: `Sign up with my code ${code} and get ${settings?.referral_signup_bonus ?? 100} reward points free!`,
          url: shareLink,
        });
      } catch { /* cancelled */ }
    } else copyLink();
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container max-w-4xl py-10">
        <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Loyalty</p>
        <h1 className="font-display text-4xl">Rewards & Referrals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Earn points on every order. Invite friends. Redeem for instant discounts at checkout.
        </p>

        <div className="grid sm:grid-cols-3 gap-4 mt-8">
          <div className="rounded-2xl border bg-gradient-to-br from-primary/10 to-blossom/40 p-5">
            <div className="flex items-center gap-2 text-rose-deep text-xs uppercase tracking-wider"><Sparkles className="h-3.5 w-3.5" /> Balance</div>
            <p className="font-display text-4xl mt-2">{profile?.reward_points ?? 0}</p>
            <p className="text-xs text-muted-foreground">
              ≈ ₹{((profile?.reward_points ?? 0) * (settings?.reward_redeem_value ?? 0.1)).toFixed(2)} off
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider"><TrendingUp className="h-3.5 w-3.5" /> Lifetime</div>
            <p className="font-display text-4xl mt-2">{profile?.lifetime_reward_points ?? 0}</p>
            <p className="text-xs text-muted-foreground">Earn {settings?.reward_earn_rate_percent ?? 2}% on every order</p>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider"><Users className="h-3.5 w-3.5" /> Referrals</div>
            <p className="font-display text-4xl mt-2">{refs.filter(r => r.status === "rewarded").length}</p>
            <p className="text-xs text-muted-foreground">{refs.length} invited · {refs.filter(r => r.status === "rewarded").length} rewarded</p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="h-4 w-4 text-rose-deep" />
            <h2 className="font-display text-xl">Your referral code</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Share your code. Friends get <b>{settings?.referral_signup_bonus ?? 100}</b> bonus points on signup.
            You earn <b>{settings?.referral_referrer_bonus ?? 200}</b> points when they complete an order of ₹{settings?.referral_min_order_amount ?? 500}+.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-dashed border-primary px-5 py-3 font-mono text-2xl tracking-widest bg-primary/5">
              {code || "—"}
            </div>
            <Button variant="outline" size="sm" onClick={copyCode}><Copy className="h-3.5 w-3.5 mr-1" /> Copy code</Button>
            <Button variant="outline" size="sm" onClick={copyLink}><Copy className="h-3.5 w-3.5 mr-1" /> Copy link</Button>
            <Button variant="hero" size="sm" onClick={share}><Share2 className="h-3.5 w-3.5 mr-1" /> Share</Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <div className="rounded-3xl border bg-card p-6">
            <h2 className="font-display text-xl mb-4">Point history</h2>
            {txs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet. Place an order to start earning.</p>
            ) : (
              <ul className="divide-y">
                {txs.map(t => {
                  const credit = t.points >= 0;
                  return (
                    <li key={t.id} className="py-3 flex items-start gap-3">
                      <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center ${credit ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {credit ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium capitalize">{t.kind.replace(/_/g, " ")}</p>
                        {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
                        <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${credit ? "text-emerald-700" : "text-rose-700"}`}>{credit ? "+" : ""}{t.points}</p>
                        <p className="text-[10px] text-muted-foreground">bal {t.balance_after}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border bg-card p-6">
            <h2 className="font-display text-xl mb-4">Friends invited</h2>
            {refs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No referrals yet. Share your code to start earning.</p>
            ) : (
              <ul className="divide-y">
                {refs.map(r => (
                  <li key={r.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{r.referred?.full_name || "Friend"}</p>
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
        </div>
      </section>
      <Footer />
    </div>
  );
}
