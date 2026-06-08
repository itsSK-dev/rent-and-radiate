import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2, Check, Bell, Settings } from "lucide-react";

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { items, unreadCount, markRead, markAllRead, remove } = useNotifications(100);

  useEffect(() => { document.title = "Notifications · Rent & Radiate"; }, []);
  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/notifications");
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container max-w-3xl py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-rose-deep mb-2">Inbox</p>
            <h1 className="font-display text-4xl">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/settings/notifications")}>
              <Settings className="h-4 w-4 mr-2" />Preferences
            </Button>
            {unreadCount > 0 && (
              <Button variant="soft" size="sm" onClick={() => markAllRead()}>
                <Check className="h-4 w-4 mr-2" />Mark all read
              </Button>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-16 text-center text-muted-foreground">
            <Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />
            No notifications yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li
                key={n.id}
                className={`rounded-2xl border p-4 flex gap-4 transition-smooth ${
                  n.is_read ? "bg-card" : "bg-primary/5 border-primary/20"
                }`}
              >
                {n.image_url && (
                  <img src={n.image_url} alt="" className="h-14 w-14 rounded-lg object-cover flex-shrink-0" />
                )}
                <button
                  className="flex-1 text-left min-w-0"
                  onClick={async () => {
                    if (!n.is_read) await markRead(n.id);
                    if (n.link_url) navigate(n.link_url);
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{n.title}</p>
                    <Badge variant="outline" className="text-[10px]">{n.type.replace(/_/g, " ")}</Badge>
                  </div>
                  {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </button>
                <button
                  aria-label="Delete"
                  onClick={() => remove(n.id)}
                  className="text-muted-foreground hover:text-destructive self-start p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Footer />
    </div>
  );
}
