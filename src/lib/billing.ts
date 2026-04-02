import { supabase } from "./supabase";
import { env } from "./env";

export const FREE_PROMPT_LIMIT = 10;
export const PENDING_UPGRADE_FLAG = "pf_pending_pro_upgrade";
export const PENDING_UPGRADE_AT = "pf_pending_pro_upgrade_at";
let checkoutOpenLock = false;
let checkoutOpenAt = 0;
let planSchemaUnsupported = false;
let warnedPlanSchemaUnsupported = false;

export const PRO_FEATURES = [
  "Unlimited prompt improvements",
  "Unlimited debug sessions",
  "Unlimited saved prompts",
  "Priority AI response speed",
  "Access to every current and future premium feature",
] as const;

export type PlanTier = "free" | "pro" | "custom";
export interface PlanProfile {
  plan_tier: string | null;
  subscription_status: string | null;
}

const isMissingColumnError = (message: string | undefined) =>
  (message ?? "").toLowerCase().includes("column") && (message ?? "").toLowerCase().includes("does not exist");
const isSchemaCacheError = (message: string | undefined) =>
  (message ?? "").toLowerCase().includes("schema cache");
const isPlanSchemaError = (message: string | undefined) => {
  const text = (message ?? "").toLowerCase();
  return (
    (isMissingColumnError(message) || isSchemaCacheError(message)) &&
    (text.includes("plan_tier") || text.includes("subscription_status") || text.includes("users_profiles"))
  );
};

export const isPlanSchemaUnsupported = () => planSchemaUnsupported;

const markPlanSchemaUnsupported = (reason: string) => {
  planSchemaUnsupported = true;
  if (!warnedPlanSchemaUnsupported) {
    warnedPlanSchemaUnsupported = true;
    console.warn(`Plan schema mismatch detected (${reason}). Pro auto-sync is temporarily disabled.`);
  }
};

const derivePlanFromProfileRow = (row: Record<string, unknown> | null): PlanProfile | null => {
  if (!row) return null;
  const maybeBooleanPro = row.is_pro === true || row.pro === true || row.is_paid === true;
  const tierValue = [row.plan_tier, row.tier, row.subscription_plan, row.plan]
    .find((value) => typeof value === "string") as string | undefined;
  const statusValue = [row.subscription_status, row.subscription, row.status]
    .find((value) => typeof value === "string") as string | undefined;

  return {
    plan_tier: tierValue ?? (maybeBooleanPro ? "pro" : null),
    subscription_status: statusValue ?? (maybeBooleanPro ? "active" : null),
  };
};

export const isProTier = (planTier: string | null | undefined, subscriptionStatus: string | null | undefined) => {
  if (!planTier) return false;
  if (!["pro", "custom"].includes(planTier)) return false;
  if (!subscriptionStatus) return true;
  return ["active", "trialing", "paid"].includes(subscriptionStatus);
};

export const getCurrentMonthUsage = async (userId: string) => {
  if (!supabase) return 0;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { count: promptCount, error: promptError } = await supabase
    .from("prompt_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", monthStart);

  if (promptError) {
    console.error("Failed to fetch monthly prompt usage", promptError);
  }

  const { count: codeCount, error: codeError } = await supabase
    .from("code_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", monthStart);

  if (codeError) {
    console.error("Failed to fetch monthly code session usage", codeError);
  }

  return (promptCount ?? 0) + (codeError ? 0 : (codeCount ?? 0));
};

export const getUserPlanProfile = async (userId: string): Promise<PlanProfile | null> => {
  if (!supabase) return null;
  if (planSchemaUnsupported) return null;
  const primary = await supabase
    .from("users_profiles")
    .select("plan_tier,subscription_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!primary.error) {
    const data = primary.data as { plan_tier?: string | null; subscription_status?: string | null } | null;
    return {
      plan_tier: data?.plan_tier ?? null,
      subscription_status: data?.subscription_status ?? null,
    };
  }

  if (!isPlanSchemaError(primary.error.message)) {
    console.error("Failed to fetch plan profile", primary.error);
    return null;
  }

  const fallbackAny = await supabase
    .from("users_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (fallbackAny.error) {
    markPlanSchemaUnsupported("users_profiles has no plan columns");
    return null;
  }

  const row = (fallbackAny.data as Record<string, unknown> | null) ?? null;
  const derived = derivePlanFromProfileRow(row);
  if (!derived) {
    markPlanSchemaUnsupported("unable to derive tier fields from users_profiles");
    return null;
  }
  return derived;
};

