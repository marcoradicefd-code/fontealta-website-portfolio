"use client";

import { track } from "@vercel/analytics";
import { ArrowRight } from "lucide-react";
import type { ComponentProps } from "react";

import { IntentLink } from "@/components/ui/intent-link";

/**
 * «Approfondisci» sotto una risposta (Marco, 4/11/2026; spec FAQ § 8): il testo descrittivo scritto
 * nel file, nello stile dei link delle FAQ, con la freccia nascosta ai lettori di schermo. Al clic
 * conta `faq_approfondisci` con due proprietà, `pagina` (il percorso, che porta la lingua) e
 * `destinazione` (il percorso italiano): sul piano Pro un evento ne porta al più 2. Senza cookie,
 * e senza `<Analytics />` (anteprime, locale) `track()` non fa niente.
 *
 * La classe del link arriva dal server (`FAQ_TEXT_LINK`): importarla da `faq-answer.tsx`
 * porterebbe nel bundle del browser quel modulo, che è del server.
 */
export function FaqApprofondisci({
  href,
  destinazione,
  label,
  className,
}: {
  href: ComponentProps<typeof IntentLink>["href"];
  destinazione: string;
  label: string;
  className: string;
}) {
  return (
    <p className="fa-body-lg mt-4" data-faq-approfondisci>
      <IntentLink
        href={href}
        className={className}
        onClick={() =>
          track("faq_approfondisci", { pagina: window.location.pathname, destinazione })
        }
      >
        {label}
        <ArrowRight aria-hidden className="ml-1 inline size-4 align-middle" />
      </IntentLink>
    </p>
  );
}
