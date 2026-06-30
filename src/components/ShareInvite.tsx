import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Share2, MessageCircle, Mail, Send, Smartphone } from "lucide-react";

const APP_NAME = "Rent & Radiate";
const APP_TAGLINE = "Rent premium fashion, jewellery & more — or shop the latest collections from verified local boutiques.";

type Props = {
  /** Referral code to include in the link. If omitted, behaves as plain "Share app". */
  code?: string | null;
  /** Override the share URL. Defaults to the site origin (+ ?ref=CODE when provided). */
  url?: string;
  /** Optional pre-headline text shown before the buttons. */
  title?: string;
  /** Compact: render only icon buttons. */
  compact?: boolean;
};

export function ShareInvite({ code, url, title, compact }: Props) {
  const base = typeof window !== "undefined" ? window.location.origin : "https://rent-and-radiate.lovable.app";
  const shareUrl = url ?? (code ? `${base}/auth?mode=signup&ref=${code}` : base);
  const message = code
    ? `✨ Join me on ${APP_NAME}! Use my referral code ${code} when you sign up and get welcome bonus points. ${APP_TAGLINE}\n\n${shareUrl}`
    : `✨ Check out ${APP_NAME} — ${APP_TAGLINE}\n\n${shareUrl}`;

  const enc = encodeURIComponent(message);
  const encUrl = encodeURIComponent(shareUrl);
  const encSubject = encodeURIComponent(`Join me on ${APP_NAME}`);

  const links = {
    whatsapp: `https://wa.me/?text=${enc}`,
    sms: `sms:?&body=${enc}`,
    email: `mailto:?subject=${encSubject}&body=${enc}`,
    telegram: `https://t.me/share/url?url=${encUrl}&text=${enc}`,
  };

  async function nativeShare() {
    const nav: any = typeof navigator !== "undefined" ? navigator : null;
    if (nav?.share) {
      try {
        await nav.share({ title: APP_NAME, text: message, url: shareUrl });
        return;
      } catch { /* user cancelled */ }
    }
    await navigator.clipboard.writeText(message);
    toast.success("Invite copied to clipboard");
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied");
  }

  function open(href: string) {
    window.open(href, "_blank", "noopener,noreferrer");
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="icon" variant="outline" aria-label="WhatsApp" onClick={() => open(links.whatsapp)}>
          <MessageCircle className="h-4 w-4 text-emerald-600" />
        </Button>
        <Button size="icon" variant="outline" aria-label="SMS" onClick={() => open(links.sms)}>
          <Smartphone className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline" aria-label="Email" onClick={() => open(links.email)}>
          <Mail className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline" aria-label="Telegram" onClick={() => open(links.telegram)}>
          <Send className="h-4 w-4 text-sky-600" />
        </Button>
        <Button size="icon" variant="outline" aria-label="Copy link" onClick={copyLink}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="hero" aria-label="Share" onClick={nativeShare}>
          <Share2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {title && <p className="text-sm text-muted-foreground">{title}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => open(links.whatsapp)}>
          <MessageCircle className="h-4 w-4 mr-1.5 text-emerald-600" /> WhatsApp
        </Button>
        <Button variant="outline" size="sm" onClick={() => open(links.sms)}>
          <Smartphone className="h-4 w-4 mr-1.5" /> SMS
        </Button>
        <Button variant="outline" size="sm" onClick={() => open(links.email)}>
          <Mail className="h-4 w-4 mr-1.5" /> Email
        </Button>
        <Button variant="outline" size="sm" onClick={() => open(links.telegram)}>
          <Send className="h-4 w-4 mr-1.5 text-sky-600" /> Telegram
        </Button>
        <Button variant="outline" size="sm" onClick={copyLink}>
          <Copy className="h-4 w-4 mr-1.5" /> Copy link
        </Button>
        <Button variant="hero" size="sm" onClick={nativeShare}>
          <Share2 className="h-4 w-4 mr-1.5" /> More
        </Button>
      </div>
    </div>
  );
}
