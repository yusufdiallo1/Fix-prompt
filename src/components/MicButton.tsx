/**
 * Speech-to-Text UI for PromptFix (Web Speech API).
 * MicButton (36×36 icon, 44×44 touch target), ListeningBanner, useSpeechInput, SttTextMirror.
 */

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { applySpeechPunctuation, getSttLanguage, isSpeechSupported, SpeechToText } from "../lib/stt";
import type { STTErrorKind } from "../lib/stt";

export type STTState = "idle" | "listening" | "processing" | "denied";

export interface UseSpeechInputOptions {
  value: string;
  onChange: (v: string) => void;
  language?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onSpeechFinalized?: () => void;
  /** isError: soft red toast; neutral: soft gray toast */
  showToast?: (text: string, isError?: boolean) => void;
}

export interface UseSpeechInputResult {
  sttState: STTState;
  interimText: string;
  /** Text confirmed this session (prefix + finalized), without interim — for styled mirror */
  committedPart: string;
  isSupported: boolean;
  toggle: () => void;
  stop: () => void;
}

function joinCommitted(prefix: string, finalized: string): string {
  return [prefix.trim(), finalized.trim()].filter(Boolean).join(" ");
}

function joinWithInterim(committed: string, interim: string): string {
  const i = interim.trim();
  if (!i) return committed;
  if (!committed) return i;
  return `${committed} ${i}`;
}

export function useSpeechInput({
  value,
  onChange,
  language,
  textareaRef,
  onSpeechFinalized,
  showToast,
}: UseSpeechInputOptions): UseSpeechInputResult {
  const [sttState, setSttState] = useState<STTState>("idle");
  const [interimText, setInterimText] = useState("");
  const [committedPart, setCommittedPart] = useState("");
  const [isSupported] = useState(() => isSpeechSupported());

  const valueRef = useRef(value);
  valueRef.current = value;

  const sttRef = useRef<SpeechToText | null>(null);
  const prefixRef = useRef("");
  const finalizedRef = useRef("");
  const hasSpeechRef = useRef(false);
  const errorHandledRef = useRef(false);

  useEffect(() => {
    return () => {
      sttRef.current?.stop();
    };
  }, []);

  const scrollTextareaToBottom = useCallback(() => {
    const el = textareaRef?.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [textareaRef]);

  const startListening = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    prefixRef.current = valueRef.current;
    finalizedRef.current = "";
    hasSpeechRef.current = false;
    errorHandledRef.current = false;

    const initialCommitted = joinCommitted(prefixRef.current, "");
    setCommittedPart(initialCommitted);

    const lang = language ?? getSttLanguage();

    const stt = new SpeechToText(
      {
        onStart() {
          setSttState("listening");
          setInterimText("");
          const c = joinCommitted(prefixRef.current, finalizedRef.current);
          setCommittedPart(c);
        },

        onInterim(text) {
          setInterimText(text);
          const c = joinCommitted(prefixRef.current, finalizedRef.current);
          setCommittedPart(c);
          onChange(joinWithInterim(c, text));
          scrollTextareaToBottom();
        },

        onFinal(text) {
          hasSpeechRef.current = true;
          const polished = applySpeechPunctuation(text);
          finalizedRef.current = [finalizedRef.current, polished.trim()].filter(Boolean).join(" ");
          setInterimText("");
          const c = joinCommitted(prefixRef.current, finalizedRef.current);
          setCommittedPart(c);
          onChange(c);
          scrollTextareaToBottom();
        },

        onStop() {
          if (errorHandledRef.current) {
            errorHandledRef.current = false;
            setSttState("idle");
            setInterimText("");
            return;
          }
          const c = joinCommitted(prefixRef.current, finalizedRef.current);
          onChange(c);
          setInterimText("");
          setCommittedPart(c);
          setSttState("processing");

          window.setTimeout(() => {
            setSttState("idle");
            if (hasSpeechRef.current && finalizedRef.current.trim()) {
              showToast?.("Recording stopped", false);
              onSpeechFinalized?.();
            }
          }, 300);
        },

        onError(kind: STTErrorKind) {
          errorHandledRef.current = true;
          const c = joinCommitted(prefixRef.current, finalizedRef.current);
          onChange(c);
          setInterimText("");
          setCommittedPart(c);

          if (kind === "mic-denied") {
            setSttState("denied");
            showToast?.(
              "Microphone access denied. Please allow microphone access in your browser settings to use this feature.",
              true,
            );
          } else if (kind === "no-speech") {
            setSttState("idle");
            showToast?.("No speech detected. Tap the microphone to try again.", true);
          } else if (kind === "not-supported") {
            setSttState("idle");
          } else {
            setSttState("idle");
            showToast?.("Speech recognition unavailable. Please try again.", true);
          }
        },
      },
      lang,
    );

    sttRef.current = stt;
    stt.start();
  }, [language, onChange, scrollTextareaToBottom, onSpeechFinalized, showToast]);

  const stop = useCallback(() => {
    sttRef.current?.stop();
    sttRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    if (sttState === "listening" || sttState === "processing") {
      stop();
    } else if (sttState === "denied") {
      showToast?.(
        "Microphone access denied. Please allow microphone access in your browser settings to use this feature.",
        true,
      );
    } else {
      startListening();
    }
  }, [sttState, stop, startListening, showToast]);

  return { sttState, interimText, committedPart, isSupported, toggle, stop };
}

