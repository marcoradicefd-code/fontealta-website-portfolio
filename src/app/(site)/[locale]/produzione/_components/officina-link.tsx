"use client";

import { track } from "@vercel/analytics";
import { useLocale } from "next-intl";
import type { ReactNode } from "react";

import { IntentLink } from "@/components/ui/intent-link";

interface OfficinaLinkProps {
  /** L'id della didascalia, che descrive il link (`aria-describedby`). */
  describedBy: string;
  className: string;
  children: ReactNode;
}

/**
 * Il link della facciata verso la tavola dell'officina, nella lingua della pagina e nella
 * stessa scheda. Al clic conta `officina_apri` (spec `docs/specs/tavola-officina.md`,
 * «Statistiche»); `track()` senza `<Analytics />` (anteprime, locale) non fa niente.
 * Prefetch su intenzione, come le card (rule `cache-isr`).
 */
export function OfficinaLink({ describedBy, className, children }: Readonly<OfficinaLinkProps>) {
  const lingua = useLocale();
  return (
    <IntentLink
      href="/officina"
      aria-describedby={describedBy}
      className={className}
      onClick={() => track("officina_apri", { lingua })}
    >
      {children}
    </IntentLink>
  );
}
