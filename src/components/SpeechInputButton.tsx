import { useCallback, useRef, useState } from "react";

interface SpeechInputButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  label?: string;
  variant?: "dark" | "light";
}

export const SpeechInputButton = ({
  onTranscript,
  className = "",
  label = "Dictate",
  variant = "dark",
}: SpeechInputButtonProps) => {
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void; start: () => void; onresult: ((e: Event) => void) | null } | null>(
    null,
  );

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!Ctor) {
      window.alert("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (listening) {
      stop();
      return;
    }
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (event: Event) => {
      const r = (event as unknown as { results: SpeechRecognitionResultList }).results;
      const text = r[0]?.[0]?.transcript?.trim() ?? "";
      if (text) onTranscript(text);
      stop();
    };
    rec.onerror = () => stop();
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, [listening, onTranscript, stop]);

  const base =
    variant === "light"
      ? "border-[#D1D1D6] bg-white/80 text-[#636366] hover:bg-white"
      : "border-white/20 bg-white/10 text-slate-200 hover:bg-white/15";

  return (
    <button
      type="button"
      onClick={() => void start()}
      aria-label={label}
      title={label}
      className={[
        "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border transition md:min-h-9 md:min-w-9",
        base,
        listening ? "animate-pulse ring-2 ring-[#3B82F6]" : "",
        className,
      ].join(" ")}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
      </svg>
    </button>
  );
};
