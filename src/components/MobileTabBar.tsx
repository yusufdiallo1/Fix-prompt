import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import {
  BoltIcon,
  BoltIconFilled,
  ClockIcon,
  ClockIconFilled,
  HomeIcon,
  HomeIconFilled,
  SparklesIcon,
  SparklesIconFilled,
} from "./NavIcons";

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317a1.724 1.724 0 013.35 0 1.724 1.724 0 002.573 1.066 1.724 1.724 0 012.356.998 1.724 1.724 0 001.314 2.223 1.724 1.724 0 010 3.292 1.724 1.724 0 00-1.314 2.223 1.724 1.724 0 01-2.356.998 1.724 1.724 0 00-2.573 1.066 1.724 1.724 0 01-3.35 0 1.724 1.724 0 00-2.573-1.066 1.724 1.724 0 01-2.356-.998 1.724 1.724 0 00-1.314-2.223 1.724 1.724 0 010-3.292 1.724 1.724 0 001.314-2.223 1.724 1.724 0 012.356-.998 1.724 1.724 0 002.573-1.066z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75A3.75 3.75 0 1012 8.25a3.75 3.75 0 000 7.5z" />
    </svg>
  );
}

const TABS = [
  { label: "Home", to: "/dashboard", Icon: HomeIcon, ActiveIcon: HomeIconFilled },
  { label: "Improve", to: "/improve", Icon: SparklesIcon, ActiveIcon: SparklesIconFilled },
  { label: "Fix", to: "/debug", Icon: BoltIcon, ActiveIcon: BoltIconFilled },
  { label: "History", to: "/history", Icon: ClockIcon, ActiveIcon: ClockIconFilled },
  { label: "Settings", to: "/settings", Icon: SettingsIcon, ActiveIcon: SettingsIcon },
] as const;

export const MobileTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bouncingTab, setBouncingTab] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);

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

  const isActive = (to: string) =>
    to === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(to);

  const handleTap = (to: string) => {
    setBouncingTab(to);
    // Clear after animation completes so it can retrigger
    setTimeout(() => setBouncingTab(null), 500);
    navigate(to);
  };

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-[120] lg:hidden"
      style={{
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        borderTopLeftRadius: "24px",
        borderTopRightRadius: "24px",
        borderTop: "1px solid #D1D1D6",
        boxShadow:
          "0 -6px 26px rgba(28,28,30,0.10), inset 0 0.5px 0 rgba(255,255,255,0.9)",
      }}
    >
      <div
        className="flex items-center justify-around px-2"
        style={{ minHeight: 80, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)", paddingTop: "8px" }}
      >
        {TABS.map((tab) => {
          const active = isActive(tab.to);
          const bouncing = bouncingTab === tab.to;
          const Icon = active ? tab.ActiveIcon : tab.Icon;

          return (
            <button
              key={tab.to}
              type="button"
              onClick={() => handleTap(tab.to)}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              className="relative flex min-h-[44px] flex-1 flex-col items-center gap-[3px] rounded-2xl py-2 px-1 transition-colors duration-100 active:bg-black/[0.04]"
            >
              {active ? <span className="mb-0.5 h-1.5 w-1.5 rounded-full bg-[#93C5FD]" /> : <span className="mb-0.5 h-1.5 w-1.5" />}
              {/* Icon wrapper for bounce isolation */}
              <span className={bouncing ? "tab-bounce" : undefined} style={{ display: "block", position: "relative" }}>
                <Icon
                  className={[
                    "h-6 w-6 transition-colors duration-150",
                    active ? "text-[#3B82F6]" : "text-[#636366]",
                  ].join(" ")}
                />
                {tab.to === "/dashboard" && streak >= 3 ? (
                  <span className="absolute -right-3 -top-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold leading-4 text-white">
                    {streak}
                  </span>
                ) : null}
              </span>
              <span
                className={[
                  "text-[10px] font-medium leading-none transition-colors duration-150",
                  active ? "text-[#3B82F6]" : "text-[#636366]",
                ].join(" ")}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
