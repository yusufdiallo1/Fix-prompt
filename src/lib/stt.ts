/**
 * Web Speech API wrapper for PromptFix Speech-to-Text.
 * No external dependencies. Works in Chrome, Edge, Safari, and Capacitor WKWebView.
 */

// ─── Minimal Web Speech API typings ──────────────────────────────────────────
// TypeScript's DOM lib omits these in older versions; declare them locally.

interface SpeechRecognitionResultItem {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionResultItem;
  [index: number]: SpeechRecognitionResultItem;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEventData extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEventData extends Event {
  readonly error: string;
  readonly message: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEventData) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEventData) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

// ─── Exports ──────────────────────────────────────────────────────────────────

export type STTErrorKind =
  | "not-supported"
  | "mic-denied"
  | "no-speech"
  | "service-unavailable";

export interface STTCallbacks {
  /** Fires with the latest unconfirmed transcript as the user speaks. */
  onInterim: (text: string) => void;
  /** Fires when a phrase is finalized by the speech engine. */
  onFinal: (text: string) => void;
  /** Fires once recognition actually begins (after permission is granted). */
  onStart: () => void;
  /** Fires when recognition fully stops (after manual stop or timeout). */
  onStop: () => void;
  /** Fires on unrecoverable errors. */
  onError: (kind: STTErrorKind) => void;
}

/** Returns true when the current browser supports the Web Speech API. */
export const isSpeechSupported = (): boolean => {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w["SpeechRecognition"] ?? w["webkitSpeechRecognition"]);
};

/**
 * Light punctuation pass: many engines already include punctuation; this adds
 * a sentence end only when the phrase looks complete and has none.
 */
export const applySpeechPunctuation = (transcript: string): string => {
  const t = transcript.trim();
  if (!t) return t;
  if (/[.!?…,;:'"')\]}»…]$/.test(t)) return t;
  const lower = t.toLowerCase();
  if (
    /^(what|how|why|when|where|who|which|can you|could you|would you|is it|are there|do you|does it)\b/.test(
      lower,
    )
  ) {
    return `${t}?`;
  }
  return `${t}.`;
};

/** Read the saved STT language from localStorage, falling back to en-US. */
export const getSttLanguage = (): string => {
  try {
    return localStorage.getItem("stt_language") ?? "en-US";
  } catch {
    return "en-US";
  }
};

const getImpl = (): SpeechRecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w["SpeechRecognition"] as SpeechRecognitionCtor | undefined) ??
    (w["webkitSpeechRecognition"] as SpeechRecognitionCtor | undefined) ??
    null;
};

/**
 * Manages a single continuous-mode speech recognition session.
 * Create a new instance for each listening session.
 */
export class SpeechToText {
  private rec: SpeechRecognitionInstance | null = null;
  private readonly cb: STTCallbacks;
  private readonly lang: string;
  private _active = false;
  private speechSeen = false;
  private noSpeechTimer: number | null = null;
  private silenceTimer: number | null = null;

  /** Auto-stop after this many ms of silence once speech has been detected. */
  readonly SILENCE_AFTER_SPEECH_MS = 8_000;
  /** Auto-stop if no speech is heard within this many ms of starting. */
  readonly NO_SPEECH_TIMEOUT_MS = 15_000;

  constructor(callbacks: STTCallbacks, language = "en-US") {
    this.cb = callbacks;
    this.lang = language;
  }

  get isActive(): boolean {
    return this._active;
  }

  start(): void {
    if (this._active) return;

    const Impl = getImpl();
    if (!Impl) {
      this.cb.onError("not-supported");
      return;
    }

    if (typeof location !== "undefined" && location.protocol !== "https:") {
      if (["localhost", "127.0.0.1"].includes(location.hostname)) {
        console.warn(
          "[PromptFix STT] Using Web Speech on localhost is fine for development. " +
            "Production and iOS Safari require HTTPS.",
        );
      } else {
        console.warn(
          "[PromptFix STT] Web Speech API requires HTTPS on iOS Safari. " +
            "Recognition may fail on this origin.",
        );
      }
    }

    const rec = new Impl();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    this.rec = rec;
    this._active = true;
    this.speechSeen = false;

    // Guard: fire no-speech error if nothing is heard after NO_SPEECH_TIMEOUT_MS.
    this.noSpeechTimer = window.setTimeout(() => {
      if (this._active && !this.speechSeen) {
        this.forceStop();
        this.cb.onError("no-speech");
      }
    }, this.NO_SPEECH_TIMEOUT_MS);

    rec.onstart = () => {
      this.cb.onStart();
    };

    rec.onresult = (event: SpeechRecognitionEventData) => {
      if (!this.speechSeen) {
        this.speechSeen = true;
        this.clearTimer("noSpeech");
      }
      this.resetSilenceTimer();

      // Emit each newly finalized segment once.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          this.cb.onFinal(r[0].transcript);
        }
      }

      // Full live interim = concatenate all non-final hypotheses (fixes “only after” UX).
      let fullInterim = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (!r.isFinal) {
          fullInterim += r[0].transcript;
        }
      }
      this.cb.onInterim(fullInterim.trim());
    };

    rec.onerror = (event: SpeechRecognitionErrorEventData) => {
      // "aborted" fires when .stop() is called manually — not a real error.
      if (event.error === "aborted") return;

      this._active = false;
      this.clearAllTimers();

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        this.cb.onError("mic-denied");
      } else if (event.error === "no-speech") {
        this.cb.onError("no-speech");
      } else {
        this.cb.onError("service-unavailable");
      }
    };

    rec.onend = () => {
      if (this._active) {
        // continuous=true but recognition ended (browser auto-paused); restart.
        try {
          rec.start();
          return;
        } catch {
          /* Can't restart; fall through */
        }
      }
      this._active = false;
      this.clearAllTimers();
      this.cb.onStop();
    };

    try {
      rec.start();
    } catch {
      this._active = false;
      this.clearAllTimers();
      this.cb.onError("service-unavailable");
    }
  }

  stop(): void {
    this.forceStop();
  }

  private forceStop(): void {
    this._active = false;
    this.clearAllTimers();
    if (this.rec) {
      try {
        this.rec.stop();
      } catch {
        /* already stopped */
      }
      this.rec = null;
    }
  }

  private resetSilenceTimer(): void {
    this.clearTimer("silence");
    this.silenceTimer = window.setTimeout(() => {
      if (this._active) this.forceStop();
    }, this.SILENCE_AFTER_SPEECH_MS);
  }

  private clearTimer(which: "noSpeech" | "silence"): void {
    if (which === "noSpeech" && this.noSpeechTimer !== null) {
      window.clearTimeout(this.noSpeechTimer);
      this.noSpeechTimer = null;
    }
    if (which === "silence" && this.silenceTimer !== null) {
      window.clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private clearAllTimers(): void {
    this.clearTimer("noSpeech");
    this.clearTimer("silence");
  }
}
