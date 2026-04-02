import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BottomSheet } from "../components/BottomSheet";
import { useAuth } from "../hooks/useAuth";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { safeText } from "../lib/renderSafety";
import { supabase } from "../lib/supabase";
import type { PromptSession } from "../types/database";

const PAGE_SIZE = 20;
const FILTERS = [
  { id: "all", label: "All" },
  { id: "improve", label: "Improve Sessions" },
  { id: "debug", label: "Debug Sessions" },
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
  { id: "clarity", label: "Highest Clarity Gain" },
];

interface HistorySession extends PromptSession {
  debug_root_cause: string | null;
}

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

const rootCauseClass = (cause: string | null) => {
  switch (cause) {
    case "Missing Context":
      return "bg-rose-100 text-rose-700";
    case "Ambiguous Requirements":
      return "bg-orange-100 text-orange-700";
    case "Platform Limitation":
      return "bg-blue-100 text-blue-700";
    case "Scope Creep":
      return "bg-yellow-100 text-yellow-700";
    case "Tech Mismatch":
      return "bg-purple-100 text-purple-700";
    case "Missing Dependency":
      return "bg-pink-100 text-pink-700";
    case "Logic Error":
      return "bg-red-100 text-red-700";
    case "Style Conflict":
      return "bg-teal-100 text-teal-700";
    default:
      return "bg-[#F2F2F7] text-[#636366]";
  }
};

const clamp10 = (value: number) => Math.max(0, Math.min(10, value));
const toScore = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return 0;
  return value > 10 ? clamp10(value / 10) : clamp10(value);
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
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
      <div className="skeleton mt-3 h-4 w-28 rounded" />
      <div className="skeleton mt-4 h-3 w-20 rounded" />
    </article>
  );
}

