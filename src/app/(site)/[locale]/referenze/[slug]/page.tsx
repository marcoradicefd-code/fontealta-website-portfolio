import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getReference } from "@/lib/content";
import { indicizzazione, risolviSeo } from "@/lib/seo-editoriale";
import { fallbackOgImages } from "@/lib/og-fallback-image";
import { conAltOg, openGraphBase } from "@/lib/open-graph";
import { absoluteUrl, localizedUrls } from "@/lib/urls";
import type { ActiveLocale } from "@/i18n/routing";

import { ReferenceCollectionsUsed } from "../_components/reference-collections-used";
import { ReferenceDetailHero } from "../_components/reference-detail-hero";
import { ReferenceGallery } from "../_components/reference-gallery";
import { ReferenceStory } from "../_components/reference-story";

export const revalidate = false;

interface PageProps {
  params: Promise<{ locale: ActiveLocale; slug: string }>;
}

/**
 * ISR on-demand: ritorna [] così nessuna pagina è pre-renderizzata al build.
 * Le pagine referenza vengono generate alla prima richiesta e cache con
 * `revalidate = false` (freschezza on-demand via webhook + tag
 * `projectReference:${slug}`; coerente col vincolo 0-documenti).
 */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const reference = await getReference(slug, locale);
  if (!reference) {
    const t = await getTranslations({ locale, namespace: "referenze" });
    return { title: t("notFoundTitle") };
  }
  const metaFromFields = [reference.architect, reference.location, reference.country]
    .filter(Boolean)
    .join(" · ");
  const seo = risolviSeo({
    seo: reference.seo,
    locale,
    // Titolo, architetto, luogo e paese sono nomi propri, non testo tradotto:
    // la scheda è nella lingua chiesta comunque.
    contenutoNellaLingua: true,
    template: { titolo: reference.title ?? "", description: metaFromFields },
  });
  const href = { pathname: "/referenze/[slug]" as const, params: { slug } };
  const canonico = absoluteUrl(locale, href);
  return {
    title: seo.titolo,
    // ⚠️ `undefined` e non la stringa vuota: senza architetto, luogo e paese non
    // c'è niente da dire, e un `<meta name="description" content="">` è peggio
    // dell'assenza del tag. Al 9/09/2026 i documenti `projectReference` sono
    // **zero**, quindi questo ramo non è mai stato servito.
    description: seo.description.length > 0 ? seo.description : undefined,
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
      description: seo.description.length > 0 ? seo.description : undefined,
      images: conAltOg(await fallbackOgImages(locale), seo.titolo, locale),
    },
  };
}

export default async function ReferenceDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const reference = await getReference(slug, locale);
  if (!reference) notFound();

  const gallery = reference.gallery ?? [];
  const collectionsUsed = reference.collectionsUsed ?? [];
  const t = await getTranslations({ locale, namespace: "referenze" });

  return (
    <>
      <ReferenceDetailHero reference={reference} />

      <ReferenceStory story={reference.story} />

      {gallery.length > 0 && (
        <section className="fa-section light">
          <div className="fa-container">
            <span className="fa-eyebrow">{t("galleryEyebrow")}</span>
            <h2 className="fa-h3 mt-eyebrow mb-10 text-fa-black">{t("galleryHeading")}</h2>
            <ReferenceGallery gallery={gallery} />
          </div>
        </section>
      )}

      {collectionsUsed.length > 0 && <ReferenceCollectionsUsed collections={collectionsUsed} />}
    </>
  );
}
