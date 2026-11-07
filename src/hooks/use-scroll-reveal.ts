"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

interface UseScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const subscribeReducedMotion = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
};

const getReducedMotion = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;
const getReducedMotionServerSnapshot = () => false;

/**
 * Single-shot reveal hook based on IntersectionObserver.
 *
 * Returns a ref to attach to the target element and an `isRevealed` boolean
 * that flips to `true` the first time the element enters the viewport.
 * Subsequent scroll-out events do NOT toggle it back to `false`.
 *
 * Honours `prefers-reduced-motion: reduce` by reporting `isRevealed: true`
 * immediately and skipping the observer entirely. Reduced-motion changes
 * mid-session are picked up via `useSyncExternalStore`.
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>({
  threshold = 0.15,
  rootMargin = "0px",
}: UseScrollRevealOptions = {}) {
  const ref = useRef<T>(null);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getReducedMotionServerSnapshot,
  );
  const [hasIntersected, setHasIntersected] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasIntersected(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [reducedMotion, threshold, rootMargin]);

  return { ref, isRevealed: reducedMotion || hasIntersected };
}
