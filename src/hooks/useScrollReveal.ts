import { useEffect } from "react";

const DEFAULT_SELECTOR = ".landing-reveal";

export const useScrollReveal = (selector: string = DEFAULT_SELECTOR, watch: unknown = null) => {
  useEffect(() => {
    if (!selector.trim()) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (nodes.length === 0) return;

    const showNode = (node: HTMLElement) => {
      node.classList.add("reveal-visible");
      node.classList.add("visible");
    };

    const revealAll = () => nodes.forEach(showNode);
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    nodes.forEach((node) => node.classList.add("reveal-on-scroll"));

    if (prefersReduced) {
      revealAll();
      return;
    }

    if (typeof window.IntersectionObserver === "undefined") {
      revealAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            showNode(entry.target as HTMLElement);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -4% 0px",
      },
    );

    nodes.forEach((node) => observer.observe(node));

    // Never allow landing sections to remain hidden if observers stall.
    const fallbackTimer = window.setTimeout(() => {
      revealAll();
      const stillHidden = nodes.some((node) => window.getComputedStyle(node).opacity === "0");
      if (stillHidden) {
        console.warn("[ScrollReveal] Hidden sections detected; forcing visible state.");
        revealAll();
      }
    }, 700);

    return () => {
      window.clearTimeout(fallbackTimer);
      observer.disconnect();
    };
  }, [selector, watch]);
};
