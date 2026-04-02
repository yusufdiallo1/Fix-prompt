import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { CodeSession, PromptSession } from "../types/database";

type LoadedSession =
  | { kind: "improve"; data: PromptSession }
  | { kind: "fix"; data: CodeSession };

export const SessionDetailsPage = () => {
  const { id } = useParams();
  const [session, setSession] = useState<LoadedSession | null>(null);
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

      const { data: promptRow, error: promptError } = await supabase
        .from("prompt_sessions")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (promptError) {
        setError(promptError.message);
        setLoading(false);
        return;
      }

      if (promptRow) {
        setSession({ kind: "improve", data: promptRow as PromptSession });
        setLoading(false);
        return;
      }

      const { data: codeRow, error: codeError } = await supabase
        .from("code_sessions")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (codeError) {
        setError(codeError.message);
        setLoading(false);
        return;
      }

      if (codeRow) {
        setSession({ kind: "fix", data: codeRow as CodeSession });
        setLoading(false);
        return;
      }

      setError("Session not found.");
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

  if (session.kind === "fix") {
    const s = session.data;
    return (
      <section className="space-y-6 overflow-x-hidden">
        <Link to="/history" className="text-sm font-medium text-[#3B82F6] no-underline hover:text-[#2563EB]">
          ← Back to history
        </Link>

        <div
          className="rounded-2xl border border-[#E5E5EA] p-6"
          style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(12px)" }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-[#1C1C1E]">{s.title}</h1>
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">Fix</span>
            {s.language_detected ? (
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
                {s.language_detected}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-[#636366]">{s.platform ?? "Other"}</p>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {[
              { label: "Original code", value: s.original_code },
              { label: "Error (optional)", value: s.error_description },
              { label: "Fixed code", value: s.fixed_code },
              { label: "What was fixed", value: s.fix_explanation },
              { label: "Bugs found", value: s.bugs_found },
              { label: "Key fixes", value: s.key_fixes },
              { label: "Prevention tips", value: s.prevention_tips },
            ].map(({ label, value }) => (
              <div key={label}>
                <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">{label}</h2>
                <p className="code-block-scroll max-h-[320px] overflow-auto overflow-x-auto whitespace-pre-wrap break-words text-sm text-[#1C1C1E]">
                  {value != null && String(value).trim() !== "" ? value : (
                    <span className="text-[#8E8E93]">Not available.</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const sessionData = session.data;
  return (
    <section className="space-y-6">
      <Link to="/dashboard" className="text-sm font-medium text-[#3B82F6] no-underline hover:text-[#2563EB]">
        ← Back to dashboard
      </Link>

      <div
        className="rounded-2xl border border-[#E5E5EA] p-6"
        style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(12px)" }}
      >
        <h1 className="text-2xl font-semibold text-[#1C1C1E]">{sessionData.title}</h1>
        <p className="mt-2 text-sm text-[#636366]">
          {sessionData.platform ?? "Unknown platform"} — {sessionData.mode ?? "general"} mode
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {[
            { label: "Original Prompt", value: sessionData.original_prompt },
            { label: "Improved Prompt", value: sessionData.improved_prompt },
            { label: "Alternative One", value: sessionData.alternative_one },
            { label: "Alternative Two", value: sessionData.alternative_two },
            { label: "Alternative Three", value: sessionData.alternative_three },
            { label: "Key Changes", value: sessionData.key_changes },
          ].map(({ label, value }) => (
            <div key={label}>
              <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">{label}</h2>
              <p className="whitespace-pre-wrap break-words text-sm text-[#1C1C1E]">
                {value != null && String(value).trim() !== "" ? value : (
                  <span className="text-[#8E8E93]">Not available.</span>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
