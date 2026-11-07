import { expect, test } from "@playwright/test";

/**
 * Due colonne di card sotto `sm`, e la pill dei filtri fissa in basso sotto `lg`
 * (decisioni di Marco, 21/09/2026, viste a video durante Cersaie).
 *
 * **Punto 2 — le card.** A 390 la griglia passa da una card per riga a due, e la
 * card è la card di desktop rimpicciolita: stessa proporzione dell'immagine
 * (3/4 sulle collezioni, 1/1 su modelli e corpi) e rapporto complessivo vicino a
 * quello misurato a 1440. I numeri della misura del 21/09, larghezza/altezza:
 *
 *   famiglia      1440     390 (due colonne)
 *   collezione    0,533    0,614
 *   modello       0,561    0,601
 *   corpo         0,721    0,745
 *   affini        0,629    0,573
 *
 * La banda accettata qui è ±25%, e non è un arrotondamento di comodo: il testo
 * NON si rimpicciolisce quanto la card — un'etichetta da 13px scalata come la
 * geometria finirebbe a 7,5 — quindi un rapporto identico al decimale è
 * irraggiungibile per costruzione. Quello che la guardia deve impedire è la
 * deriva: una card che diventa il doppio più alta che larga perché qualcuno ha
 * rimesso in mobile un blocco pensato per 245px di larghezza. Era esattamente il
 * caso prima del «+N» sulle finiture: modello a **0,408**, che questa banda
 * boccia.
 *
 * ⚠️ **Il troncamento si misura, non si deduce dalla classe.** `truncate` taglia
 * solo quando il contenuto è più largo del box: si confronta `scrollWidth` con
 * `clientWidth`. Un titolo su due righe non è troncato, è andato a capo — ed è
 * ciò che deve succedere a «Corpi a incasso» e ai nomi tedeschi.
 *
 * **Punto 3 — la pill dei filtri.** Stava in cima alla griglia e al primo
 * scorrimento usciva di scena: misurato a 390, dopo 1200px stava a y=−395. Ora è
 * fissa in basso, sopra la safe-area, e si spegne in due casi — foglio aperto e
 * griglia finita — perché serve alla griglia: non deve coprire né le FAQ che le
 * stanno sotto né i link del footer (dal 30/10/2026; prima si spegneva al footer).
 *
 * ⚠️ **A 1440 non deve esistere.** Non «essere invisibile»: il ramo mobile è
 * chiuso in `lg:hidden`, e se un giorno comparisse su desktop sarebbe una pill
 * fissa sopra una barra filtri che c'è già.
 */

const VIEWPORT_MOBILE = { width: 390, height: 844 };
const VIEWPORT_DESKTOP = { width: 1440, height: 900 };

/** Le card della pagina, trovate per FORMA: un link che contiene un titolo. */
const CARTE = `a:has(:is(h3, h4))`;

type Misura = { w: number; h: number; rapporto: number; perRiga: number; troncati: string[] };

async function misuraGriglia(page: import("@playwright/test").Page): Promise<Misura> {
  return page.evaluate(() => {
    const carte = Array.from(document.querySelectorAll("a")).filter((a) => {
      if (!a.querySelector("h3, h4")) return false;
      const b = a.getBoundingClientRect();
      return b.width > 80 && b.height > 80;
    });
    if (carte.length === 0)
      return { w: 0, h: 0, rapporto: 0, perRiga: 0, troncati: ["nessuna card"] };
    const r = carte[0].getBoundingClientRect();
    const primo = Math.round(r.top);
    const perRiga = carte.filter(
      (e) => Math.abs(Math.round(e.getBoundingClientRect().top) - primo) < 4,
    ).length;
    // I titoli troncati, con il loro testo: serve sapere QUALE, non quanti.
    const troncati = carte
      .flatMap((c) => Array.from(c.querySelectorAll("h3, h4")))
      .filter((t) => t.scrollWidth > t.clientWidth + 1)
      .map((t) => (t.textContent ?? "").trim());
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      rapporto: +(r.width / r.height).toFixed(3),
      perRiga,
      troncati,
    };
  });
}

