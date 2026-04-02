import { useEffect, useRef, useState } from "react";

interface ExportSessionButtonProps {
  onCopyNotion: () => Promise<void> | void;
  onCopyNotes: () => Promise<void> | void;
  onCopyMarkdown: () => Promise<void> | void;
  onDownloadText: () => Promise<void> | void;
}

export const ExportSessionButton = ({
  onCopyNotion,
  onCopyNotes,
  onCopyMarkdown,
  onDownloadText,
}: ExportSessionButtonProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const runAction = async (action: () => Promise<void> | void) => {
    await action();
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 3000);
  };

  return (
    <div ref={rootRef} className="relative">
      {open ? (
        <div className="absolute bottom-[calc(100%+10px)] left-1/2 z-[80] w-[260px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-[#E5E5EA] bg-white/90 p-2 shadow-[0_14px_28px_rgba(28,28,30,0.14)] backdrop-blur-xl sm:left-auto sm:right-0 sm:translate-x-0">
          <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-[#8E8E93]">Export As</p>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => void runAction(onCopyNotion)}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-[#1C1C1E] transition hover:bg-black/[0.04]"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#D1D1D6] text-[10px] font-semibold">N</span>
              <span>Copy for Notion</span>
            </button>
            <button
              type="button"
              onClick={() => void runAction(onCopyNotes)}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-[#1C1C1E] transition hover:bg-black/[0.04]"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-yellow-100 text-[12px]">📝</span>
              <span>Copy for Notes</span>
            </button>
            <button
              type="button"
              onClick={() => void runAction(onCopyMarkdown)}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-[#1C1C1E] transition hover:bg-black/[0.04]"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#D1D1D6] text-[12px] font-semibold">#</span>
              <span>Copy as Markdown</span>
            </button>
            <button
              type="button"
              onClick={() => void runAction(onDownloadText)}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-[#1C1C1E] transition hover:bg-black/[0.04]"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#D1D1D6] text-[12px]">📄</span>
              <span>Download as .txt</span>
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full border border-[#D1D1D6] bg-white/60 px-4 py-2.5 text-sm font-medium text-[#1C1C1E] transition hover:bg-white/90 active:scale-[0.97]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l-4-4-4 4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 14v4a2 2 0 002 2h10a2 2 0 002-2v-4" />
        </svg>
        <span>Export Session</span>
      </button>
    </div>
  );
};
