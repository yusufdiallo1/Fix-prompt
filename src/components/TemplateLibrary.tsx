import { useEffect, useMemo, useRef, useState } from "react";
import type { PromptTemplate } from "../hooks/useTemplates";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_FILTERS = [
  { id: "All",            label: "All" },
  { id: "Build Something",label: "Build" },
  { id: "Fix a Bug",      label: "Fix" },
  { id: "Design UI",      label: "Design" },
  { id: "Create an API",  label: "API" },
  { id: "Write Content",  label: "Content" },
  { id: "Explain Code",   label: "Explain" },
  { id: "Generate Ideas", label: "Ideas" },
] as const;

type CategoryId = (typeof CATEGORY_FILTERS)[number]["id"];

const CATEGORY_EMOJI: Record<string, string> = {
  "Build Something": "🏗️",
  "Fix a Bug":        "🐛",
  "Write Content":    "✍️",
  "Create an API":    "🔌",
  "Design UI":        "🎨",
  "Explain Code":     "📖",
  "Generate Ideas":   "🧠",
  "Refactor Code":    "🔧",
};

const POPULAR_COUNT = 3;

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      className="w-[calc((100%-0.75rem)/1.5)] shrink-0 snap-start rounded-2xl border border-[#E5E5EA] p-4 md:w-[calc((100%-2.25rem)/4.3)]"
      style={{ background: "rgba(255,255,255,0.75)" }}
    >
      <div className="skeleton mb-3 h-7 w-7 rounded-lg" />
      <div className="skeleton mb-2 h-4 w-36 rounded" />
      <div className="skeleton h-3 w-28 rounded" />
      <div className="skeleton mt-3 h-5 w-16 rounded-full" />
    </div>
  );
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  selected,
  popular,
  onSelect,
}: {
  template: PromptTemplate;
  selected: boolean;
  popular: boolean;
  onSelect: (t: PromptTemplate) => void;
}) {
  const emoji = CATEGORY_EMOJI[template.category] ?? "📝";

  return (
    <button
      type="button"
      onClick={() => onSelect(template)}
      className={[
        "group w-[calc((100%-0.75rem)/1.5)] shrink-0 snap-start rounded-2xl border p-3.5 text-left transition-all duration-200 active:scale-[0.97] active:bg-blue-50/70 md:w-[calc((100%-2.25rem)/4.3)]",
        selected
          ? "border-[#3B82F6] shadow-[0_0_0_3px_rgba(59,130,246,0.14)]"
          : "border-[#E5E5EA] hover:border-[#C7D7F5] hover:shadow-[0_4px_16px_rgba(28,28,30,0.08)]",
      ].join(" ")}
      style={{
        background: selected
          ? "rgba(235,245,255,0.92)"
          : "rgba(255,255,255,0.82)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Top row: emoji + popular badge */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="text-[22px] leading-none">{emoji}</span>
        {popular && (
          <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-600">
            🔥 Popular
          </span>
        )}
      </div>

      {/* Title */}
      <p className={[
        "line-clamp-2 text-[13px] font-semibold leading-snug",
        selected ? "text-[#1C4ED8]" : "text-[#1C1C1E]",
      ].join(" ")}>
        {template.title}
      </p>

      {/* Platform badge */}
      {template.platform && (
        <span className="mt-2.5 inline-block rounded-full bg-[#F2F2F7] px-2.5 py-0.5 text-[10px] font-semibold text-[#636366]">
          {template.platform}
        </span>
      )}

      {/* Selected indicator */}
      {selected && (
        <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-[#3B82F6]">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Selected
        </div>
      )}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TemplateLibraryProps {
  templates: PromptTemplate[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (template: PromptTemplate) => void;
  onSkip: () => void;
}

export function TemplateLibrary({
  templates,
  loading,
  selectedId,
  onSelect,
  onSkip,
}: TemplateLibraryProps) {
  const [category, setCategory] = useState<CategoryId>("All");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Top 3 by usage_count
  const popularIds = useMemo(
    () =>
      [...templates]
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, POPULAR_COUNT)
        .map((t) => t.id),
    [templates],
  );

  const visible = useMemo(() => {
    const filtered =
      category === "All"
        ? templates
        : templates.filter((t) => t.category === category);

    if (category === "All") {
      // Popular first, then the rest
      const popular = filtered.filter((t) => popularIds.includes(t.id));
      const rest = filtered.filter((t) => !popularIds.includes(t.id));
      return [...popular, ...rest];
    }
    return filtered;
  }, [templates, category, popularIds]);

  // Scroll cards back to start when category changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, [category]);

  return (
    <div className="space-y-3">
      {/* Heading row */}
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold text-[#1C1C1E]">
          Start with a Template
        </p>
        <button
          type="button"
          onClick={onSkip}
          className="text-[13px] font-medium text-[#8E8E93] transition hover:text-[#636366]"
        >
          Skip →
        </button>
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setCategory(f.id as CategoryId)}
            className={[
              "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all duration-150 active:scale-[0.97]",
              category === f.id
                ? "border-[#3B82F6] bg-[#3B82F6] text-white shadow-[0_2px_8px_rgba(59,130,246,0.28)]"
                : "border-[#E5E5EA] bg-white/80 text-[#636366] hover:border-[#C7D7F5] hover:text-[#1C1C1E]",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Template cards */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
      >
        {loading ? (
          [0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)
        ) : visible.length === 0 ? (
          <p className="py-6 text-sm text-[#8E8E93]">No templates in this category yet.</p>
        ) : (
          visible.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              selected={t.id === selectedId}
              popular={category === "All" && popularIds.includes(t.id)}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
