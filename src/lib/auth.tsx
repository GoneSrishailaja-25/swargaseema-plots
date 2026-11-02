import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = { user: User | null; isAdmin: boolean; isOfficer: boolean; loading: boolean };
const AuthCtx = createContext<AuthState>({
  user: null,
  isAdmin: false,
  isOfficer: false,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAdmin: false,
    isOfficer: false,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    const load = async (user: User | null) => {
      try {
        if (!user) {
          if (mounted) setState({ user: null, isAdmin: false, isOfficer: false, loading: false });
          return;
        }
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        if (error) {
          console.warn("[Auth] Failed to fetch user roles:", error.message);
        }
        if (mounted) {
          setState({
            user,
            isAdmin: !!data?.some((r) => r.role === "admin"),
            isOfficer: !!data?.some((r) => r.role === "officer"),
            loading: false,
          });
        }
      } catch (err) {
        console.warn("[Auth] Exception during user role check:", err);
        if (mounted) setState({ user: null, isAdmin: false, isOfficer: false, loading: false });
      }
    };

    let sub: { subscription?: { unsubscribe: () => void } } | undefined;
    try {
      const res = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "TOKEN_REFRESHED") return;
        setTimeout(() => load(session?.user ?? null), 0);
      });
      sub = res?.data;
    } catch (e) {
      console.warn("[Auth] onAuthStateChange subscription failed:", e);
    }

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (mounted) load(data?.user ?? null);
      })
      .catch((err) => {
        console.warn("[Auth] getUser failed:", err);
        if (mounted) setState({ user: null, isAdmin: false, isOfficer: false, loading: false });
      });

    return () => {
      mounted = false;
      try {
        sub?.subscription?.unsubscribe();
      } catch (err) {
        void err;
      }
    };
  }, []);

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
