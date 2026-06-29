import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOverview, inr } from "@/lib/adminStats";
import {
  Users, Store, Package, Truck, CheckCircle2, ShoppingBag,
  Clock, IndianRupee, Percent, RefreshCw, BadgeCheck,
} from "lucide-react";

type Stats = Awaited<ReturnType<typeof fetchOverview>>;

const cards = (s: Stats) => [
  { label: "Total users", value: s.totalUsers.toLocaleString("en-IN"), icon: Users },
  { label: "Total sellers", value: s.totalSellers.toLocaleString("en-IN"), icon: Store },
  { label: "Total products", value: s.totalProducts.toLocaleString("en-IN"), icon: Package },
  { label: "Active rentals", value: s.activeRentals.toLocaleString("en-IN"), icon: Truck },
  { label: "Completed rentals", value: s.completedRentals.toLocaleString("en-IN"), icon: CheckCircle2 },
  { label: "Total orders", value: s.totalOrders.toLocaleString("en-IN"), icon: ShoppingBag },
  { label: "Pending orders", value: s.pendingOrders.toLocaleString("en-IN"), icon: Clock },
  { label: "Total revenue", value: inr(s.totalRevenue), icon: IndianRupee, highlight: true },
  { label: "Platform commission", value: inr(s.platformCommission), icon: Percent, highlight: true },
  { label: "Pending refunds", value: s.pendingRefunds.toLocaleString("en-IN"), icon: RefreshCw },
  { label: "Completed refunds", value: s.completedRefunds.toLocaleString("en-IN"), icon: BadgeCheck },
];

export function AdminOverviewPanel() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    fetchOverview().then((s) => { if (alive) setStats(s); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 11 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards(stats).map(({ label, value, icon: Icon, highlight }) => (
        <Card
          key={label}
          className={`rounded-2xl border-border ${highlight ? "bg-primary-soft/40" : ""}`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {label}
            </CardTitle>
            <Icon className="h-4 w-4 text-rose-deep" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display tabular-nums">{value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
