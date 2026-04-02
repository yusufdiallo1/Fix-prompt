import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePlanUsage } from "../hooks/usePlanUsage";
import { supabase } from "../lib/supabase";
import { debugPrompt, type DebugPromptResponse } from "../lib/groq";
import { UpgradeModal } from "../components/UpgradeModal";
import { ExportSessionButton } from "../components/ExportSessionButton";
import { FREE_PROMPT_LIMIT, getCurrentMonthUsage, getUserPlanProfile, isProTier, openProCheckout } from "../lib/billing";
import { downloadSessionAsTxt, formatSessionForMarkdown, formatSessionForNotes, formatSessionForNotion, type ExportSessionData } from "../lib/sessionExport";

const PLATFORMS = ["Lovable", "Cursor", "Replit", "Claude Code", "Codex", "Other"] as const;
type Platform = (typeof PLATFORMS)[number];

const PLATFORM_ACTIVE: Record<Platform, string> = {
  Lovable: "border-purple-300 bg-purple-100 text-purple-700",
  Cursor: "border-blue-300 bg-blue-100 text-blue-700",
  Replit: "border-orange-300 bg-orange-100 text-orange-700",
  "Claude Code": "border-violet-300 bg-violet-100 text-violet-700",
  Codex: "border-emerald-300 bg-emerald-100 text-emerald-700",
  Other: "border-[#D1D1D6] bg-[#F2F2F7] text-[#636366]",
};

const ROOT_CAUSE_BADGE: Record<string, { bg: string; text: string }> = {
  MISSING_CONTEXT: { bg: "bg-rose-100", text: "text-rose-700" },
  AMBIGUOUS_REQUIREMENTS: { bg: "bg-orange-100", text: "text-orange-700" },
  PLATFORM_LIMITATION: { bg: "bg-blue-100", text: "text-blue-700" },
  SCOPE_CREEP: { bg: "bg-yellow-100", text: "text-yellow-700" },
  TECH_MISMATCH: { bg: "bg-purple-100", text: "text-purple-700" },
  MISSING_DEPENDENCY: { bg: "bg-pink-100", text: "text-pink-700" },
  LOGIC_ERROR: { bg: "bg-red-100", text: "text-red-700" },
  STYLE_CONFLICT: { bg: "bg-teal-100", text: "text-teal-700" },
};

const LOADING_MESSAGES = [
  "Reading your original prompt...",
  "Diagnosing the broken code...",
  "Identifying root causes...",
  "Writing your fix prompt...",
];

interface AnalysisResult {
  rootCause: keyof typeof ROOT_CAUSE_BADGE;
  rootCauseLabel: string;
  diagnosisSummary: string;
  issues: string[];
  confidence: number;
  fixedCode: string;
  codeExplanation: string;
  alternativeOne: string;
  alternativeTwo: string;
  alternativeThree: string;
  alternativeOneStyle: string;
  alternativeTwoStyle: string;
  alternativeThreeStyle: string;
  keyChanges: string[];
  platformTip: string;
  preventionTips: string[];
  complexityLevel: "simple" | "medium" | "complex";
}

const ROOT_CAUSE_LABELS: Record<keyof typeof ROOT_CAUSE_BADGE, string> = {
  MISSING_CONTEXT: "Missing Context",
  AMBIGUOUS_REQUIREMENTS: "Ambiguous Requirements",
  PLATFORM_LIMITATION: "Platform Limitation",
  SCOPE_CREEP: "Scope Creep",
  TECH_MISMATCH: "Tech Mismatch",
  MISSING_DEPENDENCY: "Missing Dependency",
  LOGIC_ERROR: "Logic Error",
  STYLE_CONFLICT: "Style Conflict",
};

function BoltSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

const darkTextareaClass =
  "w-full min-h-[150px] resize-none rounded-2xl border border-white/10 bg-[rgba(30,30,34,0.90)] px-4 py-3 text-sm text-slate-100 outline-none transition duration-200 placeholder:text-slate-400 focus:border-[#3B82F6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.18)]";

const plainTextareaClass =
  "w-full min-h-[120px] resize-none rounded-2xl border border-[#D1D1D6] bg-white/75 px-4 py-3 text-sm text-[#1C1C1E] outline-none transition duration-200 placeholder:text-[#8E8E93] focus:border-[#3B82F6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.14)]";

