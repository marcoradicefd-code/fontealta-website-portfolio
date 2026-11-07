import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CollectionCard } from "@/components/cards/collection-card";
import { FaqSection } from "@/components/faq/faq-section";
import { ProgettareCta } from "@/components/sections/progettare-cta";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import type { ActiveLocale } from "@/i18n/routing";
import { getFaq, getUsePage } from "@/lib/content";
import { serializzaJsonLd, webPageJsonLd } from "@/lib/json-ld";
import { fallbackOgImages } from "@/lib/og-fallback-image";
import { conAltOg, ogImageScenaNellaLingua, openGraphBase } from "@/lib/open-graph";
import { lingueConTitolo, ordinaCard, titoloNellaLingua, USE_PAGE_ROUTES } from "@/lib/pagina-uso";
import { indicizzazione, risolviSeo, type SeoDocumento } from "@/lib/seo-editoriale";
import { absoluteUrl, localizedUrls } from "@/lib/urls";
import { contentPageId } from "@/sanity/lib/faq-rules";
import type { COLLECTIONS_OVERVIEW_QUERY_RESULT } from "@/sanity/types.gen";

import { UseBody } from "./_components/use-body";

/**
 * La pagina d'uso «doccia da esterno» (spec `docs/specs/seo-pagine-contenuto.md` § 5, c1b).
 *
 * Il contenuto è il documento fisso `contentPage-outdoor-shower`, scritto dal caricatore. Il tag è
 * `contentPage`, quello del webhook per i documenti senza slug; `revalidate` è quello delle altre
 * pagine (rule `cache-isr`).
 *
 * ⚠️ **Cancello**: una lingua senza titolo dà 404, e la pagina non nomina negli hreflang le lingue
 * che mancano (`lingueConTitolo`). Nessun ripiego all'italiano: la pagina d'uso esce solo nella
 * lingua in cui è scritta.
 */
export const revalidate = 86400;

const CODE = "outdoor-shower";
const HREF = USE_PAGE_ROUTES[CODE];

interface PageProps {
  params: Promise<{ locale: ActiveLocale }>;
}

type Pagina = NonNullable<Awaited<ReturnType<typeof getUsePage>>>;

/** Titolo, description e immagine: una scelta sola per i metadati e per il `WebPage`. */
async function seoDellaPagina(data: Pagina, locale: ActiveLocale, titolo: string) {
  // TypeGen tipizza i campi per lingua come array (M6): a runtime sono stringhe.
  const intro = typeof data.intro === "string" ? data.intro : "";
  return risolviSeo({
    seo: data.seo as SeoDocumento,
    locale,
    template: { titolo, description: intro },
    // Le foto del corpo sono verticali, e un 1200×630 ne terrebbe una striscia: `seo.ogImage` è
    // l'immagine fatta apposta (Marco, 4-4/11/2026), con l'alt per lingua; senza, la riserva.
    immagini: {
      seo: data.seo?.ogImage?.asset ? ogImageScenaNellaLingua(data.seo.ogImage, locale) : null,
      sito: await fallbackOgImages(locale),
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const data = await getUsePage(CODE, locale);
  const titolo = data ? titoloNellaLingua(data.titoli, locale) : null;
  // Senza titolo la pagina è una 404, e il titolo lo dà il layout («Pagina non trovata»).
  if (!data || !titolo) return {};

  const seo = await seoDellaPagina(data, locale, titolo);
  const canonico = absoluteUrl(locale, HREF);
  return {
    title: seo.titolo,
    description: seo.description,
    ...indicizzazione(seo.noIndex, {
      canonical: canonico,
      languages: localizedUrls(HREF, lingueConTitolo(data.titoli)),
    }),
    openGraph: {
      ...openGraphBase(locale, seo.noIndex ? null : canonico),
      // Il titolo nudo, come su tutte le rotte: il marchio lo porta `og:site_name`.
      title: seo.titolo,
      description: seo.description,
      images: conAltOg(seo.immagini, seo.titolo, locale),
    },
  };
}

export default async function PaginaUsoPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getUsePage(CODE, locale);
  const titolo = data ? titoloNellaLingua(data.titoli, locale) : null;
  if (!data || !titolo) notFound();

  const t = await getTranslations({ locale, namespace: "paginaUso" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tCollezioni = await getTranslations({ locale, namespace: "collezioni" });
  const faq = await getFaq(contentPageId(CODE), locale, ["contentPage"]);
  const seo = await seoDellaPagina(data, locale, titolo);

  const intro = typeof data.intro === "string" ? data.intro : "";
  // La stessa proiezione di COLLECTIONS_OVERVIEW_QUERY: la forma che la card riceve. Prima quelle
  // in evidenza, poi le altre nell'ordine del catalogo (Marco, 4/11/2026).
  const collezioni = ordinaCard(
    data.collections ?? [],
    data.inEvidenza,
  ) as COLLECTIONS_OVERVIEW_QUERY_RESULT;

  // Briciole Home › pagina (Q10): la stessa lista per il markup e per il `BreadcrumbList`.
  const briciole: BreadcrumbItem[] = [
    { label: tNav("home"), href: "/" },
    { label: t("outdoorShower") },
  ];
  const webPage = webPageJsonLd({
    locale,
    url: absoluteUrl(locale, HREF),
    name: titolo,
    description: seo.description,
  });

  return (
    <>
      <BreadcrumbJsonLd items={briciole} locale={locale} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializzaJsonLd(webPage) }}
      />

      {/* Apertura come l'articolo del blog (Q8): nessun hero, la barra resta solida. La colonna sta
          al centro, sull'asse di card e FAQ (Marco, provini del 4/11/2026): il blog la tiene a
          sinistra perché a destra ha la colonna dell'autore, qui non c'è. */}
      <div
        className="bg-fa-white px-6"
        style={{
          paddingTop: "var(--fa-space-article-top)",
          paddingBottom: "var(--fa-space-article-bottom)",
        }}
      >
        <article className="fa-container">
          <div className="mx-auto max-w-3xl">
            <Breadcrumb items={briciole} ariaLabel={tNav("breadcrumbAria")} className="mb-8" />
            <h1 className="fa-h1 mb-6" style={{ fontWeight: 400 }}>
              {titolo}
            </h1>
            {intro ? (
              <p
                className="m-0 mb-10 text-body-6"
                style={{ lineHeight: 1.5, color: "var(--fa-text-secondary)" }}
              >
                {intro}
              </p>
            ) : null}
            <UseBody
              blocks={data.body}
              labels={{ inSintesi: t("inSintesi"), tabella: t("tabella") }}
            />
          </div>
        </article>
      </div>

      {/* Le collezioni con una colonna doccia, prima quelle in evidenza (Marco, 4/11/2026), prima
          delle FAQ (Q9). Stesso fondo dell'articolo: un'imbottitura sola fra i due. */}
      {collezioni.length > 0 ? (
        <section aria-labelledby="collezioni-uso" className="fa-section light pt-0">
          <div className="fa-container">
            <h2 id="collezioni-uso" className="fa-h2 text-center">
              {t("collezioni")}
            </h2>
            <div className="mt-intro-content grid auto-rows-fr grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {collezioni.map((c) => (
                <CollectionCard key={c._id} collection={c} locale={locale} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* FAQ senza «Scrivici», poi la sola CTA della pagina (Q12). */}
      <FaqSection items={faq} locale={locale} adjacentLight="above" />
      <ProgettareCta title={tCollezioni("progettareH2")} subtitle={tCollezioni("progettareSub")} />
    </>
  );
}
