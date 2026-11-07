import { describe, expect, it } from "vitest";

import { getPathname } from "@/i18n/navigation";
import { ACTIVE_LOCALES, ALL_LOCALES, routing } from "@/i18n/routing";
import {
  REDIRECT_GUIDA_316,
  redirectGuida316,
  redirectLegali,
  REDIRECT_LEGALI,
  redirectPermanenti,
  REDIRECT_PER_LINGUA,
  REDIRECT_VECCHIO_SITO,
  redirectVecchioSito,
  rewriteDopoIFile,
} from "@/lib/redirects";

/**
 * ⚠️ `redirects.ts` non può importare il risolutore dei pathnames, perché lo
 * carica `next.config.ts` fuori dal bundle. Le sue stringhe sono quindi
 * letterali, e questo file è la rete: le confronta con la mappa dei pathnames
 * per TUTTE le lingue, e con `getPathname`, il risolutore VERO del sito, per
 * quelle attive. Se un giorno la mappa cambia, qui cade qualcosa.
 */

const SLUG = "corpi-a-incasso";
const CHIAVE_DINAMICA = { pathname: "/collezioni/[slug]", params: { slug: SLUG } } as const;
const CHIAVE_STATICA = "/collezioni/corpi-a-incasso";
const REDIRECT_PERMANENTI = redirectPermanenti(ACTIVE_LOCALES);

describe("REDIRECT_PERMANENTI", () => {
  it("manda il doppione inglese sull'indice dei corpi, e i due percorsi vengono dal risolutore", () => {
    const doppione = getPathname({ locale: "en", href: CHIAVE_DINAMICA });
    const giusto = getPathname({ locale: "en", href: CHIAVE_STATICA });

    // Le due chiavi divergono in inglese: è la condizione che crea il doppione.
    expect(doppione).not.toBe(giusto);
    expect(REDIRECT_PERMANENTI).toContainEqual({
      source: doppione,
      destination: giusto,
      permanent: true,
    });
  });

  it("in italiano non serve nessun redirect, perché le due chiavi coincidono", () => {
    // Non è una curiosità: è la ragione per cui l'italiano non ha voce. Se un
    // giorno anche l'italiano divergesse, questo test cadrebbe e la lista
    // risulterebbe incompleta invece di sembrare finita.
    expect(getPathname({ locale: "it", href: CHIAVE_DINAMICA })).toBe(
      getPathname({ locale: "it", href: CHIAVE_STATICA }),
    );
  });

  it("copre ogni locale attivo in cui le due chiavi divergono, e nessun altro", () => {
    const attesi = ACTIVE_LOCALES.filter(
      (locale) =>
        getPathname({ locale, href: CHIAVE_DINAMICA }) !==
        getPathname({ locale, href: CHIAVE_STATICA }),
    );
    expect(REDIRECT_PERMANENTI).toHaveLength(attesi.length);
    for (const locale of attesi)
      expect(REDIRECT_PERMANENTI).toContainEqual({
        source: getPathname({ locale, href: CHIAVE_DINAMICA }),
        destination: getPathname({ locale, href: CHIAVE_STATICA }),
        permanent: true,
      });
  });

  it("anche le lingue spente hanno già la voce giusta, letta dalla mappa dei pathnames", () => {
    // Per una lingua spenta `getPathname` non è interrogabile: il confronto si fa con la
    // mappa, che è la stessa da cui il risolutore legge quando la lingua si accende.
    const mappa = routing.pathnames as unknown as Record<string, Record<string, string>>;
    for (const locale of ALL_LOCALES.filter((l) => l !== "it")) {
      const voce = REDIRECT_PER_LINGUA[locale];
      expect(voce.source).toBe(
        `/${locale}${mappa["/collezioni/[slug]"][locale].replace("[slug]", SLUG)}`,
      );
      expect(voce.destination).toBe(`/${locale}${mappa[CHIAVE_STATICA][locale]}`);
    }
  });

  it("è permanente: un 308, non un 307", () => {
    // Un 307 direbbe ai motori di tenersi l'URL vecchio. Qui l'URL vecchio non
    // deve sopravvivere: è nato da una collisione, non da una scelta.
    for (const r of Object.values(REDIRECT_PER_LINGUA)) expect(r.permanent).toBe(true);
  });
});

