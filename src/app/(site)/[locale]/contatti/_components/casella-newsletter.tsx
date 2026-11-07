"use client";

import type { ComponentProps } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { SPUNTA } from "./icone-invio";

/**
 * La casella della newsletter (19/10/2026, decisione di Marco), in tutti i moduli, sopra il bottone.
 *
 * Facoltativa e MAI spuntata all'inizio (`newsletter: false` nei `defaultValues`). Casella a
 * sinistra e testo cliccabile: tutto il `<label>` la spunta, alto almeno 44 px. Il link su
 * «informativa» apre la sezione privacy in una scheda nuova, e un clic sul link non spunta la
 * casella: l'attivazione va al link, non all'etichetta.
 *
 * Dopo l'invio riuscito resta com'era, con l'aspetto di sempre: `aria-disabled` e non `disabled`
 * (che il browser disegna grigio), e i clic non la cambiano, come il bottone di invio. «Invia
 * un'altra richiesta» la svuota e la rende di nuovo attiva (`form.reset()` nel hook).
 *
 * ⚠️ Il testo è il consenso: se cambia, cambia anche `CONSENSO_VERSIONE` in `src/lib/brevo.ts`.
 *
 * `campo` sono le props dell'input: `register("newsletter")` nei moduli con react-hook-form, nome e
 * attributi d'errore nel modulo del piè di pagina, che è senza (20/10/2026).
 */
export function CasellaNewsletter({
  campo,
  bloccato,
  scuro,
}: {
  campo: ComponentProps<"input">;
  bloccato: boolean;
  /** Fondo scuro: testo chiaro e la traccia bianca dei controlli; su chiaro la traccia navy. */
  scuro: boolean;
}) {
  const t = useTranslations("contatti.form");
  const colore = scuro ? "var(--fa-text-on-dark)" : "var(--fa-text-primary)";

  return (
    <label
      className={
        bloccato
          ? "fa-body-sm flex min-h-11 cursor-default items-start gap-3 py-2 text-left"
          : "fa-body-sm flex min-h-11 cursor-pointer items-start gap-3 py-2 text-left"
      }
      style={{ color: colore }}
    >
      {/* Stile in `globals.css` (`.fa-casella`): la traccia dei controlli, nessun oro. */}
      <span className="relative mt-0.5 flex shrink-0">
        <input
          type="checkbox"
          className={scuro ? "fa-casella su-scuro" : "fa-casella"}
          {...campo}
          aria-disabled={bloccato || undefined}
          // Il clic sull'etichetta, la barra spaziatrice e il clic diretto passano tutti da qui:
          // annullato, la casella resta com'era.
          onClick={(e) => {
            if (bloccato) e.preventDefault();
          }}
        />
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="fa-casella-spunta pointer-events-none absolute inset-0 size-5"
          aria-hidden="true"
        >
          <path d={SPUNTA} />
        </svg>
      </span>
      <span>
        {t.rich("newsletterCasella", {
          link: (chunks) => (
            <Link
              href={{ pathname: "/menzioni-legali", hash: "privacy" }}
              target="_blank"
              rel="noopener"
              className="underline underline-offset-2 hover:opacity-(--fa-opacity-hover)"
            >
              {chunks}
            </Link>
          ),
        })}
      </span>
    </label>
  );
}
