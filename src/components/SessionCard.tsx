import { Link } from "react-router-dom";
import type { PromptSession } from "../types/database";

interface SessionCardProps {
  session: PromptSession;
}

export const SessionCard = ({ session }: SessionCardProps) => {
  return (
    <article
      className="rounded-2xl border border-[#E5E5EA] p-5 transition-shadow duration-150 hover:shadow-[0_4px_20px_rgba(28,28,30,0.08)]"
      style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(12px)" }}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-[#1C1C1E]">{session.title}</h3>
        <span className="shrink-0 rounded-full bg-[#F2F2F7] px-2.5 py-0.5 text-[11px] font-medium text-[#636366]">
          {session.mode ?? session.status ?? "completed"}
        </span>
      </div>
      <p className="text-sm text-[#636366] line-clamp-2">
        {session.improvement_summary ?? "No summary yet."}
      </p>
      <div className="mt-4 flex items-center justify-between text-xs text-[#8E8E93]">
        <span>{session.platform ?? "Unknown platform"}</span>
        <Link
          to={`/sessions/${session.id}`}
          className="font-medium text-[#3B82F6] no-underline transition-colors hover:text-[#2563EB]"
        >
          View details →
        </Link>
      </div>
    </article>
  );
};
