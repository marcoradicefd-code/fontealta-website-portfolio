import type { MetadataRoute } from "next";

import { ACTIVE_LOCALES, type ActiveLocale } from "@/i18n/routing";
import { dataModificaArticolo } from "@/lib/json-ld";
import { isUsePageCode, lingueConTitolo, USE_PAGE_ROUTES } from "@/lib/pagina-uso";
import { absoluteUrl, localizedUrls, type RouteHref } from "@/lib/urls";

/**
 * Assemblaggio della sitemap, **puro**: prende le liste già lette da Sanity e
 * restituisce le voci. Il fetch sta in `src/app/sitemap.ts`.
 *
 * ⚠️ La separazione non è estetica: è ciò che rende il conteggio verificabile in
 * un test unitario senza rete. Una sitemap sbagliata è invisibile — non rompe
 * nessuna pagina, non fa fallire nessun build, e si scopre in Search Console
 * settimane dopo. Stesso motivo per cui `filtri-url.ts` e `card-image.ts` sono
 * funzioni pure con i loro test.
 */

/**
 * Le rotte senza documento dietro, per chiave di rotta e non per URL: gli URL
 * localizzati li costruisce `localizedUrls()` da qui.
 *
 * ⚠️ **`/area-riservata` non c'è, ed è la stessa decisione dei canonical.** La
 * rotta dichiara `robots: { index: false }`: metterla in sitemap significherebbe
 * chiedere a Google di visitare una pagina che poi le dice di non indicizzare.
 * Fuori anche il 404 e le route API, che non sono pagine.
 *
 * ⚠️ **`/collezioni/corpi-a-incasso` entra DA QUI**, non dalla lista delle
 * collezioni, benché esista un documento `collection` con quello slug: il
 * percorso è servito dalla cartella statica, che nella mappa dei pathnames ha
 * una voce sua e in inglese diventa `/en/collections/concealed-bodies`. Passando
 * dalla chiave dinamica uscirebbe `/en/collections/corpi-a-incasso`, che risponde
 * 200 ma dichiara il canonical dell'altro: un duplicato annunciato da noi. La
 * query lo esclude a monte (`SITEMAP_QUERY`), qui rientra dalla porta giusta.
 */
export const ROTTE_STATICHE = [
  "/",
  "/collezioni",
  "/collezioni/corpi-a-incasso",
  "/produzione",
  "/finiture",
  "/chi-siamo",
  "/contatti",
  "/referenze",
  "/blog",
  "/menzioni-legali",
] as const satisfies readonly RouteHref[];

/** Una riga di `SITEMAP_QUERY`. `slug` è `string | null` perché TypeGen non
 *  restringe su `defined()`: il null lo scartiamo qui, una volta sola. */
export interface VoceSanity {
  slug: string | null;
  _updatedAt?: string | null;
}

/**
 * Una riga dei post di `SITEMAP_QUERY`: le date EDITORIALI, non `_updatedAt` (Marco, 5/11/2026
 * sera). Il `lastmod` di un post segue la regola di `dateModified` del suo JSON-LD
 * (`dataModificaArticolo`): `revisedAt`, altrimenti `publishedAt`. `_updatedAt` si muove a ogni
 * scrittura tecnica (un link, una data corretta) e direbbe a Google che l'articolo è cambiato.
 * Collezioni, modelli, corpi, referenze e pagine d'uso restano su `_updatedAt`: lì una FAQ o un
 * metadato cambiato è un cambio vero della pagina.
 */
export interface VocePost {
  slug: string | null;
  publishedAt?: string | null;
  revisedAt?: string | null;
}

export interface DatiSitemap {
  collections: readonly VoceSanity[];
  models: readonly VoceSanity[];
  bodies: readonly VoceSanity[];
  references: readonly VoceSanity[];
  posts: readonly VocePost[];
  /** Le pagine d'uso (c1b): il titolo intero, per sapere in quali lingue esistono. */
  usePages?: readonly { code: string | null; _updatedAt?: string | null; titoli?: unknown }[];
}

/**
 * Una voce per locale attivo, con la stessa mappa hreflang che la pagina emette
 * nel suo `alternates.languages`. È la stessa funzione, quindi HTML e sitemap
 * non possono divergere: se un giorno divergessero sarebbe perché qualcuno ha
 * scritto gli URL a mano da una parte sola.
 *
 * `lastModified` si scrive **solo** se il documento ha una data. Sulle rotte
 * statiche non c'è: metterci `new Date()` direbbe a ogni deploy che tutte le
 * pagine sono cambiate, che è falso e per giunta rumoroso. Niente `priority` e
 * niente `changeFrequency`: sono suggerimenti che Google dichiara di ignorare, e
 * inventarli qui vorrebbe dire fingere una gerarchia che non abbiamo misurato.
 */
function perLocale(
  href: RouteHref,
  lastModified?: string | null,
  lingue: readonly ActiveLocale[] = ACTIVE_LOCALES,
): MetadataRoute.Sitemap {
  const languages = localizedUrls(href, lingue);
  return lingue.map((locale) => ({
    url: absoluteUrl(locale, href),
    ...(lastModified ? { lastModified } : {}),
    alternates: { languages },
  }));
}

/** Le voci di un tipo di documento. Il `href` arriva come funzione così la
 *  chiave di rotta resta un letterale controllato dal typecheck. */
function daSanity<V extends { slug: string | null }>(
  voci: readonly V[],
  href: (slug: string) => RouteHref,
  data: (v: V) => string | null | undefined = (v) => (v as VoceSanity)._updatedAt,
): MetadataRoute.Sitemap {
  return voci.flatMap((v) => (v.slug ? perLocale(href(v.slug), data(v)) : []));
}

export function vociSitemap(dati: DatiSitemap): MetadataRoute.Sitemap {
  return [
    ...ROTTE_STATICHE.flatMap((href) => perLocale(href)),
    ...daSanity(dati.collections, (slug) => ({ pathname: "/collezioni/[slug]", params: { slug } })),
    ...daSanity(dati.bodies, (slug) => ({
      pathname: "/collezioni/corpi-a-incasso/[slug]",
      params: { slug },
    })),
    ...daSanity(dati.models, (slug) => ({ pathname: "/modello/[slug]", params: { slug } })),
    ...daSanity(dati.references, (slug) => ({ pathname: "/referenze/[slug]", params: { slug } })),
    ...daSanity(
      dati.posts,
      (slug) => ({ pathname: "/blog/[slug]", params: { slug } }),
      dataModificaArticolo,
    ),
    // Le pagine d'uso: solo nelle lingue col titolo, con gli hreflang delle stesse (spec § 5).
    ...(dati.usePages ?? []).flatMap((p) =>
      isUsePageCode(p.code)
        ? perLocale(USE_PAGE_ROUTES[p.code], p._updatedAt, lingueConTitolo(p.titoli))
        : [],
    ),
  ];
}
