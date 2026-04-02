const readEnv = (name: string): string | null => {
  const value = (import.meta.env as Record<string, string | undefined>)[name];
  return value?.trim() ? value : null;
};

export const env = {
  supabaseUrl: readEnv("VITE_SUPABASE_URL"),
  supabaseAnonKey: readEnv("VITE_SUPABASE_ANON_KEY"),
  groqApiKey: readEnv("VITE_GROQ_API_KEY") ?? readEnv("GROQ_API_KEY"),
  /** Post-Stripe return base; production should be https://promptfix-orcin.vercel.app */
  publicAppUrl: readEnv("VITE_PUBLIC_APP_URL"),
  stripeCheckoutUrl: readEnv("VITE_STRIPE_CHECKOUT_URL") ?? readEnv("VITE_STRIPE_PORTAL_URL"),
  stripeBillingPortalUrl:
    readEnv("VITE_STRIPE_BILLING_PORTAL_URL") ?? readEnv("VITE_STRIPE_BILLING_PORTAL_TEST_URL"),
};

export const missingSupabaseEnv = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"].filter((key) => {
  return !(import.meta.env as Record<string, string | undefined>)[key]?.trim();
});

export const hasSupabaseEnv = missingSupabaseEnv.length === 0;
