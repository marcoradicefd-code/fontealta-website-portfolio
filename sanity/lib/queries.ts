import { defineQuery } from "next-sanity";

/**
 * ⚠️ ORDINE DELLE FINITURE — `| order(order asc)` su OGNI proiezione di
 * `availableFinishes`, e non è pignoleria.
 *
 * L'array dentro i documenti `model` è stato scritto dal seed in ordine ALFABETICO
 * per codice (AB-BB-BC-BX-DB-MB-MX-RL, misurato). Le query lo restituivano così com'è,
 * quindi pill dei filtri, pallini delle card e selettore della scheda mostravano tutti
 * l'alfabetico, mentre `/finiture` — l'unica pagina che ordinava — mostrava il listino.
 *
 * L'ordine di listino (MX-BX-MB-RL-BB-BC-AB-DB) è una proprietà della FINITURA, non
 * dell'array del modello: vive su `finish.order` ed è già corretto su Sanity (10-70,
 * con RL a 35). Si legge da lì, non si riscrivono 595 array.
 *
 * Il campo `order` va PROIETTATO oltre che usato per ordinare: la FilterBar costruisce
 * le sue opzioni scorrendo i modelli, quindi ha bisogno del valore per riordinare
 * l'unione — l'ordine di prima apparizione non è quello di listino.
 *
 * ⚠️ `COLLECTION_BY_SLUG_QUERY` e `getCollection()` sono stati RIMOSSI il 9/09/2026:
 * erano codice morto (zero consumatori) e la query filtrava per lingua su documenti che
 * gemelli EN non ne hanno, quindi avrebbe dato null su EN se qualcuno l'avesse chiamata.
 */

// ⚠️ NIENTE BACKTICK nei commenti DENTRO una query: la query è un template literal,
// quindi un backtick la chiude a metà. Typegen si ferma sul FILE INTERO, perde tutte
// le query e — questa è la parte cattiva — stampa «Successfully generated types» ed
// esce 0, riscrivendo types.gen.ts SVUOTATO (misurato: −1284 righe). Fuori dalle
// query i backtick vanno benissimo. Vale anche per i commenti: viaggiano nel payload
// della query a ogni fetch, quindi qui dentro si sta stretti e si spiega sopra.

/**
 * GROQ queries adapted to the hybrid i18n model:
 *  - `collection`, `reference` → document-level i18n (filter `language == $locale`)
 *  - `model`, `finish`, `siteSettings` → field-level (`field[$locale]`)
 *
 * `$locale` parameter is passed by the loader (`src/lib/content.ts`).
 */

export const COLLECTIONS_OVERVIEW_QUERY = defineQuery(`
  *[_type == "collection"] | order(order asc) {
    _id,
    code,
    title,
    "slug": slug.current,
    tagline,
    isCustomizable,
    featured,
    "articleCount": count(*[_type=="model" && references(^._id)]),
    "finishCount": count(array::unique(*[_type=="model" && references(^._id)].availableFinishes[]._ref)),
    "productMacros": array::unique(*[_type=="model" && references(^._id)].productMacro),
    coverImage {
      ...,
      "metadata": asset->metadata
    }
  }
`);

// PARTE 2 (homepage FeaturedCollections). Projection IDENTICA a
// COLLECTIONS_OVERVIEW_QUERY → tipo compatibile con CollectionCard (riuso).
// Fallback (se 0 featured): prime 6 by order — gestito nel page component.
export const FEATURED_COLLECTIONS_QUERY = defineQuery(`
  *[_type == "collection" && featured == true] | order(order asc) [0...6] {
    _id,
    code,
    title,
    "slug": slug.current,
    tagline,
    isCustomizable,
    featured,
    "articleCount": count(*[_type=="model" && references(^._id)]),
    "finishCount": count(array::unique(*[_type=="model" && references(^._id)].availableFinishes[]._ref)),
    "productMacros": array::unique(*[_type=="model" && references(^._id)].productMacro),
    coverImage {
      ...,
      "metadata": asset->metadata
    }
  }
`);

