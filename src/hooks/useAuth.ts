import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { hasSupabaseEnv } from "../lib/env";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  user: Session["user"] | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasSupabaseEnv || !supabase) {
      setSession(null);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const init = async () => {
      const { data } = await supabase!.auth.getSession();
      if (isMounted) {
        setSession(data.session);
        setLoading(false);
      }
    };

    void init();

    const { data } = supabase!.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return createElement(AuthContext.Provider, { value: { session, loading, user: session?.user ?? null } }, children);
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
