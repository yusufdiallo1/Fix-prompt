import { useEffect, useMemo, useRef, useState } from "react";
import { BottomSheet } from "../components/BottomSheet";
import { useAuth } from "../hooks/useAuth";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { supabase } from "../lib/supabase";
import type { SavedPrompt } from "../types/database";

const TYPE_FILTERS = ["All", "Improved", "Alternatives", "Fix Prompts"] as const;
const PLATFORM_FILTERS = ["Lovable", "Cursor", "Replit", "ChatGPT", "Claude"] as const;
const SORT_OPTIONS = [
  { id: "newest", label: "Newest First" },
  { id: "oldest", label: "Oldest First" },
] as const;

const getTypeLabel = (prompt: SavedPrompt) => {
  if (prompt.label?.trim()) return prompt.label.trim();
  if (prompt.prompt_type === "improved") return "Improved Prompt";
  if (prompt.prompt_type === "alternative") return "Alternative Prompt";
  if (prompt.prompt_type === "fix") return "Fix Prompt";
  return "Saved Prompt";
};

const previewText = (text: string) => (text.length > 120 ? `${text.slice(0, 120)}...` : text);
const sourceBadge = (source: string | null) => {
  if (source === "one") return "Alternative 1";
  if (source === "two") return "Alternative 2";
  if (source === "three") return "Alternative 3";
  if (source === "improved") return "Improved";
  return null;
};

