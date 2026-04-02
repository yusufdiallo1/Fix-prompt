import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import type { PromptSession, UserStats } from "../types/database";

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
  recentSessions: PromptSession[];
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

function computeStreaksFromSessions(sessions: PromptSession[]) {
  const uniqueDays = Array.from(
    new Set(
      sessions
        .map((s) => s.created_at)
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
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    if (!supabase) {
      setError("Supabase is not configured.");
      setSessions([]);
      setUserStats(null);
      setLoading(false);
      return;
    }
    if (!userId) {
      setSessions([]);
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
        const [sessionsRes, statsRes] = await Promise.all([
          supabase!
            .from("prompt_sessions")
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
          setUserStats(null);
          return;
        }

        if (statsRes.error) {
          setError(statsRes.error.message);
        }

        setSessions((sessionsRes.data ?? []) as PromptSession[]);
        setUserStats((statsRes.data as UserStats | null) ?? null);
      } catch (fetchError) {
        if (cancelled) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load dashboard.");
        setSessions([]);
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

  const thisWeek =
    userStats?.sessions_this_week ??
    sessions.filter((s) => new Date(s.created_at) >= oneWeekAgo).length;

  const topMode =
    userStats?.most_used_mode ??
    computeTop(sessions.map((s) => s.mode ?? s.prompt_type));

  const favoritePlatform =
    userStats?.favorite_platform ?? computeTop(sessions.map((s) => s.platform));

  // Count sessions that have an improved_prompt as "prompts improved"
  const totalPromptsImproved =
    userStats?.total_prompts_improved ??
    sessions.filter((s) => s.improved_prompt).length;

  // Count total non-null alternatives across all sessions
  const totalAlternativesGenerated =
    userStats?.total_alternatives_generated ??
    sessions.reduce((acc, s) => {
      return (
        acc +
        (s.alternative_one ? 1 : 0) +
        (s.alternative_two ? 1 : 0) +
        (s.alternative_three ? 1 : 0)
      );
    }, 0);

  const fallbackStreak = computeStreaksFromSessions(sessions);
  const currentStreak = userStats?.current_streak ?? fallbackStreak.currentStreak;
  const longestStreak = userStats?.longest_streak ?? fallbackStreak.longestStreak;
  const lastSessionDate = userStats?.last_session_date ?? fallbackStreak.lastSessionDate;
  const streakUpdatedAt = userStats?.streak_updated_at ?? null;

  return {
    stats: {
      totalSessions: sessions.length,
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
    recentSessions: sessions.slice(0, 5),
    loading,
    error,
    refetch,
  };
};
