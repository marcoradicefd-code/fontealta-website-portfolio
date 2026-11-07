import { Suspense } from "react";
import { useLocale } from "next-intl";

import { ContactForm } from "@/app/(site)/[locale]/contatti/_components/contact-form";
import type { ModelloDelModulo } from "@/app/(site)/[locale]/contatti/_components/use-contact-submit";
import { elencoPaesi } from "@/lib/paesi";

interface ProgettareCtaProps {
  /** Titolo H2 già risolto — es. "Progettare in lungo e in largo.". */
  title: string;
  /** Sottotitolo/intro già risolto — copy SPECIFICO per pagina (vedi sotto). */
  subtitle: string;
  /** Solo nella scheda modello: codice e nome arrivano a Zapier col lead (16/10/2026). */
  modello?: ModelloDelModulo;
}

/**
 * ProgettareCta — sezione CTA contatto condivisa ("Progettare in lungo e in largo.").
 *
 * Layout FISSO: H2 64px/500 (`clamp(2.25rem,5vw,4rem)`/lh1.04/-1.2px) — NO eyebrow (non in Figma)
 * + sub + `<ContactForm>` (680px) su `fa-section dark` (#0b1215, fa-ink). I testi arrivano
 * via props — ogni pagina passa le proprie stringhe i18n GIÀ risolte → preserva i
 * sub-copy specifici (collezioni.progettareSub · blog.contactSub · chiSiamo.formIntro)
 * e l'EN del titolo chi-siamo ("Designing far and wide.", key chiSiamo.formH2 NON
 * unificata). Incapsula `ContactForm` (client) in `<Suspense>` (legge useSearchParams).
 * `id="progettare"` per gli anchor #progettare site-wide.
 *
 * Estratto da 5 sezioni inline duplicate ma già visivamente allineate (M-progettare-cta,
 * DRY, zero cambiamenti a video). Server Component puro: solo props + layout.
 */
export function ProgettareCta({ title, subtitle, modello }: ProgettareCtaProps) {
  // Elenco dei Paesi calcolato qui, sul server, nella lingua della pagina (v. `src/lib/paesi.ts`).
  const locale = useLocale();
  return (
    <section id="progettare" className="fa-section dark overflow-hidden">
      <div className="fa-container">
        <div className="mx-auto max-w-[680px] text-center">
          <h2
            className="m-0 text-display-close"
            style={{
              color: "var(--fa-text-on-dark)",
            }}
          >
            {title}
          </h2>
          <p
            className="fa-body-lg mx-auto mt-heading-intro max-w-[520px]"
            style={{ color: "var(--fa-text-on-dark)" }}
          >
            {subtitle}
          </p>
        </div>

        <div className="mx-auto mt-intro-content max-w-[680px]">
          <Suspense fallback={null}>
            {/* La prop solo se c'è: `modello={undefined}` finirebbe nel payload delle altre rotte. */}
            <ContactForm paesi={elencoPaesi(locale)} {...(modello ? { modello } : {})} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
