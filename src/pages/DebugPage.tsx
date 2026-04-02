import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { usePlanUsage } from "../hooks/usePlanUsage";
import { supabase } from "../lib/supabase";
import { analyzeCode, type AnalyzeCodeResponse } from "../lib/groq";
import { UpgradeModal } from "../components/UpgradeModal";
import { FREE_PROMPT_LIMIT, getCurrentMonthUsage, getUserPlanProfile, isProTier, openProCheckout } from "../lib/billing";
import { CodeScoreCard } from "../components/CodeScoreCard";
import { ListeningBanner, MicButton, SttTextMirror, useSpeechInput } from "../components/MicButton";
import { getSttLanguage } from "../lib/stt";
import { lineDiffMeta } from "../lib/codeDiff";
import { detectCodeLanguageHeuristic } from "../lib/detectCodeLanguage";

const LANG_PLATFORMS = [
  "React",
  "JavaScript",
  "TypeScript",
  "Python",
  "Swift",
  "Dart",
  "CSS",
  "SQL",
  "Other",
] as const;
type LangPlatform = (typeof LANG_PLATFORMS)[number];

const PLATFORM_ACTIVE: Record<LangPlatform, string> = {
  React: "border-blue-300 bg-blue-100 text-blue-700",
  JavaScript: "border-yellow-300 bg-yellow-100 text-yellow-800",
  TypeScript: "border-indigo-300 bg-indigo-100 text-indigo-800",
  Python: "border-emerald-300 bg-emerald-100 text-emerald-800",
  Swift: "border-orange-300 bg-orange-100 text-orange-800",
  Dart: "border-cyan-300 bg-cyan-100 text-cyan-800",
  CSS: "border-pink-300 bg-pink-100 text-pink-800",
  SQL: "border-violet-300 bg-violet-100 text-violet-800",
  Other: "border-[#D1D1D6] bg-[#F2F2F7] text-[#636366]",
};

const LOADING_MESSAGES = [
  "Reading your code...",
  "Finding the bugs...",
  "Writing the fix...",
  "Generating alternatives...",
  "Scoring your code...",
];

type AltKey = "one" | "two" | "three";
type FixedTab = "fixed" | "compare";

const mono = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" } as const;

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.39 1.025.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.27.375.27.988-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function BranchesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9" />
    </svg>
  );
}

function CodeBlock({
  code,
  language,
  maxHeightClass,
  copyLabel = "Copy Code",
}: {
  code: string;
  language: string;
  maxHeightClass: string;
  copyLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[rgba(30,30,34,0.92)]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-xs font-medium text-slate-400">{language || "Code"}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className={[
            "inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs font-semibold transition min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:px-3 md:py-1",
            copied
              ? "border-emerald-300 bg-emerald-100 text-emerald-800"
              : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10",
          ].join(" ")}
        >
          {copied ? "✓ Copied" : copyLabel}
        </button>
      </div>
      <pre
        className={`code-block-scroll overflow-x-auto overflow-y-auto p-3 text-[13px] leading-relaxed text-slate-100 md:text-sm ${maxHeightClass}`}
        style={mono}
      >
        <code className="whitespace-pre break-words">{code}</code>
      </pre>
    </div>
  );
}

