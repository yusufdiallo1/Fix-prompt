import type { ReactNode } from "react";

interface AuthSplitLayoutProps {
  children: ReactNode;
}

export const AuthSplitLayout = ({ children }: AuthSplitLayoutProps) => {
  return (
    <div className="auth-page min-h-screen lg:grid lg:grid-cols-[minmax(400px,520px)_1fr]">
      {/* ── Left panel — form area ─────────────────────────────────── */}
      <div className="flex min-h-screen flex-col items-center justify-center md:min-h-0">
        <div
          className="w-full max-w-[460px] px-5 lg:auth-enter"
          style={{
            paddingTop: "max(2.5rem, env(safe-area-inset-top))",
            paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))",
          }}
        >
          {children}

          {/* Mobile/tablet fallback demo panel */}
          <div className="mt-6 space-y-3 md:hidden">
            <div className="auth-demo-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-300">Before</p>
              <p className="mt-2 text-sm text-slate-300">"make login not crash maybe add checks"</p>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">After</p>
              <p className="mt-2 text-sm text-slate-100">
                Build a login flow with schema validation, clear error states, and unit tests for invalid credentials.
              </p>
              <div className="mt-3 h-1.5 w-full rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-violet-400" />
              </div>
            </div>
            <div className="auth-demo-card p-4">
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300">
                <span>Debug session</span>
                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-amber-200">Fix generated</span>
              </div>
              <p className="text-xs text-slate-300">TypeError: Cannot read properties of undefined (reading 'map')</p>
              <div className="mt-3 space-y-2">
                <div className="h-2 w-[88%] rounded bg-slate-700/80" />
                <div className="h-2 w-[72%] rounded bg-slate-700/80" />
                <div className="h-2 w-[80%] rounded bg-slate-700/80" />
              </div>
              <p className="mt-3 text-xs text-emerald-300">
                Added null guard, fallback array, and stronger prompt constraints.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel — animated demo (desktop only) ────────────── */}
      <div
        className="relative hidden overflow-hidden border-l border-white/10 lg:flex lg:min-h-screen lg:items-center lg:justify-center"
        style={{
          background:
            "radial-gradient(1000px 560px at 15% 10%, rgba(59,130,246,0.24), transparent 60%), radial-gradient(800px 540px at 88% 95%, rgba(167,139,250,0.22), transparent 62%), #0b1220",
        }}
      >
        <div className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-blue-500/30 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-64 w-64 rounded-full bg-violet-500/25 blur-[90px]" />

        <div className="relative z-[1] w-full max-w-xl px-10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">
            Live prompt workflow
          </p>
          <h3 className="font-syne text-3xl font-bold leading-tight text-white">
            Watch rough prompts get fixed and buggy outputs get debugged.
          </h3>

          <div className="mt-8 space-y-4">
            <div className="auth-demo-card auth-float-slow p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-300">Before</p>
              <p className="mt-2 text-sm text-slate-300">"make login not crash maybe add checks"</p>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">After</p>
              <p className="mt-2 text-sm text-slate-100">
                Build a login flow with schema validation, clear error states, and unit tests for invalid credentials.
              </p>
              <div className="auth-typing-line mt-3 h-1.5 w-full rounded-full bg-white/10">
                <div className="auth-typing-fill h-full rounded-full bg-gradient-to-r from-blue-400 to-violet-400" />
              </div>
            </div>

            <div className="auth-demo-card auth-float-fast p-4">
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300">
                <span>Debug session</span>
                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-amber-200">Fix generated</span>
              </div>
              <p className="text-xs text-slate-300">TypeError: Cannot read properties of undefined (reading 'map')</p>
              <div className="mt-3 space-y-2">
                <div className="auth-scan-line h-2 w-[88%] rounded bg-slate-700/80" />
                <div className="auth-scan-line h-2 w-[72%] rounded bg-slate-700/80 [animation-delay:180ms]" />
                <div className="auth-scan-line h-2 w-[80%] rounded bg-slate-700/80 [animation-delay:330ms]" />
              </div>
              <p className="mt-3 text-xs text-emerald-300">
                Added null guard, fallback array, and stronger prompt constraints.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