const toAnalysisResult = (source: DebugPromptResponse): AnalysisResult => ({
  rootCause: source.root_cause,
  rootCauseLabel: ROOT_CAUSE_LABELS[source.root_cause],
  diagnosisSummary: source.diagnosis_summary,
  issues: source.specific_issues,
  confidence: source.confidence_score,
  fixedCode: source.fixed_code ?? source.fix_prompt,
  codeExplanation: source.fixed_code_explanation ?? source.diagnosis_summary,
  alternativeOne: source.alternative_code_one ?? source.alternative_fix_one,
  alternativeTwo: source.alternative_code_two ?? source.alternative_fix_two,
  alternativeThree: "",
  alternativeOneStyle: source.alternative_fix_one_style,
  alternativeTwoStyle: source.alternative_fix_two_style,
  alternativeThreeStyle: "",
  keyChanges: source.fix_key_changes,
  platformTip: source.platform_tips,
  preventionTips: source.prevention_tips,
  complexityLevel: source.complexity_level,
});

const autosize = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = "0px";
  el.style.height = `${el.scrollHeight}px`;
};

export const DebugPage = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { isPro, loading: planLoading } = usePlanUsage(user?.id);

  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const codeRef = useRef<HTMLTextAreaElement | null>(null);
  const problemRef = useRef<HTMLTextAreaElement | null>(null);

  const [platform, setPlatform] = useState<Platform | null>(null);
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [brokenCode, setBrokenCode] = useState("");
  const [problemText, setProblemText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [showPrevention, setShowPrevention] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [shake, setShake] = useState({
    platform: false,
    prompt: false,
    code: false,
    problem: false,
  });
  const [platformRowScrolling, setPlatformRowScrolling] = useState(false);
  const platformScrollTimeout = useRef<number | null>(null);

  useEffect(() => {
    const state = location.state as
      | { prefillPrompt?: string; prefillPlatform?: Platform }
      | undefined;
    if (!state) return;
    if (state.prefillPrompt) setOriginalPrompt(state.prefillPrompt);
    if (state.prefillPlatform) setPlatform(state.prefillPlatform);
  }, [location.state]);

  const isFormValid = Boolean(platform && originalPrompt.trim() && brokenCode.trim() && problemText.trim());

  useEffect(() => {
    autosize(promptRef.current);
  }, [originalPrompt]);

  useEffect(() => {
    autosize(codeRef.current);
  }, [brokenCode]);

  useEffect(() => {
    autosize(problemRef.current);
  }, [problemText]);

  useEffect(() => {
    if (!isAnalyzing) return;
    const id = window.setInterval(() => {
      setProgressIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, [isAnalyzing]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const triggerShake = (missing: Array<keyof typeof shake>) => {
    if (!missing.length) return;
    setShake((prev) => {
      const next = { ...prev };
      missing.forEach((k) => {
        next[k] = true;
      });
      return next;
    });
    window.setTimeout(() => {
      setShake((prev) => {
        const next = { ...prev };
        missing.forEach((k) => {
          next[k] = false;
        });
        return next;
      });
    }, 420);
  };

  const runValidation = () => {
    const missing: Array<keyof typeof shake> = [];
    if (!platform) missing.push("platform");
    if (!originalPrompt.trim()) missing.push("prompt");
    if (!brokenCode.trim()) missing.push("code");
    if (!problemText.trim()) missing.push("problem");
    triggerShake(missing);
    return missing.length === 0;
  };

  const handleAnalyze = async (event?: FormEvent) => {
    event?.preventDefault();
    setFormError(null);

    if (!supabase) {
      setFormError("Supabase is not configured.");
      return;
    }
    if (!user?.id) {
      setFormError("You need to be logged in to run debug analysis.");
      return;
    }
    if (supabase) {
      const [profile, usage] = await Promise.all([getUserPlanProfile(user.id), getCurrentMonthUsage(user.id)]);
      const isPro = isProTier(
        profile?.plan_tier,
        profile?.subscription_status,
      );
      if (!isPro && usage >= FREE_PROMPT_LIMIT) {
        setUsageCount(usage);
        setUpgradeOpen(true);
        return;
      }
    }
    if (!runValidation()) {
      return;
    }

    setIsAnalyzing(true);
    setProgressIndex(0);
    setShowPrevention(false);
    setAnalysis(null);

    try {
      const response = await debugPrompt({
        original_prompt: originalPrompt.trim(),
        broken_code: brokenCode.trim(),
        error_message: problemText.trim(),
        platform: platform!,
        user_id: user.id,
      });
      setAnalysis(toAnalysisResult(response));
      setToast({ kind: "success", text: "Session saved" });
    } catch (analyzeError) {
      console.error("Debug request failed", analyzeError);
      const message =
        analyzeError instanceof Error ? analyzeError.message : "Could not analyze prompt. Please try again.";
      if (message === "Slow down a little, you are sending too many requests.") {
        setToast({ kind: "error", text: message });
      }
      setFormError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      if (!(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      void handleAnalyze();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [platform, originalPrompt, brokenCode, problemText]);

  const copyLabel = useMemo(() => (copyState === "copied" ? "Copied!" : "Copy Code"), [copyState]);

  const onCopyPrompt = async () => {
    if (!analysis) return;
    await navigator.clipboard.writeText(analysis.fixedCode);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 2000);
  };

  const shareText = async (text: string) => {
    const value = `${text}\n\nImproved with PromptFix`;
    try {
      if (navigator.share) {
        await navigator.share({ text: value });
      } else {
        await navigator.clipboard.writeText(value);
        setToast({ kind: "success", text: "Copied for sharing" });
      }
    } catch (error) {
      console.error("Share failed", error);
    }
  };

  const onPlatformRowScroll = () => {
    setPlatformRowScrolling(true);
    if (platformScrollTimeout.current) window.clearTimeout(platformScrollTimeout.current);
    platformScrollTimeout.current = window.setTimeout(() => setPlatformRowScrolling(false), 650);
  };

  const buildExportData = (): ExportSessionData | null => {
    if (!analysis) return null;
    const now = new Date();
    return {
      dateLabel: now.toLocaleDateString(),
      platform: platform ?? "Other",
      promptType: "Debug",
      originalPrompt: originalPrompt.trim(),
      improvedPrompt: analysis.fixedCode.trim(),
      scoreBefore: "N/A",
      scoreAfter: "N/A",
      keyChanges: analysis.keyChanges,
      alternatives: [
        { style: analysis.alternativeOneStyle, prompt: analysis.alternativeOne },
        { style: analysis.alternativeTwoStyle, prompt: analysis.alternativeTwo },
      ].filter((alt) => alt.prompt.trim().length > 0),
    };
  };

  const exportForNotion = async () => {
    const data = buildExportData();
    if (!data) return;
    await navigator.clipboard.writeText(formatSessionForNotion(data));
    setToast({ kind: "success", text: "Copied in Notion format" });
  };

  const exportForNotes = async () => {
    const data = buildExportData();
    if (!data) return;
    await navigator.clipboard.writeText(formatSessionForNotes(data));
    setToast({ kind: "success", text: "Copied for Notes" });
  };

  const exportForMarkdown = async () => {
    const data = buildExportData();
    if (!data) return;
    await navigator.clipboard.writeText(formatSessionForMarkdown(data));
    setToast({ kind: "success", text: "Copied as Markdown" });
  };

  const exportAsTextFile = () => {
    const data = buildExportData();
    if (!data) return;
    setToast({ kind: "success", text: "Preparing download..." });
    const token = new Date().toISOString().slice(0, 10);
    window.setTimeout(() => {
      downloadSessionAsTxt(formatSessionForNotes(data), token);
    }, 120);
  };

  const proLocked = Boolean(user?.id && !planLoading && !isPro);

  return (
    <section className="mx-auto w-full max-w-4xl pb-20">
      <header className="mb-7">
        <h1 className="text-[30px] font-semibold tracking-tight text-[#1C1C1E]">Debug My Code</h1>
        <p className="mt-1 text-sm text-[#636366]">
          Paste your prompt and broken code. Get a fixed prompt instantly.
        </p>
      </header>

      {proLocked ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/75 p-5">
          <h2 className="text-lg font-semibold text-blue-700">Debug Mode is a Pro feature</h2>
          <p className="mt-1 text-sm text-blue-700/90">Upgrade to unlock full debug analysis, root-cause breakdowns, and fix prompts.</p>
          <button
            type="button"
            onClick={() => {
              try {
                openProCheckout();
              } catch (error) {
                setFormError(error instanceof Error ? error.message : "Could not open Stripe checkout.");
              }
            }}
            className="mt-4 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#6366F1] px-4 py-2 text-sm font-semibold text-white"
          >
            Upgrade to Pro
          </button>
        </div>
      ) : null}

      {!proLocked ? (
      <>
      <div className="md:max-lg:grid md:max-lg:grid-cols-[55%_45%] md:max-lg:gap-4">
      <div>
      <form onSubmit={handleAnalyze} className="space-y-5">
        <div
          className={`rounded-2xl border border-[#E5E5EA] bg-white/70 p-4 backdrop-blur-xl ${shake.platform ? "debug-shake" : ""}`}
        >
          <p className="mb-3 text-sm font-medium text-[#1C1C1E]">Choose Platform</p>
          <div
            onScroll={onPlatformRowScroll}
            className={[
              "pill-scrollbar flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible",
              platformRowScrolling ? "pill-scrollbar-active" : "",
            ].join(" ")}
          >
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={[
                  "flex h-11 w-[116px] shrink-0 items-center justify-center rounded-full border px-3 py-1.5 text-center text-sm font-medium transition duration-150 whitespace-nowrap",
                  platform === p
                    ? PLATFORM_ACTIVE[p]
                    : "border-[#D1D1D6] bg-white/65 text-[#636366] backdrop-blur-xl hover:bg-white",
                ].join(" ")}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <article
          className={`rounded-2xl border border-[#E5E5EA] bg-white/72 p-5 backdrop-blur-xl ${shake.prompt ? "debug-shake" : ""}`}
        >
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#636366]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DBEAFE] text-[11px] text-[#3B82F6]">1</span>
            Step 1 - What did you ask the AI to build?
          </p>
          <h2 className="mb-3 text-lg font-semibold text-[#1C1C1E]">Your Original Prompt</h2>
          <textarea
            ref={promptRef}
            value={originalPrompt}
            onChange={(event) => setOriginalPrompt(event.target.value)}
            className={darkTextareaClass}
            placeholder="Paste the exact prompt you gave to Lovable, Cursor, or Replit..."
          />
        </article>

        <article
          className={`rounded-2xl border border-[#E5E5EA] bg-white/72 p-5 backdrop-blur-xl ${shake.code ? "debug-shake" : ""}`}
        >
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#636366]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DBEAFE] text-[11px] text-[#3B82F6]">2</span>
            Step 2 - Paste the code that was generated
          </p>
          <h2 className="mb-3 text-lg font-semibold text-[#1C1C1E]">The Broken Code</h2>
          <div className="relative">
            <textarea
              ref={codeRef}
              value={brokenCode}
              onChange={(event) => setBrokenCode(event.target.value)}
              className={`${darkTextareaClass} font-mono text-[12px] sm:text-[13px]`}
              placeholder="Paste the broken or incomplete code here..."
            />
            <span className="absolute bottom-3 right-3 text-xs text-slate-400">{brokenCode.length} chars</span>
          </div>
        </article>

        <article
          className={`rounded-2xl border border-[#E5E5EA] bg-white/72 p-5 backdrop-blur-xl ${shake.problem ? "debug-shake" : ""}`}
        >
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#636366]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DBEAFE] text-[11px] text-[#3B82F6]">3</span>
            Step 3 - What went wrong?
          </p>
          <h2 className="mb-3 text-lg font-semibold text-[#1C1C1E]">The Error or Problem</h2>
          <textarea
            ref={problemRef}
            value={problemText}
            onChange={(event) => setProblemText(event.target.value)}
            className={plainTextareaClass}
            placeholder="Describe the error message, what is broken, or what the code fails to do..."
          />
        </article>

        {formError ? <p className="text-sm text-[#FF453A]">{formError}</p> : null}

        <div className="pt-1">
          <button
            type="submit"
            disabled={!isFormValid || isAnalyzing}
            className="mx-auto flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#A78BFA] px-7 py-4 text-base font-semibold text-white shadow-[0_12px_30px_rgba(59,130,246,0.25)] transition duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAnalyzing ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                Analyzing your code...
              </>
            ) : (
              <>
                <BoltSvg className="h-4 w-4" />
                Analyze &amp; Fix My Prompt
              </>
            )}
          </button>
          <p className="mt-2 text-center text-xs text-[#8E8E93]">Shortcut: Ctrl/Cmd + Enter</p>
          {isAnalyzing ? (
            <p className="mt-2 text-center text-sm text-[#636366]">{LOADING_MESSAGES[progressIndex]}</p>
          ) : null}
        </div>
      </form>
      </div>

      <aside className="tablet-panel-sticky hidden rounded-2xl border border-[#E5E5EA] bg-white/74 p-4 backdrop-blur-xl md:max-lg:block">
        {!analysis && !isAnalyzing ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-[#D1D1D6] bg-white/70 p-6 text-center text-sm text-[#636366]">
            Your results will appear here
          </div>
        ) : null}

        {analysis ? (
          <div className="space-y-3">
            <article className="rounded-2xl border border-[#E5E5EA] bg-white/80 p-4">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${ROOT_CAUSE_BADGE[analysis.rootCause]?.bg ?? "bg-[#F2F2F7]"} ${ROOT_CAUSE_BADGE[analysis.rootCause]?.text ?? "text-[#636366]"}`}
              >
                {analysis.rootCauseLabel}
              </span>
              <p className="mt-3 text-sm text-[#3A3A3C]">{analysis.diagnosisSummary}</p>
            </article>
            <article className="rounded-2xl border border-[#E5E5EA] bg-white/80 p-4">
              <h3 className="text-lg font-semibold text-[#1C1C1E]">Fixed Code</h3>
              <pre className="mt-3 overflow-auto rounded-2xl border border-white/10 bg-[rgba(30,30,34,0.90)] p-4 text-sm leading-6 text-slate-100">
                <code className="font-mono whitespace-pre-wrap">{analysis.fixedCode}</code>
              </pre>
              <p className="mt-3 text-sm text-[#636366]">{analysis.codeExplanation}</p>
            </article>
            <article className="rounded-2xl border border-[#E5E5EA] bg-white/80 p-4">
              <h3 className="text-lg font-semibold text-[#1C1C1E]">Alternatives</h3>
              <div className="mt-3 space-y-2">
                {[analysis.alternativeOne, analysis.alternativeTwo].map((alternative, idx) => (
                  <pre key={idx} className="whitespace-pre-wrap rounded-xl border border-[#E5E7EB] bg-[#F8F8FA] p-3 text-xs text-[#1C1C1E]">
                    {alternative}
                  </pre>
                ))}
              </div>
            </article>
            <div className="flex justify-end pt-1">
              <ExportSessionButton
                onCopyNotion={exportForNotion}
                onCopyNotes={exportForNotes}
                onCopyMarkdown={exportForMarkdown}
                onDownloadText={exportAsTextFile}
              />
            </div>
          </div>
        ) : null}
      </aside>
      </div>

      {analysis ? (
        <section className="debug-results-enter mt-10 space-y-4 md:max-lg:hidden">
          <article
            className="debug-result-card rounded-2xl border border-[#E5E5EA] bg-white/75 p-6 backdrop-blur-xl"
            style={{ animationDelay: "0ms" }}
          >
            <h3 className="text-xl font-semibold text-[#1C1C1E]">What Went Wrong</h3>
            <span
              className={`mt-4 inline-flex rounded-full px-4 py-1.5 text-sm font-semibold ${ROOT_CAUSE_BADGE[analysis.rootCause]?.bg ?? "bg-[#F2F2F7]"} ${ROOT_CAUSE_BADGE[analysis.rootCause]?.text ?? "text-[#636366]"}`}
            >
              {analysis.rootCauseLabel}
            </span>
            <p className="mt-4 text-sm leading-6 text-[#3A3A3C]">{analysis.diagnosisSummary}</p>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-[#636366]">
                <span>Diagnosis Confidence</span>
                <span>{analysis.confidence}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#DDE5F2]">
                <div
                  className="h-2 rounded-full bg-[#3B82F6] transition-all duration-700"
                  style={{ width: `${analysis.confidence}%` }}
                />
              </div>
            </div>

            <ul className="mt-5 space-y-2">
              {analysis.issues.map((issue) => (
                <li key={issue} className="flex gap-2 text-sm text-[#4A4A4E]">
                  <span className="mt-1 h-2 w-2 rounded-full bg-rose-400" />
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </article>

          <article
            className="debug-result-card rounded-2xl border border-[#E5E5EA] bg-white/75 p-6 backdrop-blur-xl"
            style={{ animationDelay: "110ms" }}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xl font-semibold text-[#1C1C1E]">Fixed Code</h3>
              <button
                type="button"
                onClick={() => void shareText(analysis.fixedCode)}
                className="rounded-full border border-[#D1D1D6] bg-white p-2 text-xs text-[#636366]"
              >
                Share
              </button>
            </div>
            <p className="mt-1 text-sm text-[#636366]">Copy this fixed version and test it in {platform}</p>

            <pre className="mt-4 overflow-auto rounded-2xl border border-white/10 bg-[rgba(30,30,34,0.90)] p-4 text-sm leading-6 text-slate-100">
              <code className="font-mono whitespace-pre-wrap">{analysis.fixedCode}</code>
            </pre>

            <button
              type="button"
              onClick={onCopyPrompt}
              className={[
                "mt-4 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition duration-200",
                copyState === "copied"
                  ? "bg-emerald-500 hover:bg-emerald-500"
                  : "bg-gradient-to-r from-[#3B82F6] to-[#A78BFA] hover:brightness-105",
              ].join(" ")}
            >
              {copyState === "copied" ? "✓" : "⎘"} {copyLabel}
            </button>

            <div className="mt-4 rounded-2xl border border-[#E5E5EA] bg-white/85 p-4">
              <h4 className="text-sm font-semibold text-[#1C1C1E]">What was fixed</h4>
              <p className="mt-1 text-sm text-[#636366]">{analysis.codeExplanation}</p>
            </div>

            <div className="mt-5">
              <h4 className="text-sm font-semibold text-[#1C1C1E]">Key Changes</h4>
              <ul className="mt-2 space-y-2">
                {analysis.keyChanges.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-[#3A3A3C]">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/80 p-4">
              <h4 className="text-sm font-semibold text-blue-700">Platform Tip</h4>
              <p className="mt-1 text-sm text-blue-700/90">{analysis.platformTip}</p>
            </div>
          </article>

          <article
            className="debug-result-card rounded-2xl border border-[#E5E5EA] bg-white/75 p-6 backdrop-blur-xl"
            style={{ animationDelay: "220ms" }}
          >
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => void shareText(`${analysis.alternativeOne}\n\n${analysis.alternativeTwo}`)}
                className="rounded-full border border-[#D1D1D6] bg-white p-2 text-xs text-[#636366]"
              >
                Share
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowPrevention((prev) => !prev)}
              className="flex w-full items-center justify-between text-left"
            >
              <h3 className="text-xl font-semibold text-[#1C1C1E]">Avoid This Next Time</h3>
              <span className="text-sm text-[#636366]">{showPrevention ? "Hide" : "Show"}</span>
            </button>

            {showPrevention ? (
              <ul className="mt-4 space-y-2">
                {analysis.preventionTips.map((tip) => (
                  <li key={tip} className="text-sm leading-6 text-[#3A3A3C]">
                    • {tip}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
          <div className="flex justify-end">
            <ExportSessionButton
              onCopyNotion={exportForNotion}
              onCopyNotes={exportForNotes}
              onCopyMarkdown={exportForMarkdown}
              onDownloadText={exportAsTextFile}
            />
          </div>
        </section>
      ) : null}
      </>
      ) : null}

      {toast ? (
        <div
          className={[
            "fixed bottom-5 right-5 rounded-xl px-4 py-2 text-sm shadow-lg",
            toast.kind === "success" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white",
          ].join(" ")}
        >
          {toast.text}
        </div>
      ) : null}
      <UpgradeModal
        open={upgradeOpen}
        usageCount={usageCount}
        onClose={() => setUpgradeOpen(false)}
        onUpgrade={() => {
          try {
            openProCheckout();
          } catch (error) {
            console.error("Upgrade redirect failed", error);
            setFormError(error instanceof Error ? error.message : "Could not open Stripe checkout.");
          }
        }}
      />
    </section>
  );
};
