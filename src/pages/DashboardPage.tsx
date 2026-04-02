import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useDashboardData } from "../hooks/useDashboardData";
import { usePlanUsage } from "../hooks/usePlanUsage";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { openProCheckout } from "../lib/billing";
import { safeText } from "../lib/renderSafety";
import type { PromptSession } from "../types/database";

const STREAK_MILESTONES = new Set([3, 7, 14, 30, 60, 100]);

// ─── Time & greeting helpers ──────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function getFirstName(
  email: string | null | undefined,
  fullName: string | null | undefined,
): string {
  if (fullName?.trim()) return fullName.trim().split(/\s+/)[0];
  if (email) return email.split("@")[0];
  return "there";
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

const PLATFORM_STYLES: Record<string, { bg: string; text: string }> = {
  Lovable: { bg: "bg-purple-100", text: "text-purple-700" },
  Cursor: { bg: "bg-blue-100", text: "text-blue-700" },
  Replit: { bg: "bg-orange-100", text: "text-orange-700" },
  ChatGPT: { bg: "bg-green-100", text: "text-green-700" },
  Claude: { bg: "bg-amber-100", text: "text-amber-700" },
};

function getPlatformStyle(p: string | null) {
  return PLATFORM_STYLES[p ?? ""] ?? { bg: "bg-[#F2F2F7]", text: "text-[#636366]" };
}

const MODE_STYLES: Record<string, { bg: string; text: string }> = {
  improve: { bg: "bg-blue-100", text: "text-blue-700" },
  Improve: { bg: "bg-blue-100", text: "text-blue-700" },
  debug: { bg: "bg-rose-100", text: "text-rose-700" },
  Debug: { bg: "bg-rose-100", text: "text-rose-700" },
};

function getModeStyle(mode: string | null) {
  return MODE_STYLES[mode ?? ""] ?? { bg: "bg-[#F2F2F7]", text: "text-[#636366]" };
}

// ─── Skeleton block ───────────────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function WandSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  );
}

function CalendarSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5m-9-6h.008v.008H12v-.008z" />
    </svg>
  );
}

function SparkleSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  );
}

function RocketSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  );
}

function ChevronRightSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function ArrowRightSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <div
      className="relative min-h-[160px] overflow-hidden rounded-3xl sm:min-h-[200px]"
      style={{ background: "rgba(200,200,215,0.5)" }}
    >
      <div className="flex flex-col justify-between gap-6 p-7 sm:flex-row sm:items-center">
        <div className="space-y-3">
          <Sk className="h-9 w-56" />
          <Sk className="h-4 w-36" />
        </div>
        <Sk className="h-11 w-44 rounded-full" />
      </div>
    </div>
  );
}

function HeroCard({
  greeting,
  firstName,
  today,
}: {
  greeting: string;
  firstName: string;
  today: string;
}) {
  return (
    <div className="relative min-h-[160px] overflow-hidden rounded-3xl bg-[#0b1220] sm:min-h-[200px]">
      {/* Background image */}
      <img
        src="https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1400"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
      />
      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(4,8,24,0.74) 0%, rgba(19,13,50,0.58) 55%, rgba(27,17,55,0.40) 100%)",
        }}
      />
      {/* Bottom fade */}
      <div
        className="absolute inset-x-0 bottom-0 h-20"
        style={{ background: "linear-gradient(to top, rgba(10,5,30,0.50) 0%, transparent 100%)" }}
      />

      {/* Content */}
      <div className="relative flex min-h-[160px] flex-col justify-between gap-6 p-6 sm:min-h-[200px] sm:flex-row sm:items-center sm:p-7">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-white drop-shadow-sm sm:text-[32px]">
            {greeting},{" "}
            <span className="capitalize">{firstName}</span>
          </h1>
          <p className="mt-1.5 text-[14px] font-medium text-white/70">{today}</p>
        </div>

        {/* Gradient-border pill */}
        <div
          className="shrink-0 self-start rounded-full p-[2px] sm:self-auto"
          style={{
            background: "linear-gradient(135deg, #60A5FA 0%, #A78BFA 50%, #F472B6 100%)",
          }}
        >
          <Link
            to="/improve"
            className="flex items-center gap-2.5 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white no-underline transition-all duration-200 hover:brightness-110"
            style={{
              background: "rgba(255,255,255,0.14)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <WandSvg className="h-4 w-4" />
            Improve a Prompt
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  iconBg,
  icon,
  label,
  children,
}: {
  iconBg: string;
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className="snap-start min-w-[188px] flex-shrink-0 rounded-2xl border border-white/60 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_36px_rgba(28,28,30,0.11)] md:min-w-0 md:flex-shrink"
      style={{
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 2px 12px rgba(28,28,30,0.06), inset 0 1px 0 rgba(255,255,255,0.90)",
      }}
    >
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
        {icon}
      </div>
      <div>{children}</div>
      <p className="mt-2 text-[12px] font-medium uppercase tracking-wide text-[#8E8E93]">{label}</p>
    </article>
  );
}

