import { useEffect, useMemo, useState } from "react";

type ViewMode = "side" | "stacked";
type ExpandMode = "original" | "improved" | null;
type DiffTag = "common" | "removed" | "added";

interface DiffToken {
  text: string;
  tag: DiffTag;
}

interface BeforeAfterCardProps {
  originalPrompt: string;
  improvedPrompt: string;
  wordsBefore: number;
  wordsAfter: number;
  overallBefore: number;
  overallAfter: number;
  platform?: string | null;
  improvedFavourite?: boolean;
  onToggleImprovedFavourite?: () => void;
  improvedHeartActive?: boolean;
}

const clamp = (value: number) => Math.max(0, Math.min(10, value));

const wordsFrom = (text: string) => text.trim().split(/\s+/).filter(Boolean);

function computeDiff(original: string, improved: string): { originalTokens: DiffToken[]; improvedTokens: DiffToken[]; added: number; removed: number } {
  const a = wordsFrom(original);
  const b = wordsFrom(improved);
  const n = a.length;
  const m = b.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const originalTokens: DiffToken[] = [];
  const improvedTokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  let added = 0;
  let removed = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      originalTokens.push({ text: a[i], tag: "common" });
      improvedTokens.push({ text: b[j], tag: "common" });
      i += 1;
      j += 1;
      continue;
    }
    if (dp[i + 1][j] >= dp[i][j + 1]) {
      originalTokens.push({ text: a[i], tag: "removed" });
      removed += 1;
      i += 1;
    } else {
      improvedTokens.push({ text: b[j], tag: "added" });
      added += 1;
      j += 1;
    }
  }
  while (i < n) {
    originalTokens.push({ text: a[i], tag: "removed" });
    removed += 1;
    i += 1;
  }
  while (j < m) {
    improvedTokens.push({ text: b[j], tag: "added" });
    added += 1;
    j += 1;
  }

  return { originalTokens, improvedTokens, added, removed };
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a3.375 3.375 0 1 0 0-6.75 3.375 3.375 0 0 0 0 6.75zM15.375 18.75a3.375 3.375 0 1 0 0-6.75 3.375 3.375 0 0 0 0 6.75zM15.375 12a3.375 3.375 0 1 0 0-6.75 3.375 3.375 0 0 0 0 6.75zM11.54 10.364l1.92 1.272M13.46 5.364l-1.92 1.272M11.54 17.636l1.92-1.272" />
    </svg>
  );
}

const truncateText = (text: string, max = 180) => (text.length > max ? `${text.slice(0, max - 1)}...` : text);

const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      return;
    }
    if (line) lines.push(line);
    line = word;
  });
  if (line) lines.push(line);
  return lines;
};

function renderTokens(tokens: DiffToken[], revealHighlights: boolean, side: "original" | "improved") {
  return tokens.map((token, index) => {
    if (side === "original" && token.tag === "removed") {
      return (
        <span
          key={`${token.text}-${index}`}
          className={[
            "rounded px-0.5 line-through",
            revealHighlights ? "bg-rose-100/80 text-rose-600" : "bg-transparent text-slate-300",
            "transition-colors duration-700",
          ].join(" ")}
        >
          {token.text}
          {" "}
        </span>
      );
    }
    if (side === "improved" && token.tag === "added") {
      return (
        <span
          key={`${token.text}-${index}`}
          className={[
            "rounded px-0.5",
            revealHighlights ? "bg-emerald-100/70 text-emerald-100" : "bg-transparent text-slate-100",
            "transition-colors duration-700",
          ].join(" ")}
        >
          {token.text}
          {" "}
        </span>
      );
    }
    return (
      <span key={`${token.text}-${index}`}>
        {token.text}
        {" "}
      </span>
    );
  });
}

