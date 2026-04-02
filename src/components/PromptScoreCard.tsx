import { useEffect, useMemo, useState } from "react";

interface PromptScoreCardProps {
  clarityBefore: number;
  specificityBefore: number;
  detailBefore: number;
  clarityAfter: number;
  specificityAfter: number;
  detailAfter: number;
  overallBefore: number;
  overallAfter: number;
  insight: string;
}

const clamp10 = (value: number) => Math.max(0, Math.min(10, Number.isFinite(value) ? value : 0));
const formatScore = (value: number) => `${clamp10(value).toFixed(1)} / 10`;

const scoreLevelClass = (value: number) => {
  if (value < 5) return "bg-rose-300";
  if (value <= 7) return "bg-orange-300";
  return "bg-emerald-300";
};

const scoreLevelBorderClass = (value: number) => {
  if (value < 5) return "border-rose-300 text-rose-600";
  if (value <= 7) return "border-orange-300 text-orange-600";
  return "border-emerald-300 text-emerald-600";
};

const useCountUp = (target: number, duration = 600) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const run = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(clamp10(target) * eased);
      if (progress < 1) frame = window.requestAnimationFrame(run);
    };
    frame = window.requestAnimationFrame(run);
    return () => window.cancelAnimationFrame(frame);
  }, [target, duration]);
  return display;
};

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5h16M7 16V9m5 7V5m5 11v-4" />
    </svg>
  );
}

function MetricBar({
  score,
  colorClass,
}: {
  score: number;
  colorClass: string;
}) {
  const display = useCountUp(score);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EEF0F5]">
        <div
          className={`score-fill h-2 rounded-full ${colorClass}`}
          style={{ width: `${(clamp10(score) / 10) * 100}%` }}
        />
      </div>
      <span className="min-w-[58px] text-right text-xs text-[#636366]">{formatScore(display)}</span>
    </div>
  );
}

export const PromptScoreCard = ({
  clarityBefore,
  specificityBefore,
  detailBefore,
  clarityAfter,
  specificityAfter,
  detailAfter,
  overallBefore,
  overallAfter,
  insight,
}: PromptScoreCardProps) => {
  const overallBeforeDisplay = useCountUp(overallBefore);
  const overallAfterDisplay = useCountUp(overallAfter);

  const rows = useMemo(
    () => [
      { label: "Clarity", before: clarityBefore, after: clarityAfter },
      { label: "Specificity", before: specificityBefore, after: specificityAfter },
      { label: "Detail", before: detailBefore, after: detailAfter },
    ],
    [clarityBefore, specificityBefore, detailBefore, clarityAfter, specificityAfter, detailAfter],
  );

  const safeInsight = insight?.trim() || "Adding stronger context and constraints made the biggest difference.";

  return (
    <article className="score-card-enter rounded-2xl border border-[#E5E5EA] bg-white/80 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <ChartIcon />
        <h2 className="text-lg font-semibold text-[#1C1C1E]">Prompt Score</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8E8E93]">Your Original</p>
          {rows.map((row) => (
            <div key={`before-${row.label}`} className="space-y-1.5">
              <p className="text-xs font-medium text-[#8E8E93]">{row.label}</p>
              <MetricBar score={row.before} colorClass={scoreLevelClass(row.before)} />
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Improved</p>
          {rows.map((row) => (
            <div key={`after-${row.label}`} className="space-y-1.5">
              <p className="text-xs font-medium text-[#8E8E93]">{row.label}</p>
              <MetricBar score={row.after} colorClass="bg-emerald-300" />
            </div>
          ))}
        </section>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
        <div className="text-center">
          <div
            className={`score-circle-enter mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 bg-white text-xl font-semibold ${scoreLevelBorderClass(
              overallBefore,
            )}`}
          >
            {clamp10(overallBeforeDisplay).toFixed(1)}
          </div>
          <p className="mt-2 text-xs text-[#8E8E93]">Original Score</p>
        </div>

        <span className="text-lg text-emerald-500">→</span>

        <div className="text-center">
          <div className="score-circle-enter rounded-full bg-gradient-to-r from-blue-300 via-violet-300 to-fuchsia-300 p-[3px]">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-2xl font-semibold text-[#1C1C1E]">
              {clamp10(overallAfterDisplay).toFixed(1)}
            </div>
          </div>
          <p className="mt-2 text-xs text-[#8E8E93]">Improved Score</p>
        </div>
      </div>

      <p className="mt-4 text-center text-sm italic text-[#8E8E93]">{safeInsight}</p>
    </article>
  );
};
