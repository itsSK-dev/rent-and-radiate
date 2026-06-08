import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { Send, Clock, Megaphone } from "lucide-react";

type Audience = "all" | "selected" | "city" | "category";
type Campaign = {
  id: string; title: string; body: string | null; audience_type: Audience;
  audience_filter: Record<string, unknown>; status: string; recipient_count: number;
  scheduled_for: string | null; sent_at: string | null; created_at: string;
};

const CATEGORIES = ["dress", "jewellery", "accessory", "footwear", "other"];

export function AdminNotificationsPanel() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [image, setImage] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("dress");
  const [userIdsText, setUserIdsText] = useState("");
  const [schedule, setSchedule] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("notification_campaigns").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) return toast.error(error.message);
    setCampaigns((data ?? []) as Campaign[]);
  }
  useEffect(() => { load(); }, []);

  function buildFilter(): Record<string, unknown> {
    if (audience === "city") return { city: city.trim() };
    if (audience === "category") return { category };
    if (audience === "selected") {
      const ids = userIdsText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
      return { user_ids: ids };
    }
    return {};
  }

  async function createAndSend(send: boolean) {
    if (!title.trim()) return toast.error("Title required");
    setBusy(true);
    const filter = buildFilter();
    const status: "draft" | "scheduled" | "sending" = schedule ? "scheduled" : (send ? "sending" : "draft");
    const insertRow = {
      title: title.trim(),
      body: body.trim() || null,
      link_url: link.trim() || null,
      image_url: image.trim() || null,
      audience_type: audience,
      audience_filter: filter,
      scheduled_for: schedule || null,
      status,
    };
    const { data, error } = await supabase
      .from("notification_campaigns")
      .insert(insertRow as never)
      .select("*").single();
    if (error || !data) { setBusy(false); return toast.error(error?.message ?? "failed"); }

    if (send && !schedule) {
      const { error: sErr } = await supabase.functions.invoke("send-campaign", {
        body: { campaign_id: data.id },
      });
      if (sErr) { setBusy(false); return toast.error(sErr.message); }
      toast.success("Campaign sent");
    } else if (schedule) {
      toast.success("Campaign scheduled");
    } else {
      toast.success("Draft saved");
    }
    setTitle(""); setBody(""); setLink(""); setImage(""); setSchedule(""); setUserIdsText("");
    setBusy(false);
    load();
  }

  async function sendNow(id: string) {
    setBusy(true);
    const { error } = await supabase.functions.invoke("send-campaign", { body: { campaign_id: id } });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Sent");
    load();
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-rose-deep" />
          <h3 className="font-display text-2xl">Compose notification</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Flash Sale: 30% off today!" maxLength={120} />
          </div>
          <div>
            <Label>Link (optional)</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/browse?sale=true" maxLength={500} />
          </div>
          <div className="md:col-span-2">
            <Label>Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={500}
              placeholder="Limited time offer — rent now and save ₹500!" />
          </div>
          <div className="md:col-span-2">
            <Label>Image URL (optional)</Label>
            <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" maxLength={500} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Audience</Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users (with promotional opt-in)</SelectItem>
                <SelectItem value="selected">Selected user IDs</SelectItem>
                <SelectItem value="city">Users in a city</SelectItem>
                <SelectItem value="category">Users interested in a category</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Schedule for (optional)</Label>
            <Input type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
          </div>
          {audience === "city" && (
            <div className="md:col-span-2">
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Delhi" />
              <p className="text-xs text-muted-foreground mt-1">Matched against rental delivery addresses.</p>
            </div>
          )}
          {audience === "category" && (
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {audience === "selected" && (
            <div className="md:col-span-2">
              <Label>User IDs (comma or newline separated)</Label>
              <Textarea value={userIdsText} onChange={(e) => setUserIdsText(e.target.value)} rows={3}
                placeholder="uuid-1, uuid-2…" />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" disabled={busy} onClick={() => createAndSend(false)}>Save draft</Button>
          <Button variant="hero" disabled={busy} onClick={() => createAndSend(true)}>
            {schedule ? <><Clock className="h-4 w-4 mr-2" />Schedule</> : <><Send className="h-4 w-4 mr-2" />Send now</>}
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border bg-card p-6">
        <h3 className="font-display text-2xl mb-4">Recent campaigns</h3>
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        ) : (
          <ul className="divide-y">
            {campaigns.map((c) => (
              <li key={c.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.audience_type} · {c.recipient_count} recipients · {format(new Date(c.created_at), "PPp")}
                    {c.scheduled_for && ` · scheduled ${format(new Date(c.scheduled_for), "PPp")}`}
                  </p>
                </div>
                <Badge variant="outline">{c.status}</Badge>
                {(c.status === "draft" || c.status === "scheduled" || c.status === "failed") && (
                  <Button size="sm" variant="soft" disabled={busy} onClick={() => sendNow(c.id)}>
                    <Send className="h-3 w-3 mr-1" />Send now
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