describe("redirectLegali", () => {
  const LEGALI = redirectLegali(ACTIVE_LOCALES);

  it("porta privacy e cookie di ogni lingua attiva alla sezione della pagina nuova, dal risolutore", () => {
    expect(LEGALI).toHaveLength(ACTIVE_LOCALES.length * 2);
    for (const locale of ACTIVE_LOCALES) {
      const pagina = getPathname({ locale, href: "/menzioni-legali" });
      const prefisso = locale === "it" ? "" : `/${locale}`;
      expect(LEGALI).toContainEqual({
        source: `${prefisso}/privacy-policy`,
        destination: `${pagina}#privacy`,
        permanent: true,
      });
      expect(LEGALI).toContainEqual({
        source: `${prefisso}/cookie-policy`,
        destination: `${pagina}#cookie`,
        permanent: true,
      });
    }
  });

  it("anche le lingue spente hanno già la pagina giusta, letta dalla mappa dei pathnames", () => {
    const mappa = routing.pathnames as unknown as Record<string, Record<string, string>>;
    for (const locale of ALL_LOCALES) {
      const prefisso = locale === "it" ? "" : `/${locale}`;
      expect(REDIRECT_LEGALI[locale].pagina).toBe(
        `${prefisso}${mappa["/menzioni-legali"][locale]}`,
      );
    }
  });

  it("gli indirizzi ritirati non sono più rotte della mappa", () => {
    // Se tornassero nella mappa, il 308 li coprirebbe comunque e la rotta resterebbe
    // irraggiungibile: codice morto che sembra vivo.
    expect(Object.keys(routing.pathnames)).not.toContain("/privacy-policy");
    expect(Object.keys(routing.pathnames)).not.toContain("/cookie-policy");
  });
});

describe("redirectGuida316", () => {
  const post = (locale: (typeof ALL_LOCALES)[number], slug: string) =>
    getPathname({ locale, href: { pathname: "/blog/[slug]", params: { slug } } });

  it("la parte 2 porta alla parte 1 in ogni lingua attiva, coi percorsi del risolutore", () => {
    expect(redirectGuida316(ACTIVE_LOCALES)).toEqual(
      ACTIVE_LOCALES.map((locale) => ({
        source: post(locale, "aisi-316-contro-304-parte-2"),
        destination: post(locale, "aisi-316-contro-304-parte-1"),
        statusCode: 301,
      })),
    );
  });

  it("301 esplicito e mai `permanent`: Next non li vuole insieme", () => {
    for (const r of redirectGuida316(ACTIVE_LOCALES)) {
      expect(r.statusCode).toBe(301);
      expect("permanent" in r).toBe(false);
    }
  });

  it("ha una voce per ognuna delle cinque lingue, accese o no", () => {
    expect(Object.keys(REDIRECT_GUIDA_316).sort()).toEqual([...ALL_LOCALES].sort());
  });
});

