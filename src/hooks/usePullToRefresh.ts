import { useRef, useState } from "react";
import type { TouchEvent } from "react";

interface PullToRefreshResult {
  isRefreshing: boolean;
  pullDistance: number;
  bind: {
    onTouchStart: (event: TouchEvent<HTMLElement>) => void;
    onTouchMove: (event: TouchEvent<HTMLElement>) => void;
    onTouchEnd: () => void;
  };
}

export const usePullToRefresh = (onRefresh: () => Promise<void> | void): PullToRefreshResult => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);

  return {
    isRefreshing,
    pullDistance,
    bind: {
      onTouchStart: (event) => {
        if (window.scrollY > 0 || isRefreshing) return;
        startY.current = event.touches[0]?.clientY ?? null;
        pulling.current = true;
      },
      onTouchMove: (event) => {
        if (!pulling.current || startY.current == null) return;
        const delta = (event.touches[0]?.clientY ?? 0) - startY.current;
        if (delta <= 0) {
          setPullDistance(0);
          return;
        }
        setPullDistance(Math.min(80, delta * 0.35));
      },
      onTouchEnd: async () => {
        if (!pulling.current) return;
        const shouldRefresh = pullDistance > 46;
        setPullDistance(0);
        pulling.current = false;
        startY.current = null;
        if (!shouldRefresh) return;
        setIsRefreshing(true);
        await Promise.resolve(onRefresh());
        setIsRefreshing(false);
      },
    },
  };
};
