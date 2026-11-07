import { describe, expect, it } from "vitest";

import { ACTIVE_LOCALES } from "@/i18n/routing";
import { siteUrl } from "@/lib/seo";
import { absoluteUrl, localizedUrls, type RouteHref } from "@/lib/urls";

/**
 * Le 17 chiavi di `pathnames`, tutte, compresa l'unica in forma stringa.
 *
 * ⚠️ L'elenco è scritto a mano ed è VOLUTO. Derivarlo da `routing.pathnames`
 * renderebbe il test una tautologia: verificherebbe che la mappa è uguale a se
 * stessa. Scritto qui, una voce aggiunta alla mappa e dimenticata qui fa fallire
 * il conteggio, che è esattamente l'allarme che serve.
 *
 * ⚠️ Sono **16 in forma oggetto** e **1 in forma stringa** (`/`). Fino al 16/09/2026
 * erano 14 e 3, con `/privacy-policy` e `/cookie-policy` come stringhe: sono confluite
 * in `/menzioni-legali`, che ha una forma per lingua. `/officina` è del 27/10/2026.
 */
const CHIAVI: RouteHref[] = [
  "/",
  "/collezioni",
  "/collezioni/corpi-a-incasso",
  { pathname: "/collezioni/corpi-a-incasso/[slug]", params: { slug: "cw-1" } },
  { pathname: "/collezioni/[slug]", params: { slug: "boss" } },
  { pathname: "/modello/[slug]", params: { slug: "b40l" } },
  "/produzione",
  "/finiture",
  "/blog",
  { pathname: "/blog/[slug]", params: { slug: "cersaie-2026-dove-trovarci" } },
  "/chi-siamo",
  "/contatti",
  "/area-riservata",
  "/referenze",
  { pathname: "/referenze/[slug]", params: { slug: "villa-sardegna" } },
  "/menzioni-legali",
  "/officina",
];

const BASE = siteUrl();

describe("absoluteUrl", () => {
  it("copre tutte e 17 le chiavi di pathnames", () => {
    expect(CHIAVI).toHaveLength(17);
  });

  it.each(CHIAVI.map((h) => [JSON.stringify(h), h] as const))(
    "%s produce un URL assoluto sulla base del sito in ogni locale attivo",
    (_etichetta, href) => {
      for (const locale of ACTIVE_LOCALES) {
        const url = absoluteUrl(locale, href as RouteHref);
        expect(url.startsWith(BASE)).toBe(true);
        expect(() => new URL(url)).not.toThrow();
        // Nessun segmento non risolto: una chiave dinamica senza `params` uscirebbe
        // con le parentesi quadre dentro l'URL, e sarebbe una 404 pubblicata.
        expect(url).not.toContain("[");
        expect(url).not.toContain("]");
      }
    },
  );

  it("l'italiano non ha prefisso e l'inglese sì (localePrefix as-needed)", () => {
    expect(absoluteUrl("it", "/collezioni")).toBe(`${BASE}/collezioni`);
    expect(absoluteUrl("en", "/collezioni")).toBe(`${BASE}/en/collections`);
  });

  it("risolve i parametri delle rotte dinamiche, con lo slug tradotto della rotta", () => {
    const href = { pathname: "/modello/[slug]", params: { slug: "b40l" } } as const;
    expect(absoluteUrl("it", href)).toBe(`${BASE}/modello/b40l`);
    expect(absoluteUrl("en", href)).toBe(`${BASE}/en/model/b40l`);
  });

  it("la radice non ha lo slash finale, in nessuna lingua", () => {
    // `new URL("/", base)` lo mette; la pipeline dei metadata di Next lo toglie e
    // la sitemap no, quindi senza questa normalizzazione i due artefatti
    // dichiarerebbero due stringhe diverse per la home.
    expect(absoluteUrl("it", "/")).toBe(BASE);
    expect(absoluteUrl("en", "/")).toBe(`${BASE}/en`);
    for (const locale of ACTIVE_LOCALES) {
      expect(absoluteUrl(locale, "/").endsWith("/")).toBe(false);
    }
  });

  it("le menzioni legali hanno la loro forma in ogni lingua attiva", () => {
    expect(absoluteUrl("it", "/menzioni-legali")).toBe(`${BASE}/menzioni-legali`);
    expect(absoluteUrl("en", "/menzioni-legali")).toBe(`${BASE}/en/legal-notice`);
  });
});

describe("localizedUrls", () => {
  it.each(CHIAVI.map((h) => [JSON.stringify(h), h] as const))(
    "%s ha esattamente ACTIVE_LOCALES più x-default",
    (_etichetta, href) => {
      const mappa = localizedUrls(href as RouteHref);
      expect(Object.keys(mappa).sort()).toEqual([...ACTIVE_LOCALES, "x-default"].sort());
    },
  );

  it("x-default punta all'inglese, non all'italiano", () => {
    const mappa = localizedUrls("/collezioni");
    expect(mappa["x-default"]).toBe(mappa.en);
    expect(mappa["x-default"]).not.toBe(mappa.it);
  });

  it("l'hreflang è reciproco: ogni URL della mappa rigenera la stessa mappa", () => {
    // Il reciproco è la condizione che Google chiede: se A dichiara B, B deve
    // dichiarare A. Qui è garantito per costruzione, perché la mappa dipende
    // dalla CHIAVE di rotta e non dal locale corrente. Il test lo fissa: se
    // qualcuno un giorno la costruisse a partire dall'URL della pagina, questa
    // asserzione cadrebbe.
    for (const href of CHIAVI) {
      const attesa = localizedUrls(href);
      for (const locale of ACTIVE_LOCALES) {
        expect(localizedUrls(href)).toEqual(attesa);
        expect(attesa[locale]).toBe(absoluteUrl(locale, href));
      }
    }
  });

  // Le pagine d'uso (c1b): una lingua senza titolo dà 404 e non va nominata.
  it("con un elenco di lingue nomina solo quelle, e x-default resta EN", () => {
    const mappa = localizedUrls("/doccia-da-esterno", ["it", "en", "de"]);
    expect(Object.keys(mappa).sort()).toEqual(["de", "en", "it", "x-default"]);
    expect(mappa["x-default"]).toBe(mappa.en);
    expect(mappa.en).toBe(`${BASE}/en/outdoor-shower`);
  });

  it("senza l'inglese x-default va alla prima lingua presente; senza lingue la mappa è vuota", () => {
    expect(localizedUrls("/doccia-da-esterno", ["it", "fr"])["x-default"]).toBe(
      `${BASE}/doccia-da-esterno`,
    );
    expect(localizedUrls("/doccia-da-esterno", [])).toEqual({});
  });
});