export const DebugPage = () => {
  const { user } = useAuth();
  const { isPro } = usePlanUsage(user?.id);

  const codeRef = useRef<HTMLTextAreaElement>(null);
  const errRef = useRef<HTMLTextAreaElement>(null);
  const resultsAnchorRef = useRef<HTMLDivElement>(null);

  const [platform, setPlatform] = useState<LangPlatform | null>(null);
  const [code, setCode] = useState("");
  const [errorDesc, setErrorDesc] = useState("");
  const [debouncedGuess, setDebouncedGuess] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [result, setResult] = useState<AnalyzeCodeResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [speechToast, setSpeechToast] = useState<{ text: string; error?: boolean } | null>(null);
  const codeListeningBannerRef = useRef<HTMLDivElement | null>(null);
  const errListeningBannerRef = useRef<HTMLDivElement | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [shakeCode, setShakeCode] = useState(false);
  const [platformRowScrolling, setPlatformRowScrolling] = useState(false);
  const platformScrollTimeout = useRef<number | null>(null);
  const [fixedTab, setFixedTab] = useState<FixedTab>("fixed");
  const [activeFix, setActiveFix] = useState<"main" | AltKey>("main");
  const [cardVisible, setCardVisible] = useState([false, false, false, false]);
  const [expandedFixes, setExpandedFixes] = useState(false);
  const [expandedBugs, setExpandedBugs] = useState(false);
  const [expandedPrevention, setExpandedPrevention] = useState(false);
  const [favIds, setFavIds] = useState<Record<AltKey, string | null>>({ one: null, two: null, three: null });

  // ── Speech-to-Text ────────────────────────────────────────────────────────
  const sttCode = useSpeechInput({
    value: code,
    onChange: setCode,
    language: getSttLanguage(),
    textareaRef: codeRef,
    showToast: (text, isError) =>
      isError ? setSpeechToast({ text, error: true }) : setSpeechToast({ text, error: false }),
  });
  const sttErr = useSpeechInput({
    value: errorDesc,
    onChange: setErrorDesc,
    language: getSttLanguage(),
    textareaRef: errRef,
    showToast: (text, isError) =>
      isError ? setSpeechToast({ text, error: true }) : setSpeechToast({ text, error: false }),
  });
  // ─────────────────────────────────────────────────────────────────────────

  const lineCount = useMemo(() => (code.trim() ? code.split("\n").length : 0), [code]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedGuess(detectCodeLanguageHeuristic(code)), 500);
    return () => window.clearTimeout(t);
  }, [code]);

  const displayLangPill = useMemo(() => {
    if (result?.language_detected) return result.language_detected;
    return debouncedGuess;
  }, [result, debouncedGuess]);

  useEffect(() => {
    if (!isAnalyzing) return;
    const id = window.setInterval(() => {
      setProgressIndex((p) => (p + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, [isAnalyzing]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!speechToast) return;
    const id = window.setTimeout(() => setSpeechToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [speechToast]);

  useEffect(() => {
    if (sttCode.sttState !== "listening") return;
    const id = window.requestAnimationFrame(() => {
      codeListeningBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [sttCode.sttState]);

  useEffect(() => {
    if (sttErr.sttState !== "listening") return;
    const id = window.requestAnimationFrame(() => {
      errListeningBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [sttErr.sttState]);

  const autosize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    autosize(codeRef.current);
  }, [code]);
  useEffect(() => {
    autosize(errRef.current);
  }, [errorDesc]);

  const loadFavourites = useCallback(
    async (sid: string) => {
      if (!supabase || !user?.id) return;
      const { data } = await supabase
        .from("saved_prompts")
        .select("id,source_alternative")
        .eq("user_id", user.id)
        .eq("saved_type", "code")
        .eq("code_session_id", sid)
        .eq("is_favourite", true);
      const next: Record<AltKey, string | null> = { one: null, two: null, three: null };
      (data ?? []).forEach((row: { id: string; source_alternative: string | null }) => {
        const s = row.source_alternative as AltKey | null;
        if (s === "one" || s === "two" || s === "three") next[s] = row.id;
      });
      setFavIds(next);
    },
    [user?.id],
  );

  useEffect(() => {
    if (sessionId) void loadFavourites(sessionId);
  }, [sessionId, loadFavourites]);

  useEffect(() => {
    if (!result) {
      setCardVisible([false, false, false, false]);
      return;
    }
    setCardVisible([false, false, false, false]);
    [0, 1, 2, 3].forEach((i) => {
      window.setTimeout(() => {
        setCardVisible((prev) => {
          const n = [...prev];
          n[i] = true;
          return n;
        });
      }, 300 + i * 150);
    });
    window.setTimeout(() => {
      resultsAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  }, [result]);

  const currentFixedCode = useMemo(() => {
    if (!result) return "";
    if (activeFix === "main") return result.fixed_code;
    if (activeFix === "one") return result.alternative_one_code;
    if (activeFix === "two") return result.alternative_two_code;
    return result.alternative_three_code;
  }, [result, activeFix]);

  const currentFixedLabel = useMemo(() => {
    if (!result) return "";
    if (activeFix === "main") return "Primary fix";
    if (activeFix === "one") return result.alternative_one_label;
    if (activeFix === "two") return result.alternative_two_label;
    return result.alternative_three_label;
  }, [result, activeFix]);

  const handleSubmit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      setFormError(null);
      if (!supabase) {
        setFormError("Supabase is not configured.");
        return;
      }
      if (!user?.id) {
        setFormError("You need to be logged in.");
        return;
      }
      if (!code.trim()) {
        setShakeCode(true);
        window.setTimeout(() => setShakeCode(false), 420);
        setFormError("Paste your broken code first.");
        return;
      }

      const [profile, usage] = await Promise.all([getUserPlanProfile(user.id), getCurrentMonthUsage(user.id)]);
      const pro = isProTier(profile?.plan_tier, profile?.subscription_status);
      if (!pro && usage >= FREE_PROMPT_LIMIT) {
        setUsageCount(usage);
        setUpgradeOpen(true);
        return;
      }

      const platformValue = platform ?? "Other";

      setIsAnalyzing(true);
      setProgressIndex(0);
      setResult(null);
      setSessionId(null);
      setActiveFix("main");
      setFixedTab("fixed");

      try {
        const res = await analyzeCode({
          original_code: code.trim(),
          error_description: errorDesc.trim(),
          platform: platformValue,
          user_id: user.id,
        });
        setResult(res);
        if (res.session_id) setSessionId(res.session_id);
        setToast("Session saved");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Analysis failed. Try again.";
        setFormError(msg);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [code, errorDesc, platform, user?.id],
  );

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Enter" || !(ev.metaKey || ev.ctrlKey)) return;
      ev.preventDefault();
      void handleSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSubmit]);

  const toggleFavourite = async (key: AltKey, altCode: string, label: string) => {
    if (!supabase || !user?.id || !sessionId) return;
    const existing = favIds[key];
    if (existing) {
      await supabase.from("saved_prompts").delete().eq("id", existing);
      setFavIds((p) => ({ ...p, [key]: null }));
      return;
    }
    if (!isPro) {
      const { count } = await supabase
        .from("saved_prompts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if ((count ?? 0) >= 5) {
        setUpgradeOpen(true);
        return;
      }
    }
    const { data, error } = await supabase
      .from("saved_prompts")
      .insert({
        user_id: user.id,
        session_id: null,
        code_session_id: sessionId,
        saved_type: "code",
        prompt_text: altCode,
        prompt_type: "alternative",
        label,
        is_favourite: true,
        source_alternative: key,
        platform: platform ?? "Other",
      })
      .select("id")
      .single();
    if (!error && data) setFavIds((p) => ({ ...p, [key]: (data as { id: string }).id }));
  };

  const diff = useMemo(() => {
    if (!result) return null;
    return lineDiffMeta(code, currentFixedCode);
  }, [code, currentFixedCode, result]);

  const alternatives = useMemo(() => {
    if (!result) return [];
    return [
      {
        key: "one" as const,
        label: result.alternative_one_label,
        explanation: result.alternative_one_explanation,
        body: result.alternative_one_code,
        badge: "border-blue-300 bg-blue-100 text-blue-800",
      },
      {
        key: "two" as const,
        label: result.alternative_two_label,
        explanation: result.alternative_two_explanation,
        body: result.alternative_two_code,
        badge: "border-purple-300 bg-purple-100 text-purple-800",
      },
      {
        key: "three" as const,
        label: result.alternative_three_label,
        explanation: result.alternative_three_explanation,
        body: result.alternative_three_code,
        badge: "border-emerald-300 bg-emerald-100 text-emerald-800",
      },
    ];
  }, [result]);

  const onPlatformRowScroll = () => {
    setPlatformRowScrolling(true);
    if (platformScrollTimeout.current) window.clearTimeout(platformScrollTimeout.current);
    platformScrollTimeout.current = window.setTimeout(() => setPlatformRowScrolling(false), 650);
  };

  return (
    <section className="mx-auto w-full max-w-4xl overflow-x-hidden pb-24">
      <header className="mb-7">
        <h1 className="text-[30px] font-semibold tracking-tight text-[#1C1C1E]">Fix My Code</h1>
        <p className="mt-1 text-sm text-[#636366]">
          Paste broken code. Get a working fix plus three alternatives and a code score.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-2xl border border-[#E5E5EA] bg-white/70 p-4 backdrop-blur-xl">
          <p className="mb-3 text-sm font-medium text-[#1C1C1E]">Language or framework</p>
          <div
            onScroll={onPlatformRowScroll}
            className={[
              "pill-scrollbar flex gap-2 overflow-x-auto pb-1 md:max-lg:flex-wrap md:max-lg:overflow-visible",
              platformRowScrolling ? "pill-scrollbar-active" : "",
            ].join(" ")}
          >
            {LANG_PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={[
                  "flex h-11 min-w-[104px] shrink-0 items-center justify-center rounded-full border px-3 py-1.5 text-center text-sm font-medium whitespace-nowrap transition",
                  platform === p
                    ? PLATFORM_ACTIVE[p]
                    : "border-[#D1D1D6] bg-white/75 text-[#636366] hover:bg-white",
                ].join(" ")}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <article
          className={`relative rounded-2xl border border-[#E5E5EA] bg-white/72 p-5 backdrop-blur-xl ${shakeCode ? "debug-shake" : ""}`}
        >
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-[#1C1C1E]">Your Broken Code</h2>
              <p className="text-sm text-[#636366]">Paste the code that is not working</p>
            </div>
            {displayLangPill ? (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                {displayLangPill}
              </span>
            ) : null}
          </div>
          {sttCode.isSupported && (
            <ListeningBanner
              ref={codeListeningBannerRef}
              visible={sttCode.sttState === "listening"}
              onStop={sttCode.stop}
              label="Listening... speak your prompt"
            />
          )}
          <div className="relative rounded-2xl">
            {sttCode.isSupported && (sttCode.sttState === "listening" || sttCode.sttState === "processing") ? (
              <SttTextMirror
                dark
                committed={sttCode.committedPart}
                interim={sttCode.interimText}
                placeholder="Paste your broken or buggy code here..."
                className="px-4 py-3 pb-12 pr-14 text-[13px] leading-relaxed md:text-sm"
              />
            ) : null}
            <textarea
              ref={codeRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className={[
                "scrollbar-hide min-h-[260px] w-full resize-none overflow-y-auto rounded-2xl border border-white/10 bg-[rgba(30,30,34,0.92)] px-4 py-3 pb-12 pr-14 text-[13px] outline-none placeholder:text-slate-500 focus:border-[#3B82F6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.18)] md:min-h-[300px] md:text-sm",
                sttCode.isSupported && (sttCode.sttState === "listening" || sttCode.sttState === "processing")
                  ? "relative z-[1] bg-transparent text-transparent caret-slate-100 placeholder:text-transparent"
                  : "text-slate-100",
              ].join(" ")}
              placeholder="Paste your broken or buggy code here..."
            />
            <div className="pointer-events-none absolute bottom-3 right-3 text-xs text-slate-500">{lineCount} lines</div>
            {sttCode.isSupported && (
              <MicButton
                sttState={sttCode.sttState}
                onClick={sttCode.toggle}
                dark
                className="absolute bottom-[2px] left-[2px]"
              />
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-[#E5E5EA] bg-white/85 p-5 backdrop-blur-xl">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-[#1C1C1E]">What is the error? (optional)</h2>
            <span className="rounded-full bg-[#F2F2F7] px-2 py-0.5 text-[11px] font-medium text-[#8E8E93]">
              Optional
            </span>
          </div>
          <p className="mb-3 text-sm text-[#636366]">
            Paste the error message or describe what is broken. Leave empty if you are not sure.
          </p>
          {sttErr.isSupported && (
            <ListeningBanner
              ref={errListeningBannerRef}
              visible={sttErr.sttState === "listening"}
              onStop={sttErr.stop}
              label="Listening... speak your prompt"
            />
          )}
          <div className="relative rounded-2xl">
            {sttErr.isSupported && (sttErr.sttState === "listening" || sttErr.sttState === "processing") ? (
              <SttTextMirror
                committed={sttErr.committedPart}
                interim={sttErr.interimText}
                placeholder="Paste the error message or describe what is not working..."
                className="px-4 py-3 pb-12 pr-14 text-sm leading-relaxed"
              />
            ) : null}
            <textarea
              ref={errRef}
              value={errorDesc}
              onChange={(e) => setErrorDesc(e.target.value)}
              className={[
                "scrollbar-hide min-h-[128px] w-full resize-none overflow-y-auto rounded-2xl border border-[#D1D1D6] bg-white/90 px-4 py-3 pb-12 pr-14 text-sm outline-none placeholder:text-[#8E8E93] focus:border-[#3B82F6] md:min-h-[140px]",
                sttErr.isSupported && (sttErr.sttState === "listening" || sttErr.sttState === "processing")
                  ? "relative z-[1] bg-transparent text-transparent caret-[#1C1C1E] placeholder:text-transparent"
                  : "text-[#1C1C1E]",
              ].join(" ")}
              placeholder="Paste the error message or describe what is not working..."
            />
            {sttErr.isSupported && (
              <MicButton
                sttState={sttErr.sttState}
                onClick={sttErr.toggle}
                className="absolute bottom-[2px] left-[2px]"
              />
            )}
          </div>
        </article>

        {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={isAnalyzing}
            className="flex w-full max-w-xl items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#A78BFA] px-8 py-4 text-base font-semibold text-white shadow-[0_8px_28px_rgba(59,130,246,0.35)] transition hover:brightness-105 disabled:opacity-70 md:w-auto md:min-w-[320px]"
          >
            {isAnalyzing ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Analysing your code...
              </>
            ) : (
              <>
                <WrenchIcon className="h-5 w-5" />
                Fix My Code
              </>
            )}
          </button>
        </div>
        {isAnalyzing ? (
          <p className="text-center text-sm text-[#636366]">{LOADING_MESSAGES[progressIndex]}</p>
        ) : null}
      </form>

      <div ref={resultsAnchorRef} className="mt-10 scroll-mt-28" />

      {result ? (
        <div className="mt-6 space-y-5">
          <div
            className={`transition-all duration-500 ${cardVisible[0] ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
          >
            <CodeScoreCard
              readabilityBefore={result.score_readability_before}
              efficiencyBefore={result.score_efficiency_before}
              structureBefore={result.score_structure_before}
              readabilityAfter={result.score_readability_after}
              efficiencyAfter={result.score_efficiency_after}
              structureAfter={result.score_structure_after}
              overallBefore={result.overall_score_before}
              overallAfter={result.overall_score_after}
              insight={result.fix_explanation}
              bugsCount={result.bugs_found.length}
              languageLabel={result.language_detected}
              complexityLabel={result.complexity_level}
            />
          </div>

          <div
            className={`transition-all duration-500 ${cardVisible[1] ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
          >
            <article className="rounded-2xl border border-[#E5E5EA] bg-white/80 p-5 backdrop-blur-xl">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500">✓</span>
                  <h2 className="text-lg font-semibold text-[#1C1C1E]">Fixed Code</h2>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                    {currentFixedLabel}
                  </span>
                </div>
                <div className="flex rounded-full border border-[#D1D1D6] bg-[#F2F2F7] p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setFixedTab("fixed")}
                    className={`rounded-full px-3 py-1.5 ${fixedTab === "fixed" ? "bg-white text-[#1C1C1E] shadow-sm" : "text-[#636366]"}`}
                  >
                    Fixed Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setFixedTab("compare")}
                    className={`rounded-full px-3 py-1.5 ${fixedTab === "compare" ? "bg-white text-[#1C1C1E] shadow-sm" : "text-[#636366]"}`}
                  >
                    Compare
                  </button>
                </div>
              </div>
              {activeFix !== "main" ? (
                <button
                  type="button"
                  onClick={() => setActiveFix("main")}
                  className="mb-3 text-sm font-medium text-[#3B82F6] underline"
                >
                  Back to original fix
                </button>
              ) : null}

              {fixedTab === "fixed" ? (
                <CodeBlock
                  code={currentFixedCode}
                  language={result.language_detected}
                  maxHeightClass="max-h-[300px] md:max-h-[400px]"
                />
              ) : diff ? (
                <div className="flex flex-col gap-4 min-[1024px]:flex-row">
                  <div className="min-w-0 flex-1">
                    <p className="mb-2 text-xs font-semibold text-[#8E8E93]">Original</p>
                    <pre
                      className="code-block-scroll max-h-[280px] overflow-auto overflow-x-auto rounded-xl border border-white/10 bg-[rgba(30,30,34,0.92)] p-3 text-[13px] text-slate-100 md:max-h-[400px] md:text-sm"
                      style={mono}
                    >
                      {diff.oLines.map((line, i) => (
                        <div
                          key={`o-${i}`}
                          className={diff.originalHighlight[i] ? "bg-rose-500/15" : ""}
                        >
                          {line}
                        </div>
                      ))}
                    </pre>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-2 text-xs font-semibold text-emerald-600">Fixed</p>
                    <pre
                      className="code-block-scroll max-h-[280px] overflow-auto overflow-x-auto rounded-xl border border-white/10 bg-[rgba(30,30,34,0.92)] p-3 text-[13px] text-slate-100 md:max-h-[400px] md:text-sm"
                      style={mono}
                    >
                      {diff.fLines.map((line, i) => (
                        <div
                          key={`f-${i}`}
                          className={diff.fixedHighlight[i] ? "bg-emerald-500/15" : ""}
                        >
                          {line}
                        </div>
                      ))}
                    </pre>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 border-t border-[#E5E5EA] pt-3">
                <button
                  type="button"
                  onClick={() => setExpandedFixes((v) => !v)}
                  className="flex w-full items-center justify-between text-left text-sm font-semibold text-[#1C1C1E]"
                >
                  What Was Fixed
                  <span>{expandedFixes ? "▼" : "▶"}</span>
                </button>
                {expandedFixes ? (
                  <ul className="mt-2 space-y-2">
                    {result.key_fixes.map((x, i) => (
                      <li key={i} className="flex gap-2 text-sm text-[#636366]">
                        <span className="text-emerald-500">✓</span>
                        {x}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="mt-3 border-t border-[#E5E5EA] pt-3">
                <button
                  type="button"
                  onClick={() => setExpandedBugs((v) => !v)}
                  className="flex w-full items-center justify-between text-left text-sm font-semibold text-[#1C1C1E]"
                >
                  Bugs Found
                  <span>{expandedBugs ? "▼" : "▶"}</span>
                </button>
                {expandedBugs ? (
                  <ul className="mt-2 space-y-2">
                    {result.bugs_found.map((x, i) => (
                      <li key={i} className="flex gap-2 text-sm text-[#636366]">
                        <span className="text-rose-500">!</span>
                        {x}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          </div>

          <div
            className={`transition-all duration-500 ${cardVisible[2] ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
          >
            <article className="rounded-2xl border border-[#E5E5EA] bg-white/80 p-5 backdrop-blur-xl">
              <div className="mb-1 flex items-center gap-2">
                <BranchesIcon className="h-5 w-5 text-[#636366]" />
                <h2 className="text-lg font-semibold text-[#1C1C1E]">Alternative Approaches</h2>
              </div>
              <p className="mb-4 text-sm text-[#636366]">Three different ways to solve the same problem.</p>
              <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-3">
                {alternatives.map((alt) => (
                  <div
                    key={alt.key}
                    className="relative rounded-2xl border border-[#E5E5EA] bg-white/70 p-4"
                  >
                    <button
                      type="button"
                      onClick={() => void toggleFavourite(alt.key, alt.body, alt.label)}
                      className="absolute right-3 top-3 text-rose-500 hover:scale-110"
                      aria-label="Favourite"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-6 w-6"
                        fill={favIds[alt.key] ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth={1.8}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                        />
                      </svg>
                    </button>
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${alt.badge}`}
                    >
                      {alt.label}
                    </span>
                    <p className="mt-2 text-sm italic text-[#8E8E93]">{alt.explanation}</p>
                    <div className="mt-3">
                      <CodeBlock
                        code={alt.body}
                        language={result.language_detected}
                        maxHeightClass="max-h-[300px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveFix(alt.key)}
                      className="mt-3 w-full rounded-full border border-[#D1D1D6] bg-white/80 py-2.5 text-sm font-semibold text-[#1C1C1E] transition hover:bg-[#F2F2F7]"
                    >
                      Use This Instead
                    </button>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div
            className={`transition-all duration-500 ${cardVisible[3] ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
          >
            <article className="rounded-2xl border border-[#E5E5EA] bg-white/80 p-5 backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setExpandedPrevention((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <h2 className="text-lg font-semibold text-[#1C1C1E]">Avoid This Next Time</h2>
                <span>{expandedPrevention ? "▼" : "▶"}</span>
              </button>
              {expandedPrevention ? (
                <>
                  <ul className="mt-3 space-y-2">
                    {result.prevention_tips.map((x, i) => (
                      <li key={i} className="flex gap-2 text-sm text-[#636366]">
                        <span className="text-orange-500">●</span>
                        {x}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm text-[#8E8E93]">
                    These are the most common causes of this type of bug.
                  </p>
                </>
              ) : null}
            </article>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-[160] -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg md:bottom-8">
          {toast}
        </div>
      ) : null}
      {speechToast ? (
        <div
          className={[
            "fixed bottom-36 left-1/2 z-[165] max-w-[min(92vw,360px)] -translate-x-1/2 rounded-xl border px-4 py-2 text-sm shadow-lg md:bottom-24",
            speechToast.error
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-[#E5E5EA] bg-[#F2F2F7] text-[#636366]",
          ].join(" ")}
        >
          {speechToast.text}
        </div>
      ) : null}

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        usageCount={usageCount}
        onUpgrade={() => {
          try {
            openProCheckout();
          } catch (e) {
            console.error(e);
          }
        }}
      />
    </section>
  );
};
