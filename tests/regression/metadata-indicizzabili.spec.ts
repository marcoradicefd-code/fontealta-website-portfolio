import { expect, test, type APIRequestContext } from "@playwright/test";

import { routing } from "../../src/i18n/routing";

/**
 * La guardia della PR SEO: ogni pagina indicizzabile deve dichiarare canonical,
 * hreflang completi, un'immagine social, un titolo suo, e un JSON-LD leggibile.
 *
 * ⚠️ **Si legge il METADATA GENERATO, cioè l'HTML servito**, non i sorgenti e non
 * i `className`. Una `generateMetadata` può essere scritta benissimo e non
 * arrivare in pagina: l'`openGraph` che il layout dichiara viene cancellato da
 * qualunque pagina ne dichiari uno proprio, il `title.template` non si applica al
 * segmento in cui è definito, e il builder delle immagini di Sanity aggiunge un
 * `rect` che nessuno ha chiesto. Tutti e tre sono difetti veri di questa PR, e
 * tutti e tre si sono visti solo qui.
 *
 * ⚠️ **L'elenco delle pagine viene dalla SITEMAP**, non da una lista scritta a
 * mano accanto. Una lista a mano è una seconda dichiarazione di «quali pagine
 * esistono», e il giorno che se ne aggiunge una resterebbe scoperta in silenzio:
 * è lo stesso motivo per cui il breadcrumb visibile e il suo JSON-LD nascono
 * dalla stessa lista. Qui la sitemap è la fonte, e il test verifica in più che
 * ogni FORMA di URL che la sitemap contiene sia davvero campionata.
 *
 * ⚠️ **Questa suite NON gira in CI** (`ci.yml` lancia solo `pnpm test`): fa parte
 * del giro manuale, come tutto `tests/regression/`. Custodisce i difetti che
 * rientrano in silenzio, non è un cancello di merge.
 */

/**
 * Un URL per template, nelle CINQUE lingue (set 2026: fino al 16/09 erano due, e le
 * 1976 forme tedesche, francesi e spagnole della sitemap restavano senza campione).
 * Una riga per template, nell'ordine it · en · de · fr · es.
 *
 * L'elenco è scritto a mano di proposito: derivarlo dalla sitemap renderebbe il test
 * una tautologia — verificherebbe che la sitemap è uguale a se stessa. La rete contro
 * le dimenticanze è il primo test, che confronta queste forme con quelle che la
 * sitemap contiene davvero. ⚠️ A mano i CAMPIONI, MAI i prefissi di `forma()`: quelli
 * vengono da `routing.pathnames` (vedi sotto).
 */
const CAMPIONI = [
  "/",
  "/en",
  "/de",
  "/fr",
  "/es",
  "/collezioni",
  "/en/collections",
  "/de/kollektionen",
  "/fr/collections",
  "/es/colecciones",
  "/collezioni/boss",
  "/en/collections/boss",
  "/de/kollektionen/boss",
  "/fr/collections/boss",
  "/es/colecciones/boss",
  "/collezioni/corpi-a-incasso",
  "/en/collections/concealed-bodies",
  "/de/kollektionen/unterputz-koerper",
  "/fr/collections/corps-encastres",
  "/es/colecciones/cuerpos-empotrados",
  "/collezioni/corpi-a-incasso/cw-1",
  "/en/collections/concealed-bodies/cw-1",
  "/de/kollektionen/unterputz-koerper/cw-1",
  "/fr/collections/corps-encastres/cw-1",
  "/es/colecciones/cuerpos-empotrados/cw-1",
  "/modello/b40l",
  "/en/model/b40l",
  "/de/modell/b40l",
  "/fr/modele/b40l",
  "/es/modelo/b40l",
  "/produzione",
  "/en/production",
  "/de/produktion",
  "/fr/production",
  "/es/produccion",
  "/finiture",
  "/en/finishes",
  "/de/oberflaechen",
  "/fr/finitions",
  "/es/acabados",
  "/chi-siamo",
  "/en/about",
  "/de/ueber-uns",
  "/fr/a-propos",
  "/es/sobre-nosotros",
  "/contatti",
  "/en/contact",
  "/de/kontakt",
  "/fr/contact",
  "/es/contacto",
  "/referenze",
  "/en/projects",
  "/de/referenzen",
  "/fr/realisations",
  "/es/referencias",
  "/blog",
  "/en/blog",
  "/de/blog",
  "/fr/blog",
  "/es/blog",
  "/blog/aisi-316-contro-304-parte-1",
  "/en/blog/aisi-316-contro-304-parte-1",
  "/de/blog/aisi-316-contro-304-parte-1",
  "/fr/blog/aisi-316-contro-304-parte-1",
  "/es/blog/aisi-316-contro-304-parte-1",
  "/menzioni-legali",
  "/en/legal-notice",
  "/de/rechtliche-hinweise",
  "/fr/mentions-legales",
  "/es/aviso-legal",
  // La pagina d'uso (c1b, 4/11/2026): esiste solo dopo il carico, e il merge viene dopo il carico
  // delle cinque lingue (Marco). La sitemap la contiene solo nelle lingue col titolo.
  "/doccia-da-esterno",
  "/en/outdoor-shower",
  "/de/gartendusche",
  "/fr/douche-exterieure",
  "/es/ducha-exterior",
] as const;

/** Una rotta in ogni lingua, dalla mappa delle rotte. */
const inOgniLingua = (chiave: "/area-riservata" | "/officina") =>
  Object.entries(routing.pathnames[chiave]).map(([lingua, p]) =>
    lingua === routing.defaultLocale ? p : `/${lingua}${p}`,
  );

/** `/area-riservata` in ogni lingua. */
const AREA_RISERVATA = inOgniLingua("/area-riservata");
/** La pagina della tavola, in ogni lingua (27/10/2026). */
const OFFICINA = inOgniLingua("/officina");

/**
 * Le pagine fuori dall'indice: `noindex`, nessun canonical, hreflang né `og:url`, fuori
 * dalla sitemap. Le prove comuni valgono per tutte; il titolo dell'anteprima no
 * (`/area-riservata` lo serve templato, `/officina` nudo), e ha i suoi blocchi in fondo.
 */
