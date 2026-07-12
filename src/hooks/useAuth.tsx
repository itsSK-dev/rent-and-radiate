import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "customer" | "store_owner" | "admin" | "delivery_partner";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: Role[];
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function syncAuthState(s: Session | null) {
      if (!active) return;

      setLoading(true);
      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        await loadRoles(s.user.id);
      } else {
        setRoles([]);
      }

      if (active) setLoading(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      void syncAuthState(s);
    });

    void supabase.auth.getSession().then(({ data }) => syncAuthState(data.session));

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function loadRoles(uid: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles((data ?? []).map((r) => r.role as Role));
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshRoles() {
    if (user) await loadRoles(user.id);
  }

  return (
    <AuthContext.Provider value={{ user, session, roles, loading, signOut, refreshRoles }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