// Footer (site-wide): solo nomi + link collezioni, NESSUN conteggio derivato dai
// model → consumato con tag ["collection"] SOLO, così un publish di `model` non
// invalida il footer (e quindi ogni pagina). Set/ordine identici a
// COLLECTIONS_OVERVIEW_QUERY, projection minima (_id/title/slug).
export const FOOTER_COLLECTIONS_QUERY = defineQuery(`
  *[_type == "collection"] | order(order asc){
    _id,
    title,
    "slug": slug.current
  }
`);

// Stat bar home: numero di collezioni, derivato invece che cablato in i18n.
// Conteggio COMMERCIALE: esclude i contenitori di servizio (corpi a incasso,
// accessori). Atteso 20; sale da solo alla prossima collezione vera.
// Nessun filtro `language`: le collection sono documenti unici in italiano (22/22,
// zero gemelli EN), quindi il conteggio è lo stesso su entrambe le lingue e un
// filtro darebbe 0 su EN. Tag ["collection"] soltanto — niente "model", come
// FOOTER_COLLECTIONS_QUERY: un publish di modello non deve invalidare la home.
export const COLLECTIONS_COUNT_QUERY = defineQuery(`
  count(*[_type == "collection" && !(slug.current in ["corpi-a-incasso", "accessories"])])
`);

export const FINISHES_OVERVIEW_QUERY = defineQuery(`
  *[_type == "finish"] | order(order asc) {
    _id,
    code,
    category,
    colorHex,
    // RIPIEGO sull italiano: il nome di una finitura e un ETICHETTA, e una pill
    // senza etichetta non si puo disegnare. Stessa regola di modelDisplayName.
    "name": coalesce(name[$locale], name.it),
    swatchImage { ..., "metadata": asset->metadata }
  }
`);

export const REFERENCES_OVERVIEW_QUERY = defineQuery(`
  *[_type == "projectReference" && language == $locale] | order(year desc, order asc) {
    _id,
    title,
    "slug": slug.current,
    architect,
    location,
    country,
    category,
    year,
    coverImage { ..., "metadata": asset->metadata }
  }
`);

export const REFERENCE_BY_SLUG_QUERY = defineQuery(`
  *[_type == "projectReference" && language == $locale && slug.current == $slug][0] {
    _id,
    title,
    "slug": slug.current,
    architect,
    location,
    country,
    category,
    year,
    coverImage { ..., "metadata": asset->metadata },
    gallery[]{ ..., "metadata": asset->metadata },
    story,
    seo {
      metaTitle,
      metaDescription,
      noIndex,
      ogImage { ..., "metadata": asset->metadata }
    },
    publishedAt,
    collectionsUsed[]-> {
      _id,
      code,
      title,
      "slug": slug.current
    }
  }
`);

export const SITE_SETTINGS_QUERY = defineQuery(`
  *[_type == "siteSettings"][0] {
    companyName,
    // NIENTE ripiego: la tagline del sito segue la regola di quella delle
    // collezioni, nella lingua o niente.
    "tagline": tagline[$locale],
    address,
    phone,
    email,
    socialLinks,
    homeHeroVideoUrl,
    homeHeroVideoMp4Url,
    homeHeroPoster { ..., "metadata": asset->metadata },
    chiSiamoHeroVideoUrl,
    chiSiamoHeroVideoMp4Url,
    chiSiamoHeroPoster { ..., "metadata": asset->metadata },
    footerColumns[] {
      // RIPIEGO: e il titolo di una colonna del footer. Senza, la colonna esce muta.
      "title": coalesce(title[$locale], title.it),
      links[] {
        // RIPIEGO: un link senza etichetta e un link che nessuno puo leggere.
        "label": coalesce(label[$locale], label.it),
        href
      }
    },
    defaultSeo {
      ogImage { ..., "metadata": asset->metadata }
    },
    ogImage { ..., "metadata": asset->metadata }
  }
`);

export const ALL_COLLECTION_SLUGS_QUERY = defineQuery(`
  *[_type == "collection" && defined(slug.current)] {
    "slug": slug.current,
    "language": language
  }
`);

export const ALL_REFERENCE_SLUGS_QUERY = defineQuery(`
  *[_type == "projectReference" && defined(slug.current)] {
    "slug": slug.current,
    "language": language
  }
`);

