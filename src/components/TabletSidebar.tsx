import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePlanUsage } from "../hooks/usePlanUsage";
import { openProCheckout } from "../lib/billing";
import { supabase } from "../lib/supabase";
import { BoltIcon, BookmarkIcon, ClockIcon, HomeIcon, SparklesIcon } from "./NavIcons";

const NAV_ITEMS = [
  { label: "Home", to: "/dashboard", Icon: HomeIcon },
  { label: "Improve", to: "/improve", Icon: SparklesIcon },
  { label: "Debug", to: "/debug", Icon: BoltIcon },
  { label: "Saved", to: "/saved", Icon: BookmarkIcon },
  { label: "History", to: "/history", Icon: ClockIcon },
] as const;

export const TabletSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPro, remainingCount, loading: usageLoading } = usePlanUsage(user?.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isActive = (to: string) =>
    to === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(to);

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "PF";

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    if (supabase) await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <aside
        aria-label="Main navigation"
        className="fixed inset-y-0 left-0 z-[120] hidden w-[72px] flex-col items-center py-4 md:flex lg:hidden"
        style={{
          background: "rgba(255, 255, 255, 0.80)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderRight: "1px solid rgba(209,213,219,0.90)",
        }}
      >
        <Link
          to="/dashboard"
          aria-label="PromptFix home"
          className="mb-4 flex h-10 w-10 select-none items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#A78BFA] text-base text-white no-underline"
        >
          🔥
        </Link>

        <div className="flex flex-col items-center gap-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.to);
            return (
              <div key={item.to} className="group relative">
                <button
                  type="button"
                  onClick={() => navigate(item.to)}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-150 active:scale-95",
                    active
                      ? "bg-[#DBEAFE] text-[#3B82F6]"
                      : "text-[#6B7280]",
                  ].join(" ")}
                >
                  <item.Icon className="h-5 w-5" />
                </button>

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-20 -translate-y-1/2 translate-x-[-4px] whitespace-nowrap rounded-full border border-white/70 px-3 py-1.5 text-[12px] font-medium text-[#1C1C1E] opacity-0 shadow-[0_8px_24px_rgba(28,28,30,0.12)] transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100"
                  style={{
                    background: "rgba(255,255,255,0.82)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                  }}
                >
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-auto" ref={menuRef}>
          {!isPro ? (
            <div className="mb-2 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              {usageLoading ? "..." : `${remainingCount} left`}
            </div>
          ) : (
            <div className="mb-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              Pro
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate("/settings")}
            aria-label="Open settings"
            className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-[#D1D1D6] bg-white/90 text-[#636366] active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317a1.724 1.724 0 013.35 0 1.724 1.724 0 002.573 1.066 1.724 1.724 0 012.356.998 1.724 1.724 0 001.314 2.223 1.724 1.724 0 010 3.292 1.724 1.724 0 00-1.314 2.223 1.724 1.724 0 01-2.356.998 1.724 1.724 0 00-2.573 1.066 1.724 1.724 0 01-3.35 0 1.724 1.724 0 00-2.573-1.066 1.724 1.724 0 01-2.356-.998 1.724 1.724 0 00-1.314-2.223 1.724 1.724 0 010-3.292 1.724 1.724 0 001.314-2.223 1.724 1.724 0 012.356-.998 1.724 1.724 0 002.573-1.066z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75A3.75 3.75 0 1012 8.25a3.75 3.75 0 000 7.5z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open account menu"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#A78BFA] text-xs font-semibold text-white active:scale-95"
          >
            {initials}
          </button>
        </div>
      </aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-[140] hidden md:block lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/35"
          />
          <div className="absolute inset-x-4 bottom-4 rounded-3xl border border-white/70 bg-white/90 p-3 shadow-[0_20px_44px_rgba(28,28,30,0.18)] backdrop-blur-xl">
            <Link
              to="/profile"
              onClick={() => setMenuOpen(false)}
              className="block rounded-2xl px-4 py-3 text-[15px] font-medium text-[#1C1C1E] no-underline"
            >
              Profile
            </Link>
            <Link
              to="/settings"
              onClick={() => setMenuOpen(false)}
              className="block rounded-2xl px-4 py-3 text-[15px] font-medium text-[#1C1C1E] no-underline"
            >
              Settings
            </Link>
            {!isPro ? (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  try {
                    openProCheckout();
                  } catch (error) {
                    console.error("Upgrade redirect failed", error);
                  }
                }}
                className="block w-full rounded-2xl px-4 py-3 text-left text-[15px] font-semibold text-[#3B82F6]"
              >
                Upgrade to Pro ({usageLoading ? "..." : `${remainingCount} prompts/debug left`})
              </button>
            ) : (
              <p className="px-4 py-2 text-sm font-semibold text-emerald-700">Pro active • Unlimited prompts/debug</p>
            )}
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="mt-1 block w-full rounded-2xl px-4 py-3 text-left text-[15px] font-medium text-rose-500"
            >
              Sign Out
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
};
