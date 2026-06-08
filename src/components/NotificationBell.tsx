import { Bell, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

export function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead, remove } = useNotifications(20);
  const navigate = useNavigate();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-display text-lg">Notifications</div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => markAllRead()}>
                <Check className="h-3.5 w-3.5 mr-1" /> Mark all read
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">You're all caught up ✨</div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id} className={`p-3 flex gap-3 ${n.is_read ? "" : "bg-primary/5"}`}>
                  {n.image_url && (
                    <img src={n.image_url} alt="" className="h-10 w-10 rounded object-cover flex-shrink-0" />
                  )}
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={async () => {
                      if (!n.is_read) await markRead(n.id);
                      if (n.link_url) navigate(n.link_url);
                    }}
                  >
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </button>
                  <button
                    aria-label="Delete"
                    onClick={() => remove(n.id)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t p-2 flex justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/notifications")}>View all</Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/settings/notifications")}>Settings</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