// ─── Cantiere INCASSI ────────────────────────────────────────────────────────
// L'indice dei corpi INTERROGA IL TIPO, non le reference alla collection: un corpo
// nuovo compare da solo, e l'one-shot di arricchimento resta indipendente dall'_id
// del documento collection, creato a mano in Studio (docs/incassi-design.md §3).
// Il documento serve comunque all'hero, alla griglia /collezioni e al footer: se
// manca, la pagina fa notFound() invece di inventarsi dei contenuti.
export const CONCEALED_BODIES_INDEX_QUERY = defineQuery(`
  {
    "collection": *[_type == "collection" && slug.current == "corpi-a-incasso"][0] {
      _id,
      title,
      slug,
      code,
      description,
      tagline,
      heroVideo,
      heroVideoMp4,
      coverImage,
      heroImage { ..., "metadata": asset->metadata }
    },
    "bodies": *[_type == "concealedBody"] | order(coalesce(order, 9999) asc, code asc) {
      _id,
      code,
      "slug": slug.current,
      servesMacros,
      waterSupply,
      image { ..., "metadata": asset->metadata },
      // Per l'alt composto (spec contenuti-per-lingua): la descrizione come testo semplice
      // nella lingua della pagina, e le misure per la principale.
      "descrizioneAlt": pt::text(description[$locale]),
      specs { famiglia, misure, attacchi },
      // NIENTE ripiego: e prosa, e la card dei corpi la tratta gia come assente.
      "description": description[$locale]
    }
  }
`);

// Scheda del singolo corpo. «Usato da» è un lookup INVERSO con order(code asc)
// ESPLICITO: il reverse lookup non preserva ordine. La projection dei modelli è
// quasi identica a COLLECTION_DETAIL_QUERY.models. ⚠️ DIVERGONO dal 31/08/2026 su
// `gallery`/`collectionTitles`, che la collection-detail proietta e questa NO: lì
// c'è una collezione di pagina con cui scegliere lo sfondo, qui non c'è. ModelCard
// ha un membro union suo per questi item, non li fa passare per l'altro tipo.
export const CONCEALED_BODY_BY_SLUG_QUERY = defineQuery(`
  *[_type == "concealedBody" && slug.current == $slug][0] {
    _id,
    "contenutoNellaLingua": defined(name[$locale]),
    seo {
      metaTitle,
      metaDescription,
      noIndex,
      ogImage { ..., "metadata": asset->metadata }
    },
    code,
    name,
    // NIENTE ripiego: prosa sulla scheda del corpo, degrada a stringa vuota.
    "description": description[$locale],
    servesMacros,
    waterSupply,
    image { ..., "metadata": asset->metadata },
    // Per l'alt composto e per la sezione Misure (spec contenuti-per-lingua).
    "descrizioneAlt": pt::text(description[$locale]),
    specs { famiglia, misure, attacchi },
    "usedBy": *[_type == "model" && references(^._id)] | order(code asc) {
      _id,
      code,
      name,
      "collectionTitle": collections[0]->title,
      "slug": slug.current,
      productMacro,
      productSubtype,
      tags,
      includesConcealedBody,
      waterSupply,
      requiredConcealedBody->{ code },
      // metadata serve all'LQIP: pickLqip() lo legge da li'. NIENTE backtick in
      // questi commenti: sono dentro un template literal e lo chiuderebbero.
      primaryImage { ..., "metadata": asset->metadata },
      // Per l'alt composto (spec contenuti-per-lingua): la descrizione come testo semplice
      // nella lingua della pagina, e le misure per la principale.
      "descrizioneAlt": pt::text(description[$locale]),
      specs { famiglia, misure, attacchi },
      "finishes": availableFinishes[]->{ _id, code, name, colorHex, order } | order(order asc)
    }
  }
`);

export const ALL_CONCEALED_BODY_SLUGS_QUERY = defineQuery(`
  *[_type == "concealedBody" && defined(slug.current)] {
    "slug": slug.current
  }
`);

