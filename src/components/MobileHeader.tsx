import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePlanUsage } from "../hooks/usePlanUsage";
import { openProCheckout } from "../lib/billing";
import { supabase } from "../lib/supabase";
import { BottomSheet } from "./BottomSheet";

const getTitle = (pathname: string) => {
  if (pathname === "/dashboard") return "Home";
  if (pathname.startsWith("/improve")) return "Improve";
  if (pathname.startsWith("/debug")) return "Debug";
  if (pathname.startsWith("/saved")) return "Saved";
  if (pathname.startsWith("/history")) return "History";
  if (pathname.startsWith("/profile")) return "Profile";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/sessions")) return "Session";
  return "PromptFix";
};

export const MobileHeader = () => {
  const { user } = useAuth();
  const { isPro, remainingCount, loading: usageLoading } = usePlanUsage(user?.id);
  const navigate = useNavigate();
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "PF";

  const signOut = async () => {
    setSheetOpen(false);
    if (supabase) await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-[130] lg:hidden"
        style={{
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderBottom: "1px solid #D1D1D6",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <h1 className="text-[18px] font-medium text-[#1C1C1E]">{getTitle(location.pathname)}</h1>
          <div className="flex items-center gap-2">
            {!isPro ? (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
                {usageLoading ? "..." : `${remainingCount} left`}
              </span>
            ) : (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                Pro
              </span>
            )}
            <button
              type="button"
              onClick={() => navigate("/settings")}
              aria-label="Open settings"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D1D1D6] bg-white/90 text-[#636366]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317a1.724 1.724 0 013.35 0 1.724 1.724 0 002.573 1.066 1.724 1.724 0 012.356.998 1.724 1.724 0 001.314 2.223 1.724 1.724 0 010 3.292 1.724 1.724 0 00-1.314 2.223 1.724 1.724 0 01-2.356.998 1.724 1.724 0 00-2.573 1.066 1.724 1.724 0 01-3.35 0 1.724 1.724 0 00-2.573-1.066 1.724 1.724 0 01-2.356-.998 1.724 1.724 0 00-1.314-2.223 1.724 1.724 0 010-3.292 1.724 1.724 0 001.314-2.223 1.724 1.724 0 012.356-.998 1.724 1.724 0 002.573-1.066z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75A3.75 3.75 0 1012 8.25a3.75 3.75 0 000 7.5z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#A78BFA] text-xs font-semibold text-white"
            >
              {initials}
            </button>
          </div>
        </div>
      </header>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="space-y-1 pb-1">
          <Link
            to="/profile"
            onClick={() => setSheetOpen(false)}
            className="block rounded-2xl px-4 py-3 text-[16px] font-medium text-[#1C1C1E] no-underline"
          >
            Profile
          </Link>
          <Link
            to="/settings"
            onClick={() => setSheetOpen(false)}
            className="block rounded-2xl px-4 py-3 text-[16px] font-medium text-[#1C1C1E] no-underline"
          >
            Settings
          </Link>
          {!isPro ? (
            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                try {
                  openProCheckout();
                } catch (error) {
                  console.error("Upgrade redirect failed", error);
                }
              }}
              className="block min-h-[44px] w-full rounded-2xl px-4 py-3 text-left text-[16px] font-semibold text-[#3B82F6]"
            >
              Upgrade to Pro ({usageLoading ? "..." : `${remainingCount} left`})
            </button>
          ) : (
            <p className="px-4 py-2 text-sm font-semibold text-emerald-700">Pro plan active • Unlimited prompts/debug</p>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            className="block min-h-[44px] w-full rounded-2xl px-4 py-3 text-left text-[16px] font-medium text-rose-500"
          >
            Sign Out
          </button>
        </div>
      </BottomSheet>
    </>
  );
};
