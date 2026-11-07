import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { CollectionPageJsonLd } from "@/components/seo/collection-page-json-ld";
import { FaqSection } from "@/components/faq/faq-section";
import { CollectionHero } from "@/components/heros/collection-hero";
import { breadcrumbCatalogo } from "@/lib/breadcrumb";
import { getFaq } from "@/lib/content";
import { collectionProfile, fitsTitle } from "@/lib/meta-title";
import { modelDisplayName } from "@/lib/model-display-name";
import { taglineForLocale } from "@/lib/tagline";
import { conAltNellaLingua, conAltOg, ogImageScena, openGraphBase } from "@/lib/open-graph";
import { indicizzazione, risolviSeo } from "@/lib/seo-editoriale";
import { absoluteUrl, localizedUrls } from "@/lib/urls";
import type { ActiveLocale } from "@/i18n/routing";
import { sanityFetch } from "@/sanity/lib/live";
import type { COLLECTION_DETAIL_QUERY_RESULT } from "@/sanity/types.gen";
import { COLLECTION_DETAIL_QUERY, COLLECTION_SLUGS_QUERY } from "@/sanity/lib/queries";

import { ModelsSection } from "./_components/models-section";
import { conAltComposto, messaggiAlt } from "@/lib/messaggi-alt";

export const revalidate = false;

interface PageProps {
  params: Promise<{ locale: ActiveLocale; slug: string }>;
}

export async function generateStaticParams() {
  const { data } = await sanityFetch({
    query: COLLECTION_SLUGS_QUERY,
    params: {},
    perspective: "published",
    stega: false,
    tags: ["collection"],
  });
  return (data ?? []).map((item) => ({ slug: item.slug ?? "" })).filter((p) => p.slug !== "");
}

/**
 * Le collezioni il cui TITOLO dice già il tipo: lì la frase non si antepone,
 * perché «Accessories Accessories» non informa nessuno (decisione di Marco,
 * 21/09/2026). I corpi a incasso non passano di qui — hanno una cartella
 * statica tutta loro — ma restano elencati perché la regola è sul dato, non
 * sulla rotta: se un giorno quel documento finisse in questa pagina, il titolo
 * dovrebbe comportarsi allo stesso modo.
 */
const TITOLO_SENZA_TIPO = new Set(["accessories", "corpi-a-incasso"]);

/**
 * Il `title` della collezione: **prima il tipo, poi il nome** — «Colonne doccia
 * Boss» (decisione di Marco, 21/09/2026), che mette davanti la parola cercata.
 *
 * ⚠️ La frase viene dal PROFILO della collezione, non dalla sola macro
 * dominante: in tedesco il mercato distingue «Duschsäulen und Standarmaturen»
 * da «Duschsäulen», e quella distinzione guarda la presenza di lavabo o vasca
 * accanto alla doccia (decisione di Marco, 21/09/2026).
 *
 * ⚠️ La dominante resta il primo criterio ed è quella **con più articoli**, non
 * la prima di `MACRO_ORDER`: Boss ha 26 modelli doccia contro 14 vasca e 12
 * lavabo, e con l'ordine fisso il titolo sarebbe diventato «Rubinetteria lavabo
 * Boss». Misurato su tutte e 22: 19 dicono `doccia`, Kitchen `cucina`, Spring
 * `giardino`.
 *
 * ⚠️ Tre ricadute sul solo titolo, tutte deliberate: la collezione che è già il
 * suo tipo, quella senza modelli con macro, e la composizione che non starebbe
 * nel limite dei 60 col suffisso del layout.
 */
function titoloDellaCollezione(
  data: NonNullable<COLLECTION_DETAIL_QUERY_RESULT>,
  t: Awaited<ReturnType<typeof getTranslations<"collezioni">>>,
): string {
  const titolo = data.title ?? "";
  const slug = data.slug?.current ?? "";
  if (TITOLO_SENZA_TIPO.has(slug)) return titolo;
  const profilo = collectionProfile(data.models ?? []);
  if (!profilo) return titolo;
  const tipo = t(`tipoBreve.${profilo}` as "tipoBreve.doccia");
  const composto = t("titoloConTipo", { tipo, titolo });
  return fitsTitle(composto) ? composto : titolo;
}

/**
 * La catena SEO della collezione, in un posto solo.
 *
 * ⚠️ **La chiamano `generateMetadata` E la pagina**, ed è la ragione per cui è
 * stata estratta: la `description` che il `<meta>` dichiara e quella che il nodo
 * `CollectionPage` dichiara devono essere la stessa frase. Scritte in due punti
 * comincerebbero identiche e divergerebbero alla prima modifica di uno dei due,
 * senza che niente lo mostri — il meta si legge nell'HTML, il JSON-LD no. Next
 * deduplica la fetch, quindi chiamarla due volte non costa una richiesta.
 */