/**
 * `collectionTitle` — RETE per la riga 1 del titolo a due righe della card modello.
 *
 * La riga 1 si ricava normalmente da `name` togliendo il codice come suffisso esatto
 * (`src/lib/model-overline.ts`): il campo `name` è già «linea di prodotto + codice»
 * concatenato («Origo C50AS.YCWS.ME.D»), e il prefisso è ciò che serve. Questo campo
 * entra in gioco solo quando quel suffisso non c'è.
 *
 * Si legge `^.title`, cioè la collezione della PAGINA, non `collections[0]`: 12 modelli
 * stanno in più collezioni e `collections[0]` non è per forza quella che si sta
 * guardando — sulla pagina Boss scriverebbe «Community».
 */
export const COLLECTION_DETAIL_QUERY = defineQuery(`
  *[_type == "collection" && slug.current == $slug][0] {
    _id,
    seo {
      metaTitle,
      metaDescription,
      noIndex,
      ogImage { ..., "metadata": asset->metadata }
    },
    title,
    slug,
    code,
    description,
    tagline,
    heroVideo,
    heroVideoMp4,
    coverImage,
    heroImage { ..., "metadata": asset->metadata },
    "modelsCount": count(*[_type == "model" && references(^._id)]),
    "finishesCount": count(array::unique(*[_type == "model" && references(^._id)].availableFinishes[]._ref)),
    "models": *[_type == "model" && references(^._id)] | order(coalesce(collectionOrders[collection._ref == ^.^._id][0].position, catalogOrder, 999999) asc, code asc) {
      _id,
      code,
      name,
      // Riga 1 del titolo card: la collezione di QUESTA pagina, non collections[0].
      "collectionTitle": ^.title,
      "slug": slug.current,
      productMacro,
      productSubtype,
      tags,
      includesConcealedBody,
      waterSupply,
      requiredConcealedBody->{ code },
      // metadata serve all'LQIP: pickLqip() lo legge da li'. NIENTE backtick in
      // questi commenti: sono dentro un template literal e lo chiuderebbero.
      primaryImage { ..., "metadata": asset->metadata },
      // Galleria: 12 modelli su 595 stanno in piu' collezioni e hanno una
      // composizione per collezione, con lo sfondo di quella collezione. La primary
      // e' la prima; le altre 23 stanno qui. Senza questa proiezione la card mostra
      // sempre la primary, e 23 posizioni escono con lo sfondo di un'altra
      // collezione. Proiettata SOLO per i multi: i 583 mono restituiscono null e
      // non pagano peso. La scelta la fa src/lib/card-image.ts.
      "gallery": select(
        count(collections) > 1 => images[]{ ..., "metadata": asset->metadata },
        null
      ),
      // Titoli delle collezioni NELL'ORDINE del documento. Non e' la chiave di
      // abbinamento — Andrea puo' riordinare l'array collections da Studio — ma la
      // controprova: images[i] corrisponde a collections[i+1], verificato 23 su 23
      // sul dato vivo. Serve solo a far rumore se un giorno smette di essere vero.
      "collectionTitles": select(count(collections) > 1 => collections[]->title, null),
      // Per l'alt composto (spec contenuti-per-lingua): la descrizione come testo semplice
      // nella lingua della pagina, e le misure per la principale.
      "descrizioneAlt": pt::text(description[$locale]),
      specs { famiglia, misure, attacchi },
      "finishes": availableFinishes[]->{ _id, code, name, colorHex, order } | order(order asc)
    }
  }
`);

export const COLLECTION_SLUGS_QUERY = defineQuery(`
  *[_type == "collection" && defined(slug.current)]{
    "slug": slug.current
  }
`);