export const HistoryPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [items, setItems] = useState<HistorySession[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isTablet, setIsTablet] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);

  const orderedItems = useMemo(() => {
    if (!items.length) return items;
    const ids = new Set(items.map((session) => session.id));
    const childMap = new Map<string, HistorySession[]>();
    const topLevel: HistorySession[] = [];

    for (const session of items) {
      if (session.parent_session_id && ids.has(session.parent_session_id)) {
        const children = childMap.get(session.parent_session_id) ?? [];
        children.push(session);
        childMap.set(session.parent_session_id, children);
      } else {
        topLevel.push(session);
      }
    }

    childMap.forEach((children) => {
      children.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });

    const ordered: HistorySession[] = [];
    for (const session of topLevel) {
      ordered.push(session);
      const children = childMap.get(session.id);
      if (children?.length) {
        ordered.push(...children);
      }
    }
    return ordered;
  }, [items]);

  const chainMeta = useMemo(() => {
    const rootGroups = new Map<string, HistorySession[]>();
    const childRootIds = new Set<string>();
    for (const session of items) {
      const rootId = session.parent_session_id ?? session.id;
      const group = rootGroups.get(rootId) ?? [];
      group.push(session);
      rootGroups.set(rootId, group);
      if (session.parent_session_id) childRootIds.add(rootId);
    }

    const passById: Record<string, number> = {};
    const chainMemberIds = new Set<string>();
    rootGroups.forEach((group, rootId) => {
      group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      group.forEach((session, index) => {
        passById[session.id] = index + 1;
      });
      if (group.length > 1 || childRootIds.has(rootId)) {
        group.forEach((session) => chainMemberIds.add(session.id));
      }
    });

    return { passById, chainMemberIds };
  }, [items]);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");
    const update = () => setIsTablet(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const buildQuery = (currentOffset: number) => {
    if (!supabase || !user?.id) return null;
    let q = supabase
      .from("prompt_sessions")
      .select("*")
      .eq("user_id", user.id);

    if (filter === "improve") q = q.eq("mode", "improve");
    if (filter === "debug") q = q.eq("mode", "debug");
    if (filter.startsWith("platform:")) q = q.eq("platform", filter.replace("platform:", ""));

    const sanitized = search.trim().replace(/,/g, " ").replace(/'/g, "''");
    if (sanitized) {
      q = q.or(`title.ilike.%${sanitized}%,original_prompt.ilike.%${sanitized}%`);
    }

    if (sort === "newest") q = q.order("created_at", { ascending: false });
    if (sort === "oldest") q = q.order("created_at", { ascending: true });
    if (sort === "alternatives") {
      q = q
        .order("alternative_three", { ascending: false, nullsFirst: false })
        .order("alternative_two", { ascending: false, nullsFirst: false })
        .order("alternative_one", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
    }
    if (sort === "clarity") {
      q = q
        .order("overall_score_after", { ascending: false, nullsFirst: false })
        .order("overall_score_before", { ascending: true, nullsFirst: false })
        .order("score_clarity_after", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
    }

    return q.range(currentOffset, currentOffset + PAGE_SIZE - 1);
  };

  const fetchSessions = async (reset = false) => {
    if (!supabase || !user?.id) {
      setLoadingInitial(false);
      return;
    }
    if (!reset && (!hasMore || loadingMore || loadingInitial)) return;

    if (reset) {
      setLoadingInitial(true);
      setOffset(0);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    const currentOffset = reset ? 0 : offset;
    const query = buildQuery(currentOffset);
    if (!query) return;
    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setLoadingInitial(false);
      setLoadingMore(false);
      return;
    }

    const page = (data ?? []) as PromptSession[];
    const ids = page.map((s) => s.id);

    let rootCauseMap: Record<string, string | null> = {};
    if (ids.length) {
      const { data: debugData } = await supabase
        .from("debug_sessions")
        .select("prompt_session_id,root_cause")
        .in("prompt_session_id", ids);
      rootCauseMap = (debugData ?? []).reduce<Record<string, string | null>>((acc, row) => {
        const item = row as { prompt_session_id: string | null; root_cause: string | null };
        if (item.prompt_session_id && !(item.prompt_session_id in acc)) {
          acc[item.prompt_session_id] = item.root_cause;
        }
        return acc;
      }, {});
    }

    const mapped = page.map((s) => ({
      ...s,
      debug_root_cause: rootCauseMap[s.id] ?? null,
    }));

    setItems((prev) => (reset ? mapped : [...prev, ...mapped]));
    setOffset(currentOffset + mapped.length);
    setHasMore(mapped.length === PAGE_SIZE);
    setLoadingInitial(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    if (!supabase || !user?.id) return;
    const sb = supabase;
    let active = true;
    const run = async () => {
      const { count } = await sb
        .from("prompt_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (active) setTotalCount(count ?? 0);
    };
    void run();
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    void fetchSessions(true);
  }, [user?.id, filter, sort, search]);

  const { isRefreshing, pullDistance, bind } = usePullToRefresh(async () => {
    await fetchSessions(true);
  });

  useEffect(() => {
    const target = loaderRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchSessions(false);
        }
      },
      { rootMargin: "180px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loaderRef.current, hasMore, loadingInitial, loadingMore, offset, filter, sort, search, user?.id]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <section className="space-y-5 pb-16" {...bind}>
      {(isRefreshing || pullDistance > 0) ? (
        <div className="flex items-center justify-center">
          <span
            className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-[#3B82F6]/30 border-t-[#3B82F6]"
            style={{ transform: `translateY(${Math.max(0, pullDistance - 12)}px)` }}
          />
        </div>
      ) : null}
      <header
        className="rounded-2xl border border-[#E5E5EA] bg-white/72 p-4 backdrop-blur-xl"
      >
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-2xl font-semibold text-[#1C1C1E]">History</h1>
          <span className="text-sm text-[#8E8E93]">{totalCount} sessions</span>
        </div>
        <p className="mt-1 text-sm text-[#636366]">Every prompt session you have run</p>
      </header>

      <div className="relative z-10 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-[#E5E5EA] bg-white/72 p-4 backdrop-blur-xl">
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
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={[
                  "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition",
                  filter === f.id
                    ? "border-blue-300 bg-blue-100 text-blue-700"
                    : "border-[#D1D1D6] bg-white/75 text-[#636366]",
                ].join(" ")}
              >
                {f.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMobileSortOpen(true)}
              className="ml-auto rounded-full border border-[#D1D1D6] bg-white/90 px-3 py-1.5 text-sm text-[#1C1C1E] lg:hidden"
            >
              Sort
            </button>
          </div>
        </div>

        <div
          ref={sortMenuRef}
          className="relative z-20 hidden rounded-2xl border border-[#E5E5EA] bg-white/72 p-3 backdrop-blur-xl lg:block lg:self-start"
        >
          <label className="mb-1 block text-xs font-medium text-[#8E8E93]">Sort</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((prev) => !prev)}
              className="flex min-w-[196px] items-center justify-between rounded-full border border-[#D1D1D6] bg-white/85 px-3 py-2 text-sm text-[#1C1C1E] transition hover:bg-white"
            >
              <span>{SORT_OPTIONS.find((option) => option.id === sort)?.label}</span>
              <ChevronDownIcon />
            </button>
            {sortOpen ? (
              <div
                className="absolute left-0 top-[calc(100%+6px)] z-30 w-full overflow-hidden rounded-xl border border-[#D1D1D6] bg-white/95 p-1 shadow-[0_12px_30px_rgba(28,28,30,0.14)] backdrop-blur-xl"
              >
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setSort(option.id);
                      setSortOpen(false);
                    }}
                    className={[
                      "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition",
                      sort === option.id
                        ? "bg-blue-100 text-blue-700"
                        : "text-[#1C1C1E] hover:bg-[#F2F2F7]",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-500">{error}</p> : null}

      {loadingInitial ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <HistorySkeletonCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div
          className="rounded-3xl border border-dashed border-[#D1D1D6] px-8 py-14 text-center"
          style={{ background: "rgba(255,255,255,0.60)", backdropFilter: "blur(12px)" }}
        >
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D1D1D6] bg-white/90 text-xl">
            🗂️
          </div>
          <p className="mx-auto max-w-[360px] text-sm text-[#636366]">
            No sessions yet. Run an Improve or Debug session and it will appear here.
          </p>
        </div>
      ) : isTablet ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            {orderedItems.map((session) => {
              const titleBase = safeText(session.original_prompt) || safeText(session.title) || "Untitled session";
              const title = titleBase.length > 60 ? `${titleBase.slice(0, 60)}...` : titleBase;
              const mode = (session.mode ?? "").toLowerCase().includes("debug") ? "debug" : "improve";
              const overallBefore = toScore(session.overall_score_before ?? session.clarity_score_before);
              const overallAfter = toScore(session.overall_score_after ?? session.clarity_score_after);
              const pass = chainMeta.passById[session.id];
              const inChain = chainMeta.chainMemberIds.has(session.id);
              const isChildPass = Boolean(session.parent_session_id);
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedSessionId(session.id)}
                  className={[
                    "w-full rounded-2xl border border-[#E5E5EA] bg-white/72 p-4 text-left transition duration-200",
                    isChildPass ? "border-l-[3px] border-l-violet-200 pl-5" : "",
                  ].join(" ")}
                  style={{ backdropFilter: "blur(12px)" }}
                >
                  <h3 className="line-clamp-2 text-[15px] font-semibold text-[#1C1C1E]">{title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        mode === "debug" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {mode === "debug" ? "Debug" : "Improve"}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${platformClass(session.platform)}`}>
                      {session.platform ?? "Other"}
                    </span>
                    {inChain ? (
                      <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                        Pass {pass ?? 1}
                      </span>
                    ) : null}
                  </div>
                  {mode === "improve" ? (
                    <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-[#D1D1D6] bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#1C1C1E]">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#CBD5E1] text-[10px]">
                        {overallBefore.toFixed(1)}
                      </span>
                      <span className="text-emerald-500">→</span>
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-violet-300 text-[10px]">
                        {overallAfter.toFixed(1)}
                      </span>
                    </div>
                  ) : (
                    <span className={`mt-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${rootCauseClass(session.debug_root_cause)}`}>
                      {session.debug_root_cause ?? "Root cause pending"}
                    </span>
                  )}
                  <p className="mt-3 text-xs text-[#8E8E93]">{timeAgo(session.created_at)}</p>
                </button>
              );
            })}
          </div>
          <div className="rounded-2xl border border-[#E5E5EA] bg-white/75 p-5 backdrop-blur-xl">
            {selectedSessionId ? (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedSessionId(null)}
                  className="mb-4 rounded-full border border-[#D1D1D6] bg-white px-3 py-1 text-sm text-[#1C1C1E]"
                >
                  Back to list
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/sessions/${selectedSessionId}`)}
                  className="mb-4 ml-2 rounded-full border border-[#D1D1D6] bg-white px-3 py-1 text-sm text-[#1C1C1E]"
                >
                  Open full page
                </button>
                {(() => {
                  const s = orderedItems.find((item) => item.id === selectedSessionId);
                  if (!s) return <p className="text-sm text-[#636366]">Session unavailable.</p>;
                  return (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-[#1C1C1E]">{s.title}</h3>
                      <p className="text-sm text-[#636366]">{s.platform ?? "Unknown platform"} — {s.mode ?? "general"} mode</p>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">Original Prompt</p>
                        <p className="whitespace-pre-wrap text-sm text-[#1C1C1E]">{s.original_prompt ?? "Not available."}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">Improved Prompt</p>
                        <p className="whitespace-pre-wrap text-sm text-[#1C1C1E]">{s.improved_prompt ?? "Not available."}</p>
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-[#D1D1D6] text-sm text-[#636366]">
                Select a session to view details
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orderedItems.map((session) => {
            const titleBase = safeText(session.original_prompt) || safeText(session.title) || "Untitled session";
            const title = titleBase.length > 60 ? `${titleBase.slice(0, 60)}...` : titleBase;
            const mode = (session.mode ?? "").toLowerCase().includes("debug") ? "debug" : "improve";
            const overallBefore = toScore(session.overall_score_before ?? session.clarity_score_before);
            const overallAfter = toScore(session.overall_score_after ?? session.clarity_score_after);
            const pass = chainMeta.passById[session.id];
            const inChain = chainMeta.chainMemberIds.has(session.id);
            const isChildPass = Boolean(session.parent_session_id);

            return (
              <Link
                key={session.id}
                to={`/sessions/${session.id}`}
                className={[
                  "group rounded-2xl border border-[#E5E5EA] bg-white/72 p-4 no-underline transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(28,28,30,0.10)]",
                  isChildPass ? "border-l-[3px] border-l-violet-200 pl-5" : "",
                ].join(" ")}
                style={{ backdropFilter: "blur(12px)" }}
              >
                <h3 className="line-clamp-2 text-[15px] font-semibold text-[#1C1C1E]">{title}</h3>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      mode === "debug" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {mode === "debug" ? "Debug" : "Improve"}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${platformClass(session.platform)}`}>
                    {session.platform ?? "Other"}
                  </span>
                  {inChain ? (
                    <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                      Pass {pass ?? 1}
                    </span>
                  ) : null}
                </div>

                {mode === "improve" ? (
                  <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-[#D1D1D6] bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#1C1C1E]">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#CBD5E1] text-[10px]">
                      {overallBefore.toFixed(1)}
                    </span>
                    <span className="text-emerald-500">→</span>
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-violet-300 text-[10px]">
                      {overallAfter.toFixed(1)}
                    </span>
                  </div>
                ) : (
                  <span className={`mt-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${rootCauseClass(session.debug_root_cause)}`}>
                    {session.debug_root_cause ?? "Root cause pending"}
                  </span>
                )}

                <div className="mt-3 flex items-center justify-between text-xs text-[#8E8E93]">
                  <span>{timeAgo(session.created_at)}</span>
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