function StatCardSkeleton() {
  return (
    <div
      className="min-w-[188px] flex-shrink-0 rounded-2xl border border-white/60 p-5 md:min-w-0 md:flex-shrink"
      style={{ background: "rgba(255,255,255,0.85)" }}
    >
      <Sk className="mb-4 h-10 w-10 rounded-xl" />
      <Sk className="h-9 w-14 rounded-lg" />
      <Sk className="mt-2 h-3 w-28 rounded" />
    </div>
  );
}

function StreakCard({
  currentStreak,
  longestStreak,
  hasAnySession,
  showAtRiskWarning,
  showCelebration,
}: {
  currentStreak: number;
  longestStreak: number;
  hasAnySession: boolean;
  showAtRiskWarning: boolean;
  showCelebration: boolean;
}) {
  const inactive = !hasAnySession || currentStreak <= 0;
  return (
    <article
      className="relative snap-start min-w-[188px] flex-shrink-0 overflow-hidden rounded-2xl border p-5 md:min-w-0 md:flex-shrink"
      style={{
        background: "rgba(255,255,255,0.85)",
        borderColor: "rgba(251,146,60,0.28)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 2px 12px rgba(28,28,30,0.06), inset 0 1px 0 rgba(255,255,255,0.90)",
      }}
    >
      {showCelebration ? (
        <div aria-hidden="true" className="streak-confetti">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="streak-confetti-piece" />
          ))}
        </div>
      ) : null}
      <div className="relative z-[1] text-center">
        <p className={`text-4xl ${inactive ? "grayscale opacity-60" : ""}`}>🔥</p>
        <p className={`mt-2 text-[44px] font-bold leading-none ${inactive ? "text-[#8E8E93]" : "text-[#F97316]"}`}>
          {currentStreak}
        </p>
        <p className="mt-1 text-xs text-[#8E8E93]">{inactive ? "Start your streak today" : "day streak"}</p>
        <p className="mt-1 text-[11px] text-[#8E8E93]">Best: {longestStreak} days</p>
        {showAtRiskWarning ? (
          <span className="mt-2 inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-medium text-orange-700">
            Improve a prompt today to keep your streak
          </span>
        ) : null}
      </div>
    </article>
  );
}

// ─── Quick action card ────────────────────────────────────────────────────────

