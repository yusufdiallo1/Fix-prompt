import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  clearRecoveryState,
  clearRuntimeLockdown,
  getRuntimeLockdown,
  incrementGlobalFailureCount,
  resetGlobalFailureCount,
  setRuntimeLockdown,
} from "../lib/runtimeFirewall";

const GLOBAL_FAILURE_LIMIT = 5;

interface RuntimeFailureState {
  reason: string;
  routePath: string;
}

export const RuntimeFirewall = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [failure, setFailure] = useState<RuntimeFailureState | null>(null);
  const routePath = useMemo(() => location.pathname, [location.pathname]);

  useEffect(() => {
    const lockdown = getRuntimeLockdown();
    if (lockdown?.reason) {
      setFailure({ reason: lockdown.reason, routePath });
    }
  }, [routePath]);

  useEffect(() => {
    if (failure) return;

    const onRuntimeFailure = (reason: string) => {
      const count = incrementGlobalFailureCount();
      if (count >= GLOBAL_FAILURE_LIMIT) {
        setRuntimeLockdown(reason);
        setFailure({ reason, routePath: window.location.pathname });
      }
    };

    const onError = (event: ErrorEvent) => {
      const message = event.error instanceof Error ? event.error.message : event.message || "Unknown runtime error";
      onRuntimeFailure(`window.error: ${message}`);
    };

    const onUnhandled = (event: PromiseRejectionEvent) => {
      const reason =
        typeof event.reason === "string"
          ? event.reason
          : event.reason instanceof Error
            ? event.reason.message
            : "Unhandled rejection";
      onRuntimeFailure(`unhandledrejection: ${reason}`);
    };

    const onFirewallEvent = (event: Event) => {
      const custom = event as CustomEvent<{ reason?: string; routePath?: string }>;
      const reason = custom.detail?.reason ?? "Route failure threshold reached";
      setRuntimeLockdown(reason);
      setFailure({ reason, routePath: custom.detail?.routePath ?? window.location.pathname });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    window.addEventListener("pf-runtime-firewall", onFirewallEvent as EventListener);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
      window.removeEventListener("pf-runtime-firewall", onFirewallEvent as EventListener);
    };
  }, [failure]);

  if (!failure) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] px-4">
      <section className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 text-[#1C1C1E] shadow-[0_10px_30px_rgba(28,28,30,0.1)]">
        <h2 className="text-lg font-semibold text-rose-700">Runtime safety mode enabled</h2>
        <p className="mt-2 text-sm text-[#444]">
          We caught repeated runtime failures and blocked further unsafe rendering to prevent a blank page.
        </p>
        <p className="mt-3 rounded-xl bg-[#F2F2F7] px-3 py-2 text-xs text-[#636366]">
          Route: {failure.routePath}
          <br />
          Reason: {failure.reason}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              clearRuntimeLockdown();
              resetGlobalFailureCount();
              setFailure(null);
            }}
            className="rounded-full border border-[#D1D1D6] px-3 py-1.5 text-sm font-semibold text-[#1C1C1E]"
          >
            Retry render
          </button>
          <button
            type="button"
            onClick={() => {
              clearRuntimeLockdown();
              clearRecoveryState();
              window.location.assign("/login");
            }}
            className="rounded-full bg-[#3B82F6] px-3 py-1.5 text-sm font-semibold text-white"
          >
            Reset and go to login
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-[#1C1C1E] px-3 py-1.5 text-sm font-semibold text-white"
          >
            Reload app
          </button>
        </div>
      </section>
    </div>
  );
};
