import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

/**
 * SSR-safe `prefers-reduced-motion` via `useSyncExternalStore` — evita il
 * pattern setState-in-effect (lint `react-hooks/set-state-in-effect`).
 * Server snapshot = `false` (render con motion); il client si riallinea
 * all'hydration e reagisce ai cambi di sistema in sessione.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
