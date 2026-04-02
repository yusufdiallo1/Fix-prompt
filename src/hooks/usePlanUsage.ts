import { useCallback, useEffect, useState } from "react";
import {
  FREE_PROMPT_LIMIT,
  getCurrentMonthUsage,
  getUserPlanProfile,
  isProTier,
  isPlanSchemaUnsupported,
  PENDING_UPGRADE_FLAG,
  PENDING_UPGRADE_AT,
  syncProAccessForCurrentUser,
} from "../lib/billing";
import { supabase } from "../lib/supabase";

interface PlanUsageState {
  loading: boolean;
  isPro: boolean;
  usageCount: number;
  remainingCount: number;
}

const initialState: PlanUsageState = {
  loading: true,
  isPro: false,
  usageCount: 0,
  remainingCount: FREE_PROMPT_LIMIT,
};

export const usePlanUsage = (userId?: string) => {
  const [state, setState] = useState<PlanUsageState>(initialState);

  const refresh = useCallback(async () => {
    if (!userId || !supabase) {
      setState({
        loading: false,
        isPro: false,
        usageCount: 0,
        remainingCount: FREE_PROMPT_LIMIT,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));
    const [profile, usage] = await Promise.all([getUserPlanProfile(userId), getCurrentMonthUsage(userId)]);

    let isPro = isProTier(
      profile?.plan_tier,
      profile?.subscription_status,
    );

    const pendingUpgrade =
      typeof window !== "undefined" && window.localStorage.getItem(PENDING_UPGRADE_FLAG) === "1";
    const pendingUpgradeAt =
      typeof window !== "undefined" ? Number(window.localStorage.getItem(PENDING_UPGRADE_AT) ?? "0") : 0;
    const pendingRecently = Number.isFinite(pendingUpgradeAt) && pendingUpgradeAt > 0
      ? Date.now() - pendingUpgradeAt < 24 * 60 * 60 * 1000
      : false;
    const shouldAttemptSync = !isPro && (pendingUpgrade || pendingRecently) && !isPlanSchemaUnsupported();

    if (shouldAttemptSync) {
      try {
        await syncProAccessForCurrentUser();
        isPro = true;
        window.localStorage.removeItem(PENDING_UPGRADE_FLAG);
        window.localStorage.removeItem(PENDING_UPGRADE_AT);
      } catch (error) {
        if (error instanceof Error && error.message.toLowerCase().includes("schema")) {
          window.localStorage.removeItem(PENDING_UPGRADE_FLAG);
          window.localStorage.removeItem(PENDING_UPGRADE_AT);
        } else {
          console.error("Automatic pro sync failed", error);
        }
      }
    } else if (isPro && pendingUpgrade) {
      window.localStorage.removeItem(PENDING_UPGRADE_FLAG);
      window.localStorage.removeItem(PENDING_UPGRADE_AT);
    }

    setState({
      loading: false,
      isPro,
      usageCount: usage,
      remainingCount: Math.max(0, FREE_PROMPT_LIMIT - usage),
    });
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const recheck = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [refresh, userId]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    const flag = window.localStorage.getItem(PENDING_UPGRADE_FLAG) === "1";
    const at = Number(window.localStorage.getItem(PENDING_UPGRADE_AT) ?? "0");
    const recent = Number.isFinite(at) && at > 0 ? Date.now() - at < 24 * 60 * 60 * 1000 : false;
    if ((!flag && !recent) || isPlanSchemaUnsupported()) return;
    const id = window.setInterval(() => {
      void refresh();
    }, 7000);
    return () => window.clearInterval(id);
  }, [refresh, userId]);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  useEffect(() => {
    if (!supabase || !userId) return;
    const sb = supabase;
    const topic = `users_profiles_plan_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const channel = sb.channel(topic);
    let active = true;
    try {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users_profiles",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (!active) return;
          void refresh();
        },
      );
      channel.subscribe((status) => {
        if (!active) return;
        if (status === "CHANNEL_ERROR") {
          void refresh();
        }
      });
    } catch (error) {
      console.error("Plan usage realtime subscribe failed", error);
    }
    return () => {
      active = false;
      void sb.removeChannel(channel);
    };
  }, [refresh, userId]);

  return { ...state, refresh };
};
