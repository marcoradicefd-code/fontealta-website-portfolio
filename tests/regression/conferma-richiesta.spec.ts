import { expect, test, type Locator, type Page } from "@playwright/test";

import it from "../../src/messages/it.json";
import { ricevutiDaBrevo, ricevutiDaZapier } from "./helpers/finto-zapier";

/**
 * L'email «Richiesta ricevuta» (20/10/2026, Marco).
 *
 * Ogni modulo di CONTATTO andato a buon fine verso Zapier (`/contatti`, la home, `ProgettareCta`)
 * fa partire via Brevo il template della lingua del PAESE: IT 112, EN 113, DE/AT/CH 114, FR 115,
 * ES 116, ogni altro Paese 113. Il modulo del catalogo no (ha la sua email), e nemmeno un invio
 * con Zapier in errore (la richiesta non è arrivata). La chiamata parte in `after()`, cioè DOPO la
 * risposta: le attese qui sotto aspettano il finto Brevo, non la pagina.
 *
 * Il finto Brevo e il finto Zapier li avvia `playwright.regression.config.ts`.
 */

test.use({ locale: "it-IT" });

const FINESTRA_ANTIBOT_MS = 3000;
const CONFERME = new Set([112, 113, 114, 115, 116]);

// Indirizzo unico per prova: con 2 worker i finti Zapier e Brevo sono condivisi, e
// `testId` (26/10/2026) rende l'indirizzo unico anche se due worker scrivono nello stesso
// millisecondo. Lungo al più circa 107 caratteri, sotto i 120 che lo schema accetta.
const unica = (caso: string) =>
  `e2e+conferma-${caso}-${Date.now()}-${test.info().testId}@example.com`;

/** Il modulo generale: l'unico col menu della richiesta (il catalogo non ce l'ha). */
function moduloGenerale(page: Page): Locator {
  return page.locator("form:has(select[name='richiesta'])").first();
}

/** Aspetta l'idratazione (il clic a vuoto dà gli errori) e poi la finestra anti-bot. */
async function pronto(form: Locator): Promise<() => Promise<void>> {
  await form.scrollIntoViewIfNeeded();
  await form.locator("button[type='submit']").click();
  await expect(form.locator("input[name='nome']")).toHaveAttribute("aria-invalid", "true");
  const idratato = Date.now();
  return async () => {
    const resta = FINESTRA_ANTIBOT_MS - (Date.now() - idratato);
    if (resta > 0) await form.page().waitForTimeout(resta + 100);
  };
}

async function inviaGenerale(page: Page, email: string, paese: string) {
  const form = moduloGenerale(page);
  const attendi = await pronto(form);
  await form.locator("input[name='nome']").fill("Mario");
  await form.locator("input[name='cognome']").fill("Rossi");
  await form.locator("input[name='email']").fill(email);
  await form.locator("select[name='richiesta']").selectOption("preventivo");
  await form.locator("select[name='paese']").selectOption(paese);
  await attendi();
  await form.locator("button[type='submit']").click();
  return form;
}

async function invioBrevoPer(email: string) {
  return (await ricevutiDaBrevo()).filter((b) => b.to?.[0]?.email === email);
}

/** Che NON arrivi niente si guarda dopo aver dato ad `after()` il tempo di girare. */
async function nessunaConfermaPer(page: Page, email: string) {
  await page.waitForTimeout(2000);
  const conferme = (await invioBrevoPer(email)).filter((b) => CONFERME.has(b.templateId ?? 0));
  expect(conferme, `nessuna email di conferma per ${email}`).toEqual([]);
}

test.describe("email di conferma della richiesta", () => {
  for (const [percorso, paese, template] of [
    ["/contatti", "IT", 112],
    ["/", "AT", 114],
    ["/finiture", "FR", 115],
    ["/contatti", "ES", 116],
    ["/collezioni", "US", 113],
  ] as const) {
    test(`${percorso} · Paese ${paese} → template ${template}, una volta sola`, async ({
      page,
    }) => {
      await page.goto(percorso);
      const email = unica(paese.toLowerCase());
      const form = await inviaGenerale(page, email, paese);
      await expect(form.locator("output")).toBeVisible({ timeout: 15_000 });

      await expect
        .poll(async () => (await invioBrevoPer(email)).length, {
          message: `il finto Brevo deve ricevere la conferma di ${email}`,
        })
        .toBe(1);
      const [invio] = await invioBrevoPer(email);
      expect(invio).toMatchObject({
        templateId: template,
        to: [{ email, name: "Mario" }],
        params: { NOME: "Mario" },
        conChiave: true,
      });
      // Un'email transazionale e basta: nessun attributo, nessuna lista.
      expect(invio).not.toHaveProperty("attributes");
      expect(invio).not.toHaveProperty("listIds");
      // E la richiesta è arrivata a Zapier prima.
      expect((await ricevutiDaZapier()).some((l) => l.email === email)).toBe(true);
    });
  }

  test("/collezioni · il modulo del catalogo NON manda la conferma", async ({ page }) => {
    await page.goto("/collezioni");
    const form = page.locator("#catalogo form");
    const attendi = await pronto(form);
    const email = unica("catalogo");
    await form.locator("input[name='nome']").fill("Mario");
    await form.locator("input[name='cognome']").fill("Rossi");
    await form.locator("input[name='email']").fill(email);
    await form.locator("select[name='paese']").selectOption("IT");
    await attendi();
    await form.locator("button[type='submit']").click();
    await expect(form.locator("output")).toBeVisible({ timeout: 15_000 });

    // L'email del catalogo sì (97, italiano), la conferma no.
    await expect.poll(async () => (await invioBrevoPer(email)).length).toBe(1);
    expect((await invioBrevoPer(email))[0].templateId).toBe(97);
    await nessunaConfermaPer(page, email);
  });

  test("/contatti · Zapier in errore → nessuna conferma", async ({ page }) => {
    await page.goto("/contatti");
    // ⚠️ Il finto Zapier cerca `+errore500` subito dopo il `+`: `e2e+conferma-errore500` non lo
    // attiva (provato il 20/10), quindi qui l'indirizzo non passa da `unica`.
    const email = `e2e+errore500-conferma-${Date.now()}@example.com`;
    const form = await inviaGenerale(page, email, "IT");
    // Il finto Zapier registra il lead e risponde 500: il modulo mostra l'errore di invio.
    await expect(form.locator("[role='alert']")).toHaveText(it.contatti.form.errorGeneric, {
      timeout: 15_000,
    });
    await expect(form.locator("output")).toHaveCount(0);
    await expect
      .poll(async () => (await ricevutiDaZapier()).some((l) => l.email === email))
      .toBe(true);
    await nessunaConfermaPer(page, email);
  });
});
