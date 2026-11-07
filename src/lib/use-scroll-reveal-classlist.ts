"use client";

import { useEffect, useRef } from "react";

/**
 * Reveal a `classList`: aggiunge `.visible` all'elemento quando entra nel
 * viewport, e la transizione la fa il CSS (`.reveal` in `globals.css`).
 *
 * ⚠️ **Non e' l'unico hook di reveal del progetto, ed e' per questo che si
 * chiama cosi'.** L'altro e' `useScrollReveal` in `src/hooks/use-scroll-reveal.ts`,
 * che invece restituisce `{ ref, isRevealed }` e lascia decidere al componente.
 * Fino al 10/09/2026 si chiamavano **tutti e due `useScrollReveal`**, in due
 * cartelle diverse: due cose diverse con lo stesso nome, che e' il modo piu'
 * rapido di importare quello sbagliato senza che niente protesti.
 *
 * Non sono stati unificati apposta: l'unico consumatore di questo e'
 * `fasi-accordion.tsx`, cioe' le nove fasi di `/produzione`, che hanno una
 * taratura di sfocatura e scrim misurata al pixel. Farlo passare all'altro hook
 * vorrebbe dire rimisurarla, e non e' quello che questa pulizia sta facendo.
 */
export function useScrollRevealClassList<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      el.classList.add("visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );

    // Observe the element and all children with .reveal
    const revealElements = el.querySelectorAll(".reveal");
    revealElements.forEach((child) => observer.observe(child));
    if (el.classList.contains("reveal")) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return ref;
}
