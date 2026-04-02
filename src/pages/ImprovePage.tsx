import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListeningBanner, MicButton, SttTextMirror, useSpeechInput } from "../components/MicButton";
import { getSttLanguage } from "../lib/stt";
import { useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePlanUsage } from "../hooks/usePlanUsage";
import { supabase } from "../lib/supabase";
import { streamImprovePrompt, type ImprovePromptResponse } from "../lib/groq";
import { BottomSheet } from "../components/BottomSheet";
import { UpgradeModal } from "../components/UpgradeModal";
import { ExportSessionButton } from "../components/ExportSessionButton";
import { FREE_PROMPT_LIMIT, getCurrentMonthUsage, getUserPlanProfile, isProTier, openProCheckout } from "../lib/billing";
import { TemplateLibrary } from "../components/TemplateLibrary";
import { useTemplates } from "../hooks/useTemplates";
import type { PromptTemplate } from "../hooks/useTemplates";
import { PromptScoreCard } from "../components/PromptScoreCard";
import { BeforeAfterCard } from "../components/BeforeAfterCard";
import { QUICK_IMPROVE_STORAGE_KEY } from "../components/QuickImproveFab";
import { downloadSessionAsTxt, formatSessionForMarkdown, formatSessionForNotes, formatSessionForNotion, type ExportSessionData } from "../lib/sessionExport";

const PLATFORMS = ["Lovable", "Cursor", "Replit", "ChatGPT", "Claude", "Other"] as const;
const PROMPT_TYPES = [
  "Build Something",
  "Fix a Bug",
  "Create an API",
  "Design UI",
  "Write Content",
  "Explain Code",
  "Generate Ideas",
  "Refactor Code",
  "Other",
] as const;

const LOADING_MESSAGES = [
  "Reading your prompt...",
  "Identifying weaknesses...",
  "Writing improved version...",
  "Generating alternatives...",
];

type Platform = (typeof PLATFORMS)[number];
type PromptType = (typeof PROMPT_TYPES)[number];

type AltStyle = string;
type LengthState = "too_short" | "good" | "too_long" | "neutral";
type SourceAlternative = "improved" | "one" | "two" | "three";
const FREE_SAVED_PROMPT_LIMIT = 5;

interface ImproveResult {
  improvedPrompt: string;
  alternatives: Array<{ style: AltStyle; prompt: string }>;
  keyChanges: string[];
  weaknesses: string[];
  wordsBefore: number;
  wordsAfter: number;
  scoreClarityBefore: number;
  scoreSpecificityBefore: number;
  scoreDetailBefore: number;
  scoreClarityAfter: number;
  scoreSpecificityAfter: number;
  scoreDetailAfter: number;
  overallScoreBefore: number;
  overallScoreAfter: number;
  insight: string;
}

const PLATFORM_ACTIVE: Record<Platform, string> = {
  Lovable: "border-purple-300 bg-purple-100 text-purple-700",
  Cursor: "border-blue-300 bg-blue-100 text-blue-700",
  Replit: "border-orange-300 bg-orange-100 text-orange-700",
  ChatGPT: "border-emerald-300 bg-emerald-100 text-emerald-700",
  Claude: "border-amber-300 bg-amber-100 text-amber-700",
  Other: "border-[#D1D1D6] bg-[#F2F2F7] text-[#636366]",
};

const TYPE_ACTIVE: Record<PromptType, string> = {
  "Build Something": "border-blue-300 bg-blue-100 text-blue-700",
  "Fix a Bug": "border-rose-300 bg-rose-100 text-rose-700",
  "Create an API": "border-indigo-300 bg-indigo-100 text-indigo-700",
  "Design UI": "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-700",
  "Write Content": "border-violet-300 bg-violet-100 text-violet-700",
  "Explain Code": "border-cyan-300 bg-cyan-100 text-cyan-700",
  "Generate Ideas": "border-emerald-300 bg-emerald-100 text-emerald-700",
  "Refactor Code": "border-amber-300 bg-amber-100 text-amber-700",
  Other: "border-[#D1D1D6] bg-[#F2F2F7] text-[#636366]",
};

const getWordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const parseStreamedImprovedPrompt = (raw: string) => {
  const match = raw.match(/"improved_prompt"\s*:\s*"((?:\\.|[^"\\])*)/);
  if (!match) return "";
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return "";
  }
};

const toImproveResult = (source: ImprovePromptResponse, originalPrompt: string): ImproveResult => ({
  improvedPrompt: source.improved_prompt,
  alternatives: [
    { style: source.alternative_one_style, prompt: source.alternative_one },
    { style: source.alternative_two_style, prompt: source.alternative_two },
    { style: source.alternative_three_style, prompt: source.alternative_three },
  ],
  keyChanges: source.key_changes,
  weaknesses: source.weaknesses,
  wordsBefore: getWordCount(originalPrompt),
  wordsAfter: getWordCount(source.improved_prompt),
  scoreClarityBefore: source.score_clarity,
  scoreSpecificityBefore: source.score_specificity,
  scoreDetailBefore: source.score_detail,
  scoreClarityAfter: source.score_clarity_after,
  scoreSpecificityAfter: source.score_specificity_after,
  scoreDetailAfter: source.score_detail_after,
  overallScoreBefore: source.overall_score_before,
  overallScoreAfter: source.overall_score_after,
  insight: source.improvement_insight,
});

const autoSize = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = "0px";
  const next = Math.max(160, Math.min(el.scrollHeight, 320));
  el.style.height = `${next}px`;
};

// Maps template prompt_type values to the ImprovePage PROMPT_TYPES
const TEMPLATE_TYPE_MAP: Record<string, PromptType> = {
  "Build Something": "Build Something",
  "Fix a Bug":        "Fix a Bug",
  "Create an API":    "Create an API",
  "Design UI":        "Design UI",
  "Write Content":    "Write Content",
  "Explain Code":     "Explain Code",
  "Generate Ideas":   "Generate Ideas",
  "Refactor Code":    "Refactor Code",
};

const LENGTH_RULES: Record<Platform, { min: number; idealMax: number; tooLongAbove: number }> = {
  Lovable: { min: 30, idealMax: 150, tooLongAbove: 150 },
  Cursor: { min: 20, idealMax: 120, tooLongAbove: 200 },
  Replit: { min: 25, idealMax: 130, tooLongAbove: 180 },
  ChatGPT: { min: 15, idealMax: 300, tooLongAbove: 500 },
  Claude: { min: 15, idealMax: 400, tooLongAbove: 600 },
  Other: { min: 15, idealMax: 300, tooLongAbove: 500 },
};

