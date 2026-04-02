import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import type { CodeSession, PromptSession, UserStats } from "../types/database";

export type RecentSessionItem =
  | { kind: "improve"; session: PromptSession }
  | { kind: "fix"; session: CodeSession };

export interface DashboardStats {
  totalSessions: number;
  thisWeek: number;
  topMode: string | null;
  favoritePlatform: string | null;
  totalPromptsImproved: number;
  totalAlternativesGenerated: number;
  currentStreak: number;
  longestStreak: number;
  lastSessionDate: string | null;
  streakUpdatedAt: string | null;
}

export interface DashboardData {
  stats: DashboardStats;
  recentSessions: RecentSessionItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function computeTop(values: (string | null | undefined)[]): string | null {
  const counts: Record<string, number> = {};
  for (const v of values) {
    if (v) counts[v] = (counts[v] ?? 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top?.[0] ?? null;
}

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function computeStreaksFromSessions(isoDates: string[]) {
  const uniqueDays = Array.from(
    new Set(
      isoDates
        .filter(Boolean)
        .map((iso) => toLocalDateString(new Date(iso))),
    ),
  ).sort((a, b) => b.localeCompare(a));

  if (!uniqueDays.length) {
    return { currentStreak: 0, longestStreak: 0, lastSessionDate: null as string | null };
  }

  let current = 1;
  for (let i = 1; i < uniqueDays.length; i += 1) {
    const prev = new Date(`${uniqueDays[i - 1]}T00:00:00`);
    const next = new Date(`${uniqueDays[i]}T00:00:00`);
    const diffDays = Math.round((prev.getTime() - next.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays === 1) current += 1;
    else break;
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < uniqueDays.length; i += 1) {
    const prev = new Date(`${uniqueDays[i - 1]}T00:00:00`);
    const next = new Date(`${uniqueDays[i]}T00:00:00`);
    const diffDays = Math.round((prev.getTime() - next.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  return { currentStreak: current, longestStreak: longest, lastSessionDate: uniqueDays[0] };
}

export const useDashboardData = (): DashboardData => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [sessions, setSessions] = useState<PromptSession[]>([]);
  const [codeSessions, setCodeSessions] = useState<CodeSession[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    if (!supabase) {
      setError("Supabase is not configured.");
      setSessions([]);
      setCodeSessions([]);
      setUserStats(null);
      setLoading(false);
      return;
    }
    if (!userId) {
      setSessions([]);
      setCodeSessions([]);
      setUserStats(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const [sessionsRes, codeRes, statsRes] = await Promise.all([
          supabase!
            .from("prompt_sessions")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
          supabase!
            .from("code_sessions")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
          supabase!
            .from("user_stats")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (sessionsRes.error) {
          setError(sessionsRes.error.message);
          setSessions([]);
          setCodeSessions([]);
          setUserStats(null);
          return;
        }

        if (codeRes.error) {
          console.warn("code_sessions load failed", codeRes.error.message);
        }

        if (statsRes.error) {
          setError(statsRes.error.message);
        }

        setSessions((sessionsRes.data ?? []) as PromptSession[]);
        setCodeSessions((codeRes.data ?? []) as CodeSession[]);
        setUserStats((statsRes.data as UserStats | null) ?? null);
      } catch (fetchError) {
        if (cancelled) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load dashboard.");
        setSessions([]);
        setCodeSessions([]);
        setUserStats(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [userId, fetchKey]);

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const sessionWeekCount =
    sessions.filter((s) => new Date(s.created_at) >= oneWeekAgo).length +
    codeSessions.filter((s) => new Date(s.created_at) >= oneWeekAgo).length;

  const thisWeek = userStats?.sessions_this_week ?? sessionWeekCount;

  const topMode =
    userStats?.most_used_mode ??
    computeTop([
      ...sessions.map((s) => s.mode ?? s.prompt_type),
      ...codeSessions.map(() => "fix"),
    ]);

  const favoritePlatform =
    userStats?.favorite_platform ??
    computeTop([...sessions.map((s) => s.platform), ...codeSessions.map((s) => s.platform)]);

  // Count sessions that have an improved_prompt as "prompts improved"
  const totalPromptsImproved =
    userStats?.total_prompts_improved ??
    sessions.filter((s) => s.improved_prompt).length;

  // Count total non-null alternatives across all sessions
  const altFromPrompts = sessions.reduce((acc, s) => {
    return (
      acc +
      (s.alternative_one ? 1 : 0) +
      (s.alternative_two ? 1 : 0) +
      (s.alternative_three ? 1 : 0)
    );
  }, 0);
  const altFromCode = codeSessions.reduce((acc, s) => {
    return (
      acc +
      (s.alternative_one_code ? 1 : 0) +
      (s.alternative_two_code ? 1 : 0) +
      (s.alternative_three_code ? 1 : 0)
    );
  }, 0);
  const totalAlternativesGenerated = userStats?.total_alternatives_generated ?? altFromPrompts + altFromCode;

  const allActivityDates = [
    ...sessions.map((s) => s.created_at),
    ...codeSessions.map((s) => s.created_at),
  ];
  const fallbackStreak = computeStreaksFromSessions(allActivityDates);
  const currentStreak = userStats?.current_streak ?? fallbackStreak.currentStreak;
  const longestStreak = userStats?.longest_streak ?? fallbackStreak.longestStreak;
  const lastSessionDate = userStats?.last_session_date ?? fallbackStreak.lastSessionDate;
  const streakUpdatedAt = userStats?.streak_updated_at ?? null;

  const recentSessions: RecentSessionItem[] = (() => {
    const items: RecentSessionItem[] = [
      ...sessions.map((session) => ({ kind: "improve" as const, session })),
      ...codeSessions.map((session) => ({ kind: "fix" as const, session })),
    ];
    items.sort((a, b) => b.session.created_at.localeCompare(a.session.created_at));
    return items.slice(0, 5);
  })();

  return {
    stats: {
      totalSessions: sessions.length + codeSessions.length,
      thisWeek,
      topMode,
      favoritePlatform,
      totalPromptsImproved,
      totalAlternativesGenerated,
      currentStreak,
      longestStreak,
      lastSessionDate,
      streakUpdatedAt,
    },
    recentSessions,
    loading,
    error,
    refetch,
  };
};
