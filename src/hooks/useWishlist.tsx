import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface WishlistContextValue {
  ids: Set<string>;
  loading: boolean;
  isSaved: (productId: string) => boolean;
  toggle: (productId: string, title?: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setIds(new Set()); return; }
    setLoading(true);
    const { data } = await supabase.from("wishlists").select("product_id").eq("user_id", user.id);
    setIds(new Set((data ?? []).map((r) => r.product_id as string)));
    setLoading(false);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const toggle = useCallback(async (productId: string, title?: string) => {
    if (!user) {
      toast.error("Please sign in to save items");
      return;
    }
    const already = ids.has(productId);
    // Optimistic
    setIds((prev) => {
      const next = new Set(prev);
      if (already) next.delete(productId); else next.add(productId);
      return next;
    });
    if (already) {
      const { error } = await supabase.from("wishlists").delete().eq("user_id", user.id).eq("product_id", productId);
      if (error) { void refresh(); return toast.error(error.message); }
      toast.success(title ? `Removed "${title}" from wishlist` : "Removed from wishlist");
    } else {
      const { error } = await supabase.from("wishlists").insert({ user_id: user.id, product_id: productId });
      if (error) { void refresh(); return toast.error(error.message); }
      toast.success(title ? `Saved "${title}" to wishlist` : "Saved to wishlist");
    }
  }, [user, ids, refresh]);

  const isSaved = useCallback((id: string) => ids.has(id), [ids]);

  return (
    <WishlistContext.Provider value={{ ids, loading, isSaved, toggle, refresh }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
