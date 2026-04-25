import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Mail, Eye } from "lucide-react";
import {
  DisputeOpenedEmail,
  DisputeResolutionEmail,
  type DisputeEmailData,
  type DisputeResolutionData,
} from "@/components/email/DisputeEmailTemplates";

const defaultBase: DisputeEmailData = {
  recipientName: "Aanya Kapoor",
  recipientRole: "customer",
  productTitle: "Ivory Chikankari Anarkali",
  storeName: "Petals & Pearls Couture",
  rentalId: "8a2b91c4-77fd-4e8e-9a2d-1c6b5e0aa13f",
  startDate: "12 May 2026",
  endDate: "15 May 2026",
  grandTotal: "₹8,400",
  reason:
    "The dress arrived with a torn seam at the waistline and a faint stain near the hem. I noticed it as soon as I unpacked it for trial.",
};

const defaultResolution: DisputeResolutionData = {
  ...defaultBase,
  outcome: "resolved",
  resolution:
    "After reviewing the before-delivery and at-delivery photos, the damage was already present at handover. We're issuing a full refund and returning the security deposit. Thanks for your patience.",
  refundAmount: "₹3,200",
  depositReturned: "₹5,000",
};

const AdminEmailPreview = () => {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();
  const [opened, setOpened] = useState<DisputeEmailData>(defaultBase);
  const [resolution, setResolution] = useState<DisputeResolutionData>(defaultResolution);

  useEffect(() => {
    document.title = "Email previews · Admin · Bloom";
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth?next=/admin/email-previews");
      return;
    }
    if (!roles.includes("admin")) {
      toast.error("Admin access required.");
      navigate("/");
    }
  }, [user, roles, loading, navigate]);

  if (!user || !roles.includes("admin")) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-12">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Admin · Email previews</p>
          <h1 className="font-display text-5xl">Dispute notification templates</h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-2xl">
            Review how the branded dispute emails will look in a recipient's inbox before any are sent. Edit the sample data on the left and the preview on the right updates instantly.
          </p>
        </div>

        <Tabs defaultValue="opened" className="space-y-6">
          <TabsList>
            <TabsTrigger value="opened" className="gap-2">
              <Mail className="h-3.5 w-3.5" /> Dispute opened
            </TabsTrigger>
            <TabsTrigger value="resolution" className="gap-2">
              <Eye className="h-3.5 w-3.5" /> Resolved / Rejected
            </TabsTrigger>
          </TabsList>

          <TabsContent value="opened">
            <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
              <Editor>
                <BaseFields data={opened} onChange={setOpened} />
              </Editor>
              <PreviewFrame title="Dispute opened">
                <DisputeOpenedEmail data={opened} />
              </PreviewFrame>
            </div>
          </TabsContent>

          <TabsContent value="resolution">
            <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
              <Editor>
                <BaseFields data={resolution} onChange={(d) => setResolution({ ...resolution, ...d })} />
                <div className="space-y-2">
                  <Label>Outcome</Label>
                  <Select value={resolution.outcome} onValueChange={(v) => setResolution({ ...resolution, outcome: v as "resolved" | "rejected" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resolved">Resolved (in favour of claim)</SelectItem>
                      <SelectItem value="rejected">Rejected (no further action)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Admin resolution note</Label>
                  <Textarea
                    rows={4}
                    value={resolution.resolution}
                    onChange={(e) => setResolution({ ...resolution, resolution: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Refund amount</Label>
                    <Input
                      value={resolution.refundAmount ?? ""}
                      placeholder="e.g. ₹3,200"
                      onChange={(e) => setResolution({ ...resolution, refundAmount: e.target.value || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Deposit returned</Label>
                    <Input
                      value={resolution.depositReturned ?? ""}
                      placeholder="e.g. ₹5,000"
                      onChange={(e) => setResolution({ ...resolution, depositReturned: e.target.value || undefined })}
                    />
                  </div>
                </div>
              </Editor>
              <PreviewFrame title={resolution.outcome === "resolved" ? "Dispute resolved" : "Dispute rejected"}>
                <DisputeResolutionEmail data={resolution} />
              </PreviewFrame>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-10 rounded-2xl border border-dashed border-border bg-secondary/40 p-5 text-xs text-muted-foreground">
          These previews are static representations. Live sending will be enabled once the email sender domain is configured — at that point the same templates will be wired into the dispute pipeline and dispatched automatically to both parties.
        </div>
      </section>
      <Footer />
    </div>
  );
};

function Editor({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-card space-y-5 lg:sticky lg:top-24">
      <p className="text-xs uppercase tracking-wider text-rose-deep font-medium">Sample data</p>
      {children}
    </div>
  );
}

function BaseFields<T extends DisputeEmailData>({ data, onChange }: { data: T; onChange: (d: T) => void }) {
  const update = <K extends keyof T>(key: K, value: T[K]) => onChange({ ...data, [key]: value });
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Recipient name</Label>
          <Input value={data.recipientName} onChange={(e) => update("recipientName", e.target.value as T[keyof T])} />
        </div>
        <div className="space-y-2">
          <Label>Recipient role</Label>
          <Select value={data.recipientRole} onValueChange={(v) => update("recipientRole", v as T[keyof T])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="store_owner">Store owner</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Product title</Label>
        <Input value={data.productTitle} onChange={(e) => update("productTitle", e.target.value as T[keyof T])} />
      </div>
      <div className="space-y-2">
        <Label>Store name</Label>
        <Input value={data.storeName} onChange={(e) => update("storeName", e.target.value as T[keyof T])} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Start date</Label>
          <Input value={data.startDate} onChange={(e) => update("startDate", e.target.value as T[keyof T])} />
        </div>
        <div className="space-y-2">
          <Label>End date</Label>
          <Input value={data.endDate} onChange={(e) => update("endDate", e.target.value as T[keyof T])} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Order total</Label>
        <Input value={data.grandTotal} onChange={(e) => update("grandTotal", e.target.value as T[keyof T])} />
      </div>
      <div className="space-y-2">
        <Label>Customer's reason</Label>
        <Textarea rows={3} value={data.reason} onChange={(e) => update("reason", e.target.value as T[keyof T])} />
      </div>
    </>
  );
}

function PreviewFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/40">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Inbox preview · {title}</p>
        <span className="text-[10px] text-muted-foreground">no-reply@bloom · to recipient</span>
      </div>
      <div className="max-h-[80vh] overflow-y-auto">{children}</div>
    </div>
  );
}

export default AdminEmailPreview;
