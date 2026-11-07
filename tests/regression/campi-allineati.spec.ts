import { expect, test, type Page } from "@playwright/test";

/**
 * I menu del modulo hanno l'altezza dei campi (14/10/2026).
 *
 * Il `select` calcolava `line-height: normal`: 36 px contro 38,69 dell'input su fondo scuro, 39
 * contro 41 sulla home, e a 1440 il bordo di «Paese» stava 2-2,7 px più in alto di quello di
 * «Azienda», accanto. Ora l'altezza la dà `--fa-field-h-1/-2`, calcolata con la stessa formula
 * dell'input (`globals.css`). Questa è una guardia di GEOMETRIA: gira anche sul WebKit del banco,
 * che sulla pittura non fa fede ma sulle misure sì.
 */

test.use({ locale: "it-IT" });

const MODULI = [
  ["/contatti", "contatti"],
  ["/collezioni", "ProgettareCta"],
  ["/", "home"],
] as const;

async function misura(page: Page) {
  // Il modulo GENERALE: dal 19/10/2026 su `/collezioni` il primo modulo col Paese è quello del
  // catalogo, che non ha né «Azienda» né il menu della richiesta.
  const form = page.locator("form:has(select[name='richiesta'])").first();
  await form.waitFor();
  return form.evaluate((f) => {
    const r = (sel: string) => {
      const b = f.querySelector(sel)!.getBoundingClientRect();
      return { h: b.height, bottom: b.bottom };
    };
    return {
      azienda: r("input[name='azienda']"),
      paese: r("select[name='paese']"),
      richiesta: r("select[name='richiesta']"),
    };
  });
}

for (const [larghezza, altezza] of [
  [1440, 900],
  [390, 844],
] as const) {
  for (const [path, nome] of MODULI) {
    test(`${nome} a ${larghezza}: i menu sono alti come i campi`, async ({ page }) => {
      await page.setViewportSize({ width: larghezza, height: altezza });
      await page.goto(path);
      const m = await misura(page);
      expect(
        Math.abs(m.paese.h - m.azienda.h),
        `paese ${m.paese.h} vs input ${m.azienda.h}`,
      ).toBeLessThanOrEqual(0.5);
      expect(
        Math.abs(m.richiesta.h - m.azienda.h),
        `richiesta ${m.richiesta.h} vs input ${m.azienda.h}`,
      ).toBeLessThanOrEqual(0.5);
      if (larghezza === 1440) {
        // Affiancati: «Paese» sta nella riga di «Azienda», i bordi devono coincidere.
        expect(
          Math.abs(m.paese.bottom - m.azienda.bottom),
          "bordo di Paese e di Azienda",
        ).toBeLessThanOrEqual(0.5);
      }
    });
  }
}
