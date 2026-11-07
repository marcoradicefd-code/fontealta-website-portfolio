import type { Metadata } from "next";
import { SanityImage } from "@/components/media/sanity-image";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProgettareCta } from "@/components/sections/progettare-cta";
import { Link } from "@/i18n/navigation";
import {
  autoreArticoloJsonLd,
  dataModificaArticolo,
  publisherJsonLd,
  serializzaJsonLd,
} from "@/lib/json-ld";
import { conAltOg, ogImageScena, openGraphBase } from "@/lib/open-graph";
import { indicizzazione, risolviSeo } from "@/lib/seo-editoriale";
import { absoluteUrl, localizedUrls } from "@/lib/urls";
import { type ActiveLocale } from "@/i18n/routing";
import { getPostBySlug } from "@/lib/content";
import { LOCALE_INTL } from "@/lib/lingue";
import { readingTimeMinutes } from "@/lib/reading-time";
import { urlFor } from "@/sanity/lib/image";

import { ArticleBody } from "./_components/article-body";
import { AuthorCard } from "./_components/author-card";
import { risolviAlt } from "@/lib/alt-composto";

export const revalidate = false;

interface PageProps {
  params: Promise<{ locale: ActiveLocale; slug: string }>;
}

/** ISR on-demand (as model detail): empty params + revalidate false; cached until
 *  the webhook (post:${slug} tag) refreshes it, fresh after Marco publishes.
 *  Drafts stay hidden (perspective published). */
export function generateStaticParams() {
  return [];
}

