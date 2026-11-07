import "server-only";

import { sanityFetch } from "@/sanity/lib/live";
import {
  ALL_COLLECTION_SLUGS_QUERY,
  ALL_CONCEALED_BODY_SLUGS_QUERY,
  ALL_REFERENCE_SLUGS_QUERY,
  CATEGORIES_QUERY,
  COLLECTIONS_COUNT_QUERY,
  COLLECTIONS_OVERVIEW_QUERY,
  CONCEALED_BODIES_INDEX_QUERY,
  CONCEALED_BODY_BY_SLUG_QUERY,
  FAQ_QUERY,
  FEATURED_COLLECTIONS_QUERY,
  FINISHES_OVERVIEW_QUERY,
  FOOTER_COLLECTIONS_QUERY,
  MODEL_DETAIL_QUERY,
  MODEL_SLUGS_QUERY,
  POST_BY_SLUG_QUERY,
  POSTS_QUERY,
  REFERENCE_BY_SLUG_QUERY,
  REFERENCES_OVERVIEW_QUERY,
  SITE_SETTINGS_QUERY,
  USE_PAGE_QUERY,
} from "@/sanity/lib/queries";

import type { SanityLocale } from "@/sanity/env";
import type { FaqEntry } from "@/lib/faq";
import { faqOnline } from "@/lib/faq-online";
import type { UsePageCode } from "@/lib/pagina-uso";
import { contentPageId } from "@/sanity/lib/faq-rules";

type LocaleArg = SanityLocale | (string & {});

export async function getCollections(locale: LocaleArg = "it") {
  const { data } = await sanityFetch({
    query: COLLECTIONS_OVERVIEW_QUERY,
    params: { locale },
    tags: ["collection", "model"],
    stega: false,
  });
  return data ?? [];
}

export async function getFeaturedCollections(locale: LocaleArg = "it") {
  const { data } = await sanityFetch({
    query: FEATURED_COLLECTIONS_QUERY,
    params: { locale },
    tags: ["collection", "model"],
    stega: false,
  });
  return data ?? [];
}

// Footer site-wide: nomi/link collezioni only. Tag ["collection"] SOLO (niente
// "model") → un publish di model NON invalida il footer né, transitivamente, ogni
// pagina che lo renderizza.
export async function getFooterCollections(locale: LocaleArg = "it") {
  const { data } = await sanityFetch({
    query: FOOTER_COLLECTIONS_QUERY,
    params: { locale },
    tags: ["collection"],
    stega: false,
  });
  return data ?? [];
}

// Stat bar home. Tag ["collection"] SOLO, come getFooterCollections: il numero non
// dipende dai model, quindi un publish di modello non deve invalidare la home.
// Nessun `params.locale`: la query non lo usa (le collection sono documenti unici IT).
export async function getCollectionsCount() {
  const { data } = await sanityFetch({
    query: COLLECTIONS_COUNT_QUERY,
    params: {},
    tags: ["collection"],
    stega: false,
  });
  return data;
}

// ─── Cantiere INCASSI ────────────────────────────────────────────────────────
// Tag `model` OLTRE a `concealedBody` su ENTRAMBI i loader, e non è zelo: la
// sezione «Usato da» della scheda dipende dai modelli, quindi un publish di
// modello deve invalidarla. Sull'indice il tag
// `model` non servirebbe, ma tenerlo allineato costa una invalidazione in più su
// una pagina sola ed evita che qualcuno un giorno lo tolga dalla scheda "per
// simmetria". `collection` c'è perché l'hero legge il documento collezione.
export async function getConcealedBodiesIndex(locale: LocaleArg = "it") {
  const { data } = await sanityFetch({
    query: CONCEALED_BODIES_INDEX_QUERY,
    params: { locale },
    tags: ["concealedBody", "collection", "model"],
    stega: false,
  });
  return data;
}

export async function getConcealedBody(slug: string, locale: LocaleArg = "it") {
  const { data } = await sanityFetch({
    query: CONCEALED_BODY_BY_SLUG_QUERY,
    params: { slug, locale },
    tags: [`concealedBody:${slug}`, "concealedBody", "model"],
    stega: false,
  });
  return data;
}

// Serve solo a `generateStaticParams`, quindi porta qui dentro le due opzioni che
// quel caso d'uso richiede — stesse del `generateStaticParams` delle collezioni:
// `perspective: "published"` per non pre-renderizzare i path di una bozza, e
// `stega: false` perché i marcatori stega sono caratteri invisibili dentro le
// stringhe e uno slug così diventa una rotta che non risolve.
export async function getAllConcealedBodySlugs() {
  const { data } = await sanityFetch({
    query: ALL_CONCEALED_BODY_SLUGS_QUERY,
    params: {},
    perspective: "published",
    stega: false,
    tags: ["concealedBody"],
  });
  return data ?? [];
}

export async function getFinishes(locale: LocaleArg = "it") {
  const { data } = await sanityFetch({
    query: FINISHES_OVERVIEW_QUERY,
    params: { locale },
    tags: ["finish"],
    stega: false,
  });
  return data ?? [];
}

