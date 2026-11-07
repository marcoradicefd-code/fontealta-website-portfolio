import { expect, test, type Page } from "@playwright/test";

import de from "../../src/messages/de.json";
import en from "../../src/messages/en.json";
import es from "../../src/messages/es.json";
import fr from "../../src/messages/fr.json";
import it from "../../src/messages/it.json";

/**
 * Il breadcrumb del catalogo sotto `sm` (16/10/2026, Marco).
 *
 * Con quattro voci (scheda modello, scheda corpo) si vedono solo gli anelli intermedi: Home e
 * voce corrente restano nel markup e si nascondono con `max-sm:hidden`. Con tre voci (pagina di
 * una collezione, indice dei corpi) il breadcrumb resta intero e, tranne UNA pagina, su una riga:
 * l'`<ol>` è alto 44, cioè `min-h-11`. Sopra `sm` tutte le voci, come prima.
 *
 * L'eccezione, accettata e scritta nella rule `catalogo`: «Home › Colecciones › Cuerpos
 * empotrados» va su due righe sotto 384, alta 88, com'è su `main`. Si asserisce per nome, così una
 * seconda pagina che andasse a capo fa rosso invece di passare zitta.
 */

const LINGUE = [
  ["", it],
  ["/en", en],
  ["/de", de],
  ["/fr", fr],
  ["/es", es],
] as const;
const ARCHIVIO = {
  "": "/collezioni",
  "/en": "/collections",
  "/de": "/kollektionen",
  "/fr": "/collections",
  "/es": "/colecciones",
};
const DUE_RIGHE_SOTTO_384 = "/es/colecciones/cuerpos-empotrados";

async function briciole(page: Page, aria: string) {
  const ol = page.locator(`nav[aria-label="${aria}"] ol`);
  const pulisci = (t: string[]) => t.map((x) => x.replace("›", "").trim());
  return {
    tutte: pulisci(await ol.locator("li").allInnerTexts()),
    visibili: pulisci(await ol.locator("li:visible").allInnerTexts()),
    altezza: (await ol.boundingBox())!.height,
  };
}

for (const width of [360, 390, 1440]) {
  test.describe(`a ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });
    const corto = width < 640;

    for (const percorso of ["/modello/b40l", "/collezioni/corpi-a-incasso/cw-1"]) {
      test(`${percorso} · ${corto ? "solo gli anelli intermedi" : "intero"}, su una riga`, async ({
        page,
      }) => {
        await page.goto(percorso);
        const b = await briciole(page, it.nav.breadcrumbAria);
        expect(b.tutte, "il markup resta completo").toHaveLength(4);
        expect(b.tutte[0]).toBe(it.nav.home);
        expect(b.visibili).toEqual(corto ? b.tutte.slice(1, 3) : b.tutte);
        expect(b.altezza, "su una riga").toBe(44);
      });
    }
  });
}

// Tre voci: tutte le collezioni e l'indice dei corpi, dai link dell'archivio, nelle cinque
// lingue. Una pagina per lingua alla volta: il cookie `NEXT_LOCALE` resta quello della lingua.
for (const width of [360, 390]) {
  for (const [prefisso, m] of LINGUE) {
    test(`a ${width} · tre voci, ${prefisso || "/it"} · intere, su una riga tranne l'eccezione`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${prefisso}${ARCHIVIO[prefisso]}`);
      const link = [
        ...new Set(
          await page
            .locator(`main a[href^="${prefisso}${ARCHIVIO[prefisso]}/"]`)
            .evaluateAll((as) => as.map((a) => a.getAttribute("href")!)),
        ),
      ].filter((h) => h.split("/").length === (prefisso ? 4 : 3));
      expect(link.length, "le collezioni dell'archivio, indice dei corpi compreso").toBeGreaterThan(
        20,
      );

      const esiti: { pagina: string; altezza: number }[] = [];
      for (const href of link) {
        await page.goto(href);
        const pagina = decodeURI(new URL(page.url()).pathname);
        const b = await briciole(page, m.nav.breadcrumbAria);
        expect(b.tutte, pagina).toHaveLength(3);
        expect(b.visibili, `${pagina}: intero`).toEqual(b.tutte);
        esiti.push({ pagina, altezza: b.altezza });
      }
      const attese = esiti.map(({ pagina }) => ({
        pagina,
        altezza: width < 384 && pagina === DUE_RIGHE_SOTTO_384 ? 88 : 44,
      }));
      expect(esiti).toEqual(attese);
      if (prefisso === "/es") {
        expect(
          esiti.map((e) => e.pagina),
          "l'eccezione è fra le pagine visitate",
        ).toContain(DUE_RIGHE_SOTTO_384);
      }
    });
  }
}
