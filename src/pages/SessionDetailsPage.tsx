import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { PromptSession } from "../types/database";

export const SessionDetailsPage = () => {
  const { id } = useParams();
  const [session, setSession] = useState<PromptSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      if (!id) {
        setError("Session id is missing.");
        setLoading(false);
        return;
      }

      if (!supabase) {
        setError("Supabase is not configured.");
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("prompt_sessions")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setSession(data as PromptSession);
      setLoading(false);
    };

    void loadSession();
  }, [id]);

  if (loading) {
    return <p className="text-sm text-[#636366]">Loading session…</p>;
  }

  if (error || !session) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-rose-500">{error ?? "Session not found."}</p>
        <Link to="/dashboard" className="text-sm font-medium text-[#3B82F6] no-underline hover:text-[#2563EB]">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <Link to="/dashboard" className="text-sm font-medium text-[#3B82F6] no-underline hover:text-[#2563EB]">
        ← Back to dashboard
      </Link>

      <div
        className="rounded-2xl border border-[#E5E5EA] p-6"
        style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(12px)" }}
      >
        <h1 className="text-2xl font-semibold text-[#1C1C1E]">{session.title}</h1>
        <p className="mt-2 text-sm text-[#636366]">
          {session.platform ?? "Unknown platform"} —{" "}
          {session.mode ?? "general"} mode
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {[
            { label: "Original Prompt", value: session.original_prompt },
            { label: "Improved Prompt", value: session.improved_prompt },
            { label: "Alternative One", value: session.alternative_one },
            { label: "Alternative Two", value: session.alternative_two },
            { label: "Alternative Three", value: session.alternative_three },
            { label: "Key Changes", value: session.key_changes },
          ].map(({ label, value }) => (
            <div key={label}>
              <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                {label}
              </h2>
              <p className="whitespace-pre-wrap break-words text-sm text-[#1C1C1E]">
                {value ?? <span className="text-[#8E8E93]">Not available.</span>}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