function QuickActionCard({
  imageUrl,
  title,
  description,
  buttonLabel,
  to,
}: {
  imageUrl: string;
  title: string;
  description: string;
  buttonLabel: string;
  to: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-3xl bg-[#0b1220]" style={{ minHeight: 220 }}>
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(6,8,24,0.88) 0%, rgba(6,8,24,0.56) 52%, rgba(6,8,24,0.28) 100%)",
        }}
      />
      <div className="relative flex h-full flex-col justify-end p-6" style={{ minHeight: 220 }}>
        <h3 className="text-[20px] font-bold leading-snug tracking-tight text-white drop-shadow-sm">
          {title}
        </h3>
        <p className="mt-1 text-[13px] text-white/65">{description}</p>
        <Link
          to={to}
          className="quick-action-cta mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-white/90 px-5 py-2 text-[13px] font-semibold text-[#1C1C1E] no-underline shadow-sm backdrop-blur transition-all duration-200 hover:bg-white hover:-translate-y-0.5 hover:shadow-md"
        >
          {buttonLabel}
          <ArrowRightSvg className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function QuickActionSkeleton() {
  return (
    <div
      className="rounded-3xl"
      style={{ minHeight: 220, background: "rgba(200,200,215,0.5)" }}
    >
      <div className="flex h-full flex-col justify-end p-6" style={{ minHeight: 220 }}>
        <Sk className="h-6 w-40 rounded-lg" />
        <Sk className="mt-2 h-4 w-56 rounded" />
        <Sk className="mt-4 h-9 w-32 rounded-full" />
      </div>
    </div>
  );
}

// ─── Session row ──────────────────────────────────────────────────────────────