test.describe("punto 2 · due colonne di card sotto sm", () => {
  const PAGINE = [
    { nome: "collezioni", url: "/collezioni", rapportoDesktop: 0.533, colonneDesktop: 4 },
    { nome: "griglia modelli", url: "/collezioni/boss", rapportoDesktop: 0.561, colonneDesktop: 5 },
    {
      nome: "corpi a incasso",
      url: "/collezioni/corpi-a-incasso",
      rapportoDesktop: 0.721,
      colonneDesktop: 5,
    },
    { nome: "collezioni affini", url: "/modello/b40l", rapportoDesktop: 0.629, colonneDesktop: 2 },
  ];

  for (const p of PAGINE) {
    test(`${p.nome}: due card per riga a 390, e la proporzione resta quella di desktop`, async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORT_MOBILE);
      await page.goto(p.url);
      await page.locator(CARTE).first().waitFor();
      const m = await misuraGriglia(page);

      expect(m.perRiga, `card per riga a 390 su ${p.url}`).toBe(2);
      // Lo scarto dal rapporto di desktop, in proporzione a quello di desktop.
      const scarto = Math.abs(m.rapporto - p.rapportoDesktop) / p.rapportoDesktop;
      expect(
        scarto,
        `rapporto a 390 ${m.rapporto} (card ${m.w}×${m.h}) contro ${p.rapportoDesktop} di desktop`,
      ).toBeLessThan(0.25);
    });

    test(`${p.nome}: a 1440 la griglia non è cambiata`, async ({ page }) => {
      await page.setViewportSize(VIEWPORT_DESKTOP);
      await page.goto(p.url);
      await page.locator(CARTE).first().waitFor();
      const m = await misuraGriglia(page);
      expect(m.perRiga, `card per riga a 1440 su ${p.url}`).toBe(p.colonneDesktop);
    });
  }

  for (const lingua of [
    { etichetta: "italiano", collezioni: "/collezioni", corpi: "/collezioni/corpi-a-incasso" },
    {
      etichetta: "tedesco",
      collezioni: "/de/kollektionen",
      corpi: "/de/kollektionen/unterputz-koerper",
    },
  ]) {
    test(`${lingua.etichetta}: a 390 nessun titolo di card è troncato`, async ({ page }) => {
      await page.setViewportSize(VIEWPORT_MOBILE);
      for (const url of [lingua.collezioni, lingua.corpi]) {
        await page.goto(url);
        await page.locator(CARTE).first().waitFor();
        const m = await misuraGriglia(page);
        expect(m.troncati, `titoli troncati su ${url}`).toEqual([]);
      }
    });
  }
});

test.describe("punto 3 · la pill dei filtri, fissa in basso", () => {
  const PILL = ".fa-filtri-apri";

  test("a 390 resta nel viewport dopo 1200px di scorrimento, e il bersaglio è 44", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT_MOBILE);
    await page.goto("/collezioni/boss");
    await page.locator(CARTE).first().waitFor();
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" }));
    // La comparsa è governata da un IntersectionObserver: si aspetta la
    // CONDIZIONE (la pill visibile), non un cronometro.
    await expect(page.locator(PILL)).toBeVisible();

    const box = await page.locator(PILL).boundingBox();
    expect(box, "la pill ha un box").not.toBeNull();
    expect(box!.height, "bersaglio tattile").toBeGreaterThanOrEqual(44);
    // Fissa vuol dire: dentro il viewport, in basso.
    expect(box!.y + box!.height).toBeLessThanOrEqual(VIEWPORT_MOBILE.height);
    expect(box!.y).toBeGreaterThan(VIEWPORT_MOBILE.height / 2);
  });

  test("col foglio aperto la pill non si vede", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_MOBILE);
    await page.goto("/collezioni/boss");
    await page.locator(CARTE).first().waitFor();
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" }));
    await expect(page.locator(PILL)).toBeVisible();
    await page.locator(PILL).click();
    await expect(page.locator("dialog[open]")).toBeVisible();
    await expect(page.locator(PILL)).toBeHidden();
  });

  test("col footer in vista la pill non si vede, quindi non copre i suoi link", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT_MOBILE);
    await page.goto("/collezioni/boss");
    await page.locator(CARTE).first().waitFor();
    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
    );
    await expect(page.locator("footer")).toBeInViewport();
    await expect(page.locator(PILL)).toBeHidden();
  });

  test("con le FAQ in vista la pill non si vede: la griglia è finita", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_MOBILE);
    await page.goto("/collezioni/boss");
    await page.locator(CARTE).first().waitFor();
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" }));
    await expect(page.locator(PILL)).toBeVisible();
    // il titolo delle FAQ a metà schermo: il footer è ancora lontano
    await page
      .locator("#faq-section-title")
      .evaluate((h) => h.scrollIntoView({ block: "center", behavior: "instant" }));
    await expect(page.locator("footer")).not.toBeInViewport();
    await expect(page.locator(PILL)).toBeHidden();
    // risalendo nella griglia torna
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" }));
    await expect(page.locator(PILL)).toBeVisible();
  });

  test("a 1440 la pill non esiste: desktop non è cambiato", async ({ page }) => {
    await page.setViewportSize(VIEWPORT_DESKTOP);
    await page.goto("/collezioni/boss");
    await page.locator(CARTE).first().waitFor();
    // Il ramo mobile è chiuso in `lg:hidden`: il nodo c'è nel DOM ma non è reso.
    await expect(page.locator(PILL)).toBeHidden();
  });
});
