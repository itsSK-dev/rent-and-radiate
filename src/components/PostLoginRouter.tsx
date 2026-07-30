import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { consumeOAuthPending, readIntent, resolvePostLoginPath, safeNext } from "@/lib/authRouting";

/**
 * Completes OAuth (and any provider redirect) sign-ins that land back on a public
 * route: once the session + roles are resolved, sends the user to their role's home.
 * Does nothing for normal in-app navigation.
 */
export function PostLoginRouter() {
  const { user, roles, deliveryApplication, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!ready || !user) return;
    const pending = consumeOAuthPending();
    if (!pending) return;
    const next = safeNext(pending === "1" ? null : pending);
    const target = resolvePostLoginPath({
      roles,
      deliveryApplication,
      intent: readIntent(),
      next,
    });
    if (target !== location.pathname) navigate(target, { replace: true });
  }, [ready, user, roles, deliveryApplication, navigate, location.pathname]);

  return null;
}