const CHIAVI_ESCLUSE = ["/area-riservata", "/officina"] as const;
const ESCLUSE = [...AREA_RISERVATA, ...OFFICINA];

/** Il `title.default` del layout: nessuna pagina indicizzabile deve servirlo. */
const TITOLO_DEFAULT = "Fontealta · Our design, your personality";
/** La description del layout, per la stessa ragione. */
const DESCRIPTION_DEFAULT = "Specialisti dell";

// Cinque lingue dal 16/09/2026 (#201): fino a lì erano `it`, `en` e `x-default`.
const ATTESI_HREFLANG = ["it", "en", "de", "fr", "es", "x-default"];

/** Le lingue con prefisso nell'URL: tutte tranne quella di default (`as-needed`). */
const PREFISSATE = routing.locales.filter((l) => l !== routing.defaultLocale);
const PREFISSO = new RegExp(`^/(${PREFISSATE.join("|")})(?=/|$)`);

/** La lingua di un percorso, letta dal prefisso. */
const linguaDi = (path: string) => PREFISSO.exec(path)?.[1] ?? routing.defaultLocale;

/**
 * Le forme dei percorsi, per tutte le lingue, lette da `routing.pathnames`.
 *
 * ⚠️ **MAI scritte a mano** (decisione di Marco, set 2026). Una tabella accanto alla
 * mappa delle rotte è una seconda dichiarazione di come si chiamano, e il giorno che
 * una lingua cambia un segmento resterebbe indietro in silenzio: è esattamente come
 * erano nate le 1976 forme scoperte, con `forma()` che conosceva solo `/en`.
 */
const TEMPLATE = Object.values(routing.pathnames).flatMap((v) =>
  typeof v === "string" ? [v] : Object.values(v as Record<string, string>),
);
/** I segmenti statici (`/collezioni/corpi-a-incasso`), che vincono sul dinamico fratello come in Next. */
const LETTERALI = new Set(TEMPLATE.filter((t) => !t.includes("[")));
/** I prefissi dinamici (`/collezioni/`), dal più lungo: un corpo a incasso non è una collezione. */
const DINAMICI = [
  ...new Set(
    TEMPLATE.filter((t) => t.endsWith("/[slug]")).map((t) => t.slice(0, -"[slug]".length)),
  ),
].sort((a, b) => b.length - a.length);

interface Meta {
  canonical: string | null;
  hreflang: string[];
  /** `{ lingua: url }`, per il reciproco: il canonical deve stare qui dentro. */
  alternati: Record<string, string>;
  /** `og:title`: il titolo NUDO, senza il suffisso del marchio. */
  ogTitle: string | null;
  /** `twitter:title`: Next lo ricava da `og:title`, e deve restare lo stesso. */
  twitterTitle: string | null;
  /** `og:site_name`: è lui a portare il marchio, al posto del titolo. */
  siteName: string | null;
  /** `og:image:alt` e `twitter:image:alt`, dal 7/10/2026. */
  ogImageAlt: string | null;
  twitterImageAlt: string | null;
  /** I nomi dei tag `og:*` serviti: l'INSIEME, non il conteggio. */
  ogTag: string[];
  /** `og:url`: deve essere la STESSA stringa del canonical, o mancare con esso. */
  ogUrl: string | null;
  ogImage: string | null;
  /** Le misure DICHIARATE nei tag, da confrontare con quelle servite. */
  ogImageWidth: string | null;
  ogImageHeight: string | null;
  title: string | null;
  description: string | null;
  jsonLd: unknown[];
  robots: string | null;
  /** Quante intestazioni di secondo livello: la gerarchia sotto l'H1. */
  h2: number;
}

/**
 * ⚠️ L'attributo esce come `hrefLang`, in camelCase, perché è React a scriverlo.
 * In HTML gli attributi sono case-insensitive e i crawler lo leggono bene, ma una
 * sonda con la regex sensibile alle maiuscole conta ZERO su una pagina che ce
 * l'ha. Già successo misurando A2.4.
 */
/**
 * Il nodo di un certo `@type`, cercato anche **dentro `@graph`**.
 *
 * ⚠️ I nodi del sito non sono blocchi separati: `Organization` e `WebSite` stanno
 * dentro un unico `<script>` sotto `@graph`, mentre `Article` e `BreadcrumbList`
 * hanno il loro. Una sonda che guardasse solo il primo livello non troverebbe mai
 * l'azienda e passerebbe convinta di aver controllato.
 */
function nodo(blocchi: unknown[], tipo: string): unknown {
  for (const b of blocchi) {
    const d = b as { "@type"?: string; "@graph"?: unknown[] };
    if (d?.["@type"] === tipo) return d;
    for (const g of d?.["@graph"] ?? []) {
      if ((g as { "@type"?: string })?.["@type"] === tipo) return g;
    }
  }
  return null;
}

/**
 * Le chiavi ordinate, in profondità: due oggetti uguali devono dare la stessa
 * stringa anche se le chiavi sono arrivate in ordine diverso.
 */
function normalizza(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normalizza);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => [k, normalizza(x)]),
    );
  }
  return v;
}

