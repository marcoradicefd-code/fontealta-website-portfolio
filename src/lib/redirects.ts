/**
 * I redirect permanenti dichiarati da `next.config.ts`.
 *
 * ⚠️ **Questo file non importa NIENTE, e deve restare così.** Lo carica
 * `next.config.ts`, che Next compila in `next.config.compiled.js` ed esegue con
 * Node **prima** del bundle dell'app: lì l'alias `@/` non esiste. È la stessa
 * trappola che in A2.1 ha spostato gli helper degli URL in `src/lib/urls.ts`
 * invece che in `seo.ts`. Un `import` aggiunto qui fa morire il build con
 * `MODULE_NOT_FOUND`, non un errore di lint.
 *
 * ⚠️ **Perché i percorsi sono letterali e non composti.** Comporli qui vorrebbe
 * dire concatenare a mano `/en` più la voce della mappa dei pathnames, cioè
 * riscrivere `getPathname` in un secondo posto — esattamente ciò che il commento
 * in testa a `urls.ts` vieta, perché diverge in silenzio. La rete è invece un
 * test (`redirects.test.ts`) che ricava gli stessi due percorsi dal risolutore
 * VERO e li confronta con queste stringhe: il giorno che la mappa cambia, il
 * test cade.
 */

/**
 * `/en/collections/corpi-a-incasso` è un doppione dell'indice dei corpi, e nasce
 * dall'incrocio di due cose entrambe corrette.
 *
 * Il documento `collection` con slug `corpi-a-incasso` esiste, quindi quel path
 * combacia con la rotta dinamica `/collezioni/[slug]` nella sua forma inglese
 * `/collections/[slug]`. Il proxy di next-intl lo riscrive nel path interno
 * `/en/collezioni/corpi-a-incasso`, e lì Next dà **precedenza al segmento
 * statico sul dinamico fratello**: a rispondere è la cartella
 * `collezioni/corpi-a-incasso/`, cioè l'indice dei corpi. Risultato misurato:
 * **200**, con il contenuto giusto sotto un indirizzo che non è il suo.
 *
 * ⚠️ **Il redirect NON può stare in `collezioni/[slug]/page.tsx`.** Quella pagina
 * per questo slug non viene invocata mai, in nessuna lingua, proprio per la
 * precedenza del segmento statico: il codice sarebbe morto. La controprova sta
 * nell'HTML servito prima di questo commit — l'URL sbagliato emetteva il
 * canonical dell'indice dei corpi, che solo la pagina statica sa costruire. Va
 * intercettato **prima** della riscrittura del proxy, e i redirect di
 * `next.config.ts` sono l'unico gancio che sta lì.
 *
 * ⚠️ **Una voce per lingua, e l'italiano non ce l'ha.** In italiano il path della
 * chiave dinamica e quello della chiave statica coincidono
 * (`/collezioni/corpi-a-incasso`): non c'è niente da spostare. In inglese, tedesco,
 * francese e spagnolo divergono, e il doppione esiste appena la lingua è accesa. Il
 * test lo asserisce, così se un giorno anche l'italiano divergesse la lista risulterebbe
 * incompleta invece di sembrare finita.
 *
 * ⚠️ **Le voci delle lingue spente ci sono già, ma NON si dichiarano**: `next.config.ts`
 * passa `ACTIVE_LOCALES` a `redirectPermanenti`. Un redirect per una lingua spenta
 * trasformerebbe un 404 in un 308 verso un altro 404, e cambierebbe il servito senza
 * ragione.
 */
export const REDIRECT_PER_LINGUA = {
  en: {
    source: "/en/collections/corpi-a-incasso",
    destination: "/en/collections/concealed-bodies",
    permanent: true,
  },
  de: {
    source: "/de/kollektionen/corpi-a-incasso",
    destination: "/de/kollektionen/unterputz-koerper",
    permanent: true,
  },
  fr: {
    source: "/fr/collections/corpi-a-incasso",
    destination: "/fr/collections/corps-encastres",
    permanent: true,
  },
  es: {
    source: "/es/colecciones/corpi-a-incasso",
    destination: "/es/colecciones/cuerpos-empotrados",
    permanent: true,
  },
} as const;

/** I redirect delle sole lingue attive. Riceve la lista da fuori: questo file non importa niente. */
export function redirectPermanenti(attive: readonly string[]) {
  return Object.entries(REDIRECT_PER_LINGUA)
    .filter(([lingua]) => attive.includes(lingua))
    .map(([, r]) => r);
}

/**
 * `/privacy-policy` e `/cookie-policy` sono confluite in `/menzioni-legali` il 16/09/2026,
 * e i loro indirizzi portano alle due sezioni della pagina nuova, **con l'ancora**.
 *
 * ⚠️ **L'ancora nella destinazione arriva al browser.** Next la conserva nel `Location`
 * (`prepare-destination.js`, che riattacca `parsedDestination.hash` al percorso), e il
 * browser la applica alla pagina d'arrivo: è quello che apre la sezione giusta.
 *
 * ⚠️ **Qui l'italiano HA la voce**, al contrario dei corpi: l'indirizzo vecchio italiano
 * è `/privacy-policy`, e non coincide con nessuna forma della pagina nuova. Il test
 * confronta ogni destinazione con `getPathname`, il risolutore vero.
 *
 * ⚠️ Le lingue spente valgono come sopra: la voce c'è, ma non si dichiara.
 */
