import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface PromptTemplate {
  id: string;
  category: string;
  title: string;
  description: string;
  template_text: string;
  platform: string | null;
  prompt_type: string | null;
  usage_count: number;
  created_at: string;
}

export function useTemplates() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // No auth required — public read policy
      const client = supabase;
      if (!client) {
        setLoading(false);
        return;
      }
      const { data } = await client
        .from("prompt_templates")
        .select("*")
        .order("usage_count", { ascending: false });

      if (!cancelled) {
        setTemplates((data ?? []) as PromptTemplate[]);
        setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const trackUsage = async (templateId: string) => {
    if (!supabase) return;
    // Fire-and-forget — don't block the UI
    void supabase.rpc("increment_template_usage", { template_id: templateId });
    // Optimistically update local count
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === templateId ? { ...t, usage_count: t.usage_count + 1 } : t,
      ),
    );
  };

  return { templates, loading, trackUsage };
}