// ─── FASE 4.4.2: single model detail ─────────────────────────────────────────
// Slug-based, no `language` filter (model = field-level i18n). `name` proiettato
// raw (localizedString array → cast M6). `description` localizzato [$locale].
// `autoRelatedByCollection` = projection DORMIENTE: non più renderizzata (la
// sezione related-models è stata sostituita da `collectionAffinities`), tenuta
// solo perché model-card.tsx ne deriva ancora il tipo union `RelatedModel`
// (tech-debt M-model-card-type-cleanup, 2026-07-03).
export const MODEL_DETAIL_QUERY = defineQuery(`
  *[_type == "model" && slug.current == $slug][0] {
    _id,
    "contenutoNellaLingua": defined(name[$locale]),
    seo {
      metaTitle,
      metaDescription,
      noIndex,
      ogImage { ..., "metadata": asset->metadata }
    },
    code,
    "slug": slug.current,
    name,
    // NIENTE ripiego: prosa sulla scheda del modello, degrada a stringa vuota.
    "description": description[$locale],
    // Per l'alt composto della foto (spec contenuti-per-lingua).
    "descrizioneAlt": pt::text(description[$locale]),
    productMacro,
    productSubtype,
    tags,
    includesConcealedBody,
    waterSupply,
    // Lo slug serve SOLO qui (riga «Corpo incasso» della scheda): le altre due
    // proiezioni di requiredConcealedBody alimentano la sola pill di presenza.
    requiredConcealedBody->{ code, "slug": slug.current },
    alimentationTypes,
    isCustomizable,
    primaryImage { ..., "metadata": asset->metadata },
    images[]{ ..., "metadata": asset->metadata },
    specs,
    "finishes": availableFinishes[]->{ _id, code, category, colorHex, name, order } | order(order asc),
    "collections": collections[]->{ _id, code, title, "slug": slug.current },
    "autoRelatedByCollection": *[
      _type == "model" && _id != ^._id && references(^.collections[0]._ref)
    ] | order(code asc) [0...4] {
      _id,
      code,
      "slug": slug.current,
      name,
      // Dormiente come il resto della projection, ma proiettato lo stesso: è il ramo
      // union da cui model-card.tsx deriva RelatedModel, e senza il campo la card
      // dovrebbe tornare a una guardia "in" per leggerlo.
      "collectionTitle": collections[0]->title,
      productMacro,
      productSubtype,
      primaryImage { ..., "metadata": asset->metadata },
      "finishes": availableFinishes[]->{ _id, code, name, colorHex, order } | order(order asc),
      "collections": collections[]->{ _id, code, title, "slug": slug.current }
    },
    // Collezioni affini (PHASE 3): affinità editoriali della collezione PRIMARIA
    // del modello (collections[0], stessa scelta di autoRelatedByCollection).
    // Projection IDENTICA a COLLECTIONS_OVERVIEW_QUERY → tipo strutturalmente
    // compatibile con CollectionCard (riuso). Unidirezionale, NIENTE fallback:
    // se il campo è vuoto/assente l'array è vuoto → la sezione non viene mostrata.
    "collectionAffinities": collections[0]->relatedCollections[]->{
      _id,
      code,
      title,
      "slug": slug.current,
      tagline,
      isCustomizable,
      featured,
      "articleCount": count(*[_type=="model" && references(^._id)]),
      "finishCount": count(array::unique(*[_type=="model" && references(^._id)].availableFinishes[]._ref)),
      "productMacros": array::unique(*[_type=="model" && references(^._id)].productMacro),
      coverImage {
        ...,
        "metadata": asset->metadata
      }
    }
  }
`);

export const MODEL_SLUGS_QUERY = defineQuery(`
  *[_type == "model" && defined(slug.current)]{
    "slug": slug.current
  }
`);

// ─── Blog (FASE 1) ───────────────────────────────────────────────────────────
// Field-level i18n (like model/finish). Localized TEXT fields are projected
// `coalesce(field[$locale], field.it)` → EN best-effort: finché la traduzione EN
// non c'è, l'inglese mostra il testo IT (niente descrizioni vuote su /en).
// Slug è NON-localizzato (`slug.current`): la lingua è nel prefisso di route.

// List query for the blog index + cards. Excludes the heavy `body` on purpose.
export const POSTS_QUERY = defineQuery(`
  *[_type == "post"] | order(publishedAt desc) {
    _id,
    "title": coalesce(title[$locale], title.it),
    "slug": slug.current,
    "excerpt": coalesce(excerpt[$locale], excerpt.it),
    "body": coalesce(body[$locale], body.it),
    publishedAt,
    featured,
    coverImage { ..., "metadata": asset->metadata },
    "categories": categories[]->{
      _id,
      "title": coalesce(title[$locale], title.it),
      "slug": slug.current,
      order
    },
    author->{
      _id,
      name,
      "role": coalesce(role[$locale], role.it),
      linkedin,
      photo { ..., "metadata": asset->metadata }
    }
  }
`);