const formatSavedDateTime = (iso: string) => {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  const timePart = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${datePart} • ${timePart}`;
};

const platformBadgeClass = (platform: string | null) => {
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

function SavedPromptSkeletonCard() {
  return (
    <article
      className="rounded-2xl border border-[#E5E5EA] p-4"
      style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(12px)" }}
    >
      <div className="skeleton h-4 w-2/3 rounded" />
      <div className="skeleton mt-2 h-5 w-20 rounded-full" />
      <div className="skeleton mt-3 h-14 w-full rounded-lg" />
      <div className="mt-4 flex items-center justify-between">
        <div className="skeleton h-8 w-16 rounded-full" />
        <div className="skeleton h-8 w-16 rounded-full" />
      </div>
    </article>
  );
}

export const SavedPage = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>("All");
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [items, setItems] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]["id"]>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  const typeValue = useMemo(() => {
    if (typeFilter === "All") return null;
    if (typeFilter === "Improved") return "improved";
    if (typeFilter === "Alternatives") return "alternative";
    return "fix";
  }, [typeFilter]);

  useEffect(() => {
    if (!supabase || !user?.id) {
      setLoading(false);
      return;
    }
    const sb = supabase;

    let active = true;
    setLoading(true);
    setError(null);

    const run = async () => {
      const [countRes, listRes] = await Promise.all([
        sb
          .from("saved_prompts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
        (() => {
          let query = sb
            .from("saved_prompts")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: sort === "oldest" });

          if (typeValue) query = query.eq("prompt_type", typeValue);
          if (platformFilter) query = query.eq("platform", platformFilter);
          if (search.trim()) {
            const s = search.trim().replace(/,/g, " ");
            query = query.or(`label.ilike.%${s}%,quick_note.ilike.%${s}%,prompt_text.ilike.%${s}%,platform.ilike.%${s}%`);
          }
          return query;
        })(),
      ]);

      if (!active) return;

      setTotalCount(countRes.count ?? 0);
      if (listRes.error) {
        setError(listRes.error.message);
        setItems([]);
      } else {
        setItems((listRes.data ?? []) as SavedPrompt[]);
      }
      setLoading(false);
    };

    void run();
    return () => {
      active = false;
    };
  }, [user?.id, typeValue, platformFilter, search, sort, refreshKey]);

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

  const { isRefreshing, pullDistance, bind } = usePullToRefresh(async () => {
    setRefreshKey((prev) => prev + 1);
  });

  const copyPrompt = async (item: SavedPrompt) => {
    await navigator.clipboard.writeText(item.prompt_text);
    setCopiedId(item.id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  const deletePrompt = async (id: string) => {
    if (!supabase) return;
    const { error: deleteError } = await supabase.from("saved_prompts").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
    setConfirmDeleteId(null);
    setTotalCount((prev) => Math.max(0, prev - 1));
  };

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
      <header>
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-2xl font-semibold text-[#1C1C1E]">Saved Prompts</h1>
          <span className="text-sm text-[#8E8E93]">{totalCount} saved</span>
        </div>
        <p className="mt-1 text-sm text-[#636366]">Your personal library of great prompts</p>
      </header>

      <div
        className="rounded-2xl border border-[#E5E5EA] bg-white/70 p-4 backdrop-blur-xl"
      >
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search saved prompts..."
          className="w-full rounded-2xl border border-[#D1D1D6] bg-white/85 px-4 py-3 text-sm text-[#1C1C1E] outline-none focus:border-[#3B82F6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setTypeFilter(f)}
              className={[
                "rounded-full border px-3 py-1.5 text-sm transition",
                typeFilter === f
                  ? "border-blue-300 bg-blue-100 text-blue-700"
                  : "border-[#D1D1D6] bg-white/75 text-[#636366]",
              ].join(" ")}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-2 md:max-lg:overflow-x-auto">
          {PLATFORM_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setPlatformFilter((prev) => (prev === f ? null : f))}
              className={[
                "rounded-full border px-3 py-1.5 text-sm transition",
                platformFilter === f
                  ? "border-violet-300 bg-violet-100 text-violet-700"
                  : "border-[#D1D1D6] bg-white/75 text-[#636366]",
              ].join(" ")}
            >
              {f}
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

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SavedPromptSkeletonCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#636366]">
          No saved prompts yet. Save your best improved prompts from any session to find them here.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-[#E5E5EA] bg-white/72 p-4 backdrop-blur-xl"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold text-[#1C1C1E]">{getTypeLabel(item)}</p>
                  {sourceBadge(item.source_alternative) ? (
                    <span className="mt-1 inline-block rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                      {sourceBadge(item.source_alternative)}
                    </span>
                  ) : null}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${platformBadgeClass(item.platform)}`}>
                  {item.platform ?? "Other"}
                </span>
              </div>

              <p className="break-words text-sm leading-6 text-[#636366]">{previewText(item.prompt_text)}</p>

              <p className="mt-3 text-xs text-[#8E8E93]">{formatSavedDateTime(item.created_at)}</p>
              {item.quick_note?.trim() ? (
                <p className="mt-2 rounded-xl border border-[#E5E5EA] bg-white/90 px-3 py-2 text-xs text-[#636366]">
                  <span className="font-semibold text-[#1C1C1E]">Quick Note:</span> {item.quick_note.trim()}
                </p>
              ) : null}

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => void copyPrompt(item)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold text-white ${copiedId === item.id ? "bg-emerald-500" : "bg-gradient-to-r from-[#3B82F6] to-[#A78BFA]"}`}
                >
                  {copiedId === item.id ? "✓ Copied!" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(item.id)}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-500"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {confirmDeleteId ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-[480px] rounded-3xl border border-white/70 bg-white/88 p-6 shadow-[0_24px_50px_rgba(28,28,30,0.22)] backdrop-blur-xl"
          >
            <h2 className="text-xl font-semibold text-[#1C1C1E]">Delete saved prompt?</h2>
            <p className="mt-2 text-sm text-[#636366]">This action cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-full border border-[#D1D1D6] bg-white px-4 py-2 text-sm text-[#1C1C1E]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deletePrompt(confirmDeleteId)}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <BottomSheet open={mobileSortOpen} onClose={() => setMobileSortOpen(false)}>
        <h3 className="px-1 pb-2 text-[16px] font-semibold text-[#1C1C1E]">Sort Saved Prompts</h3>
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
