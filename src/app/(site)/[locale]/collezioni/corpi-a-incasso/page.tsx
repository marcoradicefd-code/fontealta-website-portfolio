import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { CollectionPageJsonLd } from "@/components/seo/collection-page-json-ld";
import { FaqSection } from "@/components/faq/faq-section";
import { CollectionHero } from "@/components/heros/collection-hero";
import { breadcrumbCatalogo } from "@/lib/breadcrumb";
import { absoluteUrl } from "@/lib/urls";
import type { ActiveLocale } from "@/i18n/routing";
import { getConcealedBodiesIndex, getFaq } from "@/lib/content";
import { MACRO_ORDER } from "@/lib/product-category";
import { staticRouteMetadata } from "@/lib/route-metadata";

import { BodiesSection } from "./_components/bodies-section";
import { conAltComposto, messaggiAlt } from "@/lib/messaggi-alt";

export const revalidate = false;

interface PageProps {
  params: Promise<{ locale: ActiveLocale }>;
}

export const generateMetadata = staticRouteMetadata({
  namespace: "corpiIncasso",
  href: "/collezioni/corpi-a-incasso",
});

/**
 * Indice dei corpi a incasso — cartella STATICA, non un bivio dentro
 * `collezioni/[slug]`. Next dà priorità al segmento statico sul dinamico fratello,
 * quindi il template delle collezioni resta senza condizionali.
 *
 * L'hero legge il documento `collection` «Corpi a incasso»; la griglia interroga il
 * TIPO `concealedBody` (docs/incassi-design.md §3). Se il documento manca la pagina fa
 * `notFound()` invece di inventarsi un hero: un fallback qui mostrerebbe un titolo
 * plausibile su una collezione che nessuno ha pubblicato.
 */
export default async function ConcealedBodiesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getConcealedBodiesIndex(locale);
  const collection = data?.collection;
  if (!collection) notFound();

  const bodies = data?.bodies ?? [];
  const faq = await getFaq(collection._id, locale, ["collection:corpi-a-incasso"]);

  const t = await getTranslations({ locale, namespace: "corpiIncasso" });
  const tCat = await getTranslations({ locale, namespace: "productCategories" });

  // Stat override: sui corpi le derivazioni dell'hero darebbero 0 articoli e 0
  // finiture, cioè due zeri veri su un conteggio che non è il loro.
  // ⚠️ Il numero dei corpi è SEMPRE `bodies.length`, mai un 17 cablato: l'indice
  // interroga il tipo, quindi al primo corpo nuovo un numero fisso mentirebbe.
  const presentMacros = MACRO_ORDER.filter((m) => bodies.some((b) => b.servesMacros?.includes(m)));
  const stats = [
    { label: t("statCorpi"), value: String(bodies.length) },
    {
      label: t("statAmbienti"),
      value: presentMacros.map((m) => (tCat.has(m) ? tCat(m) : m)).join(" · ") || "—",
    },
  ];

  // L'etichetta viene da `corpiIncasso.metaTitle`, che è già la stessa stringa
  // localizzata del titolo di pagina: nessuna query nuova e nessun secondo nome
  // per la stessa cosa.
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const briciole = breadcrumbCatalogo(
    { home: tNav("home"), collezioni: tNav("collezioni") },
    { label: t("metaTitle") },
  );

  // ⚠️ Il nome della voce è il **codice**, e non è un ripiego: sui corpi il
  // titolo della card È il codice (docs/incassi-design.md §7), `name` non è
  // nemmeno proiettato. Un `ItemList` che inventasse un'etichetta più discorsiva
  // direbbe una cosa che sulla pagina non c'è.
  const elenco = bodies
    .filter((b) => Boolean(b.slug) && Boolean(b.code))
    .map((b) => ({
      name: b.code ?? "",
      url: absoluteUrl(locale, {
        pathname: "/collezioni/corpi-a-incasso/[slug]",
        params: { slug: b.slug ?? "" },
      }),
    }));

  return (
    <>
      <BreadcrumbJsonLd items={briciole} locale={locale} />
      <CollectionPageJsonLd
        locale={locale}
        name={t("metaTitle")}
        description={t("metaDescription")}
        url={absoluteUrl(locale, "/collezioni/corpi-a-incasso")}
        items={elenco}
      />
      <CollectionHero collection={collection} locale={locale} stats={stats} />
      <BodiesSection
        bodies={conAltComposto(bodies, () => t("eyebrow"), locale, await messaggiAlt(locale))}
        locale={locale}
        breadcrumb={{ items: briciole, ariaLabel: tNav("breadcrumbAria") }}
      />
      <FaqSection items={faq} locale={locale} withContactPrompt adjacentLight="above" />
    </>
  );
}
