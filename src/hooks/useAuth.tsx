import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "customer" | "store_owner" | "admin" | "delivery_partner";
export type DeliveryApplicationStatus = "none" | "pending" | "approved" | "rejected" | "suspended";

const DEBUG = true;
export function authLog(scope: string, ...args: unknown[]) {
  if (DEBUG) console.info(`[auth:${scope}]`, ...args);
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: Role[];
  /** Delivery partner application status for the signed-in user ("none" = never applied). */
  deliveryApplication: DeliveryApplicationStatus;
  /** True once roles + delivery application have been resolved for the current user. */
  ready: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [deliveryApplication, setDeliveryApplication] = useState<DeliveryApplicationStatus>("none");
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfileContext(uid: string) {
      const [rolesRes, dpRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("delivery_partners").select("status").eq("user_id", uid).maybeSingle(),
      ]);
      if (!active) return;
      const nextRoles = (rolesRes.data ?? []).map((r) => r.role as Role);
      const dpStatus = (dpRes.data?.status as DeliveryApplicationStatus | undefined) ?? "none";
      authLog("roles", { uid, roles: nextRoles, deliveryApplication: dpStatus });
      setRoles(nextRoles);
      setDeliveryApplication(dpStatus);
    }

    async function syncAuthState(event: string, s: Session | null) {
      if (!active) return;
      authLog("session", event, { userId: s?.user?.id ?? null, email: s?.user?.email ?? null });

      setLoading(true);
      setReady(false);
      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        await loadProfileContext(s.user.id);
      } else {
        setRoles([]);
        setDeliveryApplication("none");
      }

      if (active) {
        setLoading(false);
        setReady(true);
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      void syncAuthState(event, s);
    });

    void supabase.auth.getSession().then(({ data }) => syncAuthState("RESTORE", data.session));

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshRoles = useCallback(async () => {
    if (!user) return;
    const [rolesRes, dpRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("delivery_partners").select("status").eq("user_id", user.id).maybeSingle(),
    ]);
    const nextRoles = (rolesRes.data ?? []).map((r) => r.role as Role);
    authLog("refreshRoles", { roles: nextRoles, deliveryApplication: dpRes.data?.status ?? "none" });
    setRoles(nextRoles);
    setDeliveryApplication((dpRes.data?.status as DeliveryApplicationStatus | undefined) ?? "none");
  }, [user]);

  async function signOut() {
    authLog("signOut", { userId: user?.id ?? null });
    try { localStorage.removeItem("rr_auth_intent"); } catch { /* noop */ }
    try { localStorage.removeItem("rr_oauth_pending"); } catch { /* noop */ }
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ user, session, roles, deliveryApplication, ready, loading, signOut, refreshRoles }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
