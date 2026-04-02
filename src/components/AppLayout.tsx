import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { DesktopNavbar } from "./DesktopNavbar";
import { MobileTabBar } from "./MobileTabBar";
import { MobileHeader } from "./MobileHeader";
import { QuickImproveFab } from "./QuickImproveFab";

export const AppLayout = () => {
  const location = useLocation();
  const [showDone, setShowDone] = useState(false);
  const [slideClass, setSlideClass] = useState("mobile-slide-in-right");
  const prevPathRef = useRef(location.pathname);
  const tabOrder = useMemo(
    () => ["/dashboard", "/improve", "/debug", "/saved", "/history"],
    [],
  );

  useEffect(() => {
    const current = location.pathname;
    const prev = prevPathRef.current;
    const from = tabOrder.findIndex((item) => item === prev);
    const to = tabOrder.findIndex((item) => item === current);
    if (from >= 0 && to >= 0 && from !== to) {
      setSlideClass(to > from ? "mobile-slide-in-right" : "mobile-slide-in-left");
    } else {
      setSlideClass("mobile-slide-in-right");
    }
    prevPathRef.current = current;
  }, [location.pathname, tabOrder]);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      setShowDone(true);
      window.setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 180);
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        const active = document.activeElement;
        const isInput =
          active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
        if (!isInput) setShowDone(false);
      }, 120);
    };
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return (
    <div className="app-page-bg min-h-screen">
      <DesktopNavbar />
      <MobileHeader />
      <MobileTabBar />

      {/* Scrollable content area — padding shifts content clear of each nav type */}
      <div className="page-content-wrapper">
        <main className={`mx-auto w-full max-w-6xl ${slideClass}`}>
          <Outlet />
        </main>
      </div>
      {showDone ? (
        <button
          type="button"
          onClick={() => {
            const active = document.activeElement as HTMLElement | null;
            active?.blur();
            setShowDone(false);
          }}
          className="fixed bottom-[92px] right-4 z-[95] rounded-full bg-[#3B82F6] px-3 py-1.5 text-xs font-semibold text-white shadow-lg md:hidden"
        >
          Done
        </button>
      ) : null}
      <QuickImproveFab />
    </div>
  );
};