// Single post by slug (non-localized), with the full `body` and SEO.
export const POST_BY_SLUG_QUERY = defineQuery(`
  *[_type == "post" && slug.current == $slug][0] {
    _id,
    "title": coalesce(title[$locale], title.it),
    "contenutoNellaLingua": defined(title[$locale]),
    "slug": slug.current,
    "excerpt": coalesce(excerpt[$locale], excerpt.it),
    "body": coalesce(body[$locale], body.it)[]{
      ...,
      markDefs[]{
        ...,
        _type == "internalLink" => { "slug": reference->slug.current }
      }
    },
    publishedAt,
    revisedAt,
    featured,
    seo {
      metaTitle,
      metaDescription,
      noIndex,
      ogImage { ..., "metadata": asset->metadata }
    },
    coverImage { ..., "metadata": asset->metadata },
    "categories": categories[]->{
      _id,
      "title": coalesce(title[$locale], title.it),
      "slug": slug.current,
      order
    },
    author->{
      _id,
      name,
      "role": coalesce(role[$locale], role.it),
      linkedin,
      "bio": coalesce(bio[$locale], bio.it),
      photo { ..., "metadata": asset->metadata }
    }
  }
`);

// All categories, ordered for the filter pills.
export const CATEGORIES_QUERY = defineQuery(`
  *[_type == "category"] | order(order asc) {
    _id,
    "title": coalesce(title[$locale], title.it),
    "slug": slug.current,
    order
  }
`);

// ─── Sitemap ─────────────────────────────────────────────────────────────────
/**
 * Le cinque liste che alimentano `src/app/sitemap.ts`, in una query sola.
 *
 * **Una query e non cinque.** La sitemap le vuole tutte insieme, e una sola voce
 * di cache si invalida bene: i tag sono l'unione dei cinque tipi, quindi un
 * publish qualsiasi la rigenera intera. Cinque fetch darebbero cinque chiavi che
 * possono scadere in momenti diversi, cioè una sitemap coerente a metà: è la
 * trappola della fetch-cache già a registro in CLAUDE.md, dove metà sito si
 * aggiornava e metà no perché era cambiato il testo di una query sola.
 *
 * ⚠️ **`corpi-a-incasso` è escluso dalle collezioni, e la ragione NON è che sia
 * un contenitore di servizio.** `accessories` lo è e resta dentro: ha 50 modelli
 * e una pagina vera sotto `/collezioni/[slug]`. `corpi-a-incasso` esce perché
 * quel percorso è servito dalla CARTELLA STATICA `collezioni/corpi-a-incasso/`,
 * che ha una voce propria nella mappa dei pathnames. Costruendone l'URL dalla
 * chiave dinamica uscirebbe `/en/collections/corpi-a-incasso`, che non è la
 * pagina inglese: quella è `/en/collections/concealed-bodies`. Misurato sul
 * servito, non dedotto: l'URL sbagliato risponde **200** e dichiara il canonical
 * dell'altro, quindi in sitemap sarebbe un duplicato annunciato da noi. L'indice
 * entra dalla sua chiave statica, in `src/lib/sitemap.ts`.
 *
 * ⚠️ **I post non si filtrano su `publishedAt`**: il criterio è quello della
 * listing (`POSTS_QUERY`, che li serve tutti). Un filtro qui pubblicherebbe una
 * sitemap che non combacia con le pagine che il sito mostra davvero. Al 9/09
 * sono 12 documenti, di cui 11 con data passata.
 *
 * ⚠️ Nessun `language` sui filtri: `collection` e `projectReference` sono
 * documenti unici in italiano (22 su 22 e 0 su 0), `model`, `concealedBody` e
 * `post` hanno i18n di campo. La sitemap moltiplica per locale a valle, con
 * `localizedUrls()`, non qui.
 *
 * ⚠️ **Il filtro `!(seo.noIndex == true)` è ripetuto su tutti e cinque i gruppi**,
 * perché la sitemap è un oggetto solo con cinque interrogazioni dentro e GROQ non
 * ha un posto dove scriverlo una volta. Se un tipo nuovo entra qui, il filtro va
 * con lui.
 *
 * ⚠️ **Scritto `!(seo.noIndex == true)` e non `!seo.noIndex`**: sui documenti che
 * il campo non ce l'hanno le due forme si comportano uguale, ma questa dice cosa
 * intende e non cambia significato il giorno che il campo arrivasse in una forma
 * diversa da un booleano.
 *
 * Il filtro della collezione si AGGIUNGE a quello che c'era: `corpi-a-incasso` è
 * un contenitore di servizio e resta escluso per conto suo.
 */
