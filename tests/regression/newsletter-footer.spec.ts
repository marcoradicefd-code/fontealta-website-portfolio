import { expect, test, type Locator, type Page } from "@playwright/test";

import de from "../../src/messages/de.json";
import en from "../../src/messages/en.json";
import es from "../../src/messages/es.json";
import fr from "../../src/messages/fr.json";
import it from "../../src/messages/it.json";
import {
  aggiunteAListaDaBrevo,
  contattiDaBrevo,
  ricevutiDaBrevo,
  ricevutiDaZapier,
} from "./helpers/finto-zapier";

/**
 * La newsletter nel piè di pagina (20/10/2026, Marco): Nome e Cognome affiancati, Email sotto, tutti
 * obbligatori, la casella obbligatoria e «Iscriviti». Server Action `submitNewsletter`, col finto Brevo di
 * `playwright.regression.config.ts`.
 *
 * - Lista dalla LINGUA DELLA PAGINA (it 19, en 23, de 21, fr 20, es 22) più la 25, `SOURCE: footer`,
 *   `LOCALE` della pagina, `NOME` e `COGNOME`, niente `PAESE`, mai `emailBlacklisted`.
 * - Contatto già presente → le due liste con la sola email.
 * - Senza casella o con l'esca compilata: nessuna chiamata. Mai Zapier, mai un'email.
 * - L'iscrizione parte in `after()`, dopo la risposta: si aspetta con un `poll`.
 */

const MESSAGGI = { it, en, de, fr, es } as const;
const FINESTRA_ANTIBOT_MS = 3000;

// Indirizzo unico per prova: con 2 worker i finti Zapier e Brevo sono condivisi, e
// `testId` (26/10/2026) rende l'indirizzo unico anche se due worker scrivono nello stesso
// millisecondo. Lungo al più circa 107 caratteri, sotto i 120 che lo schema accetta.
const unica = (caso: string) =>
  `e2e+footer-${caso}-${Date.now()}-${test.info().testId}@example.com`;

function moduloFooter(page: Page): Locator {
  return page.locator("footer form");
}

/** Idratazione (il clic a vuoto dà l'errore dell'email), poi la finestra anti-bot. */
async function pronto(form: Locator) {
  await form.scrollIntoViewIfNeeded();
  await form.locator("button[type='submit']").click();
  await expect(form.locator("input[name='email']")).toHaveAttribute("aria-invalid", "true");
  const idratato = Date.now();
  return async () => {
    const resta = FINESTRA_ANTIBOT_MS - (Date.now() - idratato);
    if (resta > 0) await form.page().waitForTimeout(resta + 100);
  };
}

async function iscrivi(page: Page, email: string, { casella = true } = {}) {
  const form = moduloFooter(page);
  const attendi = await pronto(form);
  await form.locator("input[name='nome']").fill("Mario");
  await form.locator("input[name='cognome']").fill("Rossi");
  await form.locator("input[name='email']").fill(email);
  if (casella) await form.locator("input[name='newsletter']").check();
  await attendi();
  await form.locator("button[type='submit']").click();
  return form;
}

const contattiPer = async (email: string) =>
  (await contattiDaBrevo()).filter((c) => c.email === email);
const aggiuntePer = async (email: string) =>
  (await aggiunteAListaDaBrevo()).filter((a) => a.corpo.emails?.toString() === email);

/** Che NON arrivi niente si guarda dopo aver dato ad `after()` il tempo di girare. */
async function niente(page: Page, email: string) {
  await page.waitForTimeout(2000);
  expect(await contattiPer(email)).toEqual([]);
  expect(await aggiuntePer(email)).toEqual([]);
}