export const openProCheckout = () => {
  const now = Date.now();
  if (checkoutOpenLock && now - checkoutOpenAt < 3000) {
    return;
  }
  checkoutOpenLock = true;
  checkoutOpenAt = now;

  const url = env.stripeCheckoutUrl;
  if (!url) {
    checkoutOpenLock = false;
    throw new Error("Stripe checkout URL is missing. Set VITE_STRIPE_CHECKOUT_URL.");
  }
  window.localStorage.setItem(PENDING_UPGRADE_FLAG, "1");
  window.localStorage.setItem(PENDING_UPGRADE_AT, String(Date.now()));
  const returnUrl = "http://localhost:5176/dashboard";
  const checkoutUrl = (() => {
    try {
      const parsed = new URL(url);
      if (!parsed.searchParams.has("return_url")) parsed.searchParams.set("return_url", returnUrl);
      if (!parsed.searchParams.has("redirect_url")) parsed.searchParams.set("redirect_url", returnUrl);
      return parsed.toString();
    } catch {
      return url;
    }
  })();

  // Open Stripe in a new tab only; do not redirect current tab.
  const popup = window.open(checkoutUrl, "_blank");
  if (popup) {
    popup.opener = null;
    const poll = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(poll);
        window.location.href = returnUrl;
      }
    }, 1000);
    window.setTimeout(() => {
      checkoutOpenLock = false;
    }, 3500);
    return;
  }
  checkoutOpenLock = false;
  throw new Error("Unable to open Stripe checkout. Please allow pop-ups and try again.");
};

export const syncProAccessForCurrentUser = async () => {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  if (planSchemaUnsupported) {
    throw new Error("Plan schema is not compatible for automatic sync.");
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user?.id) {
    throw new Error("Unable to identify current user.");
  }

  const email = authData.user.email?.trim();
  if (!email) {
    throw new Error("Unable to sync Pro plan: account email is missing.");
  }

  const primaryUpsert = await supabase
    .from("users_profiles")
    .upsert(
      {
        user_id: authData.user.id,
        email,
        full_name:
          typeof authData.user.user_metadata?.full_name === "string"
            ? authData.user.user_metadata.full_name
            : null,
        avatar_url:
          typeof authData.user.user_metadata?.avatar_url === "string"
            ? authData.user.user_metadata.avatar_url
            : null,
        plan_tier: "pro",
        subscription_status: "active",
      },
      { onConflict: "user_id" },
    );

  if (!primaryUpsert.error) return;

  if (isPlanSchemaError(primaryUpsert.error.message)) {
    const fallbackPayloads: Array<Record<string, unknown>> = [
      {
        user_id: authData.user.id,
        email,
        full_name:
          typeof authData.user.user_metadata?.full_name === "string"
            ? authData.user.user_metadata.full_name
            : null,
        avatar_url:
          typeof authData.user.user_metadata?.avatar_url === "string"
            ? authData.user.user_metadata.avatar_url
            : null,
        is_pro: true,
      },
      {
        user_id: authData.user.id,
        email,
        tier: "pro",
      },
      {
        user_id: authData.user.id,
        email,
        subscription_status: "active",
      },
    ];

    for (const payload of fallbackPayloads) {
      const attempt = await supabase
        .from("users_profiles")
        .upsert(payload, { onConflict: "user_id" });
      if (!attempt.error) return;
    }

    markPlanSchemaUnsupported("upsert failed for all known plan payloads");
    const fallbackUpsert = await supabase
      .from("users_profiles")
      .upsert(
        {
          user_id: authData.user.id,
          email,
          full_name:
            typeof authData.user.user_metadata?.full_name === "string"
              ? authData.user.user_metadata.full_name
              : null,
          avatar_url:
            typeof authData.user.user_metadata?.avatar_url === "string"
              ? authData.user.user_metadata.avatar_url
              : null,
        },
        { onConflict: "user_id" },
      );
    if (!fallbackUpsert.error) {
      throw new Error("Plan schema is not compatible for automatic sync.");
    }
    throw new Error(fallbackUpsert.error.message);
  }
  throw new Error(primaryUpsert.error.message);
};
