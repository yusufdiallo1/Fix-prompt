import { type ReactNode, useEffect, useRef, useState } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export const BottomSheet = ({ open, onClose, children }: BottomSheetProps) => {
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[170] md:hidden">
      <button type="button" aria-label="Close sheet" className="absolute inset-0 bg-black/40 bottom-sheet-backdrop-enter" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[28px] border border-white/70 bg-white/92 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3 shadow-[0_-18px_38px_rgba(28,28,30,0.22)] backdrop-blur-2xl bottom-sheet-enter"
        style={{
          transform: `translateY(${offsetY}px)`,
          transition: dragging ? "none" : "transform 260ms cubic-bezier(0.22,1,0.36,1)",
        }}
        onTouchStart={(event) => {
          startYRef.current = event.touches[0]?.clientY ?? null;
          setDragging(true);
        }}
        onTouchMove={(event) => {
          if (startYRef.current == null) return;
          const next = (event.touches[0]?.clientY ?? 0) - startYRef.current;
          setOffsetY(Math.max(0, next));
        }}
        onTouchEnd={() => {
          setDragging(false);
          if (offsetY > 110) {
            onClose();
          }
          setOffsetY(0);
          startYRef.current = null;
        }}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#C7C7CC]" />
        {children}
      </div>
    </div>
  );
};