test.describe("newsletter nel piè di pagina", () => {
  for (const [lingua, percorso, lista] of [
    ["it", "/finiture", 19],
    ["en", "/en/finishes", 23],
    ["de", "/de", 21],
    ["fr", "/fr", 20],
    ["es", "/es", 22],
  ] as const) {
    test(`${percorso} · lista ${lista} e 25, SOURCE footer, LOCALE ${lingua}, niente PAESE`, async ({
      page,
    }) => {
      const m = MESSAGGI[lingua];
      await page.goto(percorso);
      const email = unica(lingua);
      const form = await iscrivi(page, email);

      await expect(form.locator("output")).toHaveText(m.contatti.form.newsletterConferma, {
        timeout: 15_000,
      });
      await expect(form.locator("button[type='submit']")).toContainText(
        m.contatti.newsletterFooter.iscritto,
      );
      await expect.poll(async () => (await contattiPer(email)).length).toBe(1);
      const [contatto] = await contattiPer(email);
      expect(contatto).toMatchObject({
        listIds: [lista, 25],
        updateEnabled: false,
        conChiave: true,
        attributes: { NOME: "Mario", COGNOME: "Rossi", LOCALE: lingua, SOURCE: "footer" },
      });
      expect(contatto.attributes).not.toHaveProperty("PAESE");
      expect(contatto).not.toHaveProperty("emailBlacklisted");
      // Né Zapier né un'email transazionale.
      expect((await ricevutiDaZapier()).some((l) => l.email === email)).toBe(false);
      expect((await ricevutiDaBrevo()).some((b) => b.to?.[0]?.email === email)).toBe(false);
    });
  }

  test("contatto già presente · stessa risposta, poi le due liste con la sola email", async ({
    page,
  }) => {
    const email = unica("gia");
    const righe: string[] = [];
    for (let giro = 0; giro < 2; giro++) {
      await page.goto("/finiture");
      const form = await iscrivi(page, email);
      await expect(form.locator("output")).toBeVisible({ timeout: 15_000 });
      righe.push((await form.locator("output").textContent()) ?? "");
    }
    expect(righe[0]).toBe(righe[1]);
    await expect.poll(async () => (await contattiPer(email)).length).toBe(2);
    await expect.poll(async () => (await aggiuntePer(email)).length).toBe(2);
    expect(await aggiuntePer(email)).toEqual([
      { listId: 19, corpo: { emails: [email] }, conChiave: true },
      { listId: 25, corpo: { emails: [email] }, conChiave: true },
    ]);
  });

  test("senza casella · errore sotto la casella, nessuna chiamata a Brevo", async ({ page }) => {
    await page.goto("/finiture");
    const email = unica("senza-casella");
    const form = await iscrivi(page, email, { casella: false });
    const casella = form.locator("input[name='newsletter']");
    await expect(form.getByRole("alert")).toHaveText(it.contatti.newsletterFooter.casella);
    await expect(casella).toHaveAttribute("aria-invalid", "true");
    await expect(casella).not.toBeChecked();
    await expect(form.locator("output")).toHaveCount(0);
    await niente(page, email);
  });

  test("nome, cognome ed email vuoti · un errore per campo, nessuna chiamata", async ({ page }) => {
    await page.goto("/finiture");
    const form = moduloFooter(page);
    await form.scrollIntoViewIfNeeded();
    await form.locator("input[name='newsletter']").check();
    await form.locator("button[type='submit']").click();
    const f = it.contatti.form;
    for (const [campo, errore] of [
      ["nome", f.errors.nomeRequired],
      ["cognome", f.errors.cognomeRequired],
      ["email", f.errors.emailInvalid],
    ] as const) {
      const input = form.locator(`input[name='${campo}']`);
      await expect(input).toHaveAttribute("aria-invalid", "true");
      const id = await input.getAttribute("aria-describedby");
      await expect(form.locator(`[id='${id}']`)).toHaveText(errore);
    }
    // Il fuoco va sul primo campo sbagliato.
    await expect(form.locator("input[name='nome']")).toBeFocused();
    await expect(form.locator("output")).toHaveCount(0);
  });

  test("esca compilata · finto successo, nessuna chiamata a Brevo", async ({ page }) => {
    await page.goto("/finiture");
    const form = moduloFooter(page);
    const attendi = await pronto(form);
    const email = unica("esca");
    await form.locator("input[name='nome']").fill("Mario");
    await form.locator("input[name='cognome']").fill("Rossi");
    await form.locator("input[name='email']").fill(email);
    await form.locator("input[name='newsletter']").check();
    // L'esca è fuori schermo e fuori dal Tab: la riempie solo un bot.
    await form.locator("input[name='_gotcha']").fill("spam", { force: true });
    await attendi();
    await form.locator("button[type='submit']").click();
    await expect(form.locator("output")).toBeVisible({ timeout: 15_000 });
    await niente(page, email);
  });

  test("la casella parte vuota, e il link dell'informativa apre la privacy in una scheda nuova", async ({
    page,
  }) => {
    await page.goto("/finiture");
    const form = moduloFooter(page);
    await expect(form.locator("input[name='newsletter']")).not.toBeChecked();
    const link = form.locator("label a");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("href", "/menzioni-legali#privacy");
  });
});
