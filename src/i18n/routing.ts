import { defineRouting } from "next-intl/routing";

/**
 * Cinque lingue, tutte attive dal 16/09/2026 su decisione di Marco. IT resta la lingua di default e
 * la sorgente dei contenuti; EN, DE, FR ed ES sono tradotte.
 *
 * ⚠️ Questo è **il cancello**: pubblicare i testi su Sanity non accende niente, accende questa riga.
 * Fino al 16/09 valeva `["it", "en"]` e le altre tre erano voci disabilitate nel selettore; da qui
 * il selettore le mostra tutte e cinque e le rotte con prefisso rispondono 200.
 *
 * ⚠️ Spegnerne una è una riga sola, e resta la via per ritirare **una** lingua senza toccare le
 * altre: è la ragione per cui il cancello sta nel codice e non nei dati.
 */
export const ALL_LOCALES = ["it", "en", "de", "fr", "es"] as const;
export const ACTIVE_LOCALES = ["it", "en", "de", "fr", "es"] as const;

export type Locale = (typeof ALL_LOCALES)[number];
export type ActiveLocale = (typeof ACTIVE_LOCALES)[number];

export const routing = defineRouting({
  locales: ACTIVE_LOCALES,
  defaultLocale: "it",
  localePrefix: "as-needed",

  /**
   * ⚠️ **Gli hreflang li emette UNA sorgente sola, ed è `alternates` nell'HTML.**
   * Il default di next-intl è `true` (`routing/config.js:7`) e mette un header
   * HTTP `Link` con `it`, `en` e `x-default` su OGNI pagina. Finché `alternates`
   * esisteva su tre rotte i due canali dicevano la stessa cosa e la doppia
   * sorgente sembrava innocua; dalla PR SEO `x-default` vale **EN** e l'header
   * continuerebbe a dire **IT** sulla stessa pagina, cioè due annotazioni in
   * conflitto. Google chiede esplicitamente un solo meccanismo di consegna.
   *
   * E l'header aveva due difetti suoi, misurati in produzione l'8/09: ripeteva
   * le MAIUSCOLE della richiesta invece di risolvere il pathname (su
   * `/Collezioni` dichiarava l'alternato inglese come `/en/Collezioni`, che non
   * è la pagina inglese), e lo emetteva anche sulle risposte **404**
   * (`/modello/B40L`), verso URL inesistenti. `alternates` non ha nessuno dei
   * due, perché nasce dalla chiave di rotta e non dal path richiesto.
   */
  alternateLinks: false,

  /**
   * ⚠️ **Un URL è una lingua, sempre.** Il default di next-intl è `true`
   * (`routing/config.js:6`) e faceva **307** da ogni URL italiano senza prefisso
   * verso l'equivalente `/en` quando il browser mandava `Accept-Language: en`.
   * Misurato in produzione su tutte le rotte IT: `/` → `/en`, `/collezioni` →
   * `/en/collections`, `/modello/b40l` → `/en/model/b40l`, e così via.
   *
   * Googlebot non manda quell'header e prendeva 200 in italiano, quindi
   * l'indicizzazione non ne soffriva. Ma **bingbot sì**, verificato: con
   * `Accept-Language: en-US` riceveva 307. E soprattutto lo subiva ogni persona
   * con il browser in inglese che apriva un link italiano esplicito, da una
   * mail, dalla stampa, da un QR: veniva spostata su un'altra pagina senza
   * poter scegliere. È il redirect automatico che Google sconsiglia, e colpiva
   * proprio gli URL che sitemap e hreflang dichiarano come versione IT.
   *
   * Da qui in avanti la lingua si cambia dal selettore. Il cookie `NEXT_LOCALE`
   * continua a ricordare la scelta, che è un'altra cosa: è la scelta dell'utente,
   * non un'inferenza sull'utente. Un eventuale invito morbido tipo «Continue in
   * English?» è lavoro post-Cersaie, se Marco lo vuole.
   *
   * ⚠️ Traccia che il difetto era già noto senza essere scritto: `lighthouserc.js`
   * forza `it` nelle impostazioni proprio perché «il Chrome del runner manda
   * Accept-Language: en → /blog rediregerebbe a /en/blog, e auditare via
   * redirect rompe l'audit SEO canonical». Era un rimedio al banco di prova per
   * un problema del sito.
   */
  localeDetection: false,
  /**
   * ⚠️ **Segmenti ASCII, senza accenti né dieresi.** `oberflaechen` e non
   * `oberflächen`, `modele` e non `modèle`, `produccion` e non `producción`. Un
   * URL non ASCII funziona — si percent-encoda — ma copiato e incollato diventa
   * illeggibile, e nei log, nelle mail e nei fogli di calcolo arriva a pezzi. La
   * traslitterazione `ae/oe/ue` è la convenzione tedesca per gli indirizzi, e
   * francese e spagnolo lasciano cadere l'accento.
   *
   * ⚠️ **Gli SLUG dei documenti non si toccano**: `/de/kollektionen/boss` e non
   * `/de/kollektionen/boss-de`. È una decisione a registro — hreflang e sitemap
   * la presuppongono — e vale per collezioni, modelli, corpi, post, referenze.
   *
   * ⚠️ **L'unica chiave in forma di STRINGA è `/`**, uguale in tutte le lingue.
   * Fino al 16/09/2026 lo erano anche `/privacy-policy` e `/cookie-policy`: sono
   * confluite in `/menzioni-legali`, e i loro vecchi indirizzi rispondono 308 verso
   * le ancore `#privacy` e `#cookie` della pagina nuova (`src/lib/redirects.ts`).
   */
  pathnames: {
    "/": "/",
    "/collezioni": {
      it: "/collezioni",
      en: "/collections",
      de: "/kollektionen",
      fr: "/collections",
      es: "/colecciones",
    },
    // Cantiere INCASSI. Le due voci LETTERALI vanno PRIMA della dinamica
    // `/collezioni/[slug]`: Next dà priorità al segmento statico sul dinamico
    // fratello, e next-intl risolve sulla voce più specifica. Senza queste due
    // righe i percorsi non sarebbero nella mappa e darebbero 404 (whitelist).
    "/collezioni/corpi-a-incasso": {
      it: "/collezioni/corpi-a-incasso",
      en: "/collections/concealed-bodies",
      de: "/kollektionen/unterputz-koerper",
      fr: "/collections/corps-encastres",
      es: "/colecciones/cuerpos-empotrados",
    },
    "/collezioni/corpi-a-incasso/[slug]": {
      it: "/collezioni/corpi-a-incasso/[slug]",
      en: "/collections/concealed-bodies/[slug]",
      de: "/kollektionen/unterputz-koerper/[slug]",
      fr: "/collections/corps-encastres/[slug]",
      es: "/colecciones/cuerpos-empotrados/[slug]",
    },
    "/collezioni/[slug]": {
      it: "/collezioni/[slug]",
      en: "/collections/[slug]",
      de: "/kollektionen/[slug]",
      fr: "/collections/[slug]",
      es: "/colecciones/[slug]",
    },
    "/modello/[slug]": {
      it: "/modello/[slug]",
      en: "/model/[slug]",
      de: "/modell/[slug]",
      fr: "/modele/[slug]",
      es: "/modelo/[slug]",
    },
    "/produzione": {
      it: "/produzione",
      en: "/production",
      de: "/produktion",
      fr: "/production",
      es: "/produccion",
    },
    "/finiture": {
      it: "/finiture",
      en: "/finishes",
      de: "/oberflaechen",
      fr: "/finitions",
      es: "/acabados",
    },
    "/blog": { it: "/blog", en: "/blog", de: "/blog", fr: "/blog", es: "/blog" },
    "/blog/[slug]": {
      it: "/blog/[slug]",
      en: "/blog/[slug]",
      de: "/blog/[slug]",
      fr: "/blog/[slug]",
      es: "/blog/[slug]",
    },
    "/chi-siamo": {
      it: "/chi-siamo",
      en: "/about",
      de: "/ueber-uns",
      fr: "/a-propos",
      es: "/sobre-nosotros",
    },
    "/contatti": {
      it: "/contatti",
      en: "/contact",
      de: "/kontakt",
      fr: "/contact",
      es: "/contacto",
    },
    // Ex `/area-pro`: voce in mappa che NON aveva una pagina, quindi whitelistata
    // e servita dal catch-all come 404, e a cui non puntava nessun href.
    // Rinominata (non affiancata) quando la pagina «in costruzione» è nata: due
    // chiavi per una pagina sola avrebbero lasciato un URL dichiarato valido e
    // rispondente 404.
    // ⚠️ Cambia la CHIAVE e il pathname IT, NON quello inglese: `/pro-area` resta
    // l'URL EN, com'era. Le etichette inglesi dicono «Pro Area» in tutto il sito,
    // e un indirizzo che non le somiglia sarebbe un terzo nome per la stessa cosa.
    "/area-riservata": {
      it: "/area-riservata",
      en: "/pro-area",
      de: "/pro-bereich",
      fr: "/espace-pro",
      // ⚠️ `area-reservada` e NON `area-pro`, che sarebbe lo spagnolo naturale:
      // `/area-pro` e il vecchio indirizzo ITALIANO, ritirato apposta quando la
      // pagina e nata, e c'e una guardia che pretende che resti morto. Darlo allo
      // spagnolo lo avrebbe resuscitato come 307 verso `/area-riservata` — non
      // una 404, ma un indirizzo ritirato che torna a rispondere. Misurato, non
      // dedotto: la suite di regressione e diventata rossa.
      es: "/area-reservada",
    },
    "/referenze": {
      it: "/referenze",
      en: "/projects",
      de: "/referenzen",
      fr: "/realisations",
      es: "/referencias",
    },
    "/referenze/[slug]": {
      it: "/referenze/[slug]",
      en: "/projects/[slug]",
      de: "/referenzen/[slug]",
      fr: "/realisations/[slug]",
      es: "/referencias/[slug]",
    },
    // Termini d'uso, privacy, cookie e trasparenza AI in una pagina sola, ad
    // accordion. Le sezioni hanno un'ancora (`#societa` dal 26/10/2026, `#termini`,
    // `#privacy`, `#cookie`, `#ai`) e i vecchi `/privacy-policy` e `/cookie-policy` ci
    // arrivano con un 308.
    "/menzioni-legali": {
      it: "/menzioni-legali",
      en: "/legal-notice",
      de: "/rechtliche-hinweise",
      fr: "/mentions-legales",
      es: "/aviso-legal",
    },
    // La tavola «Come nasce una colonna» in un iframe, sotto l'header e senza footer
    // (spec `docs/specs/tavola-officina.md`). Pagina `noindex`, fuori dalla sitemap.
    // ⚠️ La tavola statica sta in `public/officina-tavola/`, non in `public/officina/`:
    // una cartella e una rotta con lo stesso nome si contenderebbero l'indirizzo.
    "/officina": {
      it: "/officina",
      en: "/workshop",
      de: "/werkstatt",
      fr: "/atelier",
      es: "/taller",
    },
    // La pagina d'uso «doccia da esterno» (spec `docs/specs/seo-pagine-contenuto.md`, c1b): gli
    // slug sono le keyword di ogni lingua (spec FAQ § 7). Una lingua senza titolo su Sanity dà
    // 404 ed esce da sitemap, hreflang e `llms.txt`.
    "/doccia-da-esterno": {
      it: "/doccia-da-esterno",
      en: "/outdoor-shower",
      de: "/gartendusche",
      fr: "/douche-exterieure",
      es: "/ducha-exterior",
    },
  },
});
