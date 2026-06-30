import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShareInvite } from "@/components/ShareInvite";
import { Gift, Share2 } from "lucide-react";

export function ShareAppSection() {
  return (
    <section className="container py-12">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-3xl border bg-gradient-to-br from-primary/10 via-blossom/40 to-background p-8">
          <div className="flex items-center gap-2 text-rose-deep">
            <Gift className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.2em]">Refer & earn</p>
          </div>
          <h3 className="font-display text-2xl md:text-3xl mt-2">Invite friends. Earn rewards.</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Share your unique code — your friends get welcome points and you earn bonus points on every successful invite.
          </p>
          <Button asChild variant="hero" size="sm" className="mt-5">
            <Link to="/refer">Refer a friend</Link>
          </Button>
        </div>

        <div className="rounded-3xl border bg-card p-8">
          <div className="flex items-center gap-2 text-rose-deep">
            <Share2 className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.2em]">Share the app</p>
          </div>
          <h3 className="font-display text-2xl md:text-3xl mt-2">Love it? Share Rent & Radiate.</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Send the app to friends and family in one tap — WhatsApp, SMS, Email, Telegram or your device's share sheet.
          </p>
          <div className="mt-5">
            <ShareInvite />
          </div>
        </div>
      </div>
    </section>
  );
}