export async function getReferences(locale: LocaleArg = "it") {
  const { data } = await sanityFetch({
    query: REFERENCES_OVERVIEW_QUERY,
    params: { locale },
    tags: ["projectReference"],
    stega: false,
  });
  return data ?? [];
}

export async function getReference(slug: string, locale: LocaleArg = "it") {
  const { data } = await sanityFetch({
    query: REFERENCE_BY_SLUG_QUERY,
    params: { slug, locale },
    tags: [`projectReference:${slug}`],
    stega: false,
  });
  return data;
}

export async function getSiteSettings(locale: LocaleArg = "it") {
  const { data } = await sanityFetch({
    query: SITE_SETTINGS_QUERY,
    params: { locale },
    tags: ["siteSettings"],
    stega: false,
  });
  return data;
}

export async function getAllCollectionSlugs() {
  const { data } = await sanityFetch({
    query: ALL_COLLECTION_SLUGS_QUERY,
    params: {},
    tags: ["collection"],
    stega: false,
  });
  return data ?? [];
}

export async function getAllReferenceSlugs() {
  const { data } = await sanityFetch({
    query: ALL_REFERENCE_SLUGS_QUERY,
    params: {},
    tags: ["projectReference"],
    stega: false,
  });
  return data ?? [];
}

export async function getModel(slug: string, locale: LocaleArg = "it") {
  const { data } = await sanityFetch({
    query: MODEL_DETAIL_QUERY,
    params: { slug, locale },
    tags: [`model:${slug}`, "finish"],
    stega: false,
  });
  return data;
}

export async function getAllModelSlugs() {
  const { data } = await sanityFetch({
    query: MODEL_SLUGS_QUERY,
    params: {},
    tags: ["model"],
    stega: false,
  });
  return data ?? [];
}

// ─── Blog (FASE 1) ───────────────────────────────────────────────────────────

export async function getPosts(locale: LocaleArg = "it") {
  const { data } = await sanityFetch({
    query: POSTS_QUERY,
    params: { locale },
    tags: ["post", "category", "author"],
    stega: false,
  });
  return data ?? [];
}

export async function getPostBySlug(slug: string, locale: LocaleArg = "it") {
  const { data } = await sanityFetch({
    query: POST_BY_SLUG_QUERY,
    params: { slug, locale },
    // `author`: la pagina mostra la foto e il ruolo dell'autore, e un publish dell'autore (o un
    // carico della sezione alt-autori) la deve rinfrescare. Senza, la invalidava solo `post:<slug>`.
    tags: [`post:${slug}`, "author"],
    stega: false,
  });
  return data;
}

export async function getCategories(locale: LocaleArg = "it") {
  const { data } = await sanityFetch({
    query: CATEGORIES_QUERY,
    params: { locale },
    tags: ["category"],
    stega: false,
  });
  return data ?? [];
}

/**
 * Le FAQ di una pagina nella sua lingua, le sole con risposta (`FAQ_QUERY`), solo con l'interruttore
 * acceso (`faqOnline`, spento di default). I tag li sceglie la
 * pagina: `collection:<slug>` per una collezione, `contentPage` per una pagina principale, che
 * il webhook manda col solo tipo perché quei documenti non hanno slug.
 *
 * ⚠️ Il cast: con la lingua in un parametro (`faq[$locale]`) typegen dà `never`, come per gli
 * altri campi per lingua (M6). La forma la dichiara `FaqEntry`.
 */
export async function getFaq(id: string, locale: LocaleArg, tags: string[]) {
  // Interruttore spento: nessuna FAQ, quindi né sezione né `FAQPage`, in tutte le lingue.
  if (!faqOnline()) return [];
  const { data } = await sanityFetch({
    query: FAQ_QUERY,
    params: { id, locale },
    tags,
    stega: false,
  });
  return (data ?? []) as unknown as FaqEntry[];
}

/**
 * Una pagina d'uso (spec `docs/specs/seo-pagine-contenuto.md`, c1b), dal documento fisso
 * `contentPage-<code>`. Il tag della pagina è il tipo, `contentPage`, come per le FAQ della home:
 * il documento non ha slug e il webhook manda il tipo. Il cancello per lingua lo fa la pagina
 * (`titoloNellaLingua`), non la query, perché gli hreflang vogliono tutte le lingue presenti.
 *
 * ⚠️ **Anche `collection` e `model`, come `getCollections`**: le card delle collezioni a video
 * contano i modelli e ne leggono le macro, e la fetch di `next-sanity` non scade da sola
 * (`revalidate: false`, rule `i18n-sanity`). Col solo `contentPage`, una doccia aggiunta a Club o
 * una cover nuova non si vedrebbero su questa pagina fino al carico successivo. E i tipi a cui
 * puntano i link interni del corpo (`post`, `concealedBody`, `projectReference`): la query ne legge
 * lo slug, e uno slug cambiato lascerebbe qui un link verso una 404 (verificatore del 4/11).
 */
export async function getUsePage(code: UsePageCode, locale: LocaleArg) {
  const { data } = await sanityFetch({
    query: USE_PAGE_QUERY,
    params: { id: contentPageId(code), locale },
    tags: ["contentPage", "collection", "model", "post", "concealedBody", "projectReference"],
    stega: false,
  });
  return data;
}
