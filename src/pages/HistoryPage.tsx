import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BottomSheet } from "../components/BottomSheet";
import { useAuth } from "../hooks/useAuth";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { safeText } from "../lib/renderSafety";
import { supabase } from "../lib/supabase";
import type { CodeSession, PromptSession } from "../types/database";

const PAGE_SIZE = 20;
const TABLE_FETCH_LIMIT = 150;

const FILTERS = [
  { id: "all", label: "All" },
  { id: "improve", label: "Improve Sessions" },
  { id: "fix", label: "Fix Sessions" },
  { id: "platform:Lovable", label: "Lovable" },
  { id: "platform:Cursor", label: "Cursor" },
  { id: "platform:Replit", label: "Replit" },
  { id: "platform:ChatGPT", label: "ChatGPT" },
  { id: "platform:Claude", label: "Claude" },
  { id: "platform:Other", label: "Other" },
] as const;

type SortKey = "newest" | "oldest" | "alternatives" | "clarity";
type FilterKey = (typeof FILTERS)[number]["id"];
const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: "newest", label: "Newest First" },
  { id: "oldest", label: "Oldest First" },
  { id: "alternatives", label: "Most Alternatives" },
  { id: "clarity", label: "Highest Score Gain" },
];

type UnifiedHistoryItem =
  | { kind: "improve"; created_at: string; session: PromptSession }
  | { kind: "fix"; created_at: string; session: CodeSession };

const timeAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const platformClass = (platform: string | null) => {
  switch (platform) {
    case "Lovable":
      return "bg-purple-100 text-purple-700";
    case "Cursor":
      return "bg-blue-100 text-blue-700";
    case "Replit":
      return "bg-orange-100 text-orange-700";
    case "ChatGPT":
      return "bg-emerald-100 text-emerald-700";
    case "Claude":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-[#F2F2F7] text-[#636366]";
  }
};

const languageClass = () => "bg-sky-100 text-sky-800";

function altCount(item: UnifiedHistoryItem): number {
  if (item.kind === "improve") {
    const s = item.session;
    return [s.alternative_one, s.alternative_two, s.alternative_three].filter(Boolean).length;
  }
  const s = item.session;
  return [s.alternative_one_code, s.alternative_two_code, s.alternative_three_code].filter(Boolean).length;
}

function scoreGain(item: UnifiedHistoryItem): number {
  const s = item.session;
  const ob = s.overall_score_before ?? 0;
  const oa = s.overall_score_after ?? 0;
  return oa - ob;
}

function sortUnified(list: UnifiedHistoryItem[], sort: SortKey): UnifiedHistoryItem[] {
  const next = [...list];
  next.sort((x, y) => {
    if (sort === "newest") return y.created_at.localeCompare(x.created_at);
    if (sort === "oldest") return x.created_at.localeCompare(y.created_at);
    if (sort === "alternatives") {
      const d = altCount(y) - altCount(x);
      if (d !== 0) return d;
      return y.created_at.localeCompare(x.created_at);
    }
    const g = scoreGain(y) - scoreGain(x);
    if (g !== 0) return g;
    return y.created_at.localeCompare(x.created_at);
  });
  return next;
}

function formatScorePair(before: number | null | undefined, after: number | null | undefined): string | null {
  if (before == null && after == null) return null;
  const b = Number(before ?? 0);
  const a = Number(after ?? 0);
  return `${b.toFixed(1)} → ${a.toFixed(1)}`;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function HistorySkeletonCard() {
  return (
    <article
      className="rounded-2xl border border-[#E5E5EA] p-4"
      style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(12px)" }}
    >
      <div className="skeleton h-4 w-3/4 rounded" />
      <div className="mt-2 flex gap-2">
        <div className="skeleton h-5 w-16 rounded-full" />
        <div className="skeleton h-5 w-16 rounded-full" />
      </div>
      <div className="skeleton mt-3 h-4 w-24 rounded" />
      <div className="skeleton mt-4 h-3 w-20 rounded" />
    </article>
  );
}

export const HistoryPage = () => {
  const { user } = useAuth();
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const [merged, setMerged] = useState<UnifiedHistoryItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const searchText = search.trim().replace(/,/g, " ").replace(/'/g, "''");

  const fetchCount = async () => {
    if (!supabase || !user?.id) return;
    const sb = supabase;

    const countPrompts = async () => {
      let q = sb
        .from("prompt_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .or("mode.eq.improve,mode.is.null");
      if (filter.startsWith("platform:")) q = q.eq("platform", filter.replace("platform:", ""));
      if (searchText) q = q.or(`title.ilike.%${searchText}%,original_prompt.ilike.%${searchText}%`);
      const { count, error: e } = await q;
      if (e) throw e;
      return count ?? 0;
    };

    const countCodes = async () => {
      let q = sb.from("code_sessions").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      if (filter.startsWith("platform:")) q = q.eq("platform", filter.replace("platform:", ""));
      if (searchText) {
        q = q.or(`title.ilike.%${searchText}%,original_code.ilike.%${searchText}%,error_description.ilike.%${searchText}%`);
      }
      const { count, error: e } = await q;
      if (e) throw e;
      return count ?? 0;
    };

    try {
      if (filter === "improve") {
        const n = await countPrompts();
        setTotalCount(n);
        return;
      }
      if (filter === "fix") {
        const n = await countCodes();
        setTotalCount(n);
        return;
      }
      const [pn, cn] = await Promise.all([countPrompts(), countCodes()]);
      setTotalCount(pn + cn);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Count failed");
    }
  };

  const loadMerged = async () => {
    if (!supabase || !user?.id) {
      setLoadingInitial(false);
      return;
    }
    setLoadingInitial(true);
    setError(null);

    try {
      const unified: UnifiedHistoryItem[] = [];

      const needPrompts = filter === "all" || filter === "improve" || filter.startsWith("platform:");
      const needCodes = filter === "all" || filter === "fix" || filter.startsWith("platform:");

      const sb = supabase;

      if (needPrompts) {
        let pq = sb.from("prompt_sessions").select("*").eq("user_id", user.id).or("mode.eq.improve,mode.is.null");
        if (filter.startsWith("platform:")) {
          pq = pq.eq("platform", filter.replace("platform:", ""));
        }
        if (searchText) {
          pq = pq.or(`title.ilike.%${searchText}%,original_prompt.ilike.%${searchText}%`);
        }
        const { data: prompts, error: pe } = await pq.limit(TABLE_FETCH_LIMIT);
        if (pe) throw pe;
        (prompts ?? []).forEach((row: PromptSession) => {
          unified.push({ kind: "improve", created_at: row.created_at, session: row });
        });
      }

      if (needCodes) {
        let cq = sb.from("code_sessions").select("*").eq("user_id", user.id);
        if (filter.startsWith("platform:")) {
          cq = cq.eq("platform", filter.replace("platform:", ""));
        }
        if (searchText) {
          cq = cq.or(`title.ilike.%${searchText}%,original_code.ilike.%${searchText}%,error_description.ilike.%${searchText}%`);
        }
        const { data: codes, error: ce } = await cq.limit(TABLE_FETCH_LIMIT);
        if (ce) throw ce;
        (codes ?? []).forEach((row: CodeSession) => {
          unified.push({ kind: "fix", created_at: row.created_at, session: row });
        });
      }

      setMerged(sortUnified(unified, sort));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
      setMerged([]);
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    void loadMerged();
    void fetchCount();
  }, [user?.id, filter, sort, search]);

  const visibleItems = merged.slice(0, visibleCount);
  const hasMore = visibleCount < merged.length;

  useEffect(() => {
    const target = loaderRef.current;
    if (!target || !hasMore || loadingInitial || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLoadingMore(true);
          window.setTimeout(() => {
            setVisibleCount((v) => v + PAGE_SIZE);
            setLoadingMore(false);
          }, 80);
        }
      },
      { rootMargin: "180px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadingInitial, loadingMore, visibleCount, merged.length]);

  const { isRefreshing, pullDistance, bind } = usePullToRefresh(async () => {
    setVisibleCount(PAGE_SIZE);
    await Promise.all([loadMerged(), fetchCount()]);
  });

  useEffect(() => {
    if (!sortOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setSortOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [sortOpen]);

  return (
    <section className="space-y-5 overflow-x-hidden pb-16" {...bind}>
      {(isRefreshing || pullDistance > 0) ? (
        <div className="flex items-center justify-center">
          <span
            className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-[#3B82F6]/30 border-t-[#3B82F6]"
            style={{ transform: `translateY(${Math.max(0, pullDistance - 12)}px)` }}
          />
        </div>
      ) : null}

      <header>
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-2xl font-semibold text-[#1C1C1E]">History</h1>
          <span className="text-sm text-[#8E8E93]">{totalCount} sessions</span>
        </div>
        <p className="mt-1 text-sm text-[#636366]">Improve sessions and code fix sessions in one place</p>
      </header>

      <div className="rounded-2xl border border-[#E5E5EA] bg-white/70 p-4 backdrop-blur-xl">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]">
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your sessions..."
            className="w-full rounded-2xl border border-[#D1D1D6] bg-white/85 py-3 pl-10 pr-3 text-sm text-[#1C1C1E] outline-none focus:border-[#3B82F6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={[
                "rounded-full border px-3 py-1.5 text-sm transition",
                filter === f.id
                  ? "border-blue-300 bg-blue-100 text-blue-700"
                  : "border-[#D1D1D6] bg-white/75 text-[#636366]",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mt-3 hidden justify-end md:flex" ref={sortMenuRef}>
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((prev) => !prev)}
              className="flex min-w-[170px] items-center justify-between rounded-full border border-[#D1D1D6] bg-white/90 px-4 py-2 text-sm text-[#1C1C1E] transition hover:bg-white"
            >
              <span>{SORT_OPTIONS.find((option) => option.id === sort)?.label}</span>
              <span className="ml-2 text-xs text-[#636366]">▼</span>
            </button>
            {sortOpen ? (
              <div className="absolute right-0 top-[calc(100%+6px)] z-[120] min-w-[170px] overflow-hidden rounded-xl border border-[#D1D1D6] bg-white p-1 shadow-[0_12px_30px_rgba(28,28,30,0.14)]">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setSort(option.id);
                      setSortOpen(false);
                    }}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${sort === option.id ? "bg-blue-100 text-blue-700" : "text-[#1C1C1E] hover:bg-[#F2F2F7]"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileSortOpen(true)}
            className="rounded-full border border-[#D1D1D6] bg-white/90 px-4 py-2 text-sm text-[#1C1C1E]"
          >
            Sort
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-500">{error}</p> : null}

      {loadingInitial ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <HistorySkeletonCard key={i} />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <div
          className="rounded-3xl border border-dashed border-[#D1D1D6] px-8 py-14 text-center"
          style={{ background: "rgba(255,255,255,0.60)", backdropFilter: "blur(12px)" }}
        >
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D1D1D6] bg-white/90 text-xl">
            🗂️
          </div>
          <p className="mx-auto max-w-[360px] text-sm text-[#636366]">
            No sessions yet. Run Improve or Fix My Code and it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => {
            const id = item.session.id;
            const titleBase =
              item.kind === "improve"
                ? safeText(item.session.original_prompt) || safeText(item.session.title)
                : safeText(item.session.title) || safeText(item.session.original_code);
            const title = titleBase.length > 60 ? `${titleBase.slice(0, 60)}...` : titleBase;
            const scores = formatScorePair(item.session.overall_score_before, item.session.overall_score_after);
            const scoreBefore = Number(item.session.overall_score_before ?? 0);
            const scoreAfter = Number(item.session.overall_score_after ?? 0);
            const scoreImproved = scoreAfter > scoreBefore;

            return (
              <Link
                key={`${item.kind}-${id}`}
                to={`/sessions/${id}`}
                className="group rounded-2xl border border-[#E5E5EA] bg-white/72 p-4 no-underline transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(28,28,30,0.10)]"
                style={{ backdropFilter: "blur(12px)" }}
              >
                <h3 className="line-clamp-2 text-[15px] font-semibold text-[#1C1C1E]">{title}</h3>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      item.kind === "fix" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {item.kind === "fix" ? "Fix" : "Improve"}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${platformClass(item.session.platform)}`}>
                    {item.session.platform ?? "Other"}
                  </span>
                  {item.kind === "fix" && item.session.language_detected ? (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${languageClass()}`}>
                      {item.session.language_detected}
                    </span>
                  ) : null}
                </div>

                {scores ? (
                  <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-[#D1D1D6] bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#1C1C1E]">
                    <span>{scores.split(" → ")[0]}</span>
                    <span className={scoreImproved ? "text-emerald-500" : "text-[#8E8E93]"}>
                      {scoreImproved ? "↑" : "→"}
                    </span>
                    <span>{scores.split(" → ")[1]}</span>
                  </div>
                ) : null}

                <div className="mt-3 flex items-center justify-between text-xs text-[#8E8E93]">
                  <span>{timeAgo(item.created_at)}</span>
                  <span className="text-[#C7C7CC] transition group-hover:text-[#8E8E93]">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div ref={loaderRef} />
      {loadingMore ? (
        <div className="flex items-center justify-center py-2">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#3B82F6]/30 border-t-[#3B82F6]" />
        </div>
      ) : null}
      <BottomSheet open={mobileSortOpen} onClose={() => setMobileSortOpen(false)}>
        <h3 className="px-1 pb-2 text-[16px] font-semibold text-[#1C1C1E]">Sort Sessions</h3>
        <div className="space-y-1 pb-2">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setSort(option.id);
                setMobileSortOpen(false);
              }}
              className={`block min-h-[44px] w-full rounded-2xl px-4 py-3 text-left text-sm ${sort === option.id ? "bg-blue-50 text-[#3B82F6]" : "text-[#1C1C1E]"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </BottomSheet>
    </section>
  );
};