describe("redirectVecchioSito", () => {
  const VECCHIO = redirectVecchioSito();

  it("permanenti, uno per indirizzo, senza doppioni", () => {
    expect(VECCHIO.every((r) => r.permanent)).toBe(true);
    const sorgenti = REDIRECT_VECCHIO_SITO.map((r) => r.source);
    expect(new Set(sorgenti).size).toBe(sorgenti.length);
  });

  it("le pagine fisse vanno alle rotte vere, lette dal risolutore", () => {
    const rotta = (
      href: "/" | "/collezioni" | "/chi-siamo" | "/contatti",
      locale = "it" as const,
    ) => getPathname({ locale, href });
    const attese: Record<string, string> = {
      "/home.aspx": rotta("/"),
      "/prodotti.aspx": rotta("/collezioni"),
      "/chisiamo.aspx": rotta("/chi-siamo"),
      "/contatti.aspx": rotta("/contatti"),
      "/Home/Contatti": rotta("/contatti"),
      "/en/home.html": getPathname({ locale: "en", href: "/" }),
    };
    for (const [source, destination] of Object.entries(attese))
      expect(VECCHIO, source).toContainEqual({ source, destination, permanent: true });
  });

  it("le landing per collezione vanno alla collezione, nella forma della rotta dinamica", () => {
    const skinny = getPathname({
      locale: "it",
      href: { pathname: "/collezioni/[slug]", params: { slug: "skinny" } },
    });
    expect(VECCHIO).toContainEqual({
      source: "/Landing-ITSkinny.html",
      destination: skinny,
      permanent: true,
    });
  });

  it("il catalogo sfogliabile va alla sezione del catalogo su /collezioni", () => {
    const destinazione = `${getPathname({ locale: "it", href: "/collezioni" })}#catalogo`;
    for (const source of ["/catalogo/index.html", "/catalogo/mobile/index.html"])
      expect(VECCHIO).toContainEqual({ source, destination: destinazione, permanent: true });
  });

  it("le sitemap vecchie vanno tutte a /sitemap.xml", () => {
    const sitemap = VECCHIO.filter((r) => r.source.endsWith(".xml"));
    expect(sitemap.map((r) => r.source)).toEqual(
      expect.arrayContaining(["/sitemap_it.xml", "/sitemap_index.xml"]),
    );
    expect(sitemap.every((r) => r.destination === "/sitemap.xml")).toBe(true);
  });

  it("career e careers NON hanno un redirect: restano 404 (Marco, 20/10)", () => {
    for (const s of ["/career.aspx", "/careers.aspx"])
      expect(REDIRECT_VECCHIO_SITO.map((r) => r.source)).not.toContain(s);
  });
});

/**
 * ⚠️ Le rewrite si provano con la funzione con cui il build le compila (`buildCustomRoute`), come
 * il `source` della CSP in `headers.test.ts`: la domanda è quali percorsi prendono, e la risposta
 * la dà solo la regex vera.
 */
describe("rewriteDopoIFile", () => {
  async function regole() {
    const { buildCustomRoute } = await import("next/dist/lib/build-custom-route");
    return rewriteDopoIFile(ACTIVE_LOCALES).map((r) => {
      const { regex } = buildCustomRoute("rewrite", r) as { regex: string };
      return { ...r, prende: (p: string) => new RegExp(regex).test(p) };
    });
  }
  /** La prima regola che prende il percorso, nell'ordine in cui Next le prova. */
  async function primaCheProva(p: string) {
    return (await regole()).find((r) => r.prende(p))?.destination ?? null;
  }

  it("le icone Apple alla radice vanno all'icona che c'è già", async () => {
    expect(await primaCheProva("/apple-touch-icon.png")).toBe("/apple-icon.png");
    expect(await primaCheProva("/apple-touch-icon-precomposed.png")).toBe("/apple-icon.png");
  });

  it("le schede .aspx del vecchio sito vanno alla pagina che le risolve", async () => {
    expect(await primaCheProva("/ORIGO_RAME-C50R.ME.aspx")).toBe("/it/vecchio-sito/:file");
    expect(await primaCheProva("/LARES-P60.aspx")).toBe("/it/vecchio-sito/:file");
  });

  it("ogni percorso che non comincia con una lingua va all'italiano", async () => {
    for (const p of [
      "/xyz.php",
      "/.env",
      "/ads.txt",
      "/foo.bar/collezioni",
      "/foo.bar/modello/b40l",
      "/italia.html",
      "/de.html",
      "/a/b/Telerik.Web.UI.DialogHandler.aspx",
    ])
      expect(await primaCheProva(p), p).toBe("/it/:primo/:resto*");
  });

  it("NON tocca i percorsi con la lingua, lo Studio, le API e i percorsi di Next e Vercel", async () => {
    for (const p of [
      ...ACTIVE_LOCALES.map((l) => `/${l}/xyz.php`),
      ...ACTIVE_LOCALES.map((l) => `/${l}`),
      "/studio",
      "/studio/structure",
      "/api/csp-report",
      "/_next/static/chunks/x.js",
      "/_vercel/insights/script.js",
    ])
      expect(await primaCheProva(p), p).toBeNull();
  });
});
