import type { Locale } from "../i18n/routing";

/**
 * Le chiavi dei messaggi che in una lingua possono restare IDENTICHE all'inglese.
 *
 * ⚠️ **Una fonte sola, importata da due posti**: il cancello di `parita.test.ts` e
 * `scripts/i18n/messages-diff.ts`. Fino al 14/09/2026 `messages-diff` estraeva la lista
 * **tagliando il testo** del file di test fra `const AMMESSE` e `]);`: funzionava finché la
 * lista era una sola, e non poteva reggere una seconda struttura. L'import è relativo e non
 * con l'alias `@`, perché `messages-diff` gira con `tsx` e non passa dalla risoluzione di Next.
 */

/**
 * ⚠️ **Le 44 non sono una deroga: sono i casi in cui italiano e inglese dicono davvero la
 * stessa cosa**, e quindi lo dicono anche le altre lingue: parole inglesi già nel file
 * italiano («Outdoor», «Blog»), sigle (AISI 316, PVD, TIG), numeri, nomi propri, la ragione
 * sociale e una chiave fatta di soli segnaposto. Aggiungerne una è una decisione, e va presa qui.
 */
export const ALLOWED_IDENTICAL: ReadonlySet<string> = new Set([
  // parole inglesi già nel dizionario italiano
  "nav.outdoor",
  "nav.indoor",
  "nav.kitchen",
  "nav.blog",
  "nav.home",
  "nav.comingSoon",
  "footer.columns.legal",
  "footer.columns.newsletter",
  "footer.links.news",
  "footer.privacyPolicy",
  "footer.cookiePolicy",
  "legale.sezioni.cookie.titolo",
  "blog.metaTitle",
  "blog.heroTitle",
  "contatti.form.email",
  "referenze.category.hospitality",
  "referenze.category.yacht",
  "referenze.category.beach-club",
  "referenze.category.spa-wellness",
  "collezioni.stat4Label",
  "home.heroStat4Label",
  // marca e nomi propri
  "brand.wordmark",
  "brand.tagline.line3",
  "home.heroEyebrow",
  "collezioni.stat4Value",
  "home.heroStat4Value",
  // sigle e unità
  "finiture.category.pvd",
  "produzione.f1Spec",
  "produzione.f5Spec",
  "home.aisiH2Top",
  "productCategories.bidet",
  "productSubtypes.bodyjet",
  "productSubtypes.kit",
  // numeri
  "collezioni.stat2Value",
  "collezioni.stat3Value",
  "catalogo.badgeFormato",
  "chiSiamo.s1Eyebrow",
  "home.heroStat1Value",
  "home.heroStat3Value",
  "errorPages.notFound.eyebrow",
  // soli segnaposto
  "modello.metaTitle",
  // ⚠️ Soli segnaposto anche questa, ma il motivo per cui sta nei messaggi e non
  // nel codice è un altro: l'ORDINE. Oggi tutte e cinque le lingue antepongono
  // il tipo al nome — «Colonne doccia Boss», «Duschsäulen Boss» — e la stringa
  // è identica; il giorno che una lingua vorrà invertire, cambia il suo file e
  // non un TSX. Toglierla da qui vorrebbe dire comporre l'ordine nel codice.
  "collezioni.titoloConTipo",
  // Soli segnaposto anche queste, per lo stesso motivo: l'ordine della frase dell'alt
  // composto sta nei messaggi, non nel codice (spec contenuti-per-lingua § A).
  "immagini.prodotto",
  "immagini.prodottoConMisura",
  "immagini.misura",
  // Il simbolo del diametro, uguale in ogni lingua.
  "immagini.misure.diametro",
]);

/**
 * Le chiavi che in UNA lingua coincidono con l'inglese perché in quella lingua la parola
 * giusta si scrive così. Chiave → ragione.
 *
 * ⚠️ **Nate da una misura, non da un elenco scritto a occhio** (14/09/2026, traduzioni T2
 * in `tmp/traduzioni/<lingua>/messaggi/`): fuori dalle 44 comuni, le chiavi identiche
 * all'inglese erano **DE 0 · FR 22 · ES 4**, e tutte e 26 sono parole corrette nella loro
 * lingua. Senza questa lista il cancello le avrebbe contate come «non tradotte» e
 * `messages-diff` le avrebbe rimesse fra le cose da fare.
 *
 * ⚠️ **Una voce vale solo finché la parola resta identica**: il test «le eccezioni per
 * lingua non invecchiano» di `parita.test.ts` diventa rosso se la traduzione cambia.
 */
export const ALLOWED_IDENTICAL_BY_LOCALE: Partial<
  Record<Locale, Readonly<Record<string, string>>>
> = {
  it: {
    "immagini.misure.base": "«base» è la parola italiana",
  },
  fr: {
    "nav.collezioni": "«Collections» è la parola francese",
    "nav.produzione": "«Production» è la parola francese",
    "nav.contatti": "«Contact» è la parola francese",
    "footer.columns.collezioni": "«Collections» è la parola francese",
    "footer.columns.contatti": "«Contact» è la parola francese",
    "footer.links.produzione": "«Production» è la parola francese",
    "collezioni.stat1Label": "«Collections» è la parola francese",
    "collezioni.stat2Label": "«Articles» è la parola francese",
    "catalogo.eyebrow": "«Catalogue» è la grafia francese",
    "catalogo.badgePagine": "«143 pages» si scrive uguale in francese",
    "collezioni.metaTitle": "«Collections» è la parola francese",
    "dettaglio.eyebrow": "«Collection» è la parola francese",
    "dettaglio.statArticoli": "«Articles» è la parola francese",
    "modello.eyebrow": "«Collection» è la parola francese",
    "modello.labelType": "«Type» è la parola francese",
    "modello.labelDimensions": "«Dimensions» è la parola francese",
    "produzione.metaTitle": "«Production» è la parola francese",
    "referenze.collectionsEyebrow": "«Collections» è la parola francese",
    "referenze.collectionEyebrowItem": "«Collection» è la parola francese",
    "contatti.metaTitle": "«Contact» è la parola francese",
    "home.heroStat2Label": "«Collections» è la parola francese",
    "home.heroStat3Label": "«Articles» è la parola francese",
  },
  es: {
    "finiture.category.natural": "«Natural» è la parola spagnola",
    "productSubtypes.pannello": "«Panel» è la parola spagnola",
    "legale.eyebrow": "«Legal» è la parola spagnola",
    "immagini.misure.base": "«base» è la parola spagnola",
  },
};

/** Le chiavi ammesse identiche all'inglese per una lingua: le comuni più le sue. */
export function allowedIdenticalFor(locale: Locale): ReadonlySet<string> {
  return new Set([...ALLOWED_IDENTICAL, ...Object.keys(ALLOWED_IDENTICAL_BY_LOCALE[locale] ?? {})]);
}
