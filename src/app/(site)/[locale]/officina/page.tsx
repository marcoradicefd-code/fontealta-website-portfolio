import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import type { ActiveLocale } from "@/i18n/routing";
import { openGraphBase } from "@/lib/open-graph";

import { WorkshopFrame } from "./_components/workshop-frame";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: ActiveLocale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "officina" });
  const titolo = t("metaTitle");
  return {
    title: titolo,
    description: t("metaDescription"),
    /**
     * ⚠️ **La forma di `/area-riservata`**: `noindex, follow`, nessun canonical, nessun
     * hreflang, nessun `og:url` (`openGraphBase` senza canonico). I metadati li scrive la
     * pagina e non `route-metadata.ts`, che crea canonical e hreflang per costruzione.
     * L'anteprima condivisa invece c'è: titolo nudo, la tavola scattata a 1200×630 da
     * `build:web`, e l'alt approvato in tutte le lingue.
     */
    openGraph: {
      ...openGraphBase(locale),
      title: titolo,
      description: t("metaDescription"),
      images: [{ url: "/officina-tavola/og.jpg", width: 1200, height: 630, alt: t("ogImageAlt") }],
    },
    robots: { index: false, follow: true },
  };
}

/**
 * La tavola «Come nasce una colonna» a tutta pagina, sotto l'header e senza footer
 * (spec `docs/specs/tavola-officina.md`). Griglia, altezza e footer nascosto stanno in
 * `globals.css` (`.fa-officina`); la lingua la decide l'header, e `embed=1` nasconde il
 * selettore interno della tavola.
 */
export default async function OfficinaPage({ params }: Readonly<PageProps>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "officina" });

  return (
    <div className="fa-officina">
      <h1 className="sr-only">{t("metaTitle")}</h1>
      {/* La prima riga della griglia: lo spazio sotto l'header fisso. */}
      <div aria-hidden="true" />
      <WorkshopFrame
        key={locale}
        src={`/officina-tavola/index.html?embed=1&lang=${locale}`}
        title={t("titoloIframe")}
      />
    </div>
  );
}