export const BeforeAfterCard = ({
  originalPrompt,
  improvedPrompt,
  wordsBefore,
  wordsAfter,
  overallBefore,
  overallAfter,
  platform = "Other",
  improvedFavourite = false,
  onToggleImprovedFavourite,
  improvedHeartActive = false,
}: BeforeAfterCardProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>("side");
  const [expandMode, setExpandMode] = useState<ExpandMode>(null);
  const [revealHighlights, setRevealHighlights] = useState(false);
  const [copied, setCopied] = useState<"original" | "improved" | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareImage, setShareImage] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    setViewMode(mobile ? "stacked" : "side");
  }, []);

  useEffect(() => {
    setRevealHighlights(false);
    const id = window.setTimeout(() => setRevealHighlights(true), 180);
    return () => window.clearTimeout(id);
  }, [originalPrompt, improvedPrompt]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(null), 1400);
    return () => window.clearTimeout(id);
  }, [copied]);

  const diff = useMemo(
    () => computeDiff(originalPrompt, improvedPrompt),
    [originalPrompt, improvedPrompt],
  );

  const clarityGain = clamp(overallAfter) - clamp(overallBefore);

  const copyPrompt = async (kind: "original" | "improved") => {
    await navigator.clipboard.writeText(kind === "original" ? originalPrompt : improvedPrompt);
    setCopied(kind);
  };

  const showOriginal = expandMode !== "improved";
  const showImproved = expandMode !== "original";

  const buildShareCard = async () => {
    setShareBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setShareBusy(false);
      return;
    }

    const grad = ctx.createLinearGradient(0, 0, 1200, 0);
    grad.addColorStop(0, "#E8F0FE");
    grad.addColorStop(1, "#F3E8FF");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 630);

    // subtle noise texture
    for (let i = 0; i < 1800; i += 1) {
      const x = Math.random() * 1200;
      const y = Math.random() * 630;
      const alpha = Math.random() * 0.05;
      ctx.fillStyle = `rgba(15,23,42,${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }

    ctx.fillStyle = "#111827";
    ctx.font = "700 22px Inter, system-ui, sans-serif";
    ctx.fillText("P", 40, 54);
    ctx.font = "600 20px Inter, system-ui, sans-serif";
    ctx.fillText("PromptFix", 70, 54);

    // platform pill
    const platformText = platform || "Other";
    ctx.font = "600 16px Inter, system-ui, sans-serif";
    const pWidth = ctx.measureText(platformText).width + 34;
    const px = 1200 - pWidth - 40;
    ctx.fillStyle = "rgba(59,130,246,0.14)";
    ctx.beginPath();
    ctx.roundRect(px, 30, pWidth, 34, 17);
    ctx.fill();
    ctx.fillStyle = "#1D4ED8";
    ctx.fillText(platformText, px + 17, 52);

    const cardY = 120;
    const cardH = 360;
    const cardW = 500;
    const leftX = 50;
    const rightX = 650;

    // before card
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "rgba(244,63,94,0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(leftX, cardY, cardW, cardH, 24);
    ctx.fill();
    ctx.stroke();

    // after card
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "rgba(16,185,129,0.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(rightX, cardY, cardW, cardH, 24);
    ctx.fill();
    ctx.stroke();

    ctx.font = "700 15px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#E11D48";
    ctx.fillText("BEFORE", leftX + 26, cardY + 36);
    ctx.fillStyle = "#059669";
    ctx.fillText("AFTER", rightX + 26, cardY + 36);

    ctx.font = "500 22px Inter, system-ui, sans-serif";
    const arrowGrad = ctx.createLinearGradient(570, 0, 630, 0);
    arrowGrad.addColorStop(0, "#3B82F6");
    arrowGrad.addColorStop(1, "#A78BFA");
    ctx.fillStyle = arrowGrad;
    ctx.fillText("→", 588, 310);

    const beforeText = truncateText(originalPrompt, 180);
    const afterText = truncateText(improvedPrompt, 180);
    ctx.font = "500 20px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#111827";
    wrapLines(ctx, beforeText, cardW - 52)
      .slice(0, 6)
      .forEach((line, idx) => {
        ctx.fillText(line, leftX + 26, cardY + 82 + idx * 34);
      });
    wrapLines(ctx, afterText, cardW - 52)
      .slice(0, 6)
      .forEach((line, idx) => {
        ctx.fillText(line, rightX + 26, cardY + 82 + idx * 34);
      });

    // score badges
    ctx.font = "600 16px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(244,63,94,0.14)";
    ctx.beginPath();
    ctx.roundRect(leftX + 24, cardY + cardH - 52, 170, 32, 16);
    ctx.fill();
    ctx.fillStyle = "#BE123C";
    ctx.fillText(`Score: ${clamp(overallBefore).toFixed(1)} / 10`, leftX + 36, cardY + cardH - 31);

    ctx.fillStyle = "rgba(16,185,129,0.16)";
    ctx.beginPath();
    ctx.roundRect(rightX + 24, cardY + cardH - 52, 170, 32, 16);
    ctx.fill();
    ctx.fillStyle = "#047857";
    ctx.fillText(`Score: ${clamp(overallAfter).toFixed(1)} / 10`, rightX + 36, cardY + cardH - 31);

    // bottom strip
    ctx.strokeStyle = "rgba(100,116,139,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 535);
    ctx.lineTo(1160, 535);
    ctx.stroke();

    ctx.font = "500 15px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText("Improved with PromptFix", 45, 574);
    ctx.fillText("promptfix.app", 1018, 574);

    const stats = [
      `${wordsBefore} words`,
      `${wordsAfter} words`,
      `Clarity +${clarityGain.toFixed(1)}`,
    ];
    let sx = 420;
    stats.forEach((s, idx) => {
      const w = ctx.measureText(s).width + 26;
      ctx.fillStyle = idx === 2 ? "rgba(59,130,246,0.15)" : "rgba(148,163,184,0.18)";
      ctx.beginPath();
      ctx.roundRect(sx, 555, w, 30, 15);
      ctx.fill();
      ctx.fillStyle = idx === 2 ? "#2563EB" : "#475569";
      ctx.fillText(s, sx + 13, 575);
      sx += w + 10;
    });

    setShareImage(canvas.toDataURL("image/png"));
    setShareBusy(false);
    setShareOpen(true);
  };

  const downloadShare = () => {
    if (!shareImage) return;
    const a = document.createElement("a");
    a.href = shareImage;
    a.download = "promptfix-improvement.png";
    a.click();
  };

  const shareTwitter = () => {
    const text = `Just improved my prompt from ${clamp(overallBefore).toFixed(1)} to ${clamp(overallAfter).toFixed(1)} with @PromptFix — better prompts, better results. Try it free at promptfix.app`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyImage = async () => {
    if (!shareImage) return;
    const blob = await (await fetch(shareImage)).blob();
    if ("share" in navigator && "canShare" in navigator && navigator.canShare?.({ files: [new File([blob], "promptfix-improvement.png", { type: "image/png" })] })) {
      await navigator.share({
        files: [new File([blob], "promptfix-improvement.png", { type: "image/png" })],
        title: "Prompt improvement",
      });
      return;
    }
    if ("ClipboardItem" in window) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    }
  };

  const Section = ({
    kind,
    title,
    tone,
    tokens,
    footerWords,
    footerScore,
  }: {
    kind: "original" | "improved";
    title: string;
    tone: "red" | "green";
    tokens: DiffToken[];
    footerWords: number;
    footerScore: number;
  }) => (
    <div className="flex h-full min-h-[220px] flex-col">
      <div className="mb-2 flex items-center justify-between">
        <p className={["flex items-center gap-2 text-sm font-semibold", tone === "red" ? "text-rose-500" : "text-emerald-500"].join(" ")}>
          <span className={["h-2 w-2 rounded-full", tone === "red" ? "bg-rose-300" : "bg-emerald-300"].join(" ")} />
          {title}
        </p>
        <button
          type="button"
          onClick={() => setExpandMode((prev) => (prev === kind ? null : kind))}
          className="rounded-full border border-[#D1D1D6] bg-white px-2 py-1 text-[11px] text-[#636366]"
        >
          <span className="inline-flex items-center gap-1">
            <ExpandIcon />
            {expandMode === kind ? "Collapse" : "Expand"}
          </span>
        </button>
        {kind === "improved" && onToggleImprovedFavourite ? (
          <button
            type="button"
            onClick={onToggleImprovedFavourite}
            className={[
              "ml-1 rounded-full p-1 transition-all",
              improvedHeartActive ? "heart-pop" : "",
              improvedFavourite ? "text-rose-500" : "text-[#8E8E93]",
            ].join(" ")}
            title={improvedFavourite ? "Remove from favourites" : "Save to favourites"}
          >
            <svg viewBox="0 0 24 24" fill={improvedFavourite ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.5c0 6.5-9 11.5-9 11.5S3 15 3 8.5A5.5 5.5 0 018.5 3c1.86 0 3.54.92 4.5 2.33A5.5 5.5 0 0117.5 3 5.5 5.5 0 0123 8.5z" />
            </svg>
          </button>
        ) : null}
      </div>
      <div className="flex-1 overflow-auto rounded-xl border border-white/10 bg-[rgba(30,30,34,0.92)] p-3 text-sm leading-7 text-slate-100">
        {renderTokens(tokens, revealHighlights, kind)}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-[#8E8E93]">
          <span>{footerWords} words</span>
          <span className={["rounded-full border px-2 py-0.5 font-semibold", tone === "red" ? "border-rose-200 bg-rose-50 text-rose-600" : "border-emerald-200 bg-emerald-50 text-emerald-600"].join(" ")}>
            Score: {clamp(footerScore).toFixed(1)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void copyPrompt(kind)}
          className={["rounded-full px-3 py-1.5 text-xs font-semibold", kind === "improved" ? "bg-gradient-to-r from-[#3B82F6] to-[#A78BFA] text-white" : "border border-[#D1D1D6] bg-white text-[#636366]"].join(" ")}
        >
          {copied === kind ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );

  return (
    <article className="debug-result-card rounded-2xl border border-[#E5E5EA] bg-white/75 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#1C1C1E]">Before and After</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void buildShareCard()}
            className="rounded-full p-2 text-[#8E8E93] transition hover:text-[#3B82F6]"
            title="Share as Card"
          >
            <ShareIcon />
          </button>
          <div className="inline-flex rounded-full border border-[#D1D1D6] bg-white p-1 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => {
              setExpandMode(null);
              setViewMode("side");
            }}
            className={["rounded-full px-2.5 py-1 transition", viewMode === "side" ? "bg-blue-100 text-blue-700" : "text-[#636366]"].join(" ")}
          >
            Side by Side
          </button>
          <button
            type="button"
            onClick={() => {
              setExpandMode(null);
              setViewMode("stacked");
            }}
            className={["rounded-full px-2.5 py-1 transition", viewMode === "stacked" ? "bg-blue-100 text-blue-700" : "text-[#636366]"].join(" ")}
          >
            Stacked
          </button>
          </div>
        </div>
      </div>

      {viewMode === "side" ? (
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
          {showOriginal ? (
            <Section
              kind="original"
              title="Original Prompt"
              tone="red"
              tokens={diff.originalTokens}
              footerWords={wordsBefore}
              footerScore={overallBefore}
            />
          ) : null}

          {showOriginal && showImproved ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[#E5E5EA] bg-white/85 px-2 text-center">
              <span className="text-xs font-semibold text-emerald-600">↑ {diff.added} added</span>
              <span className="text-xs font-semibold text-rose-500">↓ {diff.removed} removed</span>
              <span className="text-xs font-semibold text-blue-600">+{clarityGain.toFixed(1)} points</span>
            </div>
          ) : null}

          {showImproved ? (
            <div className={showOriginal ? "border-l border-[#E5E5EA] pl-3" : ""}>
              <Section
                kind="improved"
                title="Improved Prompt"
                tone="green"
                tokens={diff.improvedTokens}
                footerWords={wordsAfter}
                footerScore={overallAfter}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {showOriginal ? (
            <Section
              kind="original"
              title="Original Prompt"
              tone="red"
              tokens={diff.originalTokens}
              footerWords={wordsBefore}
              footerScore={overallBefore}
            />
          ) : null}

          {showOriginal && showImproved ? (
            <div className="rounded-xl border border-[#E5E5EA] bg-white/85 px-3 py-2 text-center">
              <p className="text-xs text-[#8E8E93]">↓</p>
              <div className="mt-1 flex items-center justify-center gap-3 text-xs font-semibold">
                <span className="text-emerald-600">↑ {diff.added} added</span>
                <span className="text-rose-500">↓ {diff.removed} removed</span>
                <span className="text-blue-600">+{clarityGain.toFixed(1)} points</span>
              </div>
            </div>
          ) : null}

          {showImproved ? (
            <Section
              kind="improved"
              title="Improved Prompt"
              tone="green"
              tokens={diff.improvedTokens}
              footerWords={wordsAfter}
              footerScore={overallAfter}
            />
          ) : null}
        </div>
      )}

      {shareOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[480px] rounded-3xl border border-white/70 bg-white/90 p-5 shadow-[0_24px_50px_rgba(28,28,30,0.22)] backdrop-blur-xl">
            <h3 className="text-lg font-semibold text-[#1C1C1E]">Share Your Improvement</h3>
            <div className="mt-3 overflow-hidden rounded-2xl border border-[#E5E5EA] bg-white">
              {shareBusy ? (
                <div className="flex h-52 items-center justify-center text-sm text-[#636366]">Generating image...</div>
              ) : shareImage ? (
                <img src={shareImage} alt="Share preview" className="h-auto w-full" />
              ) : null}
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={downloadShare}
                className="w-full rounded-full border border-[#D1D1D6] bg-white px-4 py-2 text-sm font-semibold text-[#1C1C1E]"
              >
                Download Image
              </button>
              <button
                type="button"
                onClick={shareTwitter}
                className="w-full rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Share to Twitter
              </button>
              <button
                type="button"
                onClick={() => void copyImage()}
                className="w-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#A78BFA] px-4 py-2 text-sm font-semibold text-white"
              >
                Copy Image
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShareOpen(false)}
              className="mt-3 block w-full text-center text-sm text-[#636366] hover:text-[#1C1C1E]"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
};
