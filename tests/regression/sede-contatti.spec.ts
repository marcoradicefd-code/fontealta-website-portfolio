import { expect, test } from "@playwright/test";

import { routing } from "../../src/i18n/routing";

/**
 * La sede su `/contatti` dice quello che dichiara il suo JSON-LD (19/10/2026).
 *
 * Fino ad allora il `LocalBusiness` della pagina dichiarava telefono ed email, mentre il
 * riquadro li leggeva da `siteSettings`, vuoto su Sanity, e mostrava la sola ragione
 * sociale: dato strutturato non visibile, che Google vieta. Ora tutti e due leggono
 * `azienda.ts`. Il test parte dal JSON-LD SERVITO e pretende ogni suo recapito nel testo
 * del riquadro, nelle cinque lingue: se uno dei due cambia sorgente, diverge e qui si vede.
 */

const voce = routing.pathnames["/contatti"];
const PERCORSI = routing.locales.map((l) =>
  l === routing.defaultLocale ? voce[l] : `/${l}${voce[l]}`,
);

interface Sede {
  legalName: string;
  telephone: string;
  email: string;
  faxNumber?: string;
  address: { streetAddress: string; postalCode: string; addressLocality: string };
}

for (const percorso of PERCORSI) {
  test(`sede visibile = LocalBusiness · ${percorso}`, async ({ browser }) => {
    // Contesto nuovo per rotta: il cookie della lingua non deve passare da una all'altra.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(percorso);

    const blocchi = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((els) => els.map((e) => JSON.parse(e.textContent ?? "null")));
    const sede = blocchi.find((b) => b?.["@type"] === "LocalBusiness") as Sede | undefined;
    expect(sede, "LocalBusiness sulla pagina").toBeTruthy();
    if (!sede) return;

    const riquadro = page.locator("main address").first();
    const colonna = riquadro.locator("xpath=..");
    const testo = (await colonna.innerText()).replace(/[ \t\n\r]+/g, " ");

    for (const [campo, valore] of [
      ["legalName", sede.legalName],
      ["telephone", sede.telephone],
      ["email", sede.email],
      ["streetAddress", sede.address.streetAddress],
      ["postalCode", sede.address.postalCode],
      ["addressLocality", sede.address.addressLocality],
    ] as const) {
      expect(testo, `${campo} dichiarato e non visibile`).toContain(valore);
    }

    // Il fax non si vede, quindi non si dichiara (Marco, 19/10/2026).
    expect(sede.faxNumber, "faxNumber dichiarato e non visibile").toBeUndefined();

    await expect(
      riquadro.locator(`a[href="tel:${sede.telephone.replaceAll(" ", "")}"]`),
    ).toHaveText(sede.telephone);
    await expect(riquadro.locator(`a[href="mailto:${sede.email}"]`)).toHaveText(sede.email);
    // In bianco pieno, non nel grigio secondario (Marco, 19/10/2026): `--fa-text-on-dark`.
    await expect(riquadro).toHaveCSS("color", "rgb(246, 244, 240)");

    await context.close();
  });
}