export const SITEMAP_QUERY = defineQuery(`
  {
    "collections": *[_type == "collection" && defined(slug.current) && !(seo.noIndex == true) && slug.current != "corpi-a-incasso"] | order(slug.current asc) {
      "slug": slug.current,
      _updatedAt
    },
    "models": *[_type == "model" && defined(slug.current) && !(seo.noIndex == true)] | order(slug.current asc) {
      "slug": slug.current,
      _updatedAt
    },
    "bodies": *[_type == "concealedBody" && defined(slug.current) && !(seo.noIndex == true)] | order(slug.current asc) {
      "slug": slug.current,
      _updatedAt
    },
    "references": *[_type == "projectReference" && defined(slug.current) && !(seo.noIndex == true)] | order(slug.current asc) {
      "slug": slug.current,
      _updatedAt
    },
    "posts": *[_type == "post" && defined(slug.current) && !(seo.noIndex == true)] | order(slug.current asc) {
      "slug": slug.current,
      publishedAt,
      revisedAt
    },
    "usePages": *[_type == "contentPage" && kind == "use" && !(_id in path("drafts.**")) && !(seo.noIndex == true)] | order(code asc) {
      code,
      _updatedAt,
      "titoli": title
    }
  }
`);

/**
 * Quel che serve a `llms.txt`, e nient'altro.
 *
 * ⚠️ **Query sua e non `COLLECTIONS_OVERVIEW_QUERY`**, che porta conteggi,
 * macro-categorie e l'immagine di copertina con i metadata: roba che quel file
 * non stampa e che costerebbe a ogni richiesta, visto che la rotta è dinamica
 * come la sitemap. Stessa ragione per cui non riusa `POSTS_QUERY`, che tira
 * dentro il `body` intero dei dodici post.
 *
 * ⚠️ **`!(seo.noIndex == true)` su tutti e due i gruppi**: un documento escluso
 * dai motori non va offerto ai crawler AI, che è la stessa richiesta detta a un
 * consumatore diverso. Forma esplicita come nella sitemap.
 *
 * Il titolo esce **intero, con tutte le lingue**, perché il file ha una sezione per
 * lingua attiva e la scelta la fa la rotta: la lingua della sezione, poi l'italiano,
 * poi l'inglese. ⚠️ Fino al 15/09/2026 uscivano due campi già risolti, italiano e
 * inglese, e ogni altra lingua avrebbe preso quello inglese.
 */
export const LLMS_TXT_QUERY = defineQuery(`
  {
    "collections": *[_type == "collection" && defined(slug.current) && !(seo.noIndex == true)] | order(order asc) {
      title,
      "slug": slug.current,
      tagline
    },
    "posts": *[_type == "post" && defined(slug.current) && !(seo.noIndex == true)] | order(publishedAt desc) {
      "titolo": title,
      "slug": slug.current,
      publishedAt,
      "autore": author->name
    },
    "usePages": *[_type == "contentPage" && kind == "use" && !(_id in path("drafts.**")) && !(seo.noIndex == true)] | order(code asc) {
      code,
      "titoli": title
    }
  }
`);