/** Localized projections are strings at runtime (TypeGen mis-types as M6 array). */
function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Split a trailing "— Parte I/II" off the title (eyebrow gets it, H1 doesn't).
 *  Linear (no catastrophic backtracking): a valid "Parte <roman/digits>" suffix
 *  contains no dash, so the separating dash must be the LAST dash — find it, then
 *  test the short tail with an end-anchored regex. Equivalent to the previous
 *  /\s*[—–-]\s*(Parte\s+[IVX\d]+)\s*$/i on every input. */
function splitParte(title: string): { h1: string; parte: string | null } {
  const trimmed = title.trimEnd();
  const dashIdx = Math.max(
    trimmed.lastIndexOf("—"),
    trimmed.lastIndexOf("–"),
    trimmed.lastIndexOf("-"),
  );
  if (dashIdx === -1) return { h1: title, parte: null };
  const parte = trimmed.slice(dashIdx + 1).replace(/^\s+/, "");
  if (!/^Parte\s+[IVX\d]+$/i.test(parte)) return { h1: title, parte: null };
  return { h1: trimmed.slice(0, dashIdx).trim(), parte };
}

function formatDate(iso: string, locale: ActiveLocale): string {
  try {
    return new Intl.DateTimeFormat(LOCALE_INTL[locale], {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPostBySlug(slug, locale);
  if (!post) {
    const t = await getTranslations({ locale, namespace: "blog" });
    return { title: t("notFound") };
  }

  const title = asText(post.title);
  const excerpt = asText(post.excerpt);

  // La scelta fra campo scritto in Studio e template sta in `risolviSeo`, una
  // volta per tutto il sito. Qui restano solo i due template, che sono il ramo
  // «campo vuoto» e non cambiano.
  const seo = risolviSeo({
    seo: post.seo,
    locale,
    contenutoNellaLingua: post.contenutoNellaLingua ?? true,
    template: { titolo: title, description: excerpt },
    immagini: {
      seo: post.seo?.ogImage?.asset ? ogImageScena(post.seo.ogImage) : null,
      entita: post.coverImage?.asset ? ogImageScena(post.coverImage) : null,
    },
  });

  // ⚠️ Le immagini passano da `ogImageScena` e non da un `urlFor` scritto qui, e
  // il motivo è un difetto trovato sul preview: `urlFor` parte da `fit("max")`,
  // che con una larghezza e un'altezza vuol dire «al MASSIMO quelle» e non
  // ingrandisce. Sulla cover di «AISI 316 contro 304», nativa 1080×1350, il CDN
  // serviva **1080×567** mentre i tag `og:image:width` e `og:image:height`
  // dichiaravano 1200×630: due numeri che non descrivevano l'immagine servita.

  const href = { pathname: "/blog/[slug]" as const, params: { slug } };
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
      // `article` sovrascrive il `website` della base: è l'unica pagina del sito
      // che è davvero un articolo.
      type: "article",
      // ⚠️ **`og:title` è il titolo NUDO, senza « | Fontealta», su questa rotta
      // come su tutte le altre** (decisione del 9/09/2026): il marchio lo porta
      // già `og:site_name`, e ripeterlo dentro il titolo lo fa comparire due
      // volte in ogni anteprima social. Finché i dodici post tengono il valore
      // nella forma stringa, il suffisso esce lo stesso perché è dentro al
      // valore; la migrazione (C4.0) lo toglie, e quei dodici `og:title`
      // perdono il marchio. È una differenza **attesa**, da elencare nel dry-run.
      title: seo.titolo,
      description: seo.description,
      // ⚠️ `undefined` qui NON eredita l'immagine del layout: la pagina dichiara
      // un `openGraph` proprio, che lo sostituisce per intero, e il post
      // resterebbe senza og:image. Misurato su `cersaie-2026-dove-trovarci`, che
      // non ha cover. `risolviSeo` chiude la catena sulla riserva del sito: sei
      // post su dodici non hanno né cover né `seo.ogImage`.
      images: conAltOg(seo.immagini, seo.titolo, locale),
    },
  };
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const post = await getPostBySlug(slug, locale);
  if (!post) notFound();

  const t = await getTranslations({ locale, namespace: "blog" });
  // Le etichette dei blocchi del corpo: le stesse della pagina d'uso, più il link del video.
  const tUso = await getTranslations({ locale, namespace: "paginaUso" });
  const labels = {
    inSintesi: tUso("inSintesi"),
    tabella: tUso("tabella"),
    video: t("watchOnYoutube"),
  };

  const fullTitle = asText(post.title);
  const { h1, parte } = splitParte(fullTitle);
  const excerpt = asText(post.excerpt);
  const category = asText(post.categories?.[0]?.title);
  const eyebrow = [category, parte].filter(Boolean).join(" · ");
  const minutes = readingTimeMinutes(post.body);
  const dateLabel = post.publishedAt ? formatDate(post.publishedAt, locale) : "";
  const revisedLabel = post.revisedAt ? formatDate(post.revisedAt, locale) : "";
  const readingLabel = t("readingTime", { min: minutes });

  // L'alt della cover nella lingua (spec contenuti-per-lingua § A): `altI18n`, poi
  // l'italiano con `lang`, poi il titolo.
  const cover = risolviAlt(post.coverImage, locale);
  const coverAlt = cover.alt || fullTitle;
  const coverLang = cover.alt ? cover.lang : undefined;
  const coverUrl = post.coverImage?.asset
    ? (urlFor(post.coverImage)?.width(1120).height(700).url() ?? null)
    : null;

  const ldImage = (() => {
    const srcFromSeo = post.seo?.ogImage?.asset ? post.seo.ogImage : null;
    const src = srcFromSeo ?? (post.coverImage?.asset ? post.coverImage : null);
    // ⚠️ `fit("crop")` esplicito: `urlFor` parte da `fit("max")`, che con una
    // larghezza e un'altezza vuol dire «al MASSIMO quelle», quindi non ingrandisce.
    // Sulla cover di «AISI 316 contro 304» il ritaglio nativo è 1080×567 e l'URL
    // serviva 1080, sotto i 1200 px che le linee guida dell'Article chiedono.
    // Letto sull'HTML servito, non dedotto.
    return src ? urlFor(src)?.width(1200).height(630).fit("crop").url() : undefined;
  })();

  const dataModifica = dataModificaArticolo(post);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: fullTitle,
    // A quale pagina appartiene il nodo, nella lingua che si sta servendo.
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(locale, { pathname: "/blog/[slug]", params: { slug } }),
    },
    inLanguage: locale,
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    // ⚠️ `dateModified` = la data di revisione EDITORIALE (`revisedAt`) se c'è, altrimenti la
    // pubblicazione; mai `_updatedAt`, che si muove anche per una scrittura tecnica (Marco,
    // 5/11/2026 sera: revoca la Q10 del mattino). La regola sta in `dataModificaArticolo`.
    ...(dataModifica ? { dateModified: dataModifica } : {}),
    // Chi firma: la persona, oppure l'azienda. La regola sta in `json-ld.ts`,
    // accanto agli altri costruttori, dove è pura e testata.
    author: autoreArticoloJsonLd(post.author, absoluteUrl(locale, "/chi-siamo")),
    // ⚠️ Nessuna immagine di riserva qui, a differenza dell'`og:image`.
    // `Article.image` dichiara l'immagine DELL'ARTICOLO: metterci quella del sito
    // sarebbe un'affermazione falsa su un dato che i motori leggono come tale.
    // Sei post su dodici oggi non hanno né cover né `seo.ogImage`, e per quelli
    // il campo resta assente: è contenuto che manca, non codice.
    ...(ldImage ? { image: [ldImage] } : {}),
    publisher: publisherJsonLd(),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // L'escape di `<` vive in `serializzaJsonLd`, insieme al perché: era
        // scritto qui, nel breadcrumb, e ora anche nel grafo del sito.
        dangerouslySetInnerHTML={{ __html: serializzaJsonLd(jsonLd) }}
      />

      {/* `px-6` sul contenitore ESTERNO, come fa `.fa-section` (set 2026): senza, sotto
          1248 px testo, immagine e riquadro dell'autore toccavano il bordo sinistro
          dello schermo, a 390 come a 1024. Fuori dal `fa-container`, da 1248 in su
          non cambia niente. */}
      <div
        className="bg-fa-white px-6"
        style={{
          paddingTop: "var(--fa-space-article-top)",
          paddingBottom: "var(--fa-space-article-bottom)",
        }}
      >
        <div className="fa-container">
          <Link
            href="/blog"
            className="mb-8 inline-flex min-h-(--fa-touch-min) items-center gap-2 text-sm"
            style={{ color: "var(--fa-text-secondary)" }}
          >
            <ArrowLeft size={16} aria-hidden />
            {t("back")}
          </Link>

          <div className="grid items-start gap-x-(--fa-space-article-cols) gap-y-12 lg:grid-cols-[minmax(0,1fr)_312px]">
            <article>
              <p
                className="m-0 mb-6 flex items-center gap-4 text-micro-4 font-semibold uppercase"
                style={{ letterSpacing: "0.18em", color: "var(--fa-navy)" }}
              >
                <span
                  aria-hidden
                  className="inline-block h-px w-[34px]"
                  style={{ background: "var(--fa-navy)" }}
                />
                {eyebrow}
              </p>

              <h1 className="fa-h1 mb-6" style={{ fontWeight: 400, maxWidth: "15ch" }}>
                {h1}
              </h1>

              {excerpt ? (
                <p
                  className="m-0 mb-7 max-w-[48ch] text-body-6"
                  style={{ lineHeight: 1.5, color: "var(--fa-text-secondary)" }}
                >
                  {excerpt}
                </p>
              ) : null}

              {/**
               * La data era testo semplice: ora è un `<time>` con `dateTime`
               * ISO, cioè lo STESSO valore che `datePublished` dichiara nel
               * JSON-LD qui sopra. A video non cambia un pixel; cambia che un
               * lettore automatico che non esegue JSON-LD — e quelli che
               * costruiscono risposte spesso non lo eseguono — la data adesso
               * la trova nel markup.
               *
               * ⚠️ **«Aggiornato il» solo con la data di revisione EDITORIALE**
               * (`revisedAt`, dal 5/11/2026), mai col timestamp di scrittura
               * del CMS: il 10/09/2026 `_updatedAt` valeva OGGI su 12 post su
               * 12, dieci allo stesso istante (`07:01:26`, la migrazione dei
               * campi `seo`), e scriverlo in pagina avrebbe detto al lettore
               * che dodici articoli erano stati rivisti quel giorno.
               */}
              <p
                className="m-0 mb-10 text-micro-5 font-medium uppercase"
                style={{ letterSpacing: "0.1em", color: "var(--fa-text-tertiary)" }}
              >
                {post.publishedAt && dateLabel ? (
                  <time dateTime={post.publishedAt}>{dateLabel}</time>
                ) : null}
                {post.publishedAt && dateLabel ? ` · ${readingLabel}` : readingLabel}
                {post.revisedAt && revisedLabel ? (
                  <>
                    {" · "}
                    <time dateTime={post.revisedAt}>{t("updatedOn", { date: revisedLabel })}</time>
                  </>
                ) : null}
              </p>

              <div
                className="relative mb-12 w-full overflow-hidden rounded-xl"
                style={{
                  aspectRatio: "16 / 10",
                  border: "var(--fa-stroke-hairline) solid var(--fa-border-light)",
                }}
                role="img"
                aria-label={coverAlt}
                lang={coverLang}
              >
                {coverUrl ? (
                  <SanityImage
                    src={coverUrl}
                    alt={coverAlt}
                    lang={coverLang}
                    fill
                    priority
                    sizes="(max-width: 920px) 100vw, 760px"
                    className="object-cover"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(120deg, var(--color-fa-steel-bx) 0%, var(--color-fa-steel-mx) 50%, var(--color-fa-steel-bx) 100%)",
                    }}
                  />
                )}
              </div>

              <ArticleBody blocks={post.body} labels={labels} />
            </article>

            <AuthorCard author={post.author} label={t("writtenBy")} locale={locale} />
          </div>
        </div>
      </div>

      {/* Chiusura = CTA contatto condivisa. Titolo e sub dal namespace blog: una
          fonte sola per elenco e articolo, e il sub segue la domanda del titolo. */}
      <ProgettareCta title={t("contactH2")} subtitle={t("contactSub")} />
    </>
  );
}
