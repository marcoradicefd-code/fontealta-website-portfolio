import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import type { ActiveLocale } from "@/i18n/routing";
import { ProgettareCta } from "@/components/sections/progettare-cta";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { altProdotto, messaggiAlt } from "@/lib/messaggi-alt";
import { breadcrumbCatalogo } from "@/lib/breadcrumb";
import { getModel } from "@/lib/content";
import { modelHead } from "@/lib/meta-title";
import { modelDisplayName } from "@/lib/model-display-name";
import { conAltOg, ogImageProdotto, openGraphBase } from "@/lib/open-graph";
import { indicizzazione, risolviSeo } from "@/lib/seo-editoriale";
import { productLabelParts } from "@/lib/product-label";
import { productTypePhrase } from "@/lib/product-type-phrase";
import { absoluteUrl, localizedUrls } from "@/lib/urls";
import { sanityFetch } from "@/sanity/lib/live";
import { MODEL_DETAIL_QUERY } from "@/sanity/lib/queries";

import { CollectionAffinities } from "./_components/collection-affinities";
import { ModelHero } from "./_components/model-hero";
import { ModelSpecs } from "./_components/model-specs";

export const revalidate = false;

interface PageProps {
  params: Promise<{ locale: ActiveLocale; slug: string }>;
}

/**
 * ISR on-demand (decisione FASE-4.4-PLAN A9): nessun pre-render al build dei
 * 591×2 = 1182 path. `dynamicParams` (default true) serve ogni slug valido alla
 * prima visita e lo cache-a con `revalidate = false` (freschezza on-demand via
 * webhook + tag `model:${slug}`). Build veloce, fresh post-Sanity.
 */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const { data } = await sanityFetch({
    query: MODEL_DETAIL_QUERY,
    params: { slug, locale },
    stega: false,
    tags: [`model:${slug}`],
  });
  if (!data) return { title: "Modello non trovato" };
  const name = modelDisplayName(data.name, locale, data.code);
  const href = { pathname: "/modello/[slug]" as const, params: { slug } };
  const t = await getTranslations({ locale, namespace: "modello" });
  const tCategoria = await getTranslations({ locale, namespace: "productCategories" });
  const tSottotipo = await getTranslations({ locale, namespace: "productSubtypes" });

  // ⚠️ Il template precedente scriveva il codice DUE VOLTE: `name` è già
  // «collezione + codice» sul dato vivo («Boss B40L»), e la coda aggiungeva
  // `data.code`. Portava anche un'em dash, che il LOCK di CLAUDE.md NON copre:
  // quel LOCK vale per `product-label.ts` e `model-hero.tsx`, non per il copy
  // servito a utenti e motori.
  const collezione = data.collections?.[0]?.title?.trim() ?? "";
  const finiture = data.finishes?.length ?? 0;
  const canonico = absoluteUrl(locale, href);
  const alternates = { canonical: canonico, languages: localizedUrls(href) };
  // La composizione prodotto, portata a 1200×630 con le bande sul fondo del
  // brand: `ogImageSanity` spiega perché non è un ritaglio.
  const immagini = ogImageProdotto(data.primaryImage);

  // Senza collezione non si compone né il title né la description: si ricade sul
  // solo nome e sulla description del layout. Oggi non capita — 0 modelli su 595
  // sono senza collezione, misurato — e l'alternativa sarebbe inventare una
  // frase per un caso che non esiste.
  if (!collezione)
    return {
      title: name,
      alternates,
      // Questo ramo dichiara un canonical, quindi dichiara anche `og:url`:
      // il cancello e' uno solo. L'immagine e' quella del prodotto, gia'
      // risolta sopra, perche' dichiarare `openGraph` cancella quello del layout.
      openGraph: { ...openGraphBase(locale, canonico), images: conAltOg(immagini, name, locale) },
    };

  /**
   * ⚠️ **Su 553 modelli su 595 il nome COMINCIA con il nome della collezione**
   * («Boss B40L» in «Boss»), quindi scrivere anche la collezione la ripete: il
   * title diventava «Boss B40L · Boss» e la description «Boss B40L, dalla
   * collezione Boss». Misurato sul dato vivo, non stimato.
   *
   * Dove si ripete, la collezione esce e al suo posto entra la **categoria**
   * localizzata, che è informazione nuova e che la query già proietta
   * (`productMacro`): il title torna al solo nome, e il marchio glielo aggiunge
   * il `title.template` del layout.
   *
   * Sui **42** in cui il nome non comincia con la collezione — «Origo
   * C50AS.YCWS.ME.D» dentro Yacht — non si ripete niente e la forma resta quella
   * con la collezione, che lì dice davvero qualcosa in più.
   *
   * ⚠️ Il confronto è **case-insensitive e richiede lo spazio**: senza lo spazio
   * una collezione «Boss» combacerebbe dentro un nome «Bossa», la stessa
   * famiglia di trappole del `match` di GROQ per token; e senza il
   * case-insensitive salterebbe il documento ILLE, che ha `title` «ILLE» mentre
   * altrove si legge «Ille».
   */
  const ripeteLaCollezione = name.toLowerCase().startsWith(`${collezione.toLowerCase()} `);

  /**
   * Il tipo di prodotto in forma di frase: «Colonna per doccia», EN «Shower
   * column». Le due etichette sono le stesse della pill — `productLabelParts`
   * è la sorgente comune, estratta da `product-label.ts` proprio per questo —
   * ma **l'em dash della pill qui non entra**: quello è un separatore di
   * composizione, coperto dal LOCK di CLAUDE.md, e questa invece è copy servito
   * a utenti e motori.
   *
   * ⚠️ **L'ORDINE delle due parole cambia con la lingua**, e per questo la frase
   * sta in `messages` e non si compone qui: l'italiano mette il sottotipo prima
   * («Colonna per doccia»), l'inglese la macro («Shower column»). Concatenare
   * nel codice vorrebbe dire scrivere la grammatica italiana dentro un file TSX.
   *
   * ⚠️ **Come entrano le etichette dipende dalla lingua**, e la frase si
   * capitalizza in testa. In italiano, inglese, francese e spagnolo si abbassano,
   * perché nascono capitalizzate per le pill; in tedesco restano come sono, perché
   * i sostantivi sono maiuscoli. La regola è una mappa per lingua in
   * `src/lib/product-type-phrase.ts`, e la stessa mappa la usa l'hero.
   */
  const parti = productLabelParts(data, { macro: tCategoria, subtype: tSottotipo });
  const tipo = productTypePhrase(
    parti,
    locale,
    {
      withSubtype: (values) => t("tipo", values),
      macroOnly: (values) => t("tipoSoloAmbiente", values),
    },
    // Le chiavi crude: il termine ufficiale si guarda per coppia, non per
    // etichetta. Senza queste la description direbbe ancora «Säule für
    // Waschtisch» mentre la pill e il title dicono «Waschtischsäule».
    { macro: data.productMacro, subtype: data.productSubtype },
  );

  // ⚠️ I due rami scelgono ormai la sola DESCRIPTION — il titolo è uno solo per
  // tutti — e la riga che diceva «altrimenti entrambi nominano la collezione»
  // descriveva il template di prima del 21/09/2026. Da qui in poi la strada è
  // una, perché la scelta fra template e campo scritto in Studio non dipende da
  // quale dei due sia uscito.
  /**
   * Il TITOLO porta il termine ufficiale del catalogo, non la collezione
   * (decisione di Marco, 21/09/2026): «Boss B40L · Colonna per lavabo con
   * rubinetto». Quel termine è già sul documento — la testa della description
   * **è** la voce dell'Excel dei contenuti, in tutte e cinque le lingue — e
   * `modelHead` la taglia con il budget che avanza dopo il nome e il suffisso
   * del layout. Testa vuota, o nome così lungo da non lasciarle spazio: resta
   * il solo nome, che è ciò che il sito faceva prima per i modelli il cui nome
   * ripete già la collezione.
   *
   * ⚠️ Il ramo `ripeteLaCollezione` ora sceglie **solo la description**: il
   * titolo non nomina più la collezione in nessuno dei due casi, quindi il
   * doppione che quel ramo evitava non può più nascere.
   */
  const testa = modelHead(name, data.description, locale);
  const titolo = testa ? t("metaTitle", { nome: name, testa }) : name;
  const template =
    ripeteLaCollezione && tipo
      ? { titolo, description: t("metaDescriptionTipo", { nome: name, tipo, finiture }) }
      : { titolo, description: t("metaDescription", { nome: name, collezione, finiture }) };

  const seo = risolviSeo({
    seo: data.seo,
    locale,
    contenutoNellaLingua: data.contenutoNellaLingua ?? true,
    template,
    immagini: {
      seo: data.seo?.ogImage?.asset ? ogImageProdotto(data.seo.ogImage) : null,
      entita: immagini,
    },
  });

  return {
    title: seo.titolo,
    description: seo.description,
    ...indicizzazione(seo.noIndex, alternates),
    openGraph: {
      ...openGraphBase(locale, seo.noIndex ? null : canonico),
      title: seo.titolo,
      description: seo.description,
      images: conAltOg(seo.immagini, seo.titolo, locale),
    },
  };
}

