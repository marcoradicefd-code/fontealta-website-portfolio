import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ⚠️ **Queste asserzioni sembrano tautologiche e non lo sono.** Guardano tre
 * righe di configurazione che non producono nessun comportamento visibile in
 * locale: in sviluppo la sitemap si rigenera comunque a ogni richiesta, quindi
 * togliere `force-dynamic` o rimettere una cache non rompe niente sul banco e
 * non rompe niente in anteprima. Si vedrebbe solo in produzione, come un
 * `lastmod` che smette di seguire i publish — cioè come il difetto che è
 * costato quattro PR il 9/09/2026 (#162, #163, #164, #165).
 *
 * Sono guardie su una **decisione**, non su una funzione. È il motivo per cui
 * asserire un valore letterale qui vale la pena.
 */
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock("@/sanity/lib/client", () => ({ client: { fetch: fetchMock } }));

import { ACTIVE_LOCALES } from "@/i18n/routing";
import { SITEMAP_QUERY } from "@/sanity/lib/queries";

import * as rotta from "./sitemap";

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    collections: [],
    models: [],
    bodies: [],
    references: [],
    posts: [],
  });
});

describe("la rotta è dinamica", () => {
  it("dichiara force-dynamic", () => {
    expect(rotta.dynamic).toBe("force-dynamic");
  });

  it("NON dichiara revalidate", () => {
    // `revalidate` e `dynamic` convivono, e la combinazione è ambigua da
    // leggere: una scadenza dichiarata su una rotta che non cachea niente fa
    // credere a chi passa che una cache ci sia. #163 l'aveva messa a 3600 e in
    // produzione non è mai scattata: lasciarla sarebbe conservare la prova di
    // un meccanismo che non funziona.
    expect("revalidate" in rotta).toBe(false);
  });
});

describe("la query non è cacheata", () => {
  it("salta la cache dati di Next e il CDN di Sanity", async () => {
    await rotta.default();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const opzioni = fetchMock.mock.calls[0]![2];
    expect(opzioni).toMatchObject({
      cache: "no-store",
      useCdn: false,
      perspective: "published",
      stega: false,
    });
  });

  it("non passa tags: con no-store non esiste una voce da taggare", async () => {
    await rotta.default();

    const opzioni = fetchMock.mock.calls[0]![2] as Record<string, unknown>;
    expect(opzioni.next).toBeUndefined();
    expect(opzioni.tags).toBeUndefined();
  });

  /**
   * `perspective: "published"` non è una scelta di cache ma di contenuto, e sta
   * qui perché è nella stessa chiamata: senza, la sitemap potrebbe annunciare
   * l'URL di una bozza, cioè una pagina che i visitatori non vedono.
   */
  it("non serve mai bozze", async () => {
    await rotta.default();

    expect(fetchMock.mock.calls[0]![2]).toHaveProperty("perspective", "published");
  });
});

describe("degrado", () => {
  it("con un fetch a vuoto restano le sole rotte statiche, e si vede", async () => {
    fetchMock.mockResolvedValue(null);

    const voci = await rotta.default();

    // 10 rotte statiche × le lingue attive (oggi 5, cioè 50). Il crollo dalle migliaia
    // di voci a 50 è deliberatamente visibile: una sitemap parziale è meglio di una
    // rotta in errore, ma non deve passare inosservata. Erano 11 fino al 16/09/2026,
    // quando privacy e cookie sono confluite in `/menzioni-legali`.
    expect(voci).toHaveLength(10 * ACTIVE_LOCALES.length);
  });
});

/**
 * ⚠️ **Il filtro `noIndex` vive in GROQ, e da qui non si può eseguire.** Girare
 * la query vorrebbe dire interrogare Sanity in un test unitario, cioè legare il
 * verde a una rete e a dei dati. L'asserzione che resta è **strutturale**: il
 * filtro c'è, su tutti i gruppi (sei dalla c1b, con le pagine d'uso).
 *
 * Il comportamento è stato provato altrove, il 9/09/2026, sul motore GROQ vero:
 * campo assente, `null` e `false` passano, `true` esclude; e il totale è rimasto
 * 1312 voci, cioè il filtro non ha tolto niente a un dataset che non ha ancora
 * quel campo. Qui si custodisce solo che nessuno lo tolga per distrazione, o che
 * un tipo nuovo non arrivi senza.
 */
describe("noIndex esclude dalla sitemap", () => {
  // `contentPage`: le pagine d'uso (c1b, 4/11/2026).
  const GRUPPI = [
    "collection",
    "model",
    "concealedBody",
    "projectReference",
    "post",
    "contentPage",
  ];

  it("tutti i gruppi filtrano su noIndex", () => {
    const occorrenze = SITEMAP_QUERY.split("!(seo.noIndex == true)").length - 1;
    expect(occorrenze).toBe(GRUPPI.length);
  });

  it("ogni tipo ha il suo filtro sulla stessa riga del suo `_type`", () => {
    for (const tipo of GRUPPI) {
      const riga = SITEMAP_QUERY.split("\n").find((r) => r.includes(`_type == "${tipo}"`));
      expect(riga, `manca la riga di ${tipo}`).toBeTruthy();
      expect(riga, `${tipo} senza filtro noIndex`).toContain("!(seo.noIndex == true)");
    }
  });

  it("il filtro della collezione si AGGIUNGE all'esclusione dei corpi a incasso", () => {
    const riga = SITEMAP_QUERY.split("\n").find((r) => r.includes('_type == "collection"'));
    expect(riga).toContain('slug.current != "corpi-a-incasso"');
    expect(riga).toContain("!(seo.noIndex == true)");
  });

  it("la forma è quella esplicita, non `!seo.noIndex`", () => {
    // Le due si comportano uguale sui documenti senza il campo, ma questa dice
    // cosa intende e non cambia significato se un giorno il campo arrivasse in
    // una forma diversa da un booleano.
    expect(SITEMAP_QUERY).not.toContain("!seo.noIndex");
  });
});
