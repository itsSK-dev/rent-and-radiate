import { BadgeCheck, RotateCcw, ShieldCheck, Gem } from "lucide-react";

const BADGES = [
  { icon: BadgeCheck, label: "Verified Stores", note: "Admin approved" },
  { icon: ShieldCheck, label: "Secure Payments", note: "100% protected" },
  { icon: Gem, label: "Quality Checked", note: "Inspected & cleaned" },
  { icon: RotateCcw, label: "Easy Returns", note: "Hassle-free pickup" },
];

/** Slim trust strip — high signal, minimal vertical space. */
export function TrustBadges() {
  return (
    <section className="container pb-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        {BADGES.map((b) => {
          const Icon = b.icon;
          return (
            <div
              key={b.label}
              className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-soft"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs md:text-sm font-medium leading-tight truncate">{b.label}</span>
                <span className="block text-[10px] md:text-[11px] text-muted-foreground truncate">{b.note}</span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
