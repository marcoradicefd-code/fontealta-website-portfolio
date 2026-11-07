import { getTranslations, setRequestLocale } from "next-intl/server";

import { Button } from "@/components/ui/button";
import type { ActiveLocale } from "@/i18n/routing";
import { fallbackOgImages } from "@/lib/og-fallback-image";
import { conAltOg, openGraphBase } from "@/lib/open-graph";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: ActiveLocale }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "areaRiservata" });
  const titolo = t("metaTitle");
  return {
    title: titolo,
    description: t("metaDescription"),
    /**
     * ⚠️ **Un `openGraph` proprio solo per `og:image:alt`** (7/10/2026). Prima
     * questa era l'unica pagina che ereditava il blocco del layout, che non
     * conosce il titolo della pagina. `title` e `description` restano FUORI
     * apposta: senza, Next li ricava come prima e i tag escono identici. Niente
     * `og:url`, come prima: la pagina non dichiara un canonical.
     */
    openGraph: {
      ...openGraphBase(locale),
      images: conAltOg(await fallbackOgImages(locale), titolo, locale),
    },
    // `noindex` SULLA ROTTA, non solo dal gate globale di M20. Il gate spegne
    // l'indicizzazione dell'INTERO sito finché `NEXT_PUBLIC_SITE_URL` non è il
    // dominio di produzione: al cutover si riaccende tutto, e questa pagina deve
    // restare fuori finché l'Area Pro vera non esiste. `follow: true` perché i
    // link in uscita (contatti) sono legittimi: non si indicizza la pagina, non
    // si taglia il grafo.
    robots: { index: false, follow: true },
  };
}

/**
 * Area Riservata «in costruzione». Pagina statica di servizio: nessuna query
 * Sanity, nessuna immagine, nessun form.
 *
 * Il layout è quello del 404 (`not-found.tsx`): `fa-section dark` centrata,
 * eyebrow warm-white + H1 + paragrafo + un solo bottone. Stessa scala di titolo
 * (`.fa-h2`) e per la stessa ragione — DEV-1 riserva `--text-display-hero` agli
 * H1 degli hero full-bleed, e qui sotto il titolo non c'è nessuna fotografia.
 *
 * ⚠️ Il copy NON dà indicazioni di tempo, né esplicite né implicite: la pagina
 * dice che lo spazio è in lavorazione e dove scrivere, e niente altro. Una data
 * o un «a breve» invecchiano da soli e diventano una promessa mancata.
 */
export default async function AreaRiservataPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "areaRiservata" });

  return (
    <section className="fa-section dark flex min-h-[max(520px,70vh)] items-center">
      <div className="fa-container narrow text-center">
        {/* eyebrow on-dark = warm white (decisione LOCKED). La classe globale
            `.fa-eyebrow.on-dark` è navy-bright (drift vs la decisione) → override
            inline come il 404 e gli altri hero scuri. */}
        <p className="fa-eyebrow on-dark" style={{ color: "var(--fa-text-on-dark)" }}>
          {t("eyebrow")}
        </p>
        <h1 className="fa-h2 mt-eyebrow" style={{ color: "var(--fa-text-on-dark)" }}>
          {t("title")}
        </h1>
        <p
          className="fa-body-lg mx-auto mt-title-text max-w-[52ch]"
          style={{ color: "var(--fa-text-on-dark)" }}
        >
          {t("body")}
        </p>
        <div className="mt-text-action-feature flex justify-center">
          <Button href="/contatti" variant="secondary" dark size="l">
            {t("cta")}
          </Button>
        </div>
      </div>
    </section>
  );
}
