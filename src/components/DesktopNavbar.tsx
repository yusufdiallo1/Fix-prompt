import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePlanUsage } from "../hooks/usePlanUsage";
import { openProCheckout } from "../lib/billing";
import { supabase } from "../lib/supabase";

const NAV_LINKS = [
  { label: "Home", to: "/dashboard" },
  { label: "Improve", to: "/improve" },
  { label: "Debug", to: "/debug" },
  { label: "Saved", to: "/saved" },
  { label: "History", to: "/history" },
];

export const DesktopNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPro, remainingCount, loading: usageLoading } = usePlanUsage(user?.id);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  const activeIndex = NAV_LINKS.findIndex((link) =>
    link.to === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(link.to),
  );

  const updateIndicator = useCallback(() => {
    const el = linkRefs.current[activeIndex];
    const nav = navRef.current;
    if (el && nav) {
      const navRect = nav.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setIndicator({
        left: elRect.left - navRect.left,
        width: elRect.width,
        ready: true,
      });
    }
  }, [activeIndex]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!supabase || !user?.id) {
      setStreak(0);
      return;
    }
    let active = true;
    const loadStreak = async () => {
      const { data } = await supabase!
        .from("user_stats")
        .select("current_streak")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      const next = (data as { current_streak?: number | null } | null)?.current_streak ?? 0;
      setStreak(next);
    };
    void loadStreak();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const handleSignOut = async () => {
    setDropdownOpen(false);
    if (supabase) await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "FP";

  return (
    <header className="fixed inset-x-0 top-0 z-50 hidden lg:block">
      <div
        className="flex h-16 items-center justify-between border-b border-gray-200/60 px-8"
        style={{
          background: "rgba(255, 255, 255, 0.70)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          boxShadow: "0 1px 0 rgba(28,28,30,0.06), 0 4px 20px rgba(28,28,30,0.04)",
        }}
      >
        {/* Logo */}
        <Link
          to="/dashboard"
          className="flex select-none items-center gap-2 text-[#1C1C1E] no-underline"
        >
          <span className="text-lg leading-none">🔥</span>
          <span className="brand-wordmark text-[17px] font-semibold tracking-[-0.02em]">PromptFix</span>
        </Link>

        {/* Nav links with sliding indicator */}
        <nav ref={navRef} className="relative flex items-center gap-1 pb-[2px]">
          {NAV_LINKS.map((link, i) => (
            <Link
              key={link.to}
              to={link.to}
              ref={(el) => {
                linkRefs.current[i] = el;
              }}
              className={[
                "rounded-lg px-4 py-1.5 text-[14px] font-medium transition-colors duration-150 no-underline",
                i === activeIndex
                  ? "text-[#3B82F6]"
                  : "text-[#636366] hover:bg-black/[0.04] hover:text-[#1C1C1E]",
              ].join(" ")}
            >
              {link.label}
            </Link>
          ))}

          {/* Sliding underline indicator */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 h-[2.5px] rounded-full bg-[#3B82F6] transition-all duration-300 ease-out"
            style={{
              left: indicator.left,
              width: indicator.width,
              opacity: indicator.ready ? 1 : 0,
            }}
          />
        </nav>

        <div className="flex items-center gap-2">
          {!isPro ? (
            <>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[12px] font-semibold text-blue-700">
                {usageLoading ? "..." : `${remainingCount} prompts/debug left`}
              </span>
              <button
                type="button"
                onClick={() => {
                  try {
                    openProCheckout();
                  } catch (error) {
                    console.error("Upgrade redirect failed", error);
                  }
                }}
                className="rounded-full bg-gradient-to-r from-[#3B82F6] to-[#A78BFA] px-3 py-1.5 text-[12px] font-semibold text-white"
              >
                Upgrade
              </button>
            </>
          ) : (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-700">
              Pro • Unlimited prompts/debug
            </span>
          )}

        {/* Avatar + dropdown */}
        <div className="group relative flex items-center gap-2" ref={dropdownRef}>
          {streak >= 3 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700">
              <span>🔥</span>
              <span>{streak}</span>
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            aria-label="Open user menu"
            title="Open account menu"
            aria-expanded={dropdownOpen}
            className="flex h-9 w-9 cursor-pointer select-none items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#A78BFA] text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 hover:opacity-95 hover:shadow-[0_0_0_4px_rgba(59,130,246,0.18)]"
          >
            {initials}
          </button>
          <span className="pointer-events-none absolute right-0 top-[calc(100%+6px)] rounded-md bg-black/75 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            Account
          </span>

          {dropdownOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+10px)] w-44 overflow-hidden rounded-2xl border border-white/60"
              style={{
                background: "rgba(255, 255, 255, 0.88)",
                backdropFilter: "blur(24px) saturate(180%)",
                WebkitBackdropFilter: "blur(24px) saturate(180%)",
                boxShadow:
                  "0 8px 32px rgba(28,28,30,0.12), 0 0 0 0.5px rgba(28,28,30,0.06)",
              }}
            >
              <Link
                to="/profile"
                role="menuitem"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center px-4 py-3 text-[14px] text-[#1C1C1E] no-underline transition-colors hover:bg-black/[0.05]"
              >
                Profile
              </Link>
              <Link
                to="/settings"
                role="menuitem"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center px-4 py-3 text-[14px] text-[#1C1C1E] no-underline transition-colors hover:bg-black/[0.05]"
              >
                Settings
              </Link>
              {!isPro ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setDropdownOpen(false);
                    try {
                      openProCheckout();
                    } catch (error) {
                      console.error("Upgrade redirect failed", error);
                    }
                  }}
                  className="flex w-full items-center px-4 py-3 text-[14px] font-semibold text-[#3B82F6] transition-colors hover:bg-black/[0.05]"
                >
                  Upgrade to Pro
                </button>
              ) : null}
              <div className="mx-3 h-px bg-[#E5E5EA]" />
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="flex w-full cursor-pointer items-center px-4 py-3 text-[14px] text-rose-500 transition-colors hover:bg-black/[0.05]"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </header>
  );
};
