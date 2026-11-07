import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import type { ActiveLocale } from "@/i18n/routing";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { breadcrumbCatalogo } from "@/lib/breadcrumb";
import { indicizzazione, risolviSeo } from "@/lib/seo-editoriale";
import { fallbackOgImages } from "@/lib/og-fallback-image";
import { conAltOg, openGraphBase } from "@/lib/open-graph";
import { absoluteUrl, localizedUrls } from "@/lib/urls";
import { getAllConcealedBodySlugs, getConcealedBody } from "@/lib/content";

import { BodyHero } from "./_components/body-hero";
import { BodySpecs } from "./_components/body-specs";
import { UsedBy } from "./_components/used-by";
import { altProdotto, messaggiAlt } from "@/lib/messaggi-alt";

export const revalidate = false;

interface PageProps {
  params: Promise<{ locale: ActiveLocale; slug: string }>;
}

/**
 * I 17 corpi si pre-renderizzano al build (17 × 2 lingue = 34 path), a differenza dei
 * 591 modelli che restano ISR on-demand: a questa scala il pre-render costa nulla e
 * la prima visita non paga il fetch.
 */
export async function generateStaticParams() {
  const slugs = await getAllConcealedBodySlugs();
  return slugs.map((item) => ({ slug: item.slug ?? "" })).filter((p) => p.slug !== "");
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const body = await getConcealedBody(slug, locale);
  if (!body) return { title: "Corpo a incasso non trovato" };
  const href = { pathname: "/collezioni/corpi-a-incasso/[slug]" as const, params: { slug } };
  const t = await getTranslations({ locale, namespace: "corpiIncasso" });
  // Erano entrambi in italiano su tutte e 34 le pagine: il title il solo codice,
  // che non dice di che cosa sia il codice, e la description una stringa
  // composta in italiano e servita anche su `/en`.
  const codice = body.code ?? "";
  const seo = risolviSeo({
    seo: body.seo,
    locale,
    contenutoNellaLingua: body.contenutoNellaLingua ?? true,
    template: {
      titolo: t("metaTitleCorpo", { codice }),
      description: t("metaDescriptionCorpo", { codice }),
    },
  });
  const canonico = absoluteUrl(locale, href);
  return {
    title: seo.titolo,
    description: seo.description,
    ...indicizzazione(seo.noIndex, {
      canonical: canonico,
      languages: localizedUrls(href),
    }),
    openGraph: {
      ...openGraphBase(locale, seo.noIndex ? null : canonico),
      // ⚠️ `title` e `description` VANNO dichiarati, e qui valgono per 34 pagine.
      // Senza, Next ci mette il titolo GIÀ passato da `title.template`, cioè col
      // « | Fontealta» che `og:site_name` porta già: misurato sul costruito, i 17
      // corpi per due lingue servivano «CW.1 · Corpi a incasso | Fontealta». Il
      // blocco `openGraph` si emette COMPLETO, perché dichiararne un campo
      // sostituisce l'oggetto intero.
      title: seo.titolo,
      description: seo.description,
      images: conAltOg(await fallbackOgImages(locale), seo.titolo, locale),
    },
  };
}

export default async function ConcealedBodyDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const body = await getConcealedBody(slug, locale);
  if (!body) notFound();

  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tCorpi = await getTranslations({ locale, namespace: "corpiIncasso" });
  const briciole = breadcrumbCatalogo(
    { home: tNav("home"), collezioni: tNav("collezioni") },
    { label: tCorpi("metaTitle"), href: "/collezioni/corpi-a-incasso" },
    { label: body.code ?? "" },
  );

  return (
    <>
      <BreadcrumbJsonLd items={briciole} locale={locale} />
      <BodyHero
        body={body}
        breadcrumb={{ items: briciole, ariaLabel: tNav("breadcrumbAria") }}
        fotoAlt={altProdotto(
          body.image,
          body,
          tCorpi("eyebrow"),
          locale,
          await messaggiAlt(locale),
        )}
      />
      <BodySpecs body={body} />
      <UsedBy body={body} locale={locale} />
    </>
  );
}
