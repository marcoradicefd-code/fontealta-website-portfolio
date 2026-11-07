import { Suspense } from "react";

import { useLocale, useTranslations } from "next-intl";

import {
  AZIENDA_EMAIL,
  AZIENDA_INDIRIZZO,
  AZIENDA_RAGIONE_SOCIALE,
  AZIENDA_TELEFONO,
} from "@/lib/azienda";
import { elencoPaesi } from "@/lib/paesi";

import { ContactForm } from "./contact-form";

/**
 * ContactSection — sez. 2 (spec §2). Server Component.
 *
 * Colonna sx: la sede da `azienda.ts` (ragione sociale, indirizzo, telefono, email),
 * la stessa sorgente del JSON-LD `LocalBusiness` della pagina e del footer.
 * ⚠️ Fino al 19/10/2026 indirizzo, telefono ed email venivano da `siteSettings`, che su
 * Sanity è vuoto: a video c'era la sola ragione sociale, mentre il JSON-LD dichiarava
 * telefono ed email. La ragione sociale veniva già da qui dal 10/09 (su Sanity valeva
 * «Fontealta S.r.l.»).
 * Colonna dx: ContactForm (client) — react-hook-form + Zod + Server Action.
 *   NESSUN H2 sopra il form, deliberato (revisione copy, ago 2026): l'H1 dell'hero
 *   "Parliamo del tuo progetto." sta gia' sopra, e un secondo titolo qui sarebbe
 *   una doppia headline sulla stessa richiesta. Non ripristinare senza motivo.
 */
export function ContactSection() {
  const t = useTranslations("contatti");
  const locale = useLocale();

  return (
    <section className="fa-section dark" style={{ background: "var(--fa-ink)" }}>
      <div className="fa-container">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1fr_2fr]">
          {/* Colonna dati sede */}
          <div>
            <span className="fa-eyebrow on-dark" style={{ color: "var(--fa-text-on-dark)" }}>
              {t("sedeEyebrow")}
            </span>
            <p className="fa-h4 mt-4" style={{ color: "var(--fa-text-on-dark)" }}>
              {AZIENDA_RAGIONE_SOCIALE}
            </p>

            <address
              className="fa-body-sm mt-6 not-italic"
              style={{
                // Bianco pieno e non il secondario (Marco, 19/10/2026): i recapiti si leggono.
                color: "var(--fa-text-on-dark)",
                lineHeight: 1.9,
              }}
            >
              {AZIENDA_INDIRIZZO.map((riga) => (
                <span key={riga} className="block">
                  {riga}
                </span>
              ))}
              <a
                href={`tel:${AZIENDA_TELEFONO.replaceAll(/\s+/g, "")}`}
                className="mt-3 block transition-colors hover:text-fa-text-on-dark"
              >
                {AZIENDA_TELEFONO}
              </a>
              <a
                href={`mailto:${AZIENDA_EMAIL}`}
                className="block transition-colors hover:text-fa-text-on-dark"
              >
                {AZIENDA_EMAIL}
              </a>
            </address>
          </div>

          {/* Colonna form */}
          <div>
            <Suspense fallback={null}>
              <ContactForm paesi={elencoPaesi(locale)} />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}
