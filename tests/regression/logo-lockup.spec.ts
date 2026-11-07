import { expect, test, type Page } from "@playwright/test";

/**
 * Il logo dell'header e quello del footer sono lo STESSO lockup, allineati (Marco, 20/10/2026):
 * stesso simbolo, stesso spazio prima della scritta, stessa scritta, stesso bordo sinistro.
 * Fino ad allora il footer aveva simbolo 28 · spazio 10 · lettere a 2 px contro 36 · 12 · 3 px
 * della barra, e «FONTEALTA» partiva 10 px più a sinistra.
 *
 * ⚠️ La scritta si misura sul rettangolo dei GLIFI (`Range`), non su quello dello span.
 *
 * ⚠️ **Il simbolo è alto 36 e largo in proporzione al file, 33,2** (Marco, 27/10/2026, variante A
 * del provino `fix/logo-proporzioni`). Fino ad allora il riquadro era 36 × 36 e il PNG, che è
 * 1146 × 1241, usciva stirato in orizzontale dell'8%: la vecchia asserzione «simbolo: 36» lo
 * custodiva come se fosse giusto. Ribasata a 33,2 dopo la scelta di Marco; la controprova è la
 * prova «il simbolo non è deformato» qui sotto, rossa sul codice di prima (1,000 contro 0,923).
 */

/**
 * La proporzione DISEGNATA del monogramma e quella del file. Con `object-fit` diverso da `fill` il
 * browser non stira, e il disegno ha la proporzione del file dentro il riquadro.
 */
const proporzioni = (page: Page, selettore: string) =>
  page.evaluate((sel) => {
    const img = document.querySelector<HTMLImageElement>(sel)!;
    const r = img.getBoundingClientRect();
    const file = img.naturalWidth / img.naturalHeight;
    const fit = getComputedStyle(img).objectFit;
    const disegnata = fit === "fill" ? r.width / r.height : file;
    return { disegnata, file, caricata: img.complete && img.naturalWidth > 0 };
  }, selettore);

for (const larghezza of [1440, 1024, 390]) {
  test(`a ${larghezza} il lockup del footer è quello dell'header`, async ({ page }) => {
    await page.setViewportSize({ width: larghezza, height: 900 });
    await page.goto("/finiture");
    const misure = await page.evaluate(() =>
      (["header", "footer"] as const).map((dove) => {
        const img = document.querySelector<HTMLImageElement>(`${dove} img[src*='monogram']`)!;
        const scritta = img.parentElement!.querySelector("span")!;
        const range = document.createRange();
        range.selectNodeContents(scritta);
        const g = range.getBoundingClientRect();
        const i = img.getBoundingClientRect();
        const cs = getComputedStyle(scritta);
        return {
          simboloX: Math.round(i.left * 10) / 10,
          simbolo: Math.round(i.width * 10) / 10,
          altezza: Math.round(i.height * 10) / 10,
          spazio: Math.round((g.left - i.right) * 10) / 10,
          scrittaX: Math.round(g.left * 10) / 10,
          scrittaW: Math.round(g.width * 10) / 10,
          corpo: cs.fontSize,
          peso: cs.fontWeight,
          lettere: cs.letterSpacing,
          testo: scritta.textContent,
        };
      }),
    );
    const [header, footer] = misure;
    expect(footer).toEqual(header);
    // E il valore di riferimento è quello della barra.
    expect(header).toMatchObject({
      simbolo: 33.2,
      altezza: 36,
      spazio: 12,
      corpo: "18px",
      lettere: "3px",
    });
  });
}

/** Dove sta il monogramma con le misure scritte nel codice, e su quale pagina si misura. */
const SIMBOLI = [
  { nome: "header", pagina: "/finiture", selettore: "header img[src*='monogram']" },
  { nome: "footer", pagina: "/finiture", selettore: "footer img[src*='monogram']" },
  { nome: "catalogo", pagina: "/contatti", selettore: "#catalogo img[src*='monogram']" },
];

for (const s of SIMBOLI) {
  test(`${s.nome}: il simbolo non è deformato (proporzione disegnata = file, entro 0,01)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(s.pagina);
    const img = page.locator(s.selettore).first();
    await img.scrollIntoViewIfNeeded();
    // Si aspetta la condizione, non un cronometro: l'immagine decodificata (rule `misure-e-test`).
    await expect.poll(async () => (await proporzioni(page, s.selettore)).caricata).toBe(true);
    const p = await proporzioni(page, s.selettore);
    expect(Math.abs(p.disegnata - p.file), JSON.stringify(p)).toBeLessThanOrEqual(0.01);
  });
}