export const REDIRECT_LEGALI = {
  it: {
    privacy: "/privacy-policy",
    cookie: "/cookie-policy",
    pagina: "/menzioni-legali",
  },
  en: {
    privacy: "/en/privacy-policy",
    cookie: "/en/cookie-policy",
    pagina: "/en/legal-notice",
  },
  de: {
    privacy: "/de/privacy-policy",
    cookie: "/de/cookie-policy",
    pagina: "/de/rechtliche-hinweise",
  },
  fr: {
    privacy: "/fr/privacy-policy",
    cookie: "/fr/cookie-policy",
    pagina: "/fr/mentions-legales",
  },
  es: {
    privacy: "/es/privacy-policy",
    cookie: "/es/cookie-policy",
    pagina: "/es/aviso-legal",
  },
} as const;

/** I 308 dei due indirizzi legali ritirati, per le sole lingue attive. */
export function redirectLegali(attive: readonly string[]) {
  return Object.entries(REDIRECT_LEGALI)
    .filter(([lingua]) => attive.includes(lingua))
    .flatMap(([, voce]) => [
      { source: voce.privacy, destination: `${voce.pagina}#privacy`, permanent: true },
      { source: voce.cookie, destination: `${voce.pagina}#cookie`, permanent: true },
    ]);
}

/**
 * Gli indirizzi fissi del VECCHIO SITO (20/10/2026, mappa approvata da Marco), presi dai log di
 * produzione del 21/09-19/10: landing, pagine generiche, catalogo sfogliabile e sitemap. Dal 14/10
 * davano 500 (verbale `docs/history/2026-10-20-locale-404.md`).
 *
 * ⚠️ Le schede `/COLLEZIONE-CODICE.aspx` NON stanno qui: sono 215 forme diverse in quattro
 * settimane, e una lista scritta a mano invecchierebbe a ogni modello. Le risolve
 * `src/app/(site)/[locale]/vecchio-sito/[file]/page.tsx`, a cui le manda `rewriteDopoIFile`.
 * Le cinque pagine generiche `.aspx` qui sotto invece sì, perché non hanno un codice: i redirect
 * girano prima delle rewrite, quindi la pagina dei codici non le vede.
 *
 * ⚠️ Le destinazioni sono gli indirizzi italiani: il vecchio sito era in italiano (`Landing-IT…`).
 */
export const REDIRECT_VECCHIO_SITO: ReadonlyArray<{ source: string; destination: string }> = [
  // Landing per collezione. `IWS` non è più ricostruibile: va all'indice (Marco, 20/10).
  { source: "/Landing-ITIWS.html", destination: "/collezioni" },
  { source: "/Landing-ITShower.html", destination: "/collezioni" },
  { source: "/Landing-ITIlle.html", destination: "/collezioni/ille" },
  { source: "/Landing-ITSkinny.html", destination: "/collezioni/skinny" },
  { source: "/Landing-ITTwiggy.html", destination: "/collezioni/twiggy" },
  { source: "/Landing-ITOrigo.html", destination: "/collezioni/origo" },
  { source: "/Landing-ITCommunity.html", destination: "/collezioni/community" },
  { source: "/Landing-ITFlamingo.html", destination: "/collezioni/flamingo" },
  { source: "/Landing-ITBoss.html", destination: "/collezioni/boss" },
  { source: "/Landing-ITKitchen.html", destination: "/collezioni/kitchen" },
  { source: "/landingpage/landing-it.html", destination: "/" },
  // Il catalogo sfogliabile del vecchio sito → la sezione del catalogo per email (#268).
  { source: "/catalogo/index.html", destination: "/collezioni#catalogo" },
  { source: "/catalogo/mobile/index.html", destination: "/collezioni#catalogo" },
  // Pagine generiche.
  { source: "/home.aspx", destination: "/" },
  { source: "/default.aspx", destination: "/" },
  { source: "/en/home.html", destination: "/en" },
  { source: "/fr/home.html", destination: "/fr" },
  { source: "/prodotti.aspx", destination: "/collezioni" },
  { source: "/collezioni.html", destination: "/collezioni" },
  { source: "/chisiamo.aspx", destination: "/chi-siamo" },
  { source: "/chi-siamo.html", destination: "/chi-siamo" },
  { source: "/about.html", destination: "/chi-siamo" },
  { source: "/contatti.aspx", destination: "/contatti" },
  { source: "/contatti.html", destination: "/contatti" },
  { source: "/contact.html", destination: "/contatti" },
  { source: "/Home/Contatti", destination: "/contatti" },
  // Le sitemap del vecchio sito e le forme che i crawler provano.
  { source: "/sitemap_it.xml", destination: "/sitemap.xml" },
  { source: "/sitemap_index.xml", destination: "/sitemap.xml" },
  { source: "/sitemap-index.xml", destination: "/sitemap.xml" },
  { source: "/sitemap1.xml", destination: "/sitemap.xml" },
  { source: "/sitemaps.xml", destination: "/sitemap.xml" },
  { source: "/en/sitemap.xml", destination: "/sitemap.xml" },
  { source: "/en/sitemap_index.xml", destination: "/sitemap.xml" },
];

