import { Link } from "react-router-dom";
import { useState, useEffect, type CSSProperties } from "react";
import { useScrollReveal } from "../hooks/useScrollReveal";

// ─── Grain texture SVG (inline) ───────────────────────────────────────────────

const GrainOverlay = () => (
  <svg
    className="pointer-events-none fixed inset-0 z-[1] h-full w-full opacity-[0.035]"
    xmlns="http://www.w3.org/2000/svg"
  >
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#grain)" />
  </svg>
);

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(15,23,42,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "none",
      }}
    >
      <div className="landing-nav-enter mx-auto flex max-w-6xl items-center justify-between px-4 py-3 max-[260px]:px-2.5">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 max-[260px]:gap-1.5">
          <span className="brand-wordmark text-[20px] font-bold text-white">Prompt Fix</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 min-[1041px]:flex">
          {["Features", "Use Cases", "How It Works", "Pricing"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-[14px] font-medium text-[#94A3B8] transition hover:text-white"
            >
              {item}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 min-[1041px]:flex">
          <Link
            to="/login"
            className="rounded-full px-4 py-1.5 text-[14px] font-medium text-[#94A3B8] transition hover:text-white"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-full px-5 py-1.5 text-[14px] font-semibold text-white transition hover:opacity-90 active:scale-[0.97]"
            style={{ background: "linear-gradient(135deg,#3B82F6,#6366F1)" }}
          >
            Try Free
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[#94A3B8] transition hover:text-white min-[1041px]:hidden max-[260px]:h-9 max-[260px]:w-9"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      <div
          className={[
          "overflow-hidden px-4 transition-all duration-300 ease-out min-[1041px]:hidden max-[260px]:px-2.5",
          mobileOpen
            ? "max-h-[340px] translate-y-0 border-t border-white/10 py-4 opacity-100"
            : "max-h-0 -translate-y-2 border-t border-transparent py-0 opacity-0",
        ].join(" ")}
        style={{ background: "rgba(15,23,42,0.95)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
        aria-hidden={!mobileOpen}
      >
        <nav className="flex flex-col gap-4">
          {["Features", "Use Cases", "How It Works", "Pricing"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-[15px] font-medium text-[#94A3B8] transition hover:text-white max-[260px]:text-[14px]"
              onClick={() => setMobileOpen(false)}
            >
              {item}
            </a>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-4">
              <Link to="/login" className="py-2 text-center text-[15px] font-medium text-[#94A3B8] max-[260px]:text-[14px]">
              Log in
            </Link>
            <Link
              to="/signup"
                className="rounded-full py-2.5 text-center text-[15px] font-semibold text-white max-[260px]:py-2 max-[260px]:text-[14px]"
              style={{ background: "linear-gradient(135deg,#3B82F6,#6366F1)" }}
            >
              Try Free
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

const PREVIEW_DEVICE_MODES = [
  {
    label: "Mobile",
    maxW: "max-w-[260px]",
    frame: "rounded-[2.25rem] border-[3px] border-white/15 p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
    notch: true,
  },
  {
    label: "Tablet",
    maxW: "max-w-[440px]",
    frame: "rounded-[1.75rem] border-[3px] border-white/15 p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
    notch: false,
  },
  {
    label: "Desktop",
    maxW: "max-w-full",
    frame: "rounded-xl border border-white/12 p-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]",
    notch: false,
  },
] as const;

/** Landing hero device carousel — mobile / tablet / desktop screenshots */
const PREVIEW_IMAGES = [
  "/preview-improve-mobile.png",
  "/preview-improve-tablet.png",
  "/preview-improve-desktop.png",
] as const;

const PREVIEW_ALT: readonly string[] = [
  "Prompt Fix — Improve My Prompt on mobile",
  "Prompt Fix — Improve My Prompt on tablet",
  "Prompt Fix — Improve My Prompt on desktop",
];

function Hero() {
  const [previewIndex, setPreviewIndex] = useState(0);
  /** If the device screenshot fails to load, fall back once to the generic hero asset */
  const [previewSrcFallback, setPreviewSrcFallback] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPreviewIndex((i) => (i + 1) % PREVIEW_DEVICE_MODES.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setPreviewSrcFallback(null);
  }, [previewIndex]);

  const previewImgSrc = previewSrcFallback ?? PREVIEW_IMAGES[previewIndex];

  return (
    <section className="relative overflow-hidden px-6 pb-16 pt-28" style={{ background: "#0f172a" }}>
      <div
        className="pointer-events-none absolute left-1/3 top-1/3 z-[1] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[120px]"
        style={{ background: "radial-gradient(circle,#3B82F6 0%,transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute bottom-1/4 right-1/4 z-[1] h-[400px] w-[400px] rounded-full opacity-15 blur-[100px]"
        style={{ background: "radial-gradient(circle,#A78BFA 0%,transparent 70%)" }}
      />

      <div className="relative z-[2] mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="text-center lg:text-left">
          <div
            className="reveal-child mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1.5 text-[13px] font-medium text-[#94A3B8]"
            style={
              {
                "--reveal-delay": "0ms",
                background: "rgba(255,255,255,0.05)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              } as CSSProperties
            }
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#34D399]" />
            Stop guessing. Start shipping better AI outputs.
          </div>

          <h1
            className="reveal-child font-syne mb-6 text-balance-soft text-4xl font-bold text-white sm:text-5xl lg:text-[64px]"
            style={{ "--reveal-delay": "90ms" } as CSSProperties}
          >
            Turn rough ideas into prompts that
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg,#60A5FA,#A78BFA,#F472B6)" }}
            >
              get real results.
            </span>
          </h1>

          <p
            className="reveal-child font-dm mb-10 max-w-xl text-[16px] leading-relaxed text-[#94A3B8] sm:text-[18px] lg:mx-0"
            style={{ "--reveal-delay": "170ms" } as CSSProperties}
          >
            Prompt Fix rewrites vague prompts into clear, high-converting instructions for ChatGPT, Claude,
            Cursor, and more. Save time, avoid bad outputs, and get to the finish line faster.
          </p>

          <div
            className="reveal-child mb-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start"
            style={{ "--reveal-delay": "250ms" } as CSSProperties}
          >
            <Link
              to="/signup"
              className="rounded-full px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_4px_24px_rgba(59,130,246,0.4)] transition hover:opacity-90 active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg,#3B82F6,#6366F1)" }}
            >
              Get better prompts free →
            </Link>
            <a
              href="#how-it-works"
              className="rounded-full border border-white/15 px-8 py-3.5 text-[15px] font-semibold text-white transition hover:border-white/30 hover:bg-white/5 active:scale-[0.97]"
            >
              See 4-step workflow
            </a>
          </div>
        </div>

        <div
          className="reveal-child rounded-3xl border border-white/15 p-3 shadow-[0_18px_45px_rgba(3,7,18,0.45)]"
          style={
            {
              "--reveal-delay": "140ms",
              background: "rgba(15,23,42,0.68)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            } as CSSProperties
          }
        >
          <div className="mb-3 flex items-center justify-center gap-2">
            {PREVIEW_DEVICE_MODES.map((mode, i) => (
              <button
                key={mode.label}
                type="button"
                onClick={() => setPreviewIndex(i)}
                className={[
                  "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition",
                  previewIndex === i
                    ? "bg-white/15 text-white ring-1 ring-white/25"
                    : "text-[#64748B] hover:bg-white/5 hover:text-[#94A3B8]",
                ].join(" ")}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div
            className={[
              "mx-auto w-full transition-[max-width] duration-700 ease-in-out",
              PREVIEW_DEVICE_MODES[previewIndex].maxW,
            ].join(" ")}
          >
            <div
              className={[
                "overflow-hidden bg-[#0f172a] transition-[border-radius,padding] duration-700 ease-in-out",
                PREVIEW_DEVICE_MODES[previewIndex].frame,
              ].join(" ")}
            >
              {PREVIEW_DEVICE_MODES[previewIndex].notch ? (
                <div className="mx-auto mb-2 h-5 w-[38%] max-w-[120px] rounded-full bg-black/40" aria-hidden />
              ) : null}
              <img
                key={previewImgSrc}
                src={previewImgSrc}
                onError={() => {
                  if (!previewSrcFallback) setPreviewSrcFallback("/hero-improve.png");
                  else if (previewSrcFallback === "/hero-improve.png") {
                    setPreviewSrcFallback(
                      "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1200&q=80",
                    );
                  }
                }}
                alt={PREVIEW_ALT[previewIndex] ?? "Prompt Fix workspace preview"}
                className={[
                  "h-auto w-full border border-white/10 object-cover object-top transition-[border-radius] duration-700",
                  previewIndex === 0 ? "rounded-2xl" : previewIndex === 1 ? "rounded-xl" : "rounded-lg",
                ].join(" ")}
                draggable="false"
              />
            </div>
          </div>
          <p className="px-2 pb-1 pt-3 text-center text-xs font-medium text-[#94A3B8]">
            Cycles through mobile, tablet, and desktop — tap a label to jump
          </p>
        </div>
      </div>

      <div className="relative z-[2] mx-auto mt-8 flex w-full max-w-6xl flex-wrap items-center justify-center gap-8">
        {[
          { value: "50K+", label: "Prompts improved" },
          { value: "3x", label: "Faster iteration" },
          { value: "10+", label: "AI platforms supported" },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className="reveal-child text-center"
            style={{ "--reveal-delay": `${320 + i * 80}ms` } as CSSProperties}
          >
            <p className="font-syne text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-[12px] text-[#64748B]">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Trust Strip ──────────────────────────────────────────────────────────────

function TrustStrip() {
  const platforms = [
    "ChatGPT", "Claude", "Cursor", "Gemini", "Copilot",
    "Midjourney", "Bolt", "v0", "Replit", "Lovable",
  ];

  return (
    <section className="border-y border-white/5 bg-[#0f172a] px-6 py-16">
      <div className="mx-auto max-w-4xl text-center">
        <p
          className="reveal-child font-syne mb-3 text-xl font-bold text-white sm:text-2xl"
          style={{ "--reveal-delay": "0ms" } as CSSProperties}
        >
          Works with the AI tools you already use
        </p>
        <p
          className="reveal-child font-dm mb-10 text-[15px] text-[#64748B]"
          style={{ "--reveal-delay": "80ms" } as CSSProperties}
        >
          One rewrite engine for coding, design, content, and product work. Paste once, perform better everywhere.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {platforms.map((p, i) => (
            <span
              key={p}
              className="reveal-child rounded-full border border-white/10 px-4 py-1.5 text-[13px] font-medium text-[#94A3B8] transition hover:border-white/20 hover:text-white"
              style={
                {
                  "--reveal-delay": `${140 + i * 35}ms`,
                  background: "rgba(255,255,255,0.04)",
                } as CSSProperties
              }
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features Grid ────────────────────────────────────────────────────────────

function FeaturesGrid() {
  const features = [
    {
      icon: "✦",
      iconBg: "rgba(59,130,246,0.15)",
      iconColor: "#60A5FA",
      title: "Instant Rewrite",
      desc: "Paste any rough prompt and get a clear, structured version in seconds, tuned for your exact platform.",
    },
    {
      icon: "◈",
      iconBg: "rgba(167,139,250,0.15)",
      iconColor: "#A78BFA",
      title: "3 Alternatives",
      desc: "Get three winning variations instantly so you can choose the style that performs best.",
    },
    {
      icon: "⬡",
      iconBg: "rgba(52,211,153,0.15)",
      iconColor: "#34D399",
      title: "Platform-Aware",
      desc: "Built for ChatGPT, Claude, Cursor, Replit, and more, with output style tailored to each tool.",
    },
    {
      icon: "⊛",
      iconBg: "rgba(244,114,182,0.15)",
      iconColor: "#F472B6",
      title: "Debug Mode",
      desc: "See why a prompt fails, then get a targeted rewrite that fixes the issue fast.",
    },
    {
      icon: "◉",
      iconBg: "rgba(251,191,36,0.15)",
      iconColor: "#FBBF24",
      title: "Template Library",
      desc: "Start faster with proven templates for landing pages, APIs, UI components, bug fixes, and more.",
    },
    {
      icon: "⊕",
      iconBg: "rgba(99,102,241,0.15)",
      iconColor: "#818CF8",
      title: "Session History",
      desc: "Every improved prompt is saved, searchable, and ready to reuse when you need it.",
    },
  ];

  return (
    <section id="features" className="bg-[#0f172a] px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <p
            className="reveal-child font-dm mb-3 text-[13px] font-semibold uppercase tracking-widest text-[#3B82F6]"
            style={{ "--reveal-delay": "0ms" } as CSSProperties}
          >
            Features
          </p>
          <h2
            className="reveal-child font-syne mb-4 text-3xl font-bold text-white sm:text-4xl"
            style={{ "--reveal-delay": "70ms" } as CSSProperties}
          >
            Everything you need to prompt like a pro
          </h2>
          <p
            className="reveal-child font-dm mx-auto max-w-xl text-[16px] text-[#64748B]"
            style={{ "--reveal-delay": "140ms" } as CSSProperties}
          >
            Cut rework, reduce failed outputs, and create stronger prompts in seconds.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="reveal-child rounded-2xl border border-white/[0.07] p-6 transition-all duration-200 hover:border-white/15 hover-lift-soft"
              style={
                {
                  "--reveal-delay": `${200 + i * 55}ms`,
                  background: "rgba(30,41,59,0.6)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                } as CSSProperties
              }
            >
              <div
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                style={{ background: f.iconBg, color: f.iconColor }}
              >
                {f.icon}
              </div>
              <h3 className="font-syne mb-2 text-[15px] font-bold text-white">{f.title}</h3>
              <p className="font-dm text-[13px] leading-relaxed text-[#64748B]">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Use Cases ────────────────────────────────────────────────────────────────

function UseCases() {
  const cases = [
    {
      num: "01",
      title: "Vibe coding with Cursor or Bolt",
      desc: "Turn rough feature ideas into context-rich prompts that generate cleaner code on the first pass.",
    },
    {
      num: "02",
      title: "UI generation with v0 or Lovable",
      desc: "Describe your component in plain language, and get a structured spec these tools can execute reliably.",
    },
    {
      num: "03",
      title: "Image prompting for Midjourney",
      desc: "Add style, composition, lighting, and mood modifiers automatically. Get better visual outputs faster.",
    },
    {
      num: "04",
      title: "API integrations and backend code",
      desc: "Generate security-aware backend prompts with auth, validation, error handling, and edge cases baked in.",
    },
  ];

  return (
    <section id="use-cases" className="bg-[#080f1e] px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <p
            className="reveal-child font-dm mb-3 text-[13px] font-semibold uppercase tracking-widest text-[#A78BFA]"
            style={{ "--reveal-delay": "0ms" } as CSSProperties}
          >
            Use Cases
          </p>
          <h2
            className="reveal-child font-syne mb-4 text-3xl font-bold text-white sm:text-4xl"
            style={{ "--reveal-delay": "70ms" } as CSSProperties}
          >
            Built for how modern teams actually ship
          </h2>
          <p
            className="reveal-child font-dm mx-auto max-w-xl text-[16px] text-[#64748B]"
            style={{ "--reveal-delay": "140ms" } as CSSProperties}
          >
            From quick prototypes to production releases, Prompt Fix helps you move with confidence.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {cases.map((c, i) => (
              <div
                key={c.num}
                className="reveal-child rounded-2xl border border-white/[0.07] p-6 hover-lift-soft"
                style={
                  {
                    "--reveal-delay": `${180 + i * 70}ms`,
                    background: "rgba(30,41,59,0.5)",
                  } as CSSProperties
                }
              >
                <p
                  className="font-syne mb-3 text-3xl font-extrabold"
                  style={{ color: "rgba(255,255,255,0.08)" }}
                >
                  {c.num}
                </p>
                <h3 className="font-syne mb-2 text-[15px] font-bold text-white">{c.title}</h3>
                <p className="font-dm text-[13px] leading-relaxed text-[#64748B]">{c.desc}</p>
              </div>
            ))}
          </div>

          {/* Image */}
          <div
            className="reveal-child hidden overflow-hidden rounded-2xl border border-white/[0.07] lg:block"
            style={
              {
                "--reveal-delay": "260ms",
                backgroundImage:
                  "url(https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80)",
                backgroundSize: "cover",
                backgroundPosition: "center",
                minHeight: "360px",
              } as CSSProperties
            }
          >
            <div className="h-full w-full" style={{ background: "rgba(8,15,30,0.45)" }} />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const [activeTab, setActiveTab] = useState(0);

  const steps = [
    {
      num: "1",
      title: "Paste your prompt",
      desc: "Drop in whatever you have: notes, fragments, or one-liners. No cleanup needed.",
    },
    {
      num: "2",
      title: "Choose your platform",
      desc: "Select where you are sending it: ChatGPT, Claude, Cursor, Replit, and more.",
    },
    {
      num: "3",
      title: "Pick a prompt type",
      desc: "Choose the job to be done: build, fix, API, design, content, ideas, or refactor.",
    },
    {
      num: "4",
      title: "Get your improved prompt",
      desc: "Get one polished rewrite plus three alternatives you can copy and use immediately.",
    },
  ];

  const tabs = [
    {
      label: "Prompt Improvement",
      preview:
        "Your rough idea becomes a sharp, platform-optimized prompt designed to produce better outputs on the first try.",
    },
    {
      label: "Code Debugging",
      preview:
        "Paste a weak or broken prompt and get root-cause analysis with a targeted rewrite you can use right away.",
    },
    {
      label: "Saved Library",
      preview:
        "Every improved prompt is saved automatically. Search, filter, and reuse your best performers anytime.",
    },
  ];

  return (
    <section id="how-it-works" className="bg-[#0f172a] px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <p
            className="reveal-child font-dm mb-3 text-[13px] font-semibold uppercase tracking-widest text-[#34D399]"
            style={{ "--reveal-delay": "0ms" } as CSSProperties}
          >
            How It Works
          </p>
          <h2
            className="reveal-child font-syne mb-4 text-3xl font-bold text-white sm:text-4xl"
            style={{ "--reveal-delay": "70ms" } as CSSProperties}
          >
            From messy draft to high-performing prompt in four steps
          </h2>
          <p
            className="reveal-child font-dm mx-auto max-w-xl text-[16px] text-[#64748B]"
            style={{ "--reveal-delay": "140ms" } as CSSProperties}
          >
            No prompt-engineering background required. Paste what you have and let Prompt Fix do the heavy lifting.
          </p>
        </div>

        {/* Step flow */}
        <div
          className="reveal-child mb-10 rounded-2xl border border-white/[0.07] p-6 sm:p-8"
          style={{ "--reveal-delay": "180ms", background: "rgba(30,41,59,0.5)" } as CSSProperties}
        >
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <div
                key={step.num}
                className="reveal-child relative"
                style={{ "--reveal-delay": `${220 + i * 70}ms` } as CSSProperties}
              >
                {i < steps.length - 1 && (
                  <div className="absolute right-0 top-5 hidden h-px w-full translate-x-1/2 bg-white/10 lg:block" />
                )}
                <div
                  className="mb-3 flex h-10 w-10 items-center justify-center rounded-full font-syne text-[15px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#3B82F6,#6366F1)" }}
                >
                  {step.num}
                </div>
                <h3 className="font-syne mb-1.5 text-[14px] font-bold text-white">{step.title}</h3>
                <p className="font-dm text-[12px] leading-relaxed text-[#64748B]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tab strip */}
        <div
          className="reveal-child flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ "--reveal-delay": "480ms" } as CSSProperties}
        >
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActiveTab(i)}
              className={[
                "shrink-0 rounded-full border px-4 py-2 text-[13px] font-medium transition-all duration-150",
                activeTab === i
                  ? "border-[#3B82F6] bg-[#3B82F6] text-white"
                  : "border-white/10 bg-white/5 text-[#64748B] hover:text-white",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          className="reveal-child mt-4 rounded-2xl border border-white/[0.07] p-6"
          style={{ "--reveal-delay": "540ms", background: "rgba(30,41,59,0.5)" } as CSSProperties}
        >
          <p className="font-dm text-[15px] leading-relaxed text-[#94A3B8]">
            {tabs[activeTab].preview}
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function PricingSection() {
  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "/mo",
      billed: "Billed $0/year",
      savings: "Best for exploring the product",
      cta: "Start Free",
      desc: "For personal projects and getting started.",
      features: [
        "10 prompt improvements/month",
        "3 alternatives per improvement",
        "5 saved prompts",
        "Basic platform targeting",
      ],
      highlight: false,
    },
    {
      name: "Pro",
      price: "$7.99",
      period: "/mo",
      billed: "Billed $95.88/year",
      savings: "Best for power users who rely on AI daily",
      cta: "Subscribe to Pro",
      desc: "For power users who rely on AI daily.",
      features: [
        "Unlimited prompt improvements",
        "3 alternatives per improvement",
        "Unlimited saved prompts",
        "All platform targeting",
        "Debug Mode",
        "Template Library access",
        "Session history",
        "Priority support",
      ],
      highlight: true,
    },
    {
      name: "Custom",
      price: "$27.99",
      period: "/mo",
      billed: "Billed $279/year",
      savings: "Save $56.88/year vs monthly",
      cta: "Contact Sales",
      desc: "For teams that need more control and scale.",
      features: [
        "Everything in Pro",
        "Custom prompt templates",
        "Team workspaces",
        "API access",
        "SSO & advanced security",
        "SLA & dedicated support",
        "Custom integrations",
        "Volume pricing",
      ],
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="bg-[#050b18] px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <p
            className="reveal-child font-dm mb-3 text-[13px] font-semibold uppercase tracking-widest text-[#F472B6]"
            style={{ "--reveal-delay": "0ms" } as CSSProperties}
          >
            Pricing
          </p>
          <h2
            className="reveal-child font-syne mb-4 text-3xl font-bold text-white sm:text-4xl"
            style={{ "--reveal-delay": "70ms" } as CSSProperties}
          >
            Choose your plan and ship faster
          </h2>
          <p
            className="reveal-child font-dm mx-auto max-w-xl text-[16px] text-[#64748B]"
            style={{ "--reveal-delay": "140ms" } as CSSProperties}
          >
            Start free in seconds, then upgrade when Prompt Fix becomes part of your daily workflow.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              className="reveal-child relative mx-auto flex min-h-[560px] w-full max-w-[360px] flex-col rounded-3xl border p-6 hover-lift-soft md:min-h-[620px]"
              style={
                {
                  "--reveal-delay": `${200 + i * 90}ms`,
                  background: "linear-gradient(180deg, rgba(9,14,29,0.96), rgba(8,13,26,0.92))",
                  borderColor: plan.highlight
                    ? "rgba(255,255,255,0.28)"
                    : "rgba(255,255,255,0.09)",
                  boxShadow: plan.highlight
                    ? "0 0 0 1px rgba(255,255,255,0.18), 0 20px 46px rgba(0,0,0,0.42)"
                    : "0 12px 34px rgba(0,0,0,0.28)",
                } as CSSProperties
              }
            >
              {plan.highlight && (
                <div
                  className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-white px-4 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#111827]"
                >
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <p className={["font-syne mb-1 text-[14px] font-bold uppercase tracking-[0.2em]", plan.highlight ? "text-[#3B82F6]" : "text-[#94A3B8]"].join(" ")}>
                  {plan.name}
                </p>
                <p className="font-dm mb-4 text-[13px] text-[#64748B]">{plan.desc}</p>

                {/* Price stack — matches reference: dominant $, muted /mo, white billed line, blue savings */}
                <div className="mt-1 flex w-full max-w-[240px] flex-col items-start">
                  <div className="flex items-baseline gap-1 leading-none">
                    <span className="font-syne text-[2rem] font-extrabold text-white sm:text-[2.2rem]">$</span>
                    <span
                      className="font-syne text-[2.65rem] font-black tracking-[-0.015em] text-white sm:text-[2.9rem]"
                      style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
                    >
                      {plan.price.replace("$", "")}
                    </span>
                    <span className="font-dm mb-0.5 text-[13px] font-medium text-[#94A3B8]">{plan.period}</span>
                  </div>
                  <p className="font-dm mt-2 text-[14px] font-normal leading-snug text-white">{plan.billed}</p>
                  <p
                    className={[
                      "font-dm mt-1 text-[12px] leading-snug",
                      plan.savings.startsWith("Save ") ? "font-medium text-[#3B82F6]" : "text-[#64748B]",
                    ].join(" ")}
                  >
                    {plan.savings}
                  </p>
                </div>
              </div>

              <Link
                to={plan.name === "Custom" ? "/login" : "/signup"}
                className="mb-6 block w-full rounded-xl py-3 text-center text-[17px] font-bold text-white transition hover:brightness-105 active:scale-[0.98]"
                style={{
                  background: plan.highlight
                    ? "linear-gradient(135deg,#3B82F6,#6366F1)"
                    : "linear-gradient(135deg,rgba(59,130,246,0.24),rgba(99,102,241,0.24))",
                  border: "1px solid rgba(96,165,250,0.35)",
                }}
              >
                {plan.cta}
              </Link>

              <ul className="mb-8 flex flex-col gap-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#60A5FA"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    <span className="font-dm text-[15px] text-[#E2E8F0]">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer CTA Banner ────────────────────────────────────────────────────────

function FooterCTA() {
  return (
    <section className="relative overflow-hidden bg-[#0f172a] px-6 py-24">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute left-1/4 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full opacity-20 blur-[100px]"
          style={{ background: "radial-gradient(circle,#3B82F6,transparent 70%)" }}
        />
        <div
          className="absolute right-1/4 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full opacity-15 blur-[100px]"
          style={{ background: "radial-gradient(circle,#A78BFA,transparent 70%)" }}
        />
      </div>

      <div className="relative z-[1] mx-auto max-w-2xl text-center">
        <h2
          className="reveal-child font-syne mb-4 text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl"
          style={{ "--reveal-delay": "0ms" } as CSSProperties}
        >
          Better prompts. Better outputs. Faster shipping.
        </h2>
        <p
          className="reveal-child font-dm mb-10 text-[16px] text-[#64748B]"
          style={{ "--reveal-delay": "90ms" } as CSSProperties}
        >
          Start free and turn every rough prompt into high-quality results.
        </p>
        <Link
          to="/signup"
          className="reveal-child inline-block rounded-full px-10 py-4 text-[16px] font-bold text-white shadow-[0_4px_32px_rgba(59,130,246,0.45)] transition hover:opacity-90 active:scale-[0.97]"
          style={
            {
              "--reveal-delay": "180ms",
              background: "linear-gradient(135deg,#3B82F6,#6366F1)",
            } as CSSProperties
          }
        >
          Start improving prompts →
        </Link>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  const supportEmail = "hello@promptfix.ai";
  const zoomCallUrl = "https://zoom.us/";
  const socialLinks = [
    { name: "X / Twitter", href: "https://x.com/promptfixai" },
    { name: "GitHub", href: "https://github.com/promptfix-ai" },
    { name: "Discord", href: "https://discord.gg/promptfix" },
    { name: "Instagram", href: "https://instagram.com/promptfixai" },
    { name: "TikTok", href: "https://tiktok.com/@promptfixai" },
  ] as const;

  return (
    <footer className="border-t border-white/[0.06] bg-[#080f1e] px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[16px] font-bold text-white">Need help with <span className="brand-wordmark">Prompt Fix</span>?</p>
              <p className="font-dm mt-1 text-[13px] text-[#94A3B8]">
                Reply within 24 hours. Tell us your use case and we will help you get better outputs fast.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <a
                href={`mailto:${supportEmail}?subject=Prompt%20Fix%20Support`}
                className="rounded-full bg-gradient-to-r from-[#34D399] to-[#10B981] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(16,185,129,0.25)] transition hover:brightness-105"
              >
                Email Support
              </a>
              <a
                href={zoomCallUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/10"
              >
                Book a 15-min call
              </a>
            </div>
          </div>
        </div>

        <div className="mb-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{ background: "linear-gradient(135deg,#3B82F6,#A78BFA)" }}
              >
                P
              </div>
              <span className="brand-wordmark text-[15px] font-bold text-white">Prompt Fix</span>
            </div>
            <p className="font-dm text-[13px] leading-relaxed text-[#475569]">
              AI-powered prompt improvement for developers and builders.
            </p>
            <a
              href={`mailto:${supportEmail}`}
              className="font-dm mt-3 inline-block text-[13px] font-medium text-[#34D399] transition hover:text-[#6EE7B7]"
            >
              {supportEmail}
            </a>
          </div>

          {/* Product */}
          <div>
            <p className="font-syne mb-3 text-[12px] font-bold uppercase tracking-widest text-[#475569]">
              Product
            </p>
            <ul className="flex flex-col gap-2">
              {[
                { label: "Features", href: "#features" },
                { label: "Pricing", href: "#pricing" },
                { label: "Use Cases", href: "#use-cases" },
                { label: "How It Works", href: "#how-it-works" },
              ].map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="font-dm text-[13px] text-[#64748B] transition hover:text-white">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Developers */}
          <div>
            <p className="font-syne mb-3 text-[12px] font-bold uppercase tracking-widest text-[#475569]">
              Developers
            </p>
            <ul className="flex flex-col gap-2">
              {[
                { label: "GitHub", href: socialLinks[1].href, external: true },
                { label: "Status", href: "https://status.promptfix.ai", external: true },
                { label: "API Reference", href: "https://docs.promptfix.ai/api", external: true },
                { label: "Documentation", href: "https://docs.promptfix.ai", external: true },
              ].map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    target={l.external ? "_blank" : undefined}
                    rel={l.external ? "noreferrer noopener" : undefined}
                    className="font-dm text-[13px] text-[#64748B] transition hover:text-white"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="font-syne mb-3 text-[12px] font-bold uppercase tracking-widest text-[#475569]">
              Company
            </p>
            <ul className="flex flex-col gap-2">
              {[
                { label: "Contact", href: `mailto:${supportEmail}` },
                { label: "Blog", href: "https://promptfix.ai/blog" },
                { label: "Careers", href: "https://promptfix.ai/careers" },
                { label: "About", href: "https://promptfix.ai/about" },
              ].map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="font-dm text-[13px] text-[#64748B] transition hover:text-white">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-8 sm:flex-row">
          <p className="font-dm text-[12px] text-[#475569]">
            © 2025 Prompt Fix. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="https://promptfix.ai/privacy" className="font-dm text-[12px] text-[#475569] transition hover:text-white">
              Privacy
            </a>
            <a href="https://promptfix.ai/terms" className="font-dm text-[12px] text-[#475569] transition hover:text-white">
              Terms
            </a>
            {/* Social icons */}
            <div className="flex items-center gap-3">
              {/* X / Twitter */}
              <a
                href={socialLinks[0].href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[#475569] transition hover:text-white"
                aria-label={socialLinks[0].name}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.733-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              {/* GitHub */}
              <a
                href={socialLinks[1].href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[#475569] transition hover:text-white"
                aria-label={socialLinks[1].name}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
              {/* Discord */}
              <a
                href={socialLinks[2].href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[#475569] transition hover:text-white"
                aria-label={socialLinks[2].name}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.081.11 18.104.128 18.12a19.904 19.904 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994.021-.04.001-.088-.041-.104a13.201 13.201 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </a>
              {/* Instagram */}
              <a
                href={socialLinks[3].href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[#475569] transition hover:text-white"
                aria-label={socialLinks[3].name}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95h-8.5zm8.95 1.35a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.8A3.2 3.2 0 1 0 12 15.2 3.2 3.2 0 0 0 12 8.8z" />
                </svg>
              </a>
              {/* TikTok */}
              <a
                href={socialLinks[4].href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[#475569] transition hover:text-white"
                aria-label={socialLinks[4].name}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.5 3h2.8c.2 1.1.9 2.1 1.9 2.8.8.6 1.8 1 2.8 1v2.9a8.7 8.7 0 0 1-4.7-1.4v6.2a6.5 6.5 0 1 1-6.5-6.5c.4 0 .8 0 1.2.1V11a3.8 3.8 0 0 0-1.2-.2 3.7 3.7 0 1 0 3.7 3.7V3z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LandingPage() {
  useScrollReveal(".landing-reveal");

  return (
    <div className="relative min-h-screen bg-[#0f172a]">
      <GrainOverlay />
      <Navbar />
      <main>
        <div className="landing-reveal"><Hero /></div>
        <div className="landing-reveal"><TrustStrip /></div>
        <div className="landing-reveal"><FeaturesGrid /></div>
        <div className="landing-reveal"><UseCases /></div>
        <div className="landing-reveal"><HowItWorks /></div>
        <div className="landing-reveal"><PricingSection /></div>
        <div className="landing-reveal"><FooterCTA /></div>
      </main>
      <Footer />
    </div>
  );
}