/** Mirror layer: normal committed text + gray italic interim (textarea uses transparent text + caret). */
export function SttTextMirror({
  committed,
  interim,
  placeholder,
  dark,
  className,
}: {
  committed: string;
  interim: string;
  placeholder?: string;
  dark?: boolean;
  className?: string;
}) {
  const showPh = !committed && !interim;
  return (
    <div
      aria-hidden
      className={[
        "pointer-events-none absolute inset-0 z-0 overflow-hidden whitespace-pre-wrap break-words rounded-[inherit]",
        className ?? "",
      ].join(" ")}
    >
      {showPh ? (
        <span className={dark ? "text-slate-500" : "text-[#8E8E93]"}>{placeholder}</span>
      ) : (
        <>
          <span className={dark ? "text-slate-100" : "text-[#1C1C1E]"}>{committed}</span>
          {interim ? (
            <span className={dark ? "italic text-slate-400" : "italic text-[#9CA3AF]"}>
              {(committed ? " " : "") + interim}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

function MicOutlineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}

function MicFilledIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1.5a3.75 3.75 0 00-3.75 3.75v7.5a3.75 3.75 0 007.5 0v-7.5A3.75 3.75 0 0012 1.5z" />
      <path d="M19.5 10.5a1 1 0 00-2 0 5.5 5.5 0 01-11 0 1 1 0 00-2 0 7.5 7.5 0 006.5 7.43V20H9a1 1 0 000 2h6a1 1 0 000-2h-2v-2.07A7.5 7.5 0 0019.5 10.5z" />
    </svg>
  );
}

function MicSlashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      <path d="M3 3l18 18" strokeWidth={2} />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <span
      className={[
        "inline-block rounded-full border-2 border-current border-t-transparent animate-spin",
        className,
      ].join(" ")}
    />
  );
}

export const ListeningBanner = forwardRef<
  HTMLDivElement,
  {
    visible: boolean;
    onStop: () => void;
    label?: string;
  }
>(function ListeningBanner({ visible, onStop, label = "Listening... speak your prompt" }, ref) {
  if (!visible) return null;

  return (
    <div
      ref={ref}
      className="stt-banner-enter mb-1.5 flex h-8 min-h-[32px] w-full items-center gap-2 overflow-hidden rounded-t-2xl border border-rose-100 bg-rose-50/90 px-3 backdrop-blur-sm"
    >
      <span className="flex shrink-0 items-center gap-[3px]" aria-hidden>
        <span className="stt-wave-bar-1 inline-block w-[3px] rounded-full bg-rose-400" style={{ height: 10 }} />
        <span className="stt-wave-bar-2 inline-block w-[3px] rounded-full bg-rose-400" style={{ height: 14 }} />
        <span className="stt-wave-bar-3 inline-block w-[3px] rounded-full bg-rose-400" style={{ height: 10 }} />
      </span>

      <span className="flex-1 text-center text-[11px] font-medium text-rose-500">{label}</span>

      <button type="button" onClick={onStop} className="shrink-0 text-[11px] font-semibold text-rose-500 hover:text-rose-700">
        Stop
      </button>
    </div>
  );
});

interface MicButtonProps {
  sttState: STTState;
  onClick: () => void;
  className?: string;
  dark?: boolean;
}

export function MicButton({ sttState, onClick, className, dark }: MicButtonProps) {
  const isListening = sttState === "listening";
  const isProcessing = sttState === "processing";
  const isDenied = sttState === "denied";

  const tooltipText =
    isListening || isProcessing ? "Tap to stop" : isDenied ? "Microphone access denied" : "Speak your prompt";

  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltipText}
      aria-label={tooltipText}
      className={[
        "relative z-[2] flex h-[44px] w-[44px] items-center justify-center rounded-full sm:h-9 sm:w-9",
        isListening ? "animate-pulse" : "",
        className ?? "",
      ].join(" ")}
      style={{ touchAction: "manipulation" }}
    >
      {/* Visible control: 36×36 px per spec; 44×44 touch via outer padding on mobile */}
      <span
        className={[
          "relative flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200",
          isListening
            ? "bg-rose-50"
            : isProcessing
              ? "bg-violet-50"
              : isDenied
                ? "bg-[#F2F2F7]"
                : dark
                  ? "bg-white/10 hover:bg-white/20"
                  : "bg-[#F2F2F7] hover:bg-[#E5E5EA]",
        ].join(" ")}
      >
        {isListening && <span className="stt-pulse-ring absolute inset-0 rounded-full" />}

        {isListening ? (
          <MicFilledIcon className="relative z-[1] h-[18px] w-[18px] text-[#EF4444]" />
        ) : isProcessing ? (
          <span className="relative flex h-[18px] w-[18px] items-center justify-center">
            <MicOutlineIcon className="absolute inset-0 h-full w-full text-[#A78BFA]" />
            <SpinnerIcon className="absolute -right-0.5 -top-0.5 h-3 w-3 text-[#A78BFA]" />
          </span>
        ) : isDenied ? (
          <MicSlashIcon className="h-[18px] w-[18px] text-[#9CA3AF]" />
        ) : (
          <MicOutlineIcon className={["h-[18px] w-[18px]", dark ? "text-slate-400" : "text-[#9CA3AF]"].join(" ")} />
        )}
      </span>
    </button>
  );
}