function RecentSessionRow({ session }: { session: PromptSession }) {
  const ps = getPlatformStyle(session.platform);
  const modeLabel = session.mode ?? session.prompt_type;
  const ms = getModeStyle(modeLabel ?? null);
  const safeTitleBase =
    safeText(session.original_prompt) ||
    safeText(session.improved_prompt) ||
    safeText(session.title) ||
    "Untitled session";
  const displayTitle =
    safeTitleBase.length > 65 ? `${safeTitleBase.slice(0, 65)}…` : safeTitleBase;

  return (
    <Link
      to={`/sessions/${session.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-[#E5E5EA] p-4 no-underline transition-all duration-200 hover:-translate-y-px hover:border-[#D1D1D6] hover:shadow-[0_4px_24px_rgba(28,28,30,0.08)]"
      style={{
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-[#1C1C1E]">{displayTitle}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {modeLabel && (
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ms.bg} ${ms.text}`}>
              {modeLabel}
            </span>
          )}
          {session.platform && (
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ps.bg} ${ps.text}`}>
              {session.platform}
            </span>
          )}
          <span className="text-[12px] text-[#8E8E93]">{timeAgo(session.created_at)}</span>
        </div>
      </div>
      <ChevronRightSvg className="h-4 w-4 shrink-0 text-[#C7C7CC] transition-colors group-hover:text-[#8E8E93]" />
    </Link>
  );
}

function SessionRowSkeleton() {
  return (
    <div
      className="flex items-center gap-4 rounded-2xl border border-[#E5E5EA] p-4"
      style={{ background: "rgba(255,255,255,0.72)" }}
    >
      <div className="flex-1 space-y-2.5">
        <Sk className="h-4 w-3/4" />
        <div className="flex gap-2">
          <Sk className="h-3 w-16 rounded-full" />
          <Sk className="h-3 w-24 rounded-full" />
          <Sk className="h-3 w-10" />
        </div>
      </div>
      <Sk className="h-4 w-4 shrink-0" />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-[#D1D1D6] px-8 py-12 text-center"
      style={{ background: "rgba(255,255,255,0.60)", backdropFilter: "blur(12px)" }}
    >
      <div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl"
        style={{
          background: "linear-gradient(135deg, #EBF5FF 0%, #F0EBFF 100%)",
          border: "2px dashed #C7C7CC",
        }}
      >
        <WandSvg className="h-9 w-9 text-[#A78BFA]" />
      </div>
      <h3 className="mb-2 text-[17px] font-semibold text-[#1C1C1E]">No sessions yet</h3>
      <p className="mb-7 max-w-[260px] text-sm leading-relaxed text-[#636366]">
        Ready to improve your first prompt? Let's make it powerful.
      </p>
      <Link
        to="/improve"
        className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#A78BFA] px-6 py-3 text-sm font-semibold text-white no-underline shadow-[0_8px_22px_rgba(59,130,246,0.24)] transition duration-200 hover:brightness-105 active:scale-[0.97]"
      >
        <WandSvg className="h-4 w-4" />
        Improve Your First Prompt
      </Link>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPro, remainingCount, loading: usageLoading } = usePlanUsage(user?.id);
  const { stats, recentSessions, loading, error, refetch } = useDashboardData();
  const { isRefreshing, pullDistance, bind } = usePullToRefresh(async () => {
    refetch();
  });

  const greeting = useMemo(() => getGreeting(), []);
  const today = useMemo(() => todayLabel(), []);
  const [showStreakCelebration, setShowStreakCelebration] = useState(false);
  const [streakBanner, setStreakBanner] = useState<string | null>(null);
  const firstName = useMemo(
    () =>
      getFirstName(
        user?.email,
        user?.user_metadata?.full_name as string | undefined,
      ),
    [user],
  );

  const todayStr = useMemo(() => toLocalDateString(new Date()), []);
  const hasAnySession = stats.totalSessions > 0 || Boolean(stats.lastSessionDate);
  const hourNow = new Date().getHours();
  const showAtRiskWarning =
    stats.currentStreak >= 3 && stats.lastSessionDate !== todayStr && hourNow >= 18;

  useEffect(() => {
    if (loading) return;
    if (!stats.lastSessionDate || stats.lastSessionDate !== todayStr) return;
    if (!STREAK_MILESTONES.has(stats.currentStreak)) return;

    const milestoneKey = `pf_streak_milestone_seen_${stats.lastSessionDate}_${stats.currentStreak}`;
    if (window.localStorage.getItem(milestoneKey)) return;

    window.localStorage.setItem(milestoneKey, "1");
    setShowStreakCelebration(true);
    setStreakBanner(`${stats.currentStreak} day streak! Keep it going 🔥`);

    const confettiTimeout = window.setTimeout(() => setShowStreakCelebration(false), 1200);
    const bannerTimeout = window.setTimeout(() => setStreakBanner(null), 5000);
    return () => {
      window.clearTimeout(confettiTimeout);
      window.clearTimeout(bannerTimeout);
    };
  }, [loading, stats.currentStreak, stats.lastSessionDate, todayStr]);

  return (
    <section className="space-y-6 pb-4" {...bind}>
      {(isRefreshing || pullDistance > 0) ? (
        <div className="flex items-center justify-center">
          <span
            className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-[#3B82F6]/30 border-t-[#3B82F6]"
            style={{ transform: `translateY(${Math.max(0, pullDistance - 12)}px)` }}
          />
        </div>
      ) : null}

      {/* ── Hero ──────────────────────────────────────────────── */}
      {loading ? (
        <HeroSkeleton />
      ) : (
        <HeroCard greeting={greeting} firstName={firstName} today={today} />
      )}

      {loading ? (
        <div className="rounded-2xl border border-[#D1D1D6] bg-white/75 px-4 py-2 text-sm font-medium text-[#636366] backdrop-blur-xl">
          Loading dashboard...
        </div>
      ) : null}

      {/* ── Error banner ──────────────────────────────────────── */}
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </p>
      ) : null}

      {!isPro ? (
        <article className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-800">Free plan</p>
              <p className="text-sm text-blue-700">
                {usageLoading ? "Checking usage..." : `${remainingCount} prompts/debug sessions left this month.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                try {
                  openProCheckout();
                } catch (upgradeError) {
                  console.error("Upgrade redirect failed", upgradeError);
                }
              }}
              className="rounded-full bg-gradient-to-r from-[#3B82F6] to-[#A78BFA] px-4 py-2 text-sm font-semibold text-white"
            >
              Upgrade to Pro
            </button>
          </div>
        </article>
      ) : (
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <p className="text-sm font-semibold text-emerald-800">Pro plan active</p>
          <p className="text-sm text-emerald-700">Unlimited prompt improvements and debug sessions.</p>
        </article>
      )}

      {/* ── Stats row ──────────────────────────────────────────
           Mobile  → flex + horizontal scroll
           Tablet  → 2×2 grid
           Desktop → 4-col grid
      ──────────────────────────────────────────────────────── */}
      <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory md:grid md:max-lg:grid-cols-5 md:gap-4 md:overflow-x-visible md:pb-0 md:snap-none lg:grid-cols-5">
        {loading ? (
          [0, 1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              iconBg="bg-blue-100"
              icon={<WandSvg className="h-5 w-5 text-[#3B82F6]" />}
              label="Prompts Improved"
            >
              <span className="text-[32px] font-bold leading-none tracking-tight text-[#3B82F6]">
                {stats.totalPromptsImproved}
              </span>
            </StatCard>

            <StatCard
              iconBg="bg-purple-100"
              icon={<CalendarSvg className="h-5 w-5 text-[#A78BFA]" />}
              label="This Week"
            >
              <span className="text-[32px] font-bold leading-none tracking-tight text-[#A78BFA]">
                {stats.thisWeek}
              </span>
            </StatCard>

            <StatCard
              iconBg="bg-emerald-100"
              icon={<SparkleSvg className="h-5 w-5 text-[#10B981]" />}
              label="Alternatives Generated"
            >
              <span className="text-[32px] font-bold leading-none tracking-tight text-[#10B981]">
                {stats.totalAlternativesGenerated}
              </span>
            </StatCard>

            <StatCard
              iconBg="bg-orange-100"
              icon={<RocketSvg className="h-5 w-5 text-[#F97316]" />}
              label="Favorite Platform"
            >
              {stats.favoritePlatform ? (
                <span
                  className={`inline-block rounded-full px-3 py-1 text-[13px] font-semibold ${getPlatformStyle(stats.favoritePlatform).bg} ${getPlatformStyle(stats.favoritePlatform).text}`}
                >
                  {stats.favoritePlatform}
                </span>
              ) : (
                <span className="text-[15px] font-medium text-[#C7C7CC]">—</span>
              )}
            </StatCard>
            <StreakCard
              currentStreak={stats.currentStreak}
              longestStreak={stats.longestStreak}
              hasAnySession={hasAnySession}
              showAtRiskWarning={showAtRiskWarning}
              showCelebration={showStreakCelebration}
            />
          </>
        )}
      </div>

      {streakBanner ? (
        <div className="streak-banner rounded-xl border border-orange-200 bg-orange-50/90 px-4 py-2 text-sm font-semibold text-orange-700">
          {streakBanner}
        </div>
      ) : null}

      {/* ── Quick Action Cards ──────────────────────────────────
           Mobile  → stacked
           Tablet+ → side by side
      ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {loading ? (
          <>
            <QuickActionSkeleton />
            <QuickActionSkeleton />
          </>
        ) : (
          <>
            <QuickActionCard
              imageUrl="https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800"
              title="Improve My Prompt"
              description="Rewrite and get alternatives instantly"
              buttonLabel="Start Improving"
              to="/improve"
            />
            <QuickActionCard
              imageUrl="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800"
              title="Debug My Code"
              description="Find what went wrong and fix it"
              buttonLabel="Start Debugging"
              to="/debug"
            />
          </>
        )}
      </div>

      {/* ── Recent Sessions ───────────────────────────────────── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-[#1C1C1E]">Recent Sessions</h2>
          {!loading && recentSessions.length > 0 && (
            <Link
              to="/history"
              className="text-[14px] font-medium text-[#3B82F6] no-underline transition-colors hover:text-[#2563EB]"
            >
              View All →
            </Link>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <SessionRowSkeleton key={i} />
            ))}
          </div>
        ) : recentSessions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {recentSessions.map((s) => (
              <RecentSessionRow key={s.id} session={s} />
            ))}
          </div>
        )}
      </div>

      {/* ── Mobile CTA ────────────────────────────────────────── */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => navigate("/improve")}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#3B82F6] to-[#A78BFA] px-5 py-4 text-[15px] font-semibold text-white shadow-[0_8px_28px_rgba(59,130,246,0.28)] transition-all duration-200 hover:brightness-105 active:scale-[0.98]"
        >
          <WandSvg className="h-5 w-5" />
          Improve a Prompt
        </button>
      </div>

    </section>
  );
};