const LENGTH_TIPS: Record<Platform, Record<Exclude<LengthState, "neutral">, string>> = {
  Lovable: {
    too_short:
      "Lovable works best with detailed descriptions. Add more context about design and functionality.",
    good: "Great length for Lovable. Enough detail without overwhelming.",
    too_long: "Lovable may get confused with very long prompts. Consider splitting into two prompts.",
  },
  Cursor: {
    too_short: "Cursor needs more specifics. Describe the exact file, function, or behavior you want.",
    good: "Ideal length for Cursor. Clear and specific.",
    too_long: "This might be too much for one Cursor prompt. Try breaking it into smaller tasks.",
  },
  Replit: {
    too_short: "Replit builds better with more detail. Describe the full feature you want.",
    good: "Good length for Replit.",
    too_long: "Consider splitting this into multiple Replit prompts for better results.",
  },
  ChatGPT: {
    too_short: "ChatGPT can handle much more detail. Add context, examples, or desired output format.",
    good: "Good length for ChatGPT.",
    too_long: "ChatGPT handles long prompts well. This length is fine.",
  },
  Claude: {
    too_short: "Claude works better with detailed instructions. Add more context and desired output.",
    good: "Great length for Claude.",
    too_long: "Claude handles long context very well. This length is fine.",
  },
  Other: {
    too_short: "ChatGPT can handle much more detail. Add context, examples, or desired output format.",
    good: "Good length for ChatGPT.",
    too_long: "ChatGPT handles long prompts well. This length is fine.",
  },
};

const favouriteKey = (source: SourceAlternative, promptText: string) => `${source}::${promptText}`;

// Animates text appearing letter-by-letter over `duration` ms
function animateText(
  text: string,
  setter: (v: string) => void,
  duration = 400,
): () => void {
  let i = 0;
  const delay = Math.max(4, duration / text.length);
  const id = window.setInterval(() => {
    i += 1;
    setter(text.slice(0, i));
    if (i >= text.length) window.clearInterval(id);
  }, delay);
  return () => window.clearInterval(id);
}

