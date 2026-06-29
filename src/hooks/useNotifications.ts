import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  image_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

export function useNotifications(limit = 30) {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit);
    setItems((data ?? []) as NotificationRow[]);
    setLoading(false);
  }, [user, limit]);

  useEffect(() => { void load(); }, [load]);

  const limitRef = useRef(limit);
  useEffect(() => { limitRef.current = limit; }, [limit]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as NotificationRow;
          setItems((cur) => [row, ...cur].slice(0, limitRef.current));
          toast(row.title, { description: row.body ?? undefined });
        })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  const unreadCount = items.filter((n) => !n.is_read).length;

  async function markRead(id: string) {
    setItems((cur) => cur.map((n) => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
  }
  async function markAllRead() {
    if (!user) return;
    setItems((cur) => cur.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("is_read", false);
  }
  async function remove(id: string) {
    setItems((cur) => cur.filter((n) => n.id !== id));
    await supabase.from("notifications").update({ is_deleted: true }).eq("id", id);
  }

  return { items, loading, unreadCount, markRead, markAllRead, remove, reload: load };
}
