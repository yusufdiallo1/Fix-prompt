const LOCK_KEY = "pf_runtime_lockdown";
const GLOBAL_FAILURE_KEY = "pf_runtime_global_failures";
const ROUTE_FAILURE_KEY_PREFIX = "pf_runtime_route_failures:";

const safeGetNumber = (key: string) => {
  try {
    const raw = window.sessionStorage.getItem(key);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
};

const safeSetNumber = (key: string, value: number) => {
  try {
    window.sessionStorage.setItem(key, String(Math.max(0, value)));
  } catch {
    // Ignore storage failures; runtime protection still continues in-memory.
  }
};

export const incrementGlobalFailureCount = () => {
  const next = safeGetNumber(GLOBAL_FAILURE_KEY) + 1;
  safeSetNumber(GLOBAL_FAILURE_KEY, next);
  return next;
};

export const resetGlobalFailureCount = () => {
  safeSetNumber(GLOBAL_FAILURE_KEY, 0);
};

const routeKey = (routePath: string) => `${ROUTE_FAILURE_KEY_PREFIX}${routePath}`;

export const incrementRouteFailureCount = (routePath: string) => {
  const key = routeKey(routePath);
  const next = safeGetNumber(key) + 1;
  safeSetNumber(key, next);
  return next;
};

export const clearRouteFailureCount = (routePath: string) => {
  try {
    window.sessionStorage.removeItem(routeKey(routePath));
  } catch {
    // Ignore.
  }
};

export const setRuntimeLockdown = (reason: string) => {
  try {
    window.sessionStorage.setItem(
      LOCK_KEY,
      JSON.stringify({
        reason,
        timestamp: Date.now(),
      }),
    );
  } catch {
    // Ignore.
  }
};

export const getRuntimeLockdown = () => {
  try {
    const raw = window.sessionStorage.getItem(LOCK_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { reason?: string; timestamp?: number } | null;
  } catch {
    return null;
  }
};

export const clearRuntimeLockdown = () => {
  try {
    window.sessionStorage.removeItem(LOCK_KEY);
  } catch {
    // Ignore.
  }
};

export const clearRecoveryState = () => {
  try {
    const keys = Object.keys(window.localStorage);
    keys.forEach((key) => {
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        window.localStorage.removeItem(key);
      }
    });
  } catch {
    // Ignore.
  }

  try {
    const keys = Object.keys(window.sessionStorage);
    keys.forEach((key) => {
      if (
        key === LOCK_KEY ||
        key === GLOBAL_FAILURE_KEY ||
        key.startsWith(ROUTE_FAILURE_KEY_PREFIX) ||
        key.startsWith("pf_")
      ) {
        window.sessionStorage.removeItem(key);
      }
    });
  } catch {
    // Ignore.
  }
};