export const ImprovePage = () => {
  const { user } = useAuth();
  const { isPro } = usePlanUsage(user?.id);
  const location = useLocation();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const animationCleanup = useRef<(() => void) | null>(null);
  const textareaSectionRef = useRef<HTMLDivElement | null>(null);
  const handleSubmitRef = useRef<(() => Promise<void>) | null>(null);
  const listeningBannerRef = useRef<HTMLDivElement | null>(null);

  const [platform, setPlatform] = useState<Platform | null>(null);
  const [promptType, setPromptType] = useState<PromptType | null>(null);
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [isImproving, setIsImproving] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImproveResult | null>(null);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [improvedPromptView, setImprovedPromptView] = useState<string | null>(null);
  const [copiedAlternative, setCopiedAlternative] = useState<number | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [speechToast, setSpeechToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [shakeInput, setShakeInput] = useState(false);
  const [mobileWhatChangedOpen, setMobileWhatChangedOpen] = useState(false);
  const [pressSheetOpen, setPressSheetOpen] = useState(false);
  const [pressPromptText, setPressPromptText] = useState<string>("");
  const [pressLabel, setPressLabel] = useState<string>("Prompt");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const longPressTimer = useRef<number | null>(null);

  // ── Template library state ────────────────────────────────────────────────
  const { templates, loading: templatesLoading, trackUsage } = useTemplates();
  const [showTemplates, setShowTemplates] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [advisorVisible, setAdvisorVisible] = useState(true);
  const [favouriteMap, setFavouriteMap] = useState<Record<string, string>>({});
  const [heartPulse, setHeartPulse] = useState<Record<string, boolean>>({});
  const [favouriteToast, setFavouriteToast] = useState<{ text: string; tone: "green" | "gray" } | null>(null);
  const [chainParentSessionId, setChainParentSessionId] = useState<string | null>(null);
  const [rootOriginalPrompt, setRootOriginalPrompt] = useState<string | null>(null);
  const [passNumber, setPassNumber] = useState(1);
  const [showOriginalPromptPanel, setShowOriginalPromptPanel] = useState(false);
  const [resultFadeOut, setResultFadeOut] = useState(false);
  const [platformRowScrolling, setPlatformRowScrolling] = useState(false);
  const [typeRowScrolling, setTypeRowScrolling] = useState(false);
  const platformScrollTimeout = useRef<number | null>(null);
  const typeScrollTimeout = useRef<number | null>(null);

  // ── Speech-to-Text ────────────────────────────────────────────────────────
  const sttAutoImproveEnabled = (): boolean => {
    try { return localStorage.getItem("stt_auto_improve") === "true"; } catch { return false; }
  };

  const handleSpeechFinalized = useCallback(() => {
    if (!sttAutoImproveEnabled()) return;
    window.setTimeout(() => void handleSubmitRef.current?.(), 1500);
  }, []);

  const stt = useSpeechInput({
    value: originalPrompt,
    onChange: setOriginalPrompt,
    language: getSttLanguage(),
    textareaRef: inputRef,
    onSpeechFinalized: handleSpeechFinalized,
    showToast: (text, isError) => setSpeechToast({ text, error: Boolean(isError) }),
  });
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!speechToast) return;
    const id = window.setTimeout(() => setSpeechToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [speechToast]);

  useEffect(() => {
    if (stt.sttState !== "listening") return;
    const id = window.requestAnimationFrame(() => {
      listeningBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [stt.sttState]);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(QUICK_IMPROVE_STORAGE_KEY);
    if (!raw) return;
    window.sessionStorage.removeItem(QUICK_IMPROVE_STORAGE_KEY);
    try {
      const parsed = JSON.parse(raw) as {
        originalPrompt: string;
        platform: Platform;
        result: ImprovePromptResponse;
      };
      const nextOriginal = parsed.originalPrompt?.trim() ?? "";
      if (!nextOriginal || !parsed.result?.improved_prompt) return;
      setOriginalPrompt(nextOriginal);
      if (PLATFORMS.includes(parsed.platform)) {
        setPlatform(parsed.platform);
      }
      setPromptType("Other");
      setShowTemplates(false);
      const hydrated = toImproveResult(parsed.result, nextOriginal);
      setResult(hydrated);
      setImprovedPromptView(hydrated.improvedPrompt);
      setPassNumber(1);
      setRootOriginalPrompt(nextOriginal);
      setChainParentSessionId(null);
      setShowOriginalPromptPanel(false);
      setError(null);
      window.setTimeout(() => {
        textareaSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);

      if (supabase && user?.id) {
        void (async () => {
          const { data } = await supabase
            .from("prompt_sessions")
            .select("id")
            .eq("user_id", user.id)
            .eq("original_prompt", nextOriginal)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const id = (data as { id: string } | null)?.id ?? null;
          setSavedSessionId(id);
          if (id) setChainParentSessionId(id);
        })();
      }
    } catch (storageError) {
      console.error("Failed to hydrate quick improve session", storageError);
    }
  }, [location.key, user?.id]);

  const handleSelectTemplate = useCallback(
    (template: PromptTemplate) => {
      if (!user) {
        setError("Login required to use templates.");
        return;
      }
      if (!isPro) {
        setError("Template Library is available on Pro.");
        setUpgradeOpen(true);
        return;
      }
      // Cancel any in-progress animation
      animationCleanup.current?.();

      // Set platform and prompt type from template
      if (template.platform && PLATFORMS.includes(template.platform as Platform)) {
        setPlatform(template.platform as Platform);
      }
      if (template.prompt_type) {
        const mapped = TEMPLATE_TYPE_MAP[template.prompt_type];
        if (mapped) setPromptType(mapped);
      }

      // Mark as selected
      setSelectedTemplateId(template.id);
      setSelectedTemplateName(template.title);

      // Animate text into textarea
      setOriginalPrompt("");
      const cleanup = animateText(template.template_text, setOriginalPrompt, 400);
      animationCleanup.current = cleanup;

      // Track usage
      void trackUsage(template.id);

      // On mobile: collapse templates section
      if (window.innerWidth < 768) {
        window.setTimeout(() => setShowTemplates(false), 450);
      }

      // Scroll textarea into view
      window.setTimeout(() => {
        textareaSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    },
    [isPro, user, trackUsage],
  );

  const handleClearTemplate = () => {
    animationCleanup.current?.();
    setSelectedTemplateId(null);
    setSelectedTemplateName(null);
    setOriginalPrompt("");
  };

  const canSubmit = useMemo(
    () => Boolean(originalPrompt.trim() && platform && promptType && !isImproving),
    [originalPrompt, platform, promptType, isImproving],
  );
  const wordsNow = useMemo(() => getWordCount(originalPrompt), [originalPrompt]);
  const showLengthAdvisor = wordsNow >= 5;
  const lengthAdvice = useMemo(() => {
    if (!platform) {
      return {
        state: "neutral" as LengthState,
        pill: "Select a platform for length advice",
        tip: "Choose a platform to get tailored prompt length guidance.",
      };
    }
    const rules = LENGTH_RULES[platform];
    const tipSet = LENGTH_TIPS[platform];
    if (wordsNow < rules.min) {
      return { state: "too_short" as LengthState, pill: "Too Short", tip: tipSet.too_short };
    }
    if (wordsNow > rules.tooLongAbove) {
      return { state: "too_long" as LengthState, pill: "Too Long", tip: tipSet.too_long };
    }
    return { state: "good" as LengthState, pill: "Good Length", tip: tipSet.good };
  }, [platform, wordsNow]);

  useEffect(() => autoSize(inputRef.current), [originalPrompt]);

  useEffect(() => {
    if (!isImproving) return;
    const id = window.setInterval(() => {
      setProgressIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, [isImproving]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!favouriteToast) return;
    const id = window.setTimeout(() => setFavouriteToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [favouriteToast]);

  useEffect(() => {
    if (!supabase || !user?.id || !result) {
      setFavouriteMap({});
      return;
    }
    const prompts = [
      result.improvedPrompt,
      result.alternatives[0]?.prompt,
      result.alternatives[1]?.prompt,
      result.alternatives[2]?.prompt,
    ].filter(Boolean) as string[];
    if (!prompts.length) return;
    void (async () => {
      const { data, error: favError } = await supabase
        .from("saved_prompts")
        .select("id,prompt_text,source_alternative,is_favourite")
        .eq("user_id", user.id)
        .eq("is_favourite", true)
        .in("prompt_text", prompts);
      if (favError) return;
      const next: Record<string, string> = {};
      (data ?? []).forEach((row) => {
        const item = row as { id: string; prompt_text: string; source_alternative: string | null };
        const source = (item.source_alternative ?? "improved") as SourceAlternative;
        next[favouriteKey(source, item.prompt_text)] = item.id;
      });
      setFavouriteMap(next);
    })();
  }, [result, user?.id]);

  useEffect(() => {
    setAdvisorVisible(false);
    const id = window.setTimeout(() => setAdvisorVisible(true), 20);
    return () => window.clearTimeout(id);
  }, [lengthAdvice.state, lengthAdvice.tip]);

  useEffect(() => {
    if (!result || isImproving) {
      setShowScrollHint(false);
      return;
    }
    setShowScrollHint(true);
    const onScroll = () => {
      if (window.scrollY > 220) {
        setShowScrollHint(false);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [result, isImproving]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      if (!(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      void handleSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const saveSinglePrompt = async ({
    sessionId,
    promptText,
    promptKind,
    label,
  }: {
    sessionId: string;
    promptText: string;
    promptKind: "improved" | "alternative";
    label: string;
  }) => {
    if (!supabase || !user?.id || !platform) return;
    if (!isPro) {
      const { count, error: countError } = await supabase
        .from("saved_prompts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (countError) {
        setError(countError.message);
        return;
      }
      if ((count ?? 0) >= FREE_SAVED_PROMPT_LIMIT) {
        setToast("Free plan includes up to 5 saved prompts.");
        setUpgradeOpen(true);
        return;
      }
    }
    const quickNoteInput = window.prompt("Optional quick note for this saved prompt:", "") ?? null;
    if (quickNoteInput === null) return;
    const quickNote = quickNoteInput.trim() || null;

    await supabase.from("saved_prompts").insert({
      user_id: user.id,
      session_id: sessionId,
      code_session_id: null,
      saved_type: "prompt",
      prompt_text: promptText,
      prompt_type: promptKind,
      label,
      quick_note: quickNote,
      platform,
    });
    setToast("Saved to Saved Prompts");
  };

  const ensureSessionId = async () => {
    if (savedSessionId) return savedSessionId;
    if (!supabase || !user?.id) return null;
    const { data } = await supabase
      .from("prompt_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("original_prompt", originalPrompt.trim())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const id = (data as { id: string } | null)?.id ?? null;
    if (id) setSavedSessionId(id);
    return id;
  };

  const toggleFavouritePrompt = async ({
    source,
    promptText,
    label,
    promptKind,
  }: {
    source: SourceAlternative;
    promptText: string;
    label: string;
    promptKind: "improved" | "alternative";
  }) => {
    if (!supabase || !user?.id || !platform) return;
    const key = favouriteKey(source, promptText);
    const existingId = favouriteMap[key];
    if (existingId) {
      const { error: deleteError } = await supabase.from("saved_prompts").delete().eq("id", existingId);
      if (deleteError) return;
      setFavouriteMap((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setFavouriteToast({ text: "Removed from saved prompts", tone: "gray" });
      return;
    }
    if (!isPro) {
      const { count, error: countError } = await supabase
        .from("saved_prompts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (countError) return;
      if ((count ?? 0) >= FREE_SAVED_PROMPT_LIMIT) {
        setToast("Free plan includes up to 5 saved prompts.");
        setUpgradeOpen(true);
        return;
      }
    }

    const sessionId = await ensureSessionId();
    if (!sessionId) return;
    const { data, error: insertError } = await supabase
      .from("saved_prompts")
      .insert({
        user_id: user.id,
        session_id: sessionId,
        code_session_id: null,
        saved_type: "prompt",
        prompt_text: promptText,
        prompt_type: promptKind,
        label,
        quick_note: null,
        is_favourite: true,
        source_alternative: source,
        platform,
      })
      .select("id")
      .single();
    if (insertError) return;
    const insertedId = (data as { id: string }).id;
    setFavouriteMap((prev) => ({ ...prev, [key]: insertedId }));
    setHeartPulse((prev) => ({ ...prev, [key]: true }));
    window.setTimeout(() => {
      setHeartPulse((prev) => ({ ...prev, [key]: false }));
    }, 320);
    setFavouriteToast({ text: "Saved to your prompts", tone: "green" });
  };

  const handleSubmit = async (
    event?: FormEvent,
    options?: {
      promptOverride?: string;
      parentSessionId?: string | null;
      passNumberOverride?: number;
      rootOriginalPromptOverride?: string;
    },
  ) => {
    event?.preventDefault();
    setError(null);
    setCopiedAlternative(null);
    setShowAnalysis(false);
    const promptToImprove = (options?.promptOverride ?? originalPrompt).trim();

    if (!promptToImprove) {
      setShakeInput(true);
      window.setTimeout(() => setShakeInput(false), 420);
      setError("Please paste your prompt first.");
      return;
    }
    if (!platform || !promptType) {
      setError("Please choose a platform and prompt type.");
      return;
    }
    if (!user?.id) {
      setError("You need to be logged in to improve prompts.");
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

    setIsImproving(true);
    setProgressIndex(0);
    setResult(null);
    setSavedSessionId(null);
    setImprovedPromptView("");
    setShowOriginalPromptPanel(false);
    let streamedRaw = "";
    try {
      const stream = streamImprovePrompt({
        original_prompt: promptToImprove,
        platform,
        prompt_type: promptType,
        user_id: user.id,
        parent_session_id: options?.parentSessionId ?? null,
      });

      let finalOutput: ImprovePromptResponse | null = null;
      while (true) {
        const next = await stream.next();
        if (next.done) {
          finalOutput = next.value;
          break;
        }
        streamedRaw += next.value;
        const streamedPrompt = parseStreamedImprovedPrompt(streamedRaw);
        if (streamedPrompt) setImprovedPromptView(streamedPrompt);
      }

      if (!finalOutput) {
        throw new Error("AI response was invalid, please try again.");
      }

      const output = toImproveResult(finalOutput, promptToImprove);
      setResult(output);
      setImprovedPromptView(output.improvedPrompt);
      const savedId = finalOutput.session_id ?? null;
      if (savedId) {
        setSavedSessionId(savedId);
        setToast("Session saved");
      }
      if (options?.parentSessionId) {
        setChainParentSessionId(options.parentSessionId);
      } else if (savedId) {
        setChainParentSessionId(savedId);
      }
      setPassNumber(options?.passNumberOverride ?? 1);
      setRootOriginalPrompt(options?.rootOriginalPromptOverride ?? promptToImprove);
      setOriginalPrompt(promptToImprove);
    } catch (submitError) {
      console.error("Improve request failed", submitError);
      const message =
        submitError instanceof Error ? submitError.message : "Could not improve prompt. Please try again.";
      if (message === "Slow down a little, you are sending too many requests.") {
        setToast(message);
      }
      setError(message);
    } finally {
      setIsImproving(false);
    }
  };

  useEffect(() => {
    handleSubmitRef.current = () => handleSubmit();
    // Always point at latest handleSubmit (large dependency surface).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  const handleReImprove = async () => {
    if (!result || isImproving || !platform || !promptType) return;
    if (passNumber >= 4) return;
    const nextPrompt = (improvedPromptView ?? result.improvedPrompt).trim();
    if (!nextPrompt) return;

    const parentSessionId = chainParentSessionId ?? savedSessionId ?? null;
    if (!parentSessionId) {
      setError("Session link missing. Please run improve once more.");
      return;
    }

    const nextPass = passNumber + 1;
    const firstPrompt = rootOriginalPrompt ?? originalPrompt.trim();
    setOriginalPrompt(nextPrompt);
    setResultFadeOut(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 220));
    setResultFadeOut(false);
    await handleSubmit(undefined, {
      promptOverride: nextPrompt,
      parentSessionId,
      passNumberOverride: nextPass,
      rootOriginalPromptOverride: firstPrompt,
    });
  };

  const buildExportData = (): ExportSessionData | null => {
    if (!result) return null;
    const now = new Date();
    return {
      dateLabel: now.toLocaleDateString(),
      platform: platform ?? "Other",
      promptType: promptType ?? "Other",
      originalPrompt: originalPrompt.trim(),
      improvedPrompt: (improvedPromptView ?? result.improvedPrompt).trim(),
      scoreBefore: result.overallScoreBefore.toFixed(1),
      scoreAfter: result.overallScoreAfter.toFixed(1),
      keyChanges: result.keyChanges,
      alternatives: result.alternatives.map((alt) => ({ style: alt.style, prompt: alt.prompt })),
    };
  };

  const exportForNotion = async () => {
    const data = buildExportData();
    if (!data) return;
    await navigator.clipboard.writeText(formatSessionForNotion(data));
    setToast("Copied in Notion format");
  };

  const exportForNotes = async () => {
    const data = buildExportData();
    if (!data) return;
    await navigator.clipboard.writeText(formatSessionForNotes(data));
    setToast("Copied for Notes");
  };

  const exportForMarkdown = async () => {
    const data = buildExportData();
    if (!data) return;
    await navigator.clipboard.writeText(formatSessionForMarkdown(data));
    setToast("Copied as Markdown");
  };

  const exportAsTextFile = () => {
    const data = buildExportData();
    if (!data) return;
    setToast("Preparing download...");
    const token = new Date().toISOString().slice(0, 10);
    window.setTimeout(() => {
      downloadSessionAsTxt(formatSessionForNotes(data), token);
    }, 120);
  };

  const handleCopyAlternative = async (index: number) => {
    if (!result) return;
    await navigator.clipboard.writeText(result.alternatives[index].prompt);
    setCopiedAlternative(index);
    window.setTimeout(() => setCopiedAlternative(null), 2000);
  };

  const sharePrompt = async (text: string) => {
    const shareText = `${text}\n\nImproved with PromptFix`;
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        setToast("Copied for sharing");
      }
    } catch (error) {
      console.error("Share failed", error);
    }
  };

  const startLongPress = (text: string, label: string) => {
    longPressTimer.current = window.setTimeout(() => {
      setPressPromptText(text);
      setPressLabel(label);
      setPressSheetOpen(true);
    }, 450);
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onPlatformRowScroll = () => {
    setPlatformRowScrolling(true);
    if (platformScrollTimeout.current) window.clearTimeout(platformScrollTimeout.current);
    platformScrollTimeout.current = window.setTimeout(() => setPlatformRowScrolling(false), 650);
  };

  const onTypeRowScroll = () => {
    setTypeRowScrolling(true);
    if (typeScrollTimeout.current) window.clearTimeout(typeScrollTimeout.current);
    typeScrollTimeout.current = window.setTimeout(() => setTypeRowScrolling(false), 650);
  };

  const showPassBadge = Boolean(result && passNumber > 1);
  const canReImprove = Boolean(result && passNumber < 4 && !isImproving && platform && promptType);
  const showReImproveLimitMessage = Boolean(result && passNumber >= 4);

  return (
    <section className="space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-semibold text-[#1C1C1E]">Improve My Prompt</h1>
        <p className="mt-1 text-sm text-[#636366]">
          Paste any prompt. Get a better version plus three alternatives.
        </p>
      </div>

      {/* ── Template Library ──────────────────────────────────────── */}
      {showTemplates && (
        <TemplateLibrary
          templates={templates}
          loading={templatesLoading}
          selectedId={selectedTemplateId}
          onSelect={handleSelectTemplate}
          onSkip={() => {
            setShowTemplates(false);
            textareaSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}

      {!showTemplates && (
        <button
          type="button"
          onClick={() => setShowTemplates(true)}
          className="flex items-center gap-1.5 text-[13px] font-medium text-[#3B82F6] transition hover:text-[#2563EB]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
          </svg>
          Browse Templates
        </button>
      )}

      {selectedTemplateName ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3">
          <button
            type="button"
            onClick={handleClearTemplate}
            className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-[12px] font-medium text-blue-700 transition hover:bg-blue-200/70"
            title="Clear selected template"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
            Using template: {selectedTemplateName}
          </button>
        </div>
      ) : null}

      <div className="md:max-lg:grid md:max-lg:grid-cols-[55%_45%] md:max-lg:gap-4">
      <div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div
          className="rounded-2xl border border-[#E5E5EA] bg-white/70 p-4 backdrop-blur-xl"
        >
          <p className="mb-3 text-sm font-medium text-[#1C1C1E]">Choose Platform</p>
          <div
            onScroll={onPlatformRowScroll}
            className={[
              "pill-scrollbar flex gap-2 overflow-x-auto pb-1 md:max-lg:flex-wrap md:max-lg:overflow-visible",
              platformRowScrolling ? "pill-scrollbar-active" : "",
            ].join(" ")}
          >
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={[
                  "flex h-11 w-[104px] shrink-0 items-center justify-center rounded-full border px-3 py-1.5 text-center text-sm font-medium transition whitespace-nowrap",
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

        <div
          className="rounded-2xl border border-[#E5E5EA] bg-white/70 p-4 backdrop-blur-xl"
        >
          <p className="mb-3 text-sm font-medium text-[#1C1C1E]">Prompt Type</p>
          <div
            onScroll={onTypeRowScroll}
            className={[
              "pill-scrollbar flex gap-2 overflow-x-auto pb-1 md:max-lg:flex-wrap md:max-lg:overflow-visible",
              typeRowScrolling ? "pill-scrollbar-active" : "",
            ].join(" ")}
          >
            {PROMPT_TYPES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPromptType(p)}
                className={[
                  "flex h-11 w-[128px] shrink-0 items-center justify-center rounded-full border px-3 py-1.5 text-center text-sm font-medium transition whitespace-nowrap",
                  promptType === p
                    ? TYPE_ACTIVE[p]
                    : "border-[#D1D1D6] bg-white/75 text-[#636366] hover:bg-white",
                ].join(" ")}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <article
          ref={textareaSectionRef}
          className={`rounded-2xl border border-[#E5E5EA] bg-white/72 p-5 backdrop-blur-xl ${shakeInput ? "debug-shake" : ""}`}
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[#1C1C1E]">Your Prompt</p>
              <p className="text-sm text-[#636366]">Paste the prompt you want to improve</p>
            </div>
            <button
              type="button"
              onClick={() => { setOriginalPrompt(""); handleClearTemplate(); }}
              className="rounded-full border border-[#D1D1D6] bg-white px-3 py-1 text-xs font-medium text-[#636366] hover:bg-[#F8F8FA]"
            >
              Clear
            </button>
          </div>
          {stt.isSupported && (
            <ListeningBanner
              ref={listeningBannerRef}
              visible={stt.sttState === "listening"}
              onStop={stt.stop}
            />
          )}
          <div className="relative rounded-2xl">
            {stt.isSupported && (stt.sttState === "listening" || stt.sttState === "processing") ? (
              <SttTextMirror
                committed={stt.committedPart}
                interim={stt.interimText}
                placeholder="Paste your prompt here... it can be as rough or as detailed as you want."
                className="px-4 py-3 pb-12 pr-14 text-sm leading-relaxed"
              />
            ) : null}
            <textarea
              ref={inputRef}
              value={originalPrompt}
              onChange={(e) => setOriginalPrompt(e.target.value)}
              placeholder="Paste your prompt here... it can be as rough or as detailed as you want."
              className={[
                "scrollbar-hide min-h-[200px] max-h-[400px] w-full resize-none overflow-y-auto rounded-2xl border border-[#D1D1D6] bg-white/85 px-4 py-3 pb-12 pr-14 text-sm outline-none transition focus:border-[#3B82F6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]",
                stt.isSupported && (stt.sttState === "listening" || stt.sttState === "processing")
                  ? "relative z-[1] bg-transparent text-transparent caret-[#1C1C1E] placeholder:text-transparent"
                  : "text-[#1C1C1E]",
              ].join(" ")}
            />
            {stt.isSupported && (
              <MicButton
                sttState={stt.sttState}
                onClick={stt.toggle}
                className="absolute bottom-[2px] left-[2px]"
              />
            )}
            <span className="pointer-events-none absolute bottom-3 right-3 text-xs text-[#8E8E93]">
              {getWordCount(originalPrompt)} words
            </span>
          </div>

          {showLengthAdvisor ? (
            <div
              className={[
                "mt-3 flex items-center justify-between gap-3 border-t border-[#E5E5EA] pt-3 transition-opacity duration-200",
                advisorVisible ? "opacity-100" : "opacity-0",
              ].join(" ")}
            >
              <span
                className={[
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  lengthAdvice.state === "too_short"
                    ? "bg-rose-100 text-rose-700"
                    : lengthAdvice.state === "too_long"
                      ? "bg-orange-100 text-orange-700"
                      : lengthAdvice.state === "good"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-[#F2F2F7] text-[#636366]",
                ].join(" ")}
              >
                {lengthAdvice.pill}
              </span>
              <p className="text-right text-[12px] italic text-[#8E8E93]">{lengthAdvice.tip}</p>
            </div>
          ) : null}

        </article>

        {error ? <p className="text-sm text-rose-500">{error}</p> : null}

        {showScrollHint ? (
          <button
            type="button"
            onClick={() => {
              window.scrollBy({ top: 420, behavior: "smooth" });
              setShowScrollHint(false);
            }}
            className="mx-auto block rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 md:max-lg:hidden"
          >
            Your improved prompt is ready. Scroll down to view results ↓
          </button>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mx-auto flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#A78BFA] px-6 py-4 text-base font-semibold text-white shadow-[0_12px_30px_rgba(59,130,246,0.25)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isImproving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
              Improving your prompt...
            </>
          ) : (
            <>
              ✨ Improve My Prompt
            </>
          )}
        </button>

        <p className="text-center text-xs text-[#8E8E93]">Shortcut: Ctrl/Cmd + Enter</p>
        {isImproving ? (
          <p className="text-center text-sm text-[#636366]">{LOADING_MESSAGES[progressIndex]}</p>
        ) : null}
      </form>
      </div>

      <aside className="tablet-panel-sticky hidden rounded-2xl border border-[#E5E5EA] bg-white/74 p-4 backdrop-blur-xl md:max-lg:block">
        {!result && !isImproving ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-[#D1D1D6] bg-white/70 p-6 text-center text-sm text-[#636366]">
            Your results will appear here
          </div>
        ) : null}
        {isImproving && improvedPromptView ? (
          <article className="rounded-2xl border border-[#E5E5EA] bg-white/80 p-4">
            <h2 className="text-lg font-semibold text-[#1C1C1E]">Streaming Improved Prompt</h2>
            <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/10 bg-[rgba(30,30,34,0.90)] p-4 text-sm leading-6 text-slate-100">
              {improvedPromptView}
            </pre>
          </article>
        ) : null}
        {result ? (
          <section className={`space-y-3 transition-opacity duration-200 ${resultFadeOut ? "opacity-0" : "opacity-100"}`}>
            {showPassBadge ? (
              <div className="rounded-2xl border border-[#E9D5FF] bg-[#F5F3FF]/80 p-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                    Pass {passNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowOriginalPromptPanel((prev) => !prev)}
                    className="text-xs font-medium text-[#636366] underline underline-offset-2"
                  >
                    {showOriginalPromptPanel ? "Hide original" : "See original"}
                  </button>
                </div>
                {showOriginalPromptPanel && rootOriginalPrompt ? (
                  <div className="mt-2 rounded-xl border border-[#D8B4FE]/70 bg-white/80 p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#8E8E93]">First Prompt</p>
                    <p className="whitespace-pre-wrap text-sm text-[#1C1C1E]">{rootOriginalPrompt}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            <PromptScoreCard
              clarityBefore={result.scoreClarityBefore}
              specificityBefore={result.scoreSpecificityBefore}
              detailBefore={result.scoreDetailBefore}
              clarityAfter={result.scoreClarityAfter}
              specificityAfter={result.scoreSpecificityAfter}
              detailAfter={result.scoreDetailAfter}
              overallBefore={result.overallScoreBefore}
              overallAfter={result.overallScoreAfter}
              insight={result.insight}
            />
            <BeforeAfterCard
              originalPrompt={originalPrompt}
              improvedPrompt={improvedPromptView ?? result.improvedPrompt}
              wordsBefore={result.wordsBefore}
              wordsAfter={result.wordsAfter}
              overallBefore={result.overallScoreBefore}
              overallAfter={result.overallScoreAfter}
              platform={platform}
              improvedFavourite={Boolean(favouriteMap[favouriteKey("improved", improvedPromptView ?? result.improvedPrompt)])}
              improvedHeartActive={Boolean(heartPulse[favouriteKey("improved", improvedPromptView ?? result.improvedPrompt)])}
              onToggleImprovedFavourite={() =>
                void toggleFavouritePrompt({
                  source: "improved",
                  promptText: improvedPromptView ?? result.improvedPrompt,
                  label: "Improved",
                  promptKind: "improved",
                })
              }
            />
            <article className="space-y-3 rounded-2xl border border-[#E5E5EA] bg-white/80 p-4">
              <h2 className="text-lg font-semibold text-[#1C1C1E]">Alternative Approaches</h2>
              {result.alternatives.map((alt, index) => (
                <div key={`${alt.style}-${index}`} className="rounded-xl border border-[#D1D1D6] bg-white/90 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {alt.style}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        void toggleFavouritePrompt({
                          source: index === 0 ? "one" : index === 1 ? "two" : "three",
                          promptText: alt.prompt,
                          label: `Alternative ${index + 1}`,
                          promptKind: "alternative",
                        })
                      }
                      className={[
                        "rounded-full p-1 transition-all",
                        heartPulse[favouriteKey(index === 0 ? "one" : index === 1 ? "two" : "three", alt.prompt)] ? "heart-pop" : "",
                        favouriteMap[favouriteKey(index === 0 ? "one" : index === 1 ? "two" : "three", alt.prompt)]
                          ? "text-rose-500"
                          : "text-[#8E8E93]",
                      ].join(" ")}
                    >
                      <svg viewBox="0 0 24 24" fill={favouriteMap[favouriteKey(index === 0 ? "one" : index === 1 ? "two" : "three", alt.prompt)] ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.5c0 6.5-9 11.5-9 11.5S3 15 3 8.5A5.5 5.5 0 018.5 3c1.86 0 3.54.92 4.5 2.33A5.5 5.5 0 0117.5 3 5.5 5.5 0 0123 8.5z" />
                      </svg>
                    </button>
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-[#E5E7EB] bg-[#F8F8FA] p-3 text-xs text-[#1C1C1E]">
                    {alt.prompt}
                  </pre>
                </div>
              ))}
            </article>
            <div className="pt-1">
              <div className="mx-auto flex w-full max-w-2xl flex-col items-stretch gap-2 sm:flex-row sm:items-end sm:justify-center">
                {canReImprove ? (
                  <button
                    type="button"
                    onClick={() => void handleReImprove()}
                    className="reimprove-btn group w-full rounded-full px-5 py-3 text-left text-[#1C1C1E] transition-transform active:scale-[0.97]"
                  >
                    <span className="relative z-[1] flex items-center gap-2 text-sm font-semibold">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 6v6h-6" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 18v-6h6" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12a8 8 0 00-14.9-4M4 12a8 8 0 0014.9 4" />
                      </svg>
                      <span>Make It Even Better</span>
                    </span>
                    <span className="relative z-[1] mt-1 block text-xs text-[#8E8E93]">
                      Run the improved version through again for a second pass
                    </span>
                  </button>
                ) : null}
                <div className="sm:shrink-0">
                  <ExportSessionButton
                    onCopyNotion={exportForNotion}
                    onCopyNotes={exportForNotes}
                    onCopyMarkdown={exportForMarkdown}
                    onDownloadText={exportAsTextFile}
                  />
                </div>
              </div>
            </div>
            {showReImproveLimitMessage ? (
              <p className="text-center text-xs text-[#8E8E93]">
                This prompt has been refined 4 times. It is probably ready to use.
              </p>
            ) : null}
          </section>
        ) : null}
      </aside>
      </div>

      {isImproving && improvedPromptView ? (
        <article className="rounded-2xl border border-[#E5E5EA] bg-white/75 p-5 backdrop-blur-xl md:max-lg:hidden">
          <h2 className="text-lg font-semibold text-[#1C1C1E]">Streaming Improved Prompt</h2>
          <p className="mt-1 text-sm text-[#636366]">Live preview while Groq is generating...</p>
          <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/10 bg-[rgba(30,30,34,0.90)] p-4 text-sm leading-6 text-slate-100">
            {improvedPromptView}
          </pre>
        </article>
      ) : null}

      {result ? (
        <section
          className={`debug-results-enter space-y-4 transition-opacity duration-200 md:max-lg:hidden ${resultFadeOut ? "opacity-0" : "opacity-100"}`}
        >
          {showPassBadge ? (
            <div className="rounded-2xl border border-[#E9D5FF] bg-[#F5F3FF]/80 p-3">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                  Pass {passNumber}
                </span>
                <button
                  type="button"
                  onClick={() => setShowOriginalPromptPanel((prev) => !prev)}
                  className="text-xs font-medium text-[#636366] underline underline-offset-2"
                >
                  {showOriginalPromptPanel ? "Hide original" : "See original"}
                </button>
              </div>
              {showOriginalPromptPanel && rootOriginalPrompt ? (
                <div className="mt-2 rounded-xl border border-[#D8B4FE]/70 bg-white/80 p-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#8E8E93]">First Prompt</p>
                  <p className="whitespace-pre-wrap text-sm text-[#1C1C1E]">{rootOriginalPrompt}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          <PromptScoreCard
            clarityBefore={result.scoreClarityBefore}
            specificityBefore={result.scoreSpecificityBefore}
            detailBefore={result.scoreDetailBefore}
            clarityAfter={result.scoreClarityAfter}
            specificityAfter={result.scoreSpecificityAfter}
            detailAfter={result.scoreDetailAfter}
            overallBefore={result.overallScoreBefore}
            overallAfter={result.overallScoreAfter}
            insight={result.insight}
          />
          <BeforeAfterCard
            originalPrompt={originalPrompt}
            improvedPrompt={improvedPromptView ?? result.improvedPrompt}
            wordsBefore={result.wordsBefore}
            wordsAfter={result.wordsAfter}
            overallBefore={result.overallScoreBefore}
            overallAfter={result.overallScoreAfter}
            platform={platform}
            improvedFavourite={Boolean(favouriteMap[favouriteKey("improved", improvedPromptView ?? result.improvedPrompt)])}
            improvedHeartActive={Boolean(heartPulse[favouriteKey("improved", improvedPromptView ?? result.improvedPrompt)])}
            onToggleImprovedFavourite={() =>
              void toggleFavouritePrompt({
                source: "improved",
                promptText: improvedPromptView ?? result.improvedPrompt,
                label: "Improved",
                promptKind: "improved",
              })
            }
          />

          <article
            className="debug-result-card rounded-2xl border border-[#E5E5EA] bg-white/75 p-5 backdrop-blur-xl"
            style={{ animationDelay: "110ms" }}
          >
            <h2 className="text-lg font-semibold text-[#1C1C1E]">🌿 Alternative Approaches</h2>
            <p className="mt-1 text-sm text-[#636366]">Three different ways to achieve the same goal</p>

            <div className="mt-3 grid gap-3 md:max-lg:grid-cols-1 lg:grid-cols-3">
              {result.alternatives.map((alt, index) => (
                <div key={alt.style} className="rounded-xl border border-[#D1D1D6] bg-white/82 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        index === 0
                          ? "bg-blue-100 text-blue-700"
                          : index === 1
                            ? "bg-violet-100 text-violet-700"
                            : "bg-emerald-100 text-emerald-700",
                      ].join(" ")}
                    >
                      {alt.style}
                    </span>
                    <button
                      type="button"
                      onClick={() => void sharePrompt(alt.prompt)}
                      className="rounded-full border border-[#D1D1D6] bg-white px-2 py-1 text-[11px] text-[#636366]"
                    >
                      Share
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void toggleFavouritePrompt({
                          source: index === 0 ? "one" : index === 1 ? "two" : "three",
                          promptText: alt.prompt,
                          label: `Alternative ${index + 1}`,
                          promptKind: "alternative",
                        })
                      }
                      className={[
                        "rounded-full p-1 transition-all",
                        heartPulse[favouriteKey(index === 0 ? "one" : index === 1 ? "two" : "three", alt.prompt)] ? "heart-pop" : "",
                        favouriteMap[favouriteKey(index === 0 ? "one" : index === 1 ? "two" : "three", alt.prompt)]
                          ? "text-rose-500"
                          : "text-[#8E8E93]",
                      ].join(" ")}
                    >
                      <svg viewBox="0 0 24 24" fill={favouriteMap[favouriteKey(index === 0 ? "one" : index === 1 ? "two" : "three", alt.prompt)] ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.5c0 6.5-9 11.5-9 11.5S3 15 3 8.5A5.5 5.5 0 018.5 3c1.86 0 3.54.92 4.5 2.33A5.5 5.5 0 0117.5 3 5.5 5.5 0 0123 8.5z" />
                      </svg>
                    </button>
                  </div>
                  <pre
                    className="mt-2 whitespace-pre-wrap rounded-lg border border-[#E5E7EB] bg-[#F8F8FA] p-3 text-xs text-[#1C1C1E]"
                    onTouchStart={() => startLongPress(alt.prompt, `Alternative ${index + 1}`)}
                    onTouchEnd={clearLongPress}
                    onTouchMove={clearLongPress}
                  >
                    {alt.prompt}
                  </pre>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyAlternative(index)}
                      className={`w-full rounded-full px-3 py-1.5 text-xs font-semibold text-white sm:w-auto ${copiedAlternative === index ? "bg-emerald-500" : "bg-gradient-to-r from-[#3B82F6] to-[#A78BFA]"}`}
                    >
                      {copiedAlternative === index ? "Copied!" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setImprovedPromptView(alt.prompt)}
                      className="w-full rounded-full border border-[#D1D1D6] bg-white px-3 py-1.5 text-xs font-medium text-[#1C1C1E] sm:w-auto"
                    >
                      Use This One
                    </button>
                    {savedSessionId ? (
                      <button
                        type="button"
                        onClick={() =>
                          saveSinglePrompt({
                            sessionId: savedSessionId,
                            promptText: alt.prompt,
                            promptKind: "alternative",
                            label: `Alternative ${index + 1} - ${alt.style}`,
                          })
                        }
                        className="w-full rounded-full border border-[#D1D1D6] bg-white px-3 py-1.5 text-xs font-medium text-[#1C1C1E] sm:w-auto"
                      >
                        Save to Saved Prompts
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article
            className="debug-result-card rounded-2xl border border-[#E5E5EA] bg-white/75 p-5 backdrop-blur-xl"
            style={{ animationDelay: "220ms" }}
          >
            <button
              type="button"
              onClick={() => setShowAnalysis((prev) => !prev)}
              className="flex w-full items-center justify-between text-left"
            >
              <h2 className="text-lg font-semibold text-[#1C1C1E]">Prompt Analysis</h2>
              <span className="text-sm text-[#636366]">{showAnalysis ? "Hide" : "Show"}</span>
            </button>
            {showAnalysis ? (
              <ul className="mt-3 space-y-2">
                {result.weaknesses.map((w) => (
                  <li key={w} className="flex gap-2 text-sm text-[#3A3A3C]">
                    <span className="mt-1 h-2 w-2 rounded-full bg-orange-400" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {savedSessionId ? (
              <button
                type="button"
                onClick={() =>
                  saveSinglePrompt({
                    sessionId: savedSessionId,
                    promptText: improvedPromptView ?? result.improvedPrompt,
                    promptKind: "improved",
                    label: "Improved Prompt (from analysis)",
                  })
                }
                className="mt-3 rounded-full border border-[#D1D1D6] bg-white px-4 py-2 text-sm text-[#1C1C1E]"
              >
                Save to Saved Prompts
              </button>
            ) : null}
          </article>
          <div className="pt-1">
            <div className="mx-auto flex w-full flex-col items-stretch gap-2 md:max-w-2xl sm:flex-row sm:items-end sm:justify-center">
              {canReImprove ? (
                <button
                  type="button"
                  onClick={() => void handleReImprove()}
                  className="reimprove-btn group w-full rounded-full px-5 py-3 text-left text-[#1C1C1E] transition-transform active:scale-[0.97]"
                >
                  <span className="relative z-[1] flex items-center gap-2 text-sm font-semibold">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6v6h-6" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 18v-6h6" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12a8 8 0 00-14.9-4M4 12a8 8 0 0014.9 4" />
                    </svg>
                    <span>Make It Even Better</span>
                  </span>
                  <span className="relative z-[1] mt-1 block text-xs text-[#8E8E93]">
                    Run the improved version through again for a second pass
                  </span>
                </button>
              ) : null}
              <div className="sm:shrink-0">
                <ExportSessionButton
                  onCopyNotion={exportForNotion}
                  onCopyNotes={exportForNotes}
                  onCopyMarkdown={exportForMarkdown}
                  onDownloadText={exportAsTextFile}
                />
              </div>
            </div>
          </div>
          {showReImproveLimitMessage ? (
            <p className="text-center text-xs text-[#8E8E93]">
              This prompt has been refined 4 times. It is probably ready to use.
            </p>
          ) : null}
        </section>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 right-5 rounded-xl bg-emerald-500 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
      {speechToast ? (
        <div
          className={[
            "fixed bottom-5 left-5 z-[170] max-w-[min(92vw,360px)] rounded-xl border px-4 py-2 text-sm shadow-lg",
            speechToast.error
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-[#E5E5EA] bg-[#F2F2F7] text-[#636366]",
          ].join(" ")}
        >
          {speechToast.text}
        </div>
      ) : null}
      {favouriteToast ? (
        <div
          className={[
            "fixed bottom-16 right-5 rounded-xl px-4 py-2 text-sm shadow-lg",
            favouriteToast.tone === "green"
              ? "bg-emerald-500 text-white"
              : "bg-[#F2F2F7] text-[#636366]",
          ].join(" ")}
        >
          {favouriteToast.text}
        </div>
      ) : null}
      <BottomSheet open={mobileWhatChangedOpen} onClose={() => setMobileWhatChangedOpen(false)}>
        <h3 className="px-1 pb-2 text-[16px] font-semibold text-[#1C1C1E]">What Changed</h3>
        <ul className="space-y-2 pb-2">
          {result?.keyChanges.map((change) => (
            <li key={change} className="rounded-xl bg-[#F8F8FA] px-3 py-2 text-sm text-[#3A3A3C]">
              {change}
            </li>
          ))}
        </ul>
      </BottomSheet>
      <BottomSheet open={pressSheetOpen} onClose={() => setPressSheetOpen(false)}>
        <h3 className="px-1 pb-2 text-[16px] font-semibold text-[#1C1C1E]">{pressLabel}</h3>
        <div className="space-y-1 pb-2">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(pressPromptText);
              setToast("Copied");
              setPressSheetOpen(false);
            }}
            className="block min-h-[44px] w-full rounded-2xl px-4 py-3 text-left text-sm text-[#1C1C1E]"
          >
            Copy
          </button>
          {savedSessionId ? (
            <button
              type="button"
              onClick={() => {
                void saveSinglePrompt({
                  sessionId: savedSessionId,
                  promptText: pressPromptText,
                  promptKind: "alternative",
                  label: pressLabel,
                });
                setPressSheetOpen(false);
              }}
              className="block min-h-[44px] w-full rounded-2xl px-4 py-3 text-left text-sm text-[#1C1C1E]"
            >
              Save to Saved Prompts
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void sharePrompt(pressPromptText);
              setPressSheetOpen(false);
            }}
            className="block min-h-[44px] w-full rounded-2xl px-4 py-3 text-left text-sm text-[#1C1C1E]"
          >
            Share
          </button>
        </div>
      </BottomSheet>
      <UpgradeModal
        open={upgradeOpen}
        usageCount={usageCount}
        onClose={() => setUpgradeOpen(false)}
        onUpgrade={() => {
          try {
            openProCheckout();
          } catch (error) {
            console.error("Upgrade redirect failed", error);
            setError(error instanceof Error ? error.message : "Could not open Stripe checkout.");
          }
        }}
      />
    </section>
  );
};