function leggiMeta(html: string): Meta {
  const uno = (re: RegExp) => re.exec(html)?.[1] ?? null;
  const jsonLd: unknown[] = [];
  // `[\s\S]` e non il flag `s`: il target TypeScript del progetto non arriva a
  // es2018 e `dotAll` non compila (TS1501). Stessa semantica.
  for (const [, grezzo] of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
  )) {
    // Il `<` è escapato alla sorgente per non chiudere il tag: si ripristina
    // prima di parsare, altrimenti si misurerebbe l'escape e non il dato.
    jsonLd.push(JSON.parse(grezzo.replaceAll("\\u003c", "<")));
  }
  const coppie = [...html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"/gi)];
  return {
    h2: [...html.matchAll(/<h2[\s>]/gi)].length,
    canonical: uno(/<link rel="canonical" href="([^"]*)"/i),
    hreflang: coppie.map((m) => m[1]),
    alternati: Object.fromEntries(coppie.map((m) => [m[1], m[2]])),
    ogTitle: uno(/<meta property="og:title" content="([^"]*)"/i),
    twitterTitle: uno(/<meta name="twitter:title" content="([^"]*)"/i),
    siteName: uno(/<meta property="og:site_name" content="([^"]*)"/i),
    ogImageAlt: uno(/<meta property="og:image:alt" content="([^"]*)"/i),
    twitterImageAlt: uno(/<meta name="twitter:image:alt" content="([^"]*)"/i),
    ogTag: [...html.matchAll(/<meta property="(og:[^"]+)"/gi)].map((m) => m[1]),
    ogUrl: uno(/<meta property="og:url" content="([^"]*)"/i),
    ogImage: uno(/<meta property="og:image" content="([^"]*)"/i),
    ogImageWidth: uno(/<meta property="og:image:width" content="([^"]*)"/i),
    ogImageHeight: uno(/<meta property="og:image:height" content="([^"]*)"/i),
    title: uno(/<title>([^<]*)<\/title>/i),
    description: uno(/<meta name="description" content="([^"]*)"/i),
    jsonLd,
    robots: uno(/<meta name="robots" content="([^"]*)"/i),
  };
}

async function meta(request: APIRequestContext, path: string): Promise<Meta> {
  const res = await request.get(path);
  expect(res.status(), `${path} deve rispondere 200`).toBe(200);
  return leggiMeta(await res.text());
}

/**
 * La FORMA di un URL: il percorso senza il prefisso di lingua, con l'ultimo
 * segmento sostituito da `*` quando è uno slug. Serve a campionare un URL per
 * template invece di 1312, e a dire se un template è rimasto fuori.
 */
function forma(url: string): string {
  const p = new URL(url).pathname.replace(PREFISSO, "") || "/";
  // ⚠️ I segmenti LETTERALI vanno riconosciuti PRIMA dei prefissi dinamici:
  // `/collezioni/corpi-a-incasso` è una cartella statica, non una collezione con
  // quello slug, ed è la stessa precedenza che in Next fa vincere il segmento
  // statico sul dinamico fratello. Senza, verrebbe classificato `/collezioni/*` e
  // si confonderebbe con una scheda collezione.
  if (LETTERALI.has(p)) return p;
  for (const d of DINAMICI) if (p.startsWith(d) && p.length > d.length) return `${d}*`;
  return p;
}

/**
 * ⚠️ Il limite di `forma()`, detto perché nessuno ci conti sopra: riconosce i
 * segmenti letterali che stanno in `routing.pathnames`, e solo quelli. Una cartella
 * statica fuori dalla mappa non esiste per next-intl (404, whitelist), quindi non
 * può finire in sitemap: il limite di prima, «`/collezioni/outlet` scambiato per uno
 * slug», oggi vuol dire una rotta dimenticata nella mappa, e cade altrove.
 */

