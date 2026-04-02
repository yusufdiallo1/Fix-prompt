import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { hasSupabaseEnv } from "../lib/env";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  user: Session["user"] | null;
  bootstrapError: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const clearStaleSupabaseAuthStorage = () => {
  try {
    const keys = Object.keys(window.localStorage);
    keys.forEach((key) => {
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        window.localStorage.removeItem(key);
      }
    });
  } catch {
    // Ignore storage access issues; boot should continue regardless.
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv || !supabase) {
      setSession(null);
      setLoading(false);
      setBootstrapError(null);
      return;
    }

    let isMounted = true;
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (!isMounted || settled) return;
      settled = true;
      clearStaleSupabaseAuthStorage();
      setSession(null);
      setBootstrapError("Auth bootstrap timed out. Showing safe signed-out state.");
      setLoading(false);
    }, 7000);

    const init = async () => {
      try {
        const { data, error } = await supabase!.auth.getSession();
        if (error) {
          clearStaleSupabaseAuthStorage();
          try {
            await supabase!.auth.signOut();
          } catch {
            // Keep boot resilient even if remote sign-out fails.
          }
        }
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        if (isMounted) {
          setSession(data.session ?? null);
          setBootstrapError(error?.message ?? null);
          setLoading(false);
        }
      } catch {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        clearStaleSupabaseAuthStorage();
        if (isMounted) {
          setSession(null);
          setBootstrapError("Auth bootstrap failed unexpectedly. Showing safe signed-out state.");
          setLoading(false);
        }
      }
    };

    void init();

    const { data } = supabase!.auth.onAuthStateChange((_event, nextSession) => {
      settled = true;
      window.clearTimeout(timeoutId);
      setSession(nextSession);
      setBootstrapError(null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      data.subscription.unsubscribe();
    };
  }, []);

  return createElement(
    AuthContext.Provider,
    { value: { session, loading, user: session?.user ?? null, bootstrapError } },
    children,
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
