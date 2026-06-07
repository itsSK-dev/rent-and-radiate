import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { toast } from "sonner";
import { Download, MessageCircle, Mail, Plus } from "lucide-react";

type AdReq = {
  id: string;
  company_name: string;
  ad_type: string;
  status: string;
  payment_status: string;
  budget: number;
  set_price: number | null;
  duration_days: number;
  start_date: string | null;
  end_date: string | null;
  admin_notes: string | null;
  description: string | null;
  created_at: string;
  package: { name: string } | null;
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-secondary text-muted-foreground",
  pending: "bg-gold/20 text-rose-deep",
  changes_requested: "bg-destructive/10 text-destructive",
  approved: "bg-primary-soft text-rose-deep",
  rejected: "bg-destructive/10 text-destructive",
  active: "bg-primary text-primary-foreground",
  completed: "bg-muted text-muted-foreground",
};

const PAY_TONE: Record<string, string> = {
  unpaid: "bg-destructive/10 text-destructive",
  paid: "bg-primary-soft text-rose-deep",
  refunded: "bg-muted text-muted-foreground",
};

function downloadInvoice(r: AdReq) {
  const price = r.set_price ?? r.budget;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${r.id.slice(0, 8)}</title>
  <style>body{font-family:Arial,sans-serif;padding:40px;color:#111}h1{color:#b34a6c}table{width:100%;border-collapse:collapse;margin-top:24px}td,th{padding:10px;border-bottom:1px solid #eee;text-align:left}</style>
  </head><body>
  <h1>Rent &amp; Radiate — Advertisement Invoice</h1>
  <p>Invoice ID: ${r.id}</p>
  <p>Date: ${format(new Date(), "PPP")}</p>
  <table>
    <tr><th>Field</th><th>Details</th></tr>
    <tr><td>Brand</td><td>${r.company_name}</td></tr>
    <tr><td>Type</td><td>${r.ad_type.replace(/_/g, " ")}</td></tr>
    <tr><td>Package</td><td>${r.package?.name ?? "—"}</td></tr>
    <tr><td>Duration</td><td>${r.duration_days} days</td></tr>
    <tr><td>Campaign</td><td>${r.start_date ? format(new Date(r.start_date), "PP") : "—"} → ${r.end_date ? format(new Date(r.end_date), "PP") : "—"}</td></tr>
    <tr><td>Status</td><td>${r.status}</td></tr>
    <tr><td>Payment</td><td>${r.payment_status}</td></tr>
    <tr><th>Total</th><th>₹${Number(price).toLocaleString("en-IN")}</th></tr>
  </table>
  <p style="margin-top:40px;font-size:12px;color:#666">Thank you for partnering with Rent &amp; Radiate.</p>
  <script>window.onload=()=>window.print()</script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return toast.error("Pop-up blocked");
  w.document.write(html);
  w.document.close();
}

export default function MyAdvertisements() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<AdReq[]>([]);

  useEffect(() => { document.title = "My Advertisements · Rent & Radiate"; }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) nav("/auth?next=/my-advertisements");
  }, [user, loading, nav]);

  async function load() {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from("advertisement_requests")
      .select("*, package:ad_packages(name)")
      .eq("advertiser_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setRows((data as AdReq[]) ?? []);
  }
  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user]);

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-12">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">My account</p>
            <h1 className="font-display text-5xl">My Advertisements</h1>
            <p className="text-muted-foreground mt-2">Track your advertisement requests and active campaigns.</p>
          </div>
          <Button asChild variant="hero">
            <Link to="/advertise/book"><Plus className="h-4 w-4 mr-2" /> New Ad Request</Link>
          </Button>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-16 text-center">
            <p className="text-muted-foreground">No advertisement requests yet.</p>
            <Button asChild variant="hero" className="mt-4">
              <Link to="/advertise">Explore packages</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-2xl">{r.company_name}</h3>
                      <Badge className={STATUS_TONE[r.status] ?? ""}>{r.status.replace(/_/g, " ")}</Badge>
                      <Badge className={PAY_TONE[r.payment_status] ?? ""}>payment: {r.payment_status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {r.ad_type.replace(/_/g, " ")} · {r.duration_days} days · submitted {format(new Date(r.created_at), "PP")}
                    </p>
                    {r.package && (
                      <p className="text-sm text-muted-foreground">Package: <span className="font-medium text-foreground">{r.package.name}</span></p>
                    )}
                    {(r.start_date || r.end_date) && (
                      <p className="text-sm text-muted-foreground">
                        Campaign: {r.start_date ? format(new Date(r.start_date), "PP") : "—"} → {r.end_date ? format(new Date(r.end_date), "PP") : "—"}
                      </p>
                    )}
                    <p className="text-sm mt-2">
                      Price: <span className="font-display text-lg">₹{Number(r.set_price ?? r.budget).toLocaleString("en-IN")}</span>
                      {r.set_price ? <span className="text-xs text-muted-foreground ml-2">(set by admin)</span> : <span className="text-xs text-muted-foreground ml-2">(budget)</span>}
                    </p>
                    {r.admin_notes && (
                      <div className="mt-3 text-sm rounded-xl bg-secondary p-3">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Admin note</p>
                        <p className="whitespace-pre-wrap">{r.admin_notes}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-stretch gap-2 w-full md:w-auto">
                    <Button variant="outline" size="sm" onClick={() => downloadInvoice(r)}>
                      <Download className="h-4 w-4 mr-2" /> Invoice
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <a href="mailto:partnerships@rentandradiate.com"><Mail className="h-4 w-4 mr-2" /> Support</a>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <a href="https://wa.me/919999999999" target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 mr-2" /> WhatsApp</a>
                    </Button>
                    {r.status === "draft" && (
                      <Button asChild size="sm" variant="soft">
                        <Link to="/advertise/book">Continue draft</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
}