/**
 * Le FAQ di una pagina, nella lingua chiesta (spec docs/specs/faq-pagine-uso.md § 2, § 3).
 *
 * Una query per i due tipi che le portano: il documento si chiede per id, quello della
 * collezione (dalla query della pagina) o quello fisso di una pagina principale
 * (contentPage-home). Escono SOLO le domande con la risposta: una domanda che aspetta
 * Fontealta resta in Studio e non compare, né nell'accordion né nel JSON-LD, che nascono
 * da questa stessa lista. Una lingua senza FAQ (oggi DE, FR, ES) restituisce null.
 *
 * Il link interno porta lo slug del documento referenziato: il percorso lo compone il sito,
 * nella lingua della pagina, dalla rotta scritta nell'annotazione.
 */
export const FAQ_QUERY = defineQuery(`
  *[_id == $id][0].faq[$locale][defined(question) && count(answer) > 0]{
    _key,
    question,
    answer[]{
      ...,
      markDefs[]{
        ...,
        _type == "internalLink" => { "slug": reference->slug.current }
      }
    },
    deepDive { route, label, "slug": reference->slug.current }
  }
`);

/**
 * Una pagina d'uso, nella lingua chiesta (spec docs/specs/seo-pagine-contenuto.md, c1b).
 *
 * Il documento si chiede per id fisso (contentPage-<code>). Il titolo esce intero, con tutte le
 * lingue: la pagina ne ricava le lingue presenti, per il cancello e per gli hreflang (una lingua
 * senza titolo dà 404 e nessun'altra la nomina). Nessun ripiego fra lingue: la pagina d'uso esce
 * solo nella lingua in cui è scritta.
 *
 * Le collezioni hanno la stessa proiezione di COLLECTIONS_OVERVIEW_QUERY, la forma che la card
 * della collezione riceve; il link interno del corpo porta lo slug del documento referenziato,
 * come nelle FAQ.
 *
 * Le card sono automatiche (Marco, 4/11/2026): ogni collezione con almeno una colonna doccia, cioè
 * un modello di sottotipo colonna o colonna-divisibile la cui descrizione italiana c'è e non
 * comincia per «Colonna per lavabo» o «Colonna per vasca», più quelle in evidenza (il campo
 * collections, scelto a mano), che compaiono anche senza colonne. Le collezioni escono nell'ordine
 * del catalogo; inEvidenza dice quali vanno prima, e in che ordine (ordinaCard, pagina-uso.ts).
 * ⚠️ Il criterio legge il testo della descrizione: un modello nuovo deve seguire quella forma. Un
 * modello senza descrizione non conta. Una collezione nuova compare col solo webhook, perché la
 * pagina porta i tag collection e model.
 */
export const USE_PAGE_QUERY = defineQuery(`
  *[_id == $id && kind == "use"][0] {
    _id,
    _updatedAt,
    code,
    "titoli": title,
    "intro": intro[$locale],
    "body": body[$locale][]{
      ...,
      markDefs[]{
        ...,
        _type == "internalLink" => { "slug": reference->slug.current }
      },
      _type == "figure" => { image { ..., "metadata": asset->metadata { dimensions } } },
      _type == "figurePair" => {
        left { ..., "metadata": asset->metadata { dimensions } },
        right { ..., "metadata": asset->metadata { dimensions } }
      }
    },
    seo {
      metaTitle,
      metaDescription,
      noIndex,
      ogImage { ..., "metadata": asset->metadata }
    },
    "inEvidenza": collections[]._ref,
    "collections": *[
      _type == "collection" && (!defined(language) || language == "it") && (
        _id in ^.collections[]._ref ||
        count(*[
          _type == "model" && references(^._id) &&
          productSubtype in ["colonna", "colonna-divisibile"] &&
          count(description.it) > 0 &&
          !string::startsWith(lower(pt::text(description.it)), "colonna per lavabo") &&
          !string::startsWith(lower(pt::text(description.it)), "colonna per vasca")
        ]) > 0
      )
    ] | order(order asc) {
      _id,
      code,
      title,
      "slug": slug.current,
      tagline,
      isCustomizable,
      featured,
      "articleCount": count(*[_type=="model" && references(^._id)]),
      "finishCount": count(array::unique(*[_type=="model" && references(^._id)].availableFinishes[]._ref)),
      "productMacros": array::unique(*[_type=="model" && references(^._id)].productMacro),
      coverImage {
        ...,
        "metadata": asset->metadata
      }
    }
  }
`);