export default async function ModelDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const model = await getModel(slug, locale);
  if (!model) notFound();

  // `collections[0]` è la collezione di appartenenza primaria: la stessa regola che
  // il tasto «Indietro» usava per il proprio fallback, non una convenzione nuova.
  const tNav = await getTranslations({ locale, namespace: "nav" });
  // `schedaModello` e non `modello`: lo legge solo il server, quindi non va nel payload di ogni
  // pagina (`modello` è fra i `CLIENT_NAMESPACES`).
  const tScheda = await getTranslations({ locale, namespace: "schedaModello" });
  const nome = modelDisplayName(model.name, locale, model.code);
  const collezione = model.collections?.[0];
  const briciole = breadcrumbCatalogo(
    { home: tNav("home"), collezioni: tNav("collezioni") },
    ...(collezione?.slug
      ? [
          {
            label: collezione.title ?? "",
            href: { pathname: "/collezioni/[slug]" as const, params: { slug: collezione.slug } },
          },
        ]
      : []),
    { label: nome },
  );

  // L'alt della foto nella lingua della pagina (spec contenuti-per-lingua § A).
  const fotoAlt = altProdotto(
    model.primaryImage,
    model,
    collezione?.title,
    locale,
    await messaggiAlt(locale),
  );

  return (
    <>
      <BreadcrumbJsonLd items={briciole} locale={locale} />
      <ModelHero
        model={model}
        locale={locale}
        breadcrumb={{ items: briciole, ariaLabel: tNav("breadcrumbAria") }}
        fotoAlt={fotoAlt}
      />
      <ModelSpecs model={model} />
      <CollectionAffinities model={model} locale={locale} />
      {/* Il modulo in fondo alla scheda (16/10/2026): codice e nome vanno a Zapier col lead,
          `source: "modello"`. Il bottone dell'hero porta qui (`#progettare`). */}
      <ProgettareCta
        title={tScheda("progettareH2")}
        subtitle={tScheda("progettareSub")}
        {...(model.code ? { modello: { codice: model.code, nome } } : {})}
      />
    </>
  );
}
