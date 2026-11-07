import { getTranslations } from "next-intl/server";

import { IntentLink } from "@/components/ui/intent-link";
import type { ActiveLocale } from "@/i18n/routing";
import { faqAnchorIds, internalLinkHref, internalLinkPath, type FaqEntry } from "@/lib/faq";
import { faqPageJsonLd, serializzaJsonLd } from "@/lib/json-ld";
import { blocksToText } from "@/sanity/lib/faq-rules";

import { FaqAccordion } from "./faq-accordion";
import { FAQ_TEXT_LINK, FaqAnswer } from "./faq-answer";
import { FaqApprofondisci } from "./faq-approfondisci";

/** «Approfondisci» sotto la risposta, se il campo c'è e la destinazione esiste ancora. */
function approfondisci(deepDive: FaqEntry["deepDive"]) {
  const label = deepDive?.label?.trim();
  const href = internalLinkHref(deepDive?.route, deepDive?.slug);
  const destinazione = internalLinkPath(deepDive?.route, deepDive?.slug);
  if (!label || !href || !destinazione) return null;
  return (
    <FaqApprofondisci
      href={href}
      destinazione={destinazione}
      label={label}
      className={FAQ_TEXT_LINK}
    />
  );
}

/**
 * La sezione «Domande frequenti» (spec FAQ § 3; posizioni decise da Marco il 30/10/2026: sulla
 * collezione dopo la griglia, sulla home fra il team e il modulo).
 *
 * ⚠️ **Accordion e `FAQPage` nascono dalla stessa lista**, quella della query (solo domande con
 * risposta, nella lingua della pagina): una domanda che il JSON-LD dichiara e la pagina non
 * mostra è proprio il markup che Google vieta. Lista vuota (oggi DE, FR, ES) → niente sezione e
 * niente JSON-LD.
 *
 * Il titolo e la riga «Non trovi la risposta?» vengono dal namespace `faq`, letto solo qui dal
 * server: fuori da `CLIENT_NAMESPACES` (rule `i18n-sanity`). La riga c'è solo dove la pagina
 * finisce senza modulo (le collezioni; Marco, 30/10).
 *
 * Lo spazio sopra e sotto è uguale, un passo di sezione (Marco, 30/10): dove la sezione tocca
 * un'altra sezione chiara, lo spazio fra le due lo dà una sola, perché due imbottiture sullo stesso
 * crema si sommano in un vuoto doppio (`adjacentLight`).
 */
/**
 * ⚠️ **Perché uno script in linea.** React 19 non sa scrivere `hidden="until-found"` (scrive
 * `hidden=""`), e l'effetto dell'accordion lo mette solo all'idratazione. Ma Chrome cerca il testo di
 * un link `#:~:text=` (quelli con cui Google porta a un passaggio) al caricamento: con i pannelli
 * ancora `hidden=""` non trova niente, e il pannello resta chiuso, 8 volte su 10 nella sonda del
 * 30/10/2026. Lo script gira mentre la pagina si legge, subito dopo i pannelli; la CSP ammette già
 * gli script in linea (`'unsafe-inline'`, rule `seo-meta`). Su una navigazione nel sito React non
 * lo esegue, ma lì l'effetto dell'accordion arriva prima di qualunque ricerca.
 */
const UNTIL_FOUND_SCRIPT = `document.currentScript.parentElement.querySelectorAll("[role=region][hidden]").forEach(function(p){p.setAttribute("hidden","until-found")})`;

const SECTION_CLASS = {
  none: "fa-section light",
  above: "fa-section light pt-0",
  below: "fa-section light pb-0",
} as const;

export async function FaqSection({
  items,
  locale,
  withContactPrompt = false,
  adjacentLight,
}: {
  items: readonly FaqEntry[];
  locale: ActiveLocale;
  withContactPrompt?: boolean;
  /** La sezione chiara che la tocca: sopra (la griglia della collezione) o sotto (il modulo della home). */
  adjacentLight?: "above" | "below";
}) {
  if (items.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "faq" });

  const questions = items.map((item) => item.question.trim());
  const ids = faqAnchorIds(questions);
  const ld = faqPageJsonLd(
    items.map((item, i) => ({ question: questions[i], answer: blocksToText(item.answer) })),
  );

  return (
    <section aria-labelledby="faq-section-title" className={SECTION_CLASS[adjacentLight ?? "none"]}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializzaJsonLd(ld) }}
      />
      <div className="fa-container narrow">
        <h2 id="faq-section-title" className="fa-h2 text-center">
          {t("title")}
        </h2>
        <div className="mt-intro-content">
          <FaqAccordion
            items={items.map((item, i) => ({
              id: ids[i],
              question: questions[i],
              // Il JSON-LD legge solo la risposta (`blocksToText`): «Approfondisci» non ci entra.
              answer: (
                <>
                  <FaqAnswer blocks={item.answer} />
                  {approfondisci(item.deepDive)}
                </>
              ),
            }))}
          />
          {/* React scrive `hidden=""`: questo porta i pannelli a `until-found` mentre la pagina si
              legge, prima che il browser cerchi il testo di un link `#:~:text=`. */}
          <script dangerouslySetInnerHTML={{ __html: UNTIL_FOUND_SCRIPT }} />
        </div>
        {withContactPrompt && (
          <p className="fa-body-lg mt-8 mb-0 text-center text-fa-text-secondary">
            {t.rich("contactPrompt", {
              link: (chunks) => (
                <IntentLink href="/contatti" className={FAQ_TEXT_LINK}>
                  {chunks}
                </IntentLink>
              ),
            })}
          </p>
        )}
      </div>
    </section>
  );
}