async function seoDellaCollezione(
  data: NonNullable<COLLECTION_DETAIL_QUERY_RESULT>,
  locale: ActiveLocale,
) {
  const t = await getTranslations({ locale, namespace: "dettaglio" });
  const tCollezioni = await getTranslations({ locale, namespace: "collezioni" });
  const tHome = await getTranslations({ locale, namespace: "home" });
  const descrizione =
    // ⚠️ La tagline della LINGUA chiesta, senza ripiego: una tagline italiana su
    // una pagina inglese sarebbe una description nella lingua sbagliata, che è
    // il motivo per cui il campo era rimasto vuoto ovunque.
    taglineForLocale(data.tagline, locale) ??
    t("metaDescription", {
      collezione: data.title ?? "",
      articoli: data.modelsCount ?? 0,
      finiture: data.finishesCount ?? 0,
    });
  return risolviSeo({
    seo: data.seo,
    locale,
    // Il titolo di una collezione è un nome proprio, uguale nelle due lingue, e la
    // description arriva dai messaggi i18n: la pagina è nella lingua chiesta
    // sempre, quindi non c'è un contenuto che possa mancare.
    contenutoNellaLingua: true,
    template: { titolo: titoloDellaCollezione(data, tCollezioni), description: descrizione },
    immagini: {
      seo: data.seo?.ogImage?.asset ? ogImageScena(data.seo.ogImage) : null,
      // L'alt della cover composto nella lingua della pagina, come nelle card
      // («Collezione Boss», «Boss collection»): l'alt salvato su Sanity era italiano, e
      // su due collezioni aveva il trattino lungo e su una il nome del file (Marco,
      // 2/11/2026, spec contenuti-per-lingua § A.5).
      entita: conAltNellaLingua(
        ogImageScena(data.coverImage),
        tHome("featuredCardAlt", { nome: data.title ?? "" }),
      ),
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const { data } = await sanityFetch({
    query: COLLECTION_DETAIL_QUERY,
    // `locale` serve alla descrizione per l'alt composto delle card (spec contenuti-per-lingua).
    params: { slug, locale },
    stega: false,
    tags: [`collection:${slug}`, "model"],
  });
  // Nessun canonical sul ramo «non trovata»: sotto, la pagina fa `notFound()` e
  // la risposta è un 404. Dichiarare un canonical lì significherebbe annunciare
  // come indicizzabile un URL che non esiste.
  if (!data) return { title: "Collezione non trovata" };
  const href = { pathname: "/collezioni/[slug]" as const, params: { slug } };
  const canonico = absoluteUrl(locale, href);
  const seo = await seoDellaCollezione(data, locale);

  return {
    title: seo.titolo,
    // ⚠️ La `description` non era localizzata, ed era la description VERA di
    // tutte e 44 le pagine: `tagline` è null su 22 collezioni su 22, quindi il
    // ramo che si leggeva come fallback era l'unico che girava, in italiano
    // anche su `/en`. Ora è una stringa ICU per locale, coi conteggi che la
    // query già proietta. `tagline` mantiene la precedenza per il giorno che
    // qualcuno la scriverà: sarà copy italiano su un documento unico, quindi la
    // sua traduzione è lavoro della PR i18n, non di questa.
    description: seo.description,
    ...indicizzazione(seo.noIndex, {
      canonical: canonico,
      languages: localizedUrls(href),
    }),
    openGraph: {
      ...openGraphBase(locale, seo.noIndex ? null : canonico),
      title: seo.titolo,
      description: seo.description,
      images: conAltOg(seo.immagini, seo.titolo, locale),
    },
  };
}

export default async function CollectionDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const { data } = await sanityFetch({
    query: COLLECTION_DETAIL_QUERY,
    // `locale` serve alla descrizione per l'alt composto delle card (spec contenuti-per-lingua).
    params: { slug, locale },
    tags: [`collection:${slug}`, "model", "finish"],
    stega: false,
  });

  if (!data) notFound();

  // Le FAQ stanno nel documento della collezione: un publish rivalida `collection:<slug>`.
  const faq = await getFaq(data._id, locale, [`collection:${slug}`]);

  // Il breadcrumb si costruisce QUI e non dentro la sezione: `ModelsSection` è un
  // client component, e le etichette localizzate + la lista che servira' al
  // JSON-LD devono nascere una volta sola, lato server.
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const briciole = breadcrumbCatalogo(
    { home: tNav("home"), collezioni: tNav("collezioni") },
    { label: data.title ?? "" },
  );

  // La lista del `CollectionPage` nasce da `data.models`, cioè dalla STESSA
  // collezione che `ModelsSection` disegna: i filtri sono client-side e non
  // cambiano l'HTML servito, quindi ciò che il dato strutturato dichiara è ciò
  // che la griglia mostra. I modelli senza slug si scartano qui e non a valle:
  // una voce senza URL in un `ItemList` è una voce che nessuno può seguire.
  const seo = await seoDellaCollezione(data, locale);
  const elenco = (data.models ?? [])
    .filter((m) => Boolean(m.slug))
    .map((m) => ({
      name: modelDisplayName(m.name, locale, m.code),
      url: absoluteUrl(locale, { pathname: "/modello/[slug]", params: { slug: m.slug ?? "" } }),
    }));

  const mAlt = await messaggiAlt(locale);

  return (
    <>
      <BreadcrumbJsonLd items={briciole} locale={locale} />
      <CollectionPageJsonLd
        locale={locale}
        name={data.title ?? ""}
        description={seo.description}
        url={absoluteUrl(locale, { pathname: "/collezioni/[slug]", params: { slug } })}
        items={elenco}
      />
      <CollectionHero collection={data} locale={locale} />
      <ModelsSection
        collection={{
          ...data,
          // L'alt delle card composto sul server, nella lingua della pagina (spec
          // contenuti-per-lingua § A): la collezione è quella della pagina.
          models: conAltComposto(data.models ?? [], (m) => m.collectionTitle, locale, mAlt),
        }}
        locale={locale}
        breadcrumb={{ items: briciole, ariaLabel: tNav("breadcrumbAria") }}
      />
      <FaqSection items={faq} locale={locale} withContactPrompt adjacentLight="above" />
    </>
  );
}