test.describe("metadata delle pagine indicizzabili", () => {
  test("ogni forma di URL della sitemap è campionata dal test", async ({ request }) => {
    // È l'asserzione che impedisce a una rotta nuova di restare scoperta: se
    // domani nasce `/showroom` e finisce in sitemap, qui manca il campione e il
    // test cade, invece di passare senza guardarla.
    const xml = await (await request.get("/sitemap.xml")).text();
    const forme = new Set([...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => forma(m[1])));
    const campionate = new Set(CAMPIONI.map((c) => forma(`https://x${c}`)));
    const scoperte = [...forme].filter((f) => !campionate.has(f));
    expect(scoperte, "forme in sitemap senza un campione qui").toEqual([]);
  });

  /**
   * ⚠️ **L'identità dell'azienda deve essere UNA, e questo è il test che lo
   * prova.** Le asserzioni per pagina guardano che i campi ci siano e siano
   * giusti; questa guarda che siano gli **stessi ovunque**, byte per byte dopo
   * la normalizzazione delle chiavi. Il difetto che coglie è una pagina che
   * costruisce l'`Organization` per conto suo invece di leggerla da
   * `json-ld.ts`: passerebbe tutte le altre asserzioni e direbbe a un
   * consumatore che il sito parla di due aziende diverse.
   */
  test("l'Organization è identica su tutti i campioni della stessa lingua", async ({ request }) => {
    const viste = new Map<string, Map<string, string[]>>();
    const nodi = new Map<string, Record<string, unknown>>();
    for (const path of CAMPIONI) {
      const lingua = linguaDi(path);
      const org = nodo((await meta(request, path)).jsonLd, "Organization");
      nodi.set(lingua, org as Record<string, unknown>);
      const firma = JSON.stringify(normalizza(org));
      const perLingua = viste.get(lingua) ?? new Map<string, string[]>();
      perLingua.set(firma, [...(perLingua.get(firma) ?? []), path]);
      viste.set(lingua, perLingua);
    }
    for (const [lingua, perLingua] of viste) {
      expect(
        [...perLingua.values()],
        `Organization diverse dentro ${lingua}: ${JSON.stringify([...perLingua.values()])}`,
      ).toHaveLength(1);
    }

    /**
     * ⚠️ **E fra l'italiano e ogni altra lingua cambiano DUE chiavi, non una di più.** Questa
     * metà è quella che conta: `description` e `knowsAbout` sono per lingua per
     * scelta, ma se domani un altro campo cominciasse a variare — un indirizzo
     * tradotto, un `legalName` «localizzato» — un consumatore leggerebbe due
     * aziende con lo stesso `@id` e fatti diversi. L'asserzione «sono tutte
     * uguali» non lo vedrebbe più, quindi il vincolo si sposta qui invece di
     * sparire.
     */
    const it = nodi.get(routing.defaultLocale) ?? {};
    for (const lingua of PREFISSATE) {
      const altra = nodi.get(lingua) ?? {};
      const diverse = [...new Set([...Object.keys(it), ...Object.keys(altra)])]
        .filter((k) => JSON.stringify(it[k]) !== JSON.stringify(altra[k]))
        .sort();
      expect(diverse, `fra IT e ${lingua} deve cambiare solo la coppia per lingua`).toEqual([
        "description",
        "knowsAbout",
      ]);
    }
  });

  const CONTATTI: string[] = [
    "/contatti",
    "/en/contact",
    "/de/kontakt",
    "/fr/contact",
    "/es/contacto",
  ];

  for (const path of CAMPIONI) {
    test(`${path} dichiara canonical, hreflang, og:image, titolo proprio`, async ({ request }) => {
      const m = await meta(request, path);

      expect(m.canonical, "canonical assente").not.toBeNull();
      expect(m.canonical, "il canonical deve essere assoluto").toMatch(/^https?:\/\//);

      expect(m.hreflang.sort(), "hreflang incompleti").toEqual([...ATTESI_HREFLANG].sort());
      // Il canonical deve comparire fra i propri alternati: è l'auto-riferimento
      // che Google chiede, e senza il reciproco l'insieme non regge.
      expect(Object.values(m.alternati), "il canonical non è fra i propri hreflang").toContain(
        m.canonical,
      );

      expect(m.ogImage, "og:image assente").not.toBeNull();

      expect(m.title, "titolo assente").not.toBeNull();
      expect(m.title, "serve il titolo di riserva del layout").not.toBe(TITOLO_DEFAULT);

      /**
       * ⚠️ **Il marchio una volta sola, ed è una guardia nata da un difetto
       * vero.** Quattro rotte servivano «Chi siamo · Fontealta | Fontealta» e
       * «Produzione · Fontealta | Fontealta»: il `metaTitle` nei messaggi
       * conteneva già il marchio e `title.template` ne aggiungeva un secondo.
       * Nessuna guardia se n'era accorta, perché tutte controllavano i titoli
       * **per forma** — non nulli, diversi da quello di riserva — e mai per
       * contenuto.
       *
       * Una e non zero: il marchio ci deve essere. La **home** lo porta in testa
       * (`Fontealta · Colonne doccia…`) e usa `title.absolute`, quindi non passa
       * dal template: anche lì il conto fa uno.
       */
      const marchi = (m.title ?? "").split("Fontealta").length - 1;
      expect(marchi, `«Fontealta» ${marchi} volte in «${m.title}»`).toBe(1);
      expect(m.description ?? "", "serve la description di riserva del layout").not.toContain(
        DESCRIPTION_DEFAULT,
      );

      /**
       * ⚠️ **Il CONTENUTO, non il conteggio.** Fino al 10/09/2026 qui c'era solo
       * `length > 0`: una modifica *dentro* al JSON-LD passava inosservata, e la
       * prova di invarianza della PR C aveva lo stesso buco, scoperto da un
       * `drift compare` e non da noi. Un dato strutturato sbagliato non rompe
       * una pagina, non fa cadere un build e non cambia un pixel: se non lo
       * guarda un test, non lo guarda nessuno.
       */
      expect(m.jsonLd.length, "nessun JSON-LD").toBeGreaterThan(0);

      /**
       * ⚠️ **Almeno un H2, e non è una regola di stile.** Un documento con un
       * titolo e poi solo `h3` non ha gerarchia: chi lo legge a macchina — un
       * motore, un assistente, uno screen reader che naviga per intestazioni —
       * non sa dove comincia il contenuto. Al 10/09/2026 le pagine di collezione
       * e dei corpi avevano **zero** H2, misurato sul build.
       */
      expect(m.h2, "nessun H2: l'H1 non ha gerarchia sotto").toBeGreaterThanOrEqual(1);

      const org = nodo(m.jsonLd, "Organization");
      expect(org, "manca il nodo Organization").toBeTruthy();
      // I fatti sull'azienda sono LETTERALI: un NAP è un fatto sul mondo, non un
      // valore derivato, e confrontarlo con la costante da cui nasce darebbe un
      // test che si muove insieme all'errore.
      expect(org).toMatchObject({
        "@type": "Organization",
        name: "Fontealta",
        legalName: "Rubinetteria F & F L’Artigiana S.r.l.",
        vatID: "IT01718720467",
        foundingDate: "1999",
        faxNumber: "+39 0584 361206",
        address: {
          "@type": "PostalAddress",
          streetAddress: "Via Libeccio 13/15",
          postalCode: "55049",
          addressLocality: "Viareggio",
          addressRegion: "LU",
          addressCountry: "IT",
        },
      });
      // ⚠️ L'host NON si asserisce: `@id` e `url` nascono da `siteUrl()`, che
      // cambia con `NEXT_PUBLIC_SITE_URL`. Al cutover cambieranno, ed è atteso.
      expect(String((org as { "@id": string })["@id"])).toMatch(/#organization$/);

      /**
       * ⚠️ **Questa riga diceva «`sameAs` non esiste», ed è diventata falsa il
       * 10/09/2026**, quando la Fase S ha messo Instagram in
       * `siteSettings.socialLinks`: il campo esiste apposta, e la guardia stava
       * difendendo l'assenza di una cosa che qualcuno aveva appena deciso di
       * dichiarare. Quello che va difeso non è che la chiave manchi, è che
       * quando c'è contenga solo URL `https` e nessun doppione: un `sameAs`
       * afferma un'identità, e un URL rotto lì manda i motori su una pagina che
       * non risponde.
       */
      const sameAs = (org as { sameAs?: unknown }).sameAs;
      if (sameAs !== undefined) {
        expect(Array.isArray(sameAs), "sameAs deve essere un array").toBe(true);
        const profili = sameAs as string[];
        expect(profili.length, "sameAs presente ma vuoto").toBeGreaterThan(0);
        for (const url of profili) expect(url, `sameAs non https: ${url}`).toMatch(/^https:\/\//);
        expect(new Set(profili).size, "profili ripetuti in sameAs").toBe(profili.length);
      }

      /**
       * `description` e `knowsAbout`: presenti, nella lingua della pagina, e la
       * description sotto i 300 caratteri che i consumatori troncano.
       */
      const descrizione = (org as { description?: string }).description ?? "";
      expect(descrizione.length, "Organization senza description").toBeGreaterThan(0);
      expect(descrizione.length, "description troppo lunga").toBeLessThan(300);
      const argomenti = (org as { knowsAbout?: string[] }).knowsAbout ?? [];
      expect(argomenti.length, "Organization senza knowsAbout").toBeGreaterThan(0);
      expect(new Set(argomenti).size, "argomenti ripetuti in knowsAbout").toBe(argomenti.length);

      const sito = nodo(m.jsonLd, "WebSite");
      expect(sito, "manca il nodo WebSite").toBeTruthy();
      expect((sito as { inLanguage: string }).inLanguage).toBe(linguaDi(path));

      // `LocalBusiness` è la sede: sta su `/contatti` e su nessun'altra pagina.
      const sede = nodo(m.jsonLd, "LocalBusiness");
      const eContatti = CONTATTI.includes(path);
      expect(Boolean(sede), `LocalBusiness su ${path}`).toBe(eContatti);

      expect(m.robots ?? "", "una pagina in sitemap non può essere noindex").not.toContain(
        "noindex",
      );
      // Le immagini grandi in Discover (Marco, 5/11/2026): la sola direttiva, senza `index` né
      // `follow`, che in anteprima contraddirebbero l'header `X-Robots-Tag: noindex`.
      expect(m.robots, "manca max-image-preview:large").toBe("max-image-preview:large");
    });
  }

  /**
   * ⚠️ **Le pagine che elencano articoli devono dire CHE COSA elencano.** Fino
   * al 10/09/2026 una collezione dichiarava il percorso per arrivarci
   * (`BreadcrumbList`) e i due nodi del sito, e nient'altro: chi la leggeva
   * sapeva dov'era ma non che contenesse cinquantatré modelli.
   *
   * L'asserzione forte è la **terza**: ogni URL dell'`ItemList` deve comparire
   * davvero come link nell'HTML. È ciò che lega il dato strutturato alla pagina;
   * senza, un elenco preso da una query diversa da quella della griglia
   * passerebbe tutte le altre asserzioni e dichiarerebbe modelli che quella
   * pagina non mostra.
   */
  const ELENCHI: string[] = [
    "/collezioni",
    "/en/collections",
    "/de/kollektionen",
    "/fr/collections",
    "/es/colecciones",
    "/collezioni/boss",
    "/en/collections/boss",
    "/de/kollektionen/boss",
    "/fr/collections/boss",
    "/es/colecciones/boss",
    "/collezioni/corpi-a-incasso",
    "/en/collections/concealed-bodies",
    "/de/kollektionen/unterputz-koerper",
    "/fr/collections/corps-encastres",
    "/es/colecciones/cuerpos-empotrados",
  ];

  for (const path of CAMPIONI) {
    const atteso = ELENCHI.includes(path);
    test(`${path} ${atteso ? "dichiara" : "non dichiara"} un CollectionPage`, async ({
      request,
    }) => {
      const html = await (await request.get(path)).text();
      const pagina = nodo(leggiMeta(html).jsonLd, "CollectionPage") as {
        name?: string;
        description?: string;
        inLanguage?: string;
        isPartOf?: { "@id"?: string };
        mainEntity?: {
          numberOfItems?: number;
          itemListElement?: Array<{ position: number; name: string; url: string }>;
        };
      } | null;

      expect(Boolean(pagina), `CollectionPage su ${path}`).toBe(atteso);
      if (!atteso || !pagina) return;

      expect(pagina.name ?? "", "CollectionPage senza nome").not.toBe("");
      expect(pagina.inLanguage, "lingua sbagliata").toBe(linguaDi(path));
      expect(String(pagina.isPartOf?.["@id"] ?? ""), "isPartOf non punta al WebSite").toMatch(
        /#website$/,
      );

      const voci = pagina.mainEntity?.itemListElement ?? [];
      expect(voci.length, "ItemList vuoto su una pagina che elenca").toBeGreaterThan(0);
      expect(pagina.mainEntity?.numberOfItems, "numberOfItems non è il numero di voci").toBe(
        voci.length,
      );
      expect(
        voci.map((v) => v.position),
        "le posizioni non sono 1..n in ordine",
      ).toEqual(voci.map((_, i) => i + 1));

      // ⚠️ La metà che lega il dato alla pagina.
      for (const voce of voci) {
        expect(voce.name.trim(), "voce senza nome").not.toBe("");
        const percorso = new URL(voce.url).pathname;
        expect(html, `l'ItemList dichiara ${percorso}, che sulla pagina non c'è`).toContain(
          `href="${percorso}"`,
        );
      }
    });
  }

  /**
   * ⚠️ **Un `Product` si dichiara solo dove le misure si VEDONO**, ed è una
   * decisione di Marco del 10/09/2026 prima che una scelta tecnica: Google vieta
   * il markup di contenuto non visibile, quindi o si mostrano o non si
   * dichiarano. Questa guardia la tiene ferma da due lati diversi.
   *
   * Sulle pagine che NON sono una scheda modello il vincolo è assoluto e non
   * dipende dai dati: su una collezione le misure non compaiono neanche il
   * giorno che i campi saranno pieni, quindi un `Product` lì sarebbe markup che
   * descrive un'altra pagina. È la ragione per cui l'`ItemList` porta `ListItem`
   * e non `Product`, e questo test è ciò che impedisce a qualcuno di
   * «arricchirlo» in buona fede.
   *
   * Sulla scheda modello il vincolo è un'UGUAGLIANZA, non un'assenza: il nodo
   * c'è esattamente quando la pagina mostra almeno una misura. Al 10/09/2026 i
   * modelli con misure sono 0 su 595, quindi oggi entrambi i lati sono falsi —
   * ma l'uguaglianza resta discriminante, perché un `Product` che comparisse
   * senza misure a video la farebbe cadere.
   */
  const SCHEDE_MODELLO: string[] = [
    "/modello/b40l",
    "/en/model/b40l",
    "/de/modell/b40l",
    "/fr/modele/b40l",
    "/es/modelo/b40l",
  ];

  for (const path of CAMPIONI) {
    test(`${path} dichiara un Product solo se mostra delle misure`, async ({ request }) => {
      const html = await (await request.get(path)).text();
      const prodotto = nodo(leggiMeta(html).jsonLd, "Product");

      if (!SCHEDE_MODELLO.includes(path)) {
        expect(
          Boolean(prodotto),
          "un Product su una pagina che non mostra misure di prodotto",
        ).toBe(false);
        return;
      }

      // «La pagina mostra una misura» si legge dal markup, non dal dato: le righe
      // di `ModelSpecs` escono come «1200 mm» e «9.4 kg» dentro il loro <dd>.
      const mostraMisure = /<dd[^>]*>\s*[\d.,]+\s*(mm|kg)\s*<\/dd>/i.test(html);
      expect(
        Boolean(prodotto),
        mostraMisure
          ? "la scheda mostra delle misure ma non le dichiara"
          : "la scheda dichiara un Product senza mostrare nessuna misura",
      ).toBe(mostraMisure);

      if (!prodotto) return;

      // Dichiarato ⊆ mostrato: ogni valore del nodo deve comparire in pagina.
      const p = prodotto as Record<string, { value?: number } | undefined>;
      for (const [chiave, unita] of [
        ["height", "mm"],
        ["width", "mm"],
        ["depth", "mm"],
        ["weight", "kg"],
      ] as const) {
        const v = p[chiave]?.value;
        if (v === undefined) continue;
        expect(html, `${chiave} dichiarata ${v} ${unita} ma non a video`).toContain(
          `${v} ${unita}`,
        );
      }
    });
  }

  for (const path of ESCLUSE) {
    test(`${path} non dichiara né canonical né alternates`, async ({ request }) => {
      // È noindex sulla rotta: un canonical la annuncerebbe come indicizzabile e
      // gli alternates inviterebbero i motori sulle sue traduzioni.
      const m = await meta(request, path);
      expect(m.canonical, "una pagina noindex non deve avere un canonical").toBeNull();
      expect(m.hreflang, "una pagina noindex non deve avere hreflang").toEqual([]);
      expect(m.robots ?? "", "manca il noindex sulla rotta").toContain("noindex");
      // Il `robots` della pagina sostituisce per intero quello del layout (fusione shallow):
      // la direttiva delle immagini grandi non arriva fin qui, ed è giusto così.
      expect(m.robots, "il robots della pagina esclusa").toBe("noindex, follow");
    });
  }

  /**
   * ⚠️ **Le misure dichiarate devono descrivere l'immagine SERVITA.**
   * `og:image:width` e `og:image:height` sono numeri che scriviamo noi, e niente
   * costringe il CDN a rispettarli: `urlFor` parte da `fit("max")`, che con una
   * larghezza e un'altezza significa «al massimo quelle» e non ingrandisce.
   * Trovato sul preview da Marco: la cover di «AISI 316 contro 304», nativa
   * 1080×1350, veniva servita **1080×567** sotto due tag che dichiaravano
   * 1200×630. Un'anteprima social con misure sbagliate viene ritagliata o
   * scartata da chi la consuma, e non se ne accorge nessuno.
   *
   * Si misura **scaricando** e lasciando decodificare al browser, non fidandosi
   * dei parametri nell'URL: quelli sono la richiesta, non la risposta.
   */
  for (const path of [
    // Cover nativa 1080 di larghezza: è il caso che il difetto ha colpito.
    "/blog/aisi-316-contro-304-parte-1",
    // Composizione prodotto quadrata 3072, letterboxata.
    "/modello/b40l",
    // Cover collezione in formato ritratto 896×1200, ritagliata.
    "/collezioni/boss",
    // Pagina senza immagine propria: serve la riserva locale.
    "/finiture",
  ]) {
    test(`${path} serve un og:image delle misure che dichiara`, async ({
      page,
      request,
      baseURL,
    }) => {
      const m = await meta(request, path);
      expect(m.ogImage).not.toBeNull();
      expect(m.ogImageWidth).toBe("1200");
      expect(m.ogImageHeight).toBe("630");

      // ⚠️ L'immagine di riserva è servita da `public/` sotto la base del sito,
      // che in questo build vale `https://fontealta.it`: un dominio che non
      // esiste ancora e che qui non si può scaricare. Si riporta all'origine
      // locale, così si misura il FILE vero invece di fallire su una risposta
      // che non arriva. Le immagini di Sanity stanno sul CDN e si scaricano
      // così come sono.
      const daScaricare = new URL(m.ogImage as string);
      const locale = new URL(baseURL as string);
      const src =
        daScaricare.origin === new URL(m.canonical as string).origin
          ? `${locale.origin}${daScaricare.pathname}${daScaricare.search}`
          : daScaricare.toString();

      await page.goto(path);
      const servita = await page.evaluate(
        (src) =>
          new Promise<{ w: number; h: number }>((risolvi, rifiuta) => {
            const img = new Image();
            img.onload = () => risolvi({ w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = () => rifiuta(new Error(`immagine non caricata: ${src}`));
            img.src = src;
          }),
        src,
      );
      expect(servita, `${src} non è delle misure dichiarate`).toEqual({ w: 1200, h: 630 });
    });
  }

  test("le pagine escluse non compaiono in sitemap", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    for (const chiave of CHIAVI_ESCLUSE) {
      for (const escluso of Object.values(routing.pathnames[chiave])) {
        expect(xml, `${escluso} non deve stare in sitemap`).not.toContain(escluso);
      }
    }
  });

  /**
   * ⚠️ **`og:url` e canonical sono la stessa affermazione, quindi devono essere
   * la stessa stringa.** Fino all'11/09/2026 `og:url` non lo emetteva nessuna
   * rotta: le anteprime social ricadevano sull'indirizzo da cui lo scraper era
   * arrivato, che con un parametro di tracciamento in coda è un URL diverso per
   * ogni condivisione.
   *
   * L'asserzione è **l'uguaglianza**, non la presenza: un `og:url` che esiste ma
   * punta altrove è peggio dell'assenza, perché consolida le condivisioni su una
   * pagina sbagliata e nessuno se ne accorge navigando. Le due stringhe nascono
   * dalla stessa `absoluteUrl(locale, href)` chiamata **una volta** per pagina;
   * questa guardia è ciò che impedisce che un domani tornino a essere due.
   *
   * Il secondo ramo è il cancello: una pagina che non dichiara canonical —
   * `/area-riservata`, e ogni documento con `seo.noIndex` — non deve dichiarare
   * nemmeno `og:url`. È una regola sola per «dove questa pagina dice di stare».
   */
  for (const path of CAMPIONI) {
    test(`${path} dichiara og:url uguale al canonical`, async ({ request }) => {
      const m = await meta(request, path);
      expect(m.canonical, `${path} senza canonical`).not.toBeNull();
      expect(m.ogUrl, `og:url mancante su ${path}`).toBe(m.canonical);
    });
  }

  test("una pagina esclusa dai motori non dichiara og:url", async ({ request }) => {
    for (const path of ESCLUSE) {
      const m = await meta(request, path);
      expect(m.canonical, `${path} non deve avere canonical`).toBeNull();
      expect(m.ogUrl, `${path} non deve avere og:url`).toBeNull();
    }
  });

  const SUFFISSO = " | Fontealta";

  /**
   * ⚠️ **`og:title` è il titolo NUDO: il marchio lo porta `og:site_name`.**
   * Ripeterlo dentro il titolo lo fa comparire due volte in ogni anteprima
   * social — «Finiture | Fontealta» sotto l'intestazione «Fontealta».
   *
   * La regola era in `CLAUDE.md` da tempo e valeva su **due rotte su nove**: solo
   * `/blog` e `/produzione` dichiaravano `openGraph.title` a mano, tutte le altre
   * lasciavano che Next ci mettesse il titolo GIÀ passato da `title.template`.
   * Misurato sul costruito l'11/09/2026: **52 pagine** lo servivano col suffisso,
   * di cui 34 schede di corpo a incasso — la famiglia che sfuggiva al conteggio
   * perché non è una rotta statica.
   *
   * ⚠️ La seconda asserzione è quella che vale: `og:title` non basta che sia
   * "senza suffisso", deve essere **il titolo della pagina meno il suffisso**. Un
   * `og:title` diverso dal titolo passerebbe il primo controllo e direbbe ai
   * social un'altra cosa di quella che dice la pagina.
   */
  for (const path of CAMPIONI) {
    test(`${path} serve un og:title nudo e uguale al titolo`, async ({ request }) => {
      const m = await meta(request, path);
      expect(m.ogTitle, `${path} senza og:title`).not.toBeNull();
      expect(m.ogTitle ?? "", `og:title col marchio ripetuto su ${path}`).not.toContain(SUFFISSO);
      expect(m.ogTitle, `og:title diverso dal titolo su ${path}`).toBe(
        (m.title ?? "").replace(SUFFISSO, ""),
      );
    });
  }

  /**
   * ⚠️ **Il marchio sta in `og:site_name`, e quindi `og:site_name` DEVE esserci**
   * (LOCK del 10/09/2026, confermato da Marco il 7/10). La fonte è la guida
   * webmaster di Facebook: «og:title: The title of your article without any
   * branding such as your site name». Se `og:site_name` mancasse da una pagina,
   * quella pagina condivisa non direbbe più di chi è: il difetto vero sarebbe
   * lì, non nel titolo nudo.
   *
   * `twitter:title` non lo dichiara nessuno: Next lo ricava da `og:title`, e la
   * guardia tiene ferma l'uguaglianza perché un `twitter` dichiarato a mano su
   * una pagina la romperebbe in silenzio.
   *
   * `og:image:alt` c'è dal 7/10/2026 su ogni immagine: l'`alt` Sanity sulle
   * pagine italiane, il titolo nudo altrove, perché gli `alt` su Sanity sono una
   * stringa sola, italiana. Fuori dall'italiano, quindi, deve coincidere col
   * titolo: è la metà che distingue la regola da un `alt` qualunque. L'eccezione
   * è la cover di collezione, che dalla #344 ha l'alt composto nella lingua della
   * pagina (spec `docs/specs/contenuti-per-lingua.md` § A.5): lì l'atteso è scritto.
   * Lo stesso per la pagina d'uso dal 4/11/2026 (#358): `seo.ogImage` porta
   * `altI18n` nelle cinque lingue, scritto da Marco, e la pagina lo passa
   * (`ogImageScenaNellaLingua`).
   */
  const ALT_NELLA_LINGUA: Record<string, string> = {
    "/en/collections/boss": "Boss collection",
    "/de/kollektionen/boss": "Kollektion Boss",
    "/fr/collections/boss": "Collection Boss",
    "/es/colecciones/boss": "Colección Boss",
    "/doccia-da-esterno":
      "Colonne doccia da esterno Club Large e Spring a bordo piscina, al tramonto sul mare e in campagna",
    "/en/outdoor-shower":
      "Club Large and Spring outdoor shower columns by the pool, at sunset by the sea and in the countryside",
    "/de/gartendusche":
      "Duschsäulen Club Large und Spring für draußen am Pool, bei Sonnenuntergang am Meer und auf dem Land",
    "/fr/douche-exterieure":
      "Colonnes de douche extérieure Club Large et Spring en bord de piscine, au coucher du soleil face à la mer et à la campagne",
    "/es/ducha-exterior":
      "Columnas de ducha exterior Club Large y Spring junto a la piscina, al atardecer frente al mar y en el campo",
  };
  for (const path of CAMPIONI) {
    test(`${path} porta il marchio in og:site_name e l'alt sull'immagine`, async ({ request }) => {
      const m = await meta(request, path);
      expect(m.siteName, `og:site_name su ${path}`).toBe("Fontealta");
      expect(m.twitterTitle, `twitter:title diverso da og:title su ${path}`).toBe(m.ogTitle);
      expect((m.ogImageAlt ?? "").trim(), `og:image:alt vuoto o assente su ${path}`).not.toBe("");
      expect(m.twitterImageAlt, `twitter:image:alt diverso da og:image:alt su ${path}`).toBe(
        m.ogImageAlt,
      );
      if (path in ALT_NELLA_LINGUA) {
        expect(m.ogImageAlt, `alt nella lingua della pagina, su ${path}`).toBe(
          ALT_NELLA_LINGUA[path],
        );
      } else if (linguaDi(path) !== routing.defaultLocale) {
        expect(m.ogImageAlt, `fuori dall'italiano l'alt è il titolo, su ${path}`).toBe(m.ogTitle);
      }
    });
  }

  /**
   * La guardia provata contro sé stessa: il `<title>` della stessa pagina IL
   * SUFFISSO CE L'HA, perché glielo mette `title.template`. Se la sonda non lo
   * vedesse lì, non starebbe misurando niente nemmeno sopra.
   */
  test("la sonda riconosce il suffisso dove c'è davvero: la controprova", async ({ request }) => {
    const m = await meta(request, "/finiture");
    expect(m.title ?? "", "il <title> deve portare il marchio").toContain(SUFFISSO);
    expect(m.ogTitle ?? "", "e l'og:title no").not.toContain(SUFFISSO);
  });

  /**
   * ⚠️ **`openGraph` NON si eredita per campi: dichiararne uno SOSTITUISCE
   * l'oggetto intero.** Next fonde i metadata in modo shallow, quindi una pagina
   * che dichiara il proprio `openGraph` cancella quello del layout — `siteName`,
   * `og:locale` e immagine di riserva compresi. È il difetto che ha già colpito
   * quattro rotte in A2.9 e, in forma diversa, `blog` e `produzione`, che
   * dichiaravano il blocco senza `images` ed erano tagliate fuori da
   * `defaultSeo.ogImage`. Per questo il helper emette il blocco COMPLETO.
   *
   * Si asserisce l'INSIEME dei nomi, non quanti sono: dieci tag si possono
   * raggiungere anche con un mix diverso, e un conteggio che torna mentre
   * `og:site_name` è sparito sarebbe il verde peggiore. Un'immagine ne porta
   * TRE — `og:image`, `og:image:width`, `og:image:height` — ed è il motivo per
   * cui il numero è dieci e non sette. Dal 7/10/2026 sono **undici**, con
   * `og:image:alt`.
   */
  const OG_INDICIZZABILI = [
    "og:description",
    "og:image",
    "og:image:alt",
    "og:image:height",
    "og:image:width",
    "og:locale",
    "og:locale:alternate",
    "og:site_name",
    "og:title",
    "og:type",
    "og:url",
  ];

  for (const path of CAMPIONI) {
    test(`${path} serve il blocco og:* completo`, async ({ request }) => {
      const m = await meta(request, path);
      expect([...new Set(m.ogTag)].sort(), `blocco og:* incompleto su ${path}`).toEqual(
        OG_INDICIZZABILI,
      );
    });
  }

  /**
   * ⚠️ **`/area-riservata` è l'ECCEZIONE, e sta scritta qui perché un'eccezione
   * non asserita è un'eccezione che qualcuno "corregge" fra sei mesi.**
   *
   * È l'unica pagina del sito fuori dall'indice: non dichiara canonical — un
   * canonical su una pagina che chiede di non essere indicizzata è una
   * contraddizione dichiarata a Google — e quindi non dichiara `og:url`, che del
   * canonical è la copia. Non passa dal helper delle rotte statiche, e di
   * conseguenza **serve ancora `og:title` col suffisso**: è il titolo templato,
   * come prima della PR.
   *
   * ⚠️ Questo blocco è anche la CONTROPROVA della guardia qui sopra: le stesse
   * due asserzioni, applicate a queste due pagine, devono dare un risultato
   * DIVERSO. Se un giorno `/area-riservata` iniziasse a servire undici tag e un
   * titolo nudo, vorrebbe dire che qualcosa l'ha fatta passare dal helper — e la
   * guardia lo dice, invece di lasciarlo scoprire a un canonical comparso su una
   * pagina `noindex`.
   */
  const OG_ESCLUSE = OG_INDICIZZABILI.filter((t) => t !== "og:url");

  for (const path of AREA_RISERVATA) {
    test(`${path} è l'eccezione: suffisso, dieci tag, nessun canonical`, async ({ request }) => {
      const m = await meta(request, path);
      expect(m.canonical, `${path} non deve dichiarare canonical`).toBeNull();
      expect(m.ogUrl, `${path} non deve dichiarare og:url`).toBeNull();
      expect([...new Set(m.ogTag)].sort(), `${path} deve avere DIECI tag og:*`).toEqual(OG_ESCLUSE);
      expect(m.ogTitle ?? "", `${path} serve ancora il titolo templato`).toContain(SUFFISSO);
    });
  }

  /**
   * `/officina` è fuori dall'indice come `/area-riservata`, ma la sua anteprima è voluta
   * (spec `docs/specs/tavola-officina.md`, «SEO della pagina»): titolo NUDO, uguale al
   * title senza il marchio, e la tavola scattata a 1200×630 con l'alt approvato.
   */
  for (const path of OFFICINA) {
    test(`${path}: anteprima col titolo nudo e la tavola, nessun canonical`, async ({
      request,
    }) => {
      const m = await meta(request, path);
      expect(m.canonical, `${path} non deve dichiarare canonical`).toBeNull();
      expect(m.robots ?? "").toContain("noindex");
      expect(m.robots ?? "").not.toContain("nofollow");
      expect([...new Set(m.ogTag)].sort(), `${path} deve avere DIECI tag og:*`).toEqual(OG_ESCLUSE);
      expect(m.ogTitle, `${path}: og:title nudo`).not.toContain(SUFFISSO);
      expect(m.title).toBe(`${m.ogTitle}${SUFFISSO}`);
      expect(new URL(m.ogImage as string).pathname).toBe("/officina-tavola/og.jpg");
      expect([m.ogImageWidth, m.ogImageHeight]).toEqual(["1200", "630"]);
      expect(m.ogImageAlt?.length ?? 0, `${path}: alt della og`).toBeGreaterThan(60);
      expect(m.twitterImageAlt).toBe(m.ogImageAlt);
    });
  }

  test("/officina serve un og:image delle misure che dichiara", async ({ page }) => {
    // Il file sta in `public/`: si misura sull'origine locale, come la riserva qui sopra.
    await page.goto("/officina");
    const servita = await page.evaluate(
      () =>
        new Promise<{ w: number; h: number }>((risolvi, rifiuta) => {
          const img = new Image();
          img.onload = () => risolvi({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => rifiuta(new Error("og.jpg non caricata"));
          img.src = "/officina-tavola/og.jpg";
        }),
    );
    expect(servita).toEqual({ w: 1200, h: 630 });
  });
});
