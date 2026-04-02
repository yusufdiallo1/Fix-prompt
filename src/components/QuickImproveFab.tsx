import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { improvePrompt, type ImprovePromptResponse } from "../lib/groq";
import { useAuth } from "../hooks/useAuth";
import { ListeningBanner, MicButton, SttTextMirror, useSpeechInput } from "./MicButton";
import { getSttLanguage } from "../lib/stt";

const PLATFORMS = ["Lovable", "Cursor", "Replit", "ChatGPT", "Claude", "Other"] as const;
type Platform = (typeof PLATFORMS)[number];

const QUICK_IMPROVE_SESSION_KEY = "pf_quick_improve_session";

interface QuickImprovePayload {
  originalPrompt: string;
  platform: Platform;
  result: ImprovePromptResponse;
}

const isMac = () => navigator.platform.toLowerCase().includes("mac");

function BoltIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.1} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}

function SparkleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3l1.3 3.7L14 8l-3.7 1.3L9 13l-1.3-3.7L4 8l3.7-1.3L9 3zM17.5 12l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" />
    </svg>
  );
}

export const QuickImproveFab = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("Cursor");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImprovePromptResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [fabSpeechToast, setFabSpeechToast] = useState<{ text: string; error?: boolean } | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const quickListeningBannerRef = useRef<HTMLDivElement | null>(null);

  const stt = useSpeechInput({
    value: prompt,
    onChange: setPrompt,
    language: getSttLanguage(),
    textareaRef: promptTextareaRef,
    showToast: (text, isError) => {
      if (isError) setError(text);
      else setFabSpeechToast({ text, error: false });
    },
  });

  useEffect(() => {
    if (!fabSpeechToast) return;
    const id = window.setTimeout(() => setFabSpeechToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [fabSpeechToast]);

  useEffect(() => {
    if (stt.sttState !== "listening") return;
    const id = window.requestAnimationFrame(() => {
      quickListeningBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [stt.sttState]);

  const shouldHideForRoute = location.pathname.startsWith("/improve") || location.pathname.startsWith("/debug");
  const hidden = shouldHideForRoute || inputFocused;

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        setInputFocused(true);
      }
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        const active = document.activeElement;
        const focused =
          active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
        setInputFocused(focused);
      }, 80);
    };
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Enter") return;
      if (!(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      void runImprove();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  const shownText = useMemo(() => {
    if (!result) return "";
    if (activeIndex === 0) return result.improved_prompt;
    if (activeIndex === 1) return result.alternative_one;
    if (activeIndex === 2) return result.alternative_two;
    return result.alternative_three;
  }, [result, activeIndex]);

  const resetModal = () => {
    setOpen(false);
    setLoading(false);
    setError(null);
    setResult(null);
    setActiveIndex(0);
  };

  const runImprove = async () => {
    if (!prompt.trim() || !user?.id || loading) return;
    setLoading(true);
    setError(null);
    try {
      const output = await improvePrompt({
        original_prompt: prompt.trim(),
        platform,
        prompt_type: "Other",
        user_id: user.id,
      });
      setResult(output);
      setActiveIndex(0);
    } catch (improveError) {
      const message =
        improveError instanceof Error ? improveError.message : "Could not improve this prompt.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await runImprove();
  };

  const handleCopy = async () => {
    if (!shownText) return;
    await navigator.clipboard.writeText(shownText);
    setCopied(true);
  };

  const openFullSession = () => {
    if (!result) return;
    const payload: QuickImprovePayload = {
      originalPrompt: prompt.trim(),
      platform,
      result,
    };
    window.sessionStorage.setItem(QUICK_IMPROVE_SESSION_KEY, JSON.stringify(payload));
    resetModal();
    navigate("/improve");
  };

  if (hidden) return null;

  return (
    <>
      <div className="quick-improve-fab-wrap fixed bottom-24 right-5 z-[96] md:right-8 md:max-lg:bottom-24 lg:bottom-8">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="quick-improve-fab group relative h-14 w-14 rounded-full text-white shadow-[0_14px_34px_rgba(99,102,241,0.35)]"
          style={{ background: "linear-gradient(135deg,#3B82F6 0%,#A78BFA 100%)" }}
          aria-label="Quick Improve"
        >
          <span className="quick-improve-fab-glow absolute inset-0 rounded-full" />
          <span className="relative z-[2] flex h-full w-full items-center justify-center">
            <BoltIcon />
          </span>
          <span className="pointer-events-none absolute right-[calc(100%+10px)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-full border border-white/70 bg-white/92 px-3 py-1 text-xs font-semibold text-[#1C1C1E] opacity-0 shadow-[0_10px_24px_rgba(28,28,30,0.12)] transition-all duration-200 group-hover:block group-hover:opacity-100">
            Quick Improve
          </span>
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[121]">
          <button type="button" aria-label="Close quick improve" className="absolute inset-0 bg-black/40" onClick={resetModal} />

          <section className="absolute inset-x-0 bottom-0 mx-auto h-[85vh] rounded-t-[28px] border border-white/70 bg-white/90 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3 shadow-[0_-18px_40px_rgba(28,28,30,0.22)] backdrop-blur-2xl md:inset-auto md:left-1/2 md:top-1/2 md:h-[600px] md:max-h-[85vh] md:w-[min(560px,92vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[28px] md:px-5 md:pb-5 md:pt-4">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#C7C7CC] md:hidden" />

            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-[#1C1C1E]">
                <BoltIcon className="h-4 w-4 text-[#3B82F6]" />
                Quick Improve
              </h3>
              <button
                type="button"
                onClick={resetModal}
                className="rounded-full border border-[#D1D1D6] bg-white px-2.5 py-1 text-xs font-semibold text-[#636366]"
              >
                Close
              </button>
            </div>

            {!result ? (
              <form onSubmit={handleSubmit} className="flex h-[calc(100%-42px)] flex-col gap-3">
                <div className="relative flex-1 rounded-2xl border border-white/10 bg-[rgba(30,30,34,0.92)] p-3">
                  {stt.isSupported && (
                    <ListeningBanner
                      ref={quickListeningBannerRef}
                      visible={stt.sttState === "listening"}
                      onStop={stt.stop}
                    />
                  )}
                  <div className="relative min-h-[210px] rounded-xl">
                    {stt.isSupported && (stt.sttState === "listening" || stt.sttState === "processing") ? (
                      <SttTextMirror
                        dark
                        committed={stt.committedPart}
                        interim={stt.interimText}
                        placeholder="Paste any prompt here..."
                        className="p-2 pb-10 text-sm leading-6"
                      />
                    ) : null}
                    <textarea
                      ref={promptTextareaRef}
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      placeholder="Paste any prompt here..."
                      className={[
                        "h-full min-h-[210px] w-full resize-none rounded-xl border border-transparent bg-transparent p-2 pb-10 text-sm leading-6 outline-none",
                        stt.isSupported && (stt.sttState === "listening" || stt.sttState === "processing")
                          ? "relative z-[1] text-transparent caret-slate-100 placeholder:text-transparent"
                          : "text-slate-100",
                      ].join(" ")}
                      style={{ opacity: loading ? 0.5 : 1 }}
                    />
                    {stt.isSupported && (
                      <MicButton
                        sttState={stt.sttState}
                        onClick={stt.toggle}
                        dark
                        className="absolute bottom-[2px] left-[2px]"
                      />
                    )}
                  </div>
                  {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      <p className="text-sm text-slate-200">Improving...</p>
                    </div>
                  ) : null}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {PLATFORMS.map((pill) => (
                    <button
                      key={pill}
                      type="button"
                      onClick={() => setPlatform(pill)}
                      className={[
                        "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                        platform === pill
                          ? "border-blue-300 bg-blue-100 text-blue-700"
                          : "border-[#D1D1D6] bg-white text-[#636366]",
                      ].join(" ")}
                    >
                      {pill}
                    </button>
                  ))}
                </div>

                {error ? <p className="text-xs text-rose-500">{error}</p> : null}
                {fabSpeechToast ? (
                  <p
                    className={
                      fabSpeechToast.error
                        ? "text-xs text-rose-600"
                        : "text-xs text-[#8E8E93]"
                    }
                  >
                    {fabSpeechToast.text}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#A78BFA] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <SparkleIcon />
                  Improve Now
                </button>
                <p className="text-center text-[11px] text-[#8E8E93]">
                  {isMac() ? "Cmd + Enter" : "Ctrl + Enter"}
                </p>
              </form>
            ) : (
              <div className="quick-improve-result-enter flex h-[calc(100%-42px)] flex-col gap-3">
                <div className="flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(30,30,34,0.92)] p-3">
                  <div className="h-full overflow-auto whitespace-pre-wrap rounded-xl p-2 text-sm leading-6 text-slate-100">
                    {shownText}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="w-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#A78BFA] px-5 py-3 text-sm font-semibold text-white"
                >
                  {copied ? "Copied!" : activeIndex === 0 ? "Copy Improved Prompt" : "Copy"}
                </button>

                <div className="flex gap-2">
                  {["Improved", "Alt 1", "Alt 2", "Alt 3"].map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                        activeIndex === index
                          ? "border-blue-300 bg-blue-100 text-blue-700"
                          : "border-[#D1D1D6] bg-white text-[#636366]",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={openFullSession}
                  className="text-center text-xs font-medium text-[#3B82F6] hover:text-[#2563EB]"
                >
                  Open Full Session
                </button>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
};

export const QUICK_IMPROVE_STORAGE_KEY = QUICK_IMPROVE_SESSION_KEY;
