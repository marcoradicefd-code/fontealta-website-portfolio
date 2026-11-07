import { expect, test, type Locator, type Page } from "@playwright/test";

import en from "../../src/messages/en.json";
import it from "../../src/messages/it.json";
import { ricevutiDaZapier } from "./helpers/finto-zapier";

/**
 * Il modulo nelle schede modello (16/10/2026).
 *
 * In fondo alla scheda c'è `ProgettareCta`; il bottone «Richiedi informazioni» dell'hero porta lì
 * col `LenisProvider` e il menu della richiesta parte VUOTO (Q21 del grill: niente `?richiesta=`).
 * Ogni invio si verifica sul FINTO Zapier: codice e nome del modello, `source: "modello"`. Dagli
 * altri moduli i due campi arrivano vuoti.
 *
 * Richiede il build E2E (`window.__lenis`) → `pnpm test:e2e`.
 */

test.use({ locale: "it-IT" });

const FINESTRA_ANTIBOT_MS = 3000;
const BOTTONE = 'a[href="#progettare"]';

function modulo(page: Page): Locator {
  return page.locator("#progettare form");
}

/** Idratato e fuori dalla finestra anti-bot (stesso metodo di `modulo-note-paese.spec.ts`). */
async function pronto(form: Locator): Promise<() => Promise<void>> {
  await form.locator("button[type='submit']").click();
  await expect(form.locator("input[name='nome']")).toHaveAttribute("aria-invalid", "true");
  const idratato = Date.now();
  return async () => {
    const resta = FINESTRA_ANTIBOT_MS - (Date.now() - idratato);
    if (resta > 0) await form.page().waitForTimeout(resta + 100);
  };
}

async function compilaEInvia(form: Locator, email: string) {
  const attendi = await pronto(form);
  await form.locator("input[name='nome']").fill("Mario");
  await form.locator("input[name='cognome']").fill("Rossi");
  await form.locator("input[name='email']").fill(email);
  await form.locator("select[name='paese']").selectOption("IT");
  await form.locator("select[name='richiesta']").selectOption("preventivo");
  await attendi();
  await form.locator("button[type='submit']").click();
  await expect(form.locator("output")).toBeVisible();
}

async function leadPer(email: string) {
  await expect
    .poll(async () => (await ricevutiDaZapier()).filter((l) => l.email === email).length, {
      message: `il finto Zapier deve ricevere il lead di ${email}`,
    })
    .toBe(1);
  return (await ricevutiDaZapier()).find((l) => l.email === email)!;
}

// Indirizzo unico per prova: con 2 worker i finti Zapier e Brevo sono condivisi, e
// `testId` (26/10/2026) rende l'indirizzo unico anche se due worker scrivono nello stesso
// millisecondo. Lungo al più circa 107 caratteri, sotto i 120 che lo schema accetta.
const unica = (caso: string) =>
  `e2e+modello-${caso}-${Date.now()}-${test.info().testId}@example.com`;

/** Aspetta Lenis fermo, non un tempo fisso (la ragione sta in `scroll-lenis.spec.ts`). */
async function lenisFermo(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          String(
            (window as unknown as { __lenis?: { isScrolling: unknown } }).__lenis?.isScrolling,
          ),
        ),
      { timeout: 5000 },
    )
    .toBe("false");
}

const altezzaNav = (page: Page) =>
  page.evaluate(() =>
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fa-nav-h")),
  );

/** Clic sul bottone dell'hero: si atterra con la sezione sotto la nav, e il menu è vuoto. */
async function dalBottoneAlModulo(page: Page, testo: string) {
  const bottone = page.locator(BOTTONE);
  await expect(bottone).toHaveCount(1);
  await expect(bottone).toHaveText(testo);
  await expect(bottone).toBeInViewport();
  // L'idratazione del provider prima del clic, come in `scroll-lenis.spec.ts`.
  await page.waitForFunction(() => "__lenis" in window);
  await bottone.click();
  await lenisFermo(page);
  const top = await page.locator("#progettare").evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(top - (await altezzaNav(page))), "la sezione atterra sotto la nav").toBeLessThan(
    2,
  );
  expect(new URL(page.url()).search, "nessun ?richiesta=").toBe("");
  await expect(modulo(page).locator("select[name='richiesta']")).toHaveValue("");
}

for (const vp of [
  { nome: "1440", width: 1440, height: 900 },
  { nome: "390", width: 390, height: 844 },
]) {
  test(`/modello/b40l a ${vp.nome} · bottone, sezione, lead con il modello`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/modello/b40l");

    // In fondo alla colonna di testo, subito dopo l'etichetta della finitura scelta (Marco,
    // 16/10/2026), e intero nella prima schermata: a pagina in cima, top + height < innerHeight.
    // Sotto `sm` a tutta larghezza della colonna, sopra largo quanto il testo.
    const posto = await page.locator(BOTTONE).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        dopoLaFinitura: el.previousElementSibling?.lastElementChild?.getAttribute("aria-live"),
        ultimo: el.nextElementSibling === null,
        scrollY: window.scrollY,
        fondo: r.top + r.height,
        innerHeight: window.innerHeight,
        larghezza: r.width,
        colonna: el.parentElement!.clientWidth,
      };
    });
    expect(posto.dopoLaFinitura, "subito dopo l'etichetta della finitura").toBe("polite");
    expect(posto.ultimo, "ultimo della colonna di testo").toBe(true);
    expect(posto.scrollY).toBe(0);
    expect(posto.fondo, "visibile senza scorrere").toBeLessThan(posto.innerHeight);
    if (vp.width < 640) expect(posto.larghezza, "a tutta larghezza").toBe(posto.colonna);
    else expect(posto.larghezza, "largo quanto il testo").toBeLessThan(posto.colonna / 2);

    await expect(page.locator("#progettare h2")).toHaveText(it.schedaModello.progettareH2);
    await expect(page.locator("#progettare")).toContainText(it.schedaModello.progettareSub);

    await dalBottoneAlModulo(page, it.schedaModello.richiediInformazioni);

    const email = unica(`it-${vp.nome}`);
    await compilaEInvia(modulo(page), email);
    const nome = (await page.locator("h1").textContent())?.trim();
    expect(nome, "il nome della scheda").toBeTruthy();
    expect(await leadPer(email)).toMatchObject({
      modello: "B40L",
      modelloNome: nome,
      source: "modello",
      lingua: "it",
      richiesta: "preventivo",
    });
  });
}

test("/en/model/b40l · testi inglesi, lead con il modello e la lingua", async ({ page }) => {
  await page.goto("/en/model/b40l");
  await expect(page.locator("#progettare h2")).toHaveText(en.schedaModello.progettareH2);
  await dalBottoneAlModulo(page, en.schedaModello.richiediInformazioni);

  const email = unica("en");
  await compilaEInvia(modulo(page), email);
  const nome = (await page.locator("h1").textContent())?.trim();
  expect(await leadPer(email)).toMatchObject({
    modello: "B40L",
    modelloNome: nome,
    source: "modello",
    lingua: "en",
  });
});

test("/contatti · modello e modelloNome arrivano vuoti", async ({ page }) => {
  await page.goto("/contatti");
  const form = page.locator("form:has(select[name='paese'])").first();
  const email = unica("contatti");
  await compilaEInvia(form, email);
  expect(await leadPer(email)).toMatchObject({
    modello: "",
    modelloNome: "",
    source: "contatti",
  });
});