/**
 * La guida unica «AISI 304 o 316» (Marco, grill del 5/11/2026, Q17-Q20): le due parti del post
 * «AISI 316 contro 304» diventano un articolo solo, allo slug della parte 1, che ha le impressioni;
 * la parte 2 porta lì in ogni lingua. `/blog` è uguale in tutte le lingue (`routing.pathnames`), e il
 * test confronta i percorsi col risolutore vero.
 *
 * ⚠️ **301 e non 308, solo qui** (Q18): Marco l'ha chiesto esplicito, e lo controlla così il giro del
 * carico. Per Google i due codici valgono uguale; gli altri redirect del file restano 308.
 */
export const REDIRECT_GUIDA_316 = {
  it: {
    source: "/blog/aisi-316-contro-304-parte-2",
    destination: "/blog/aisi-316-contro-304-parte-1",
  },
  en: {
    source: "/en/blog/aisi-316-contro-304-parte-2",
    destination: "/en/blog/aisi-316-contro-304-parte-1",
  },
  de: {
    source: "/de/blog/aisi-316-contro-304-parte-2",
    destination: "/de/blog/aisi-316-contro-304-parte-1",
  },
  fr: {
    source: "/fr/blog/aisi-316-contro-304-parte-2",
    destination: "/fr/blog/aisi-316-contro-304-parte-1",
  },
  es: {
    source: "/es/blog/aisi-316-contro-304-parte-2",
    destination: "/es/blog/aisi-316-contro-304-parte-1",
  },
} as const;

/** I 301 della parte 2, per le sole lingue attive. */
export function redirectGuida316(attive: readonly string[]) {
  return Object.entries(REDIRECT_GUIDA_316)
    .filter(([lingua]) => attive.includes(lingua))
    .map(([, r]) => ({ ...r, statusCode: 301 as const }));
}

/** I redirect del vecchio sito: permanenti, cioè 308 come gli altri del sito. */
export function redirectVecchioSito() {
  return REDIRECT_VECCHIO_SITO.map((r) => ({ ...r, permanent: true }));
}

/**
 * Le rewrite `afterFiles` (20/10/2026). Next le applica DOPO i file veri (`public/`, icone,
 * `robots.txt`, `sitemap.xml`, `llms.txt`) e PRIMA delle rotte dinamiche, nell'ordine scritto.
 *
 * 1. **Le icone Apple alla radice → l'icona che c'è già.** Le pagine dichiarano
 *    `<link rel="apple-touch-icon" href="/apple-icon.png">`, ma chi non legge l'HTML cerca alla
 *    radice: «If no icons are specified using a link element, the website root directory is
 *    searched for icons with the apple-touch-icon… prefix» (Apple, Safari Web Content Guide,
 *    «Configuring Web Applications»). Rewrite e non redirect: risposta 200, un solo file sorgente.
 * 2. **Le schede `.aspx` del vecchio sito → la pagina che le risolve.**
 * 3. **Ogni percorso che non comincia con una lingua → `/it/…`.** È la cura dei 500 nati il 14/10
 *    con la #248. Il proxy di next-intl salta i percorsi col punto (`src/proxy.ts`), quindi
 *    `/apple-touch-icon.png` arrivava a `[locale]` con la lingua «apple-touch-icon.png», e la home
 *    la passava a `Intl.DisplayNames`: RangeError. Qui fanno quello che il proxy fa per i percorsi
 *    senza punto, e finiscono nel catch-all `[...rest]`: 404 vera, in italiano, `no-store`.
 *    ⛔ **NON si cura con `dynamicParams = false` sul layout di `[locale]`**: vale anche per i
 *    segmenti figli, e le schede su richiesta (`generateStaticParams → []`) diventano tutte 404,
 *    anche con `dynamicParams = true` scritto sui figli. Provato il 20/10.
 *    Restano fuori lo Studio, le API e i percorsi di Next e di Vercel.
 *
 * Riceve le lingue da fuori, come `redirectPermanenti`: questo file non importa niente.
 */
export function rewriteDopoIFile(attive: readonly string[]) {
  const esclusi = [...attive, "studio", "api", "_next", "_vercel"].join("|");
  return [
    { source: "/apple-touch-icon.png", destination: "/apple-icon.png" },
    { source: "/apple-touch-icon-precomposed.png", destination: "/apple-icon.png" },
    { source: "/:file([^/]+\\.aspx)", destination: "/it/vecchio-sito/:file" },
    {
      source: `/:primo((?!(?:${esclusi})(?:/|$))[^/]+)/:resto*`,
      destination: "/it/:primo/:resto*",
    },
  ];
}
