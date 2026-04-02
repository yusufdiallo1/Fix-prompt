import { useEffect } from "react";

const DEFAULT_SELECTOR = ".landing-reveal";

export const useScrollReveal = (selector: string = DEFAULT_SELECTOR, watch: unknown = null) => {
  useEffect(() => {
    if (!selector.trim()) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (nodes.length === 0) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nodes.forEach((node) => node.classList.add("reveal-on-scroll"));

    if (prefersReduced) {
      nodes.forEach((node) => node.classList.add("reveal-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.14,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    nodes.forEach((node) => {
      if (node.classList.contains("reveal-visible")) return;
      observer.observe(node);
    });

    return () => observer.disconnect();
  }, [selector, watch]);
};
