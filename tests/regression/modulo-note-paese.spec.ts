import { expect, test, type Locator, type Page } from "@playwright/test";

import en from "../../src/messages/en.json";
import it from "../../src/messages/it.json";
import { ricevutiDaZapier } from "./helpers/finto-zapier";

/**
 * Note, Paese e lingua nel modulo di contatto (13/10/2026).
 *
 * Le note cambiano etichetta e obbligo secondo richiesta e Paese; il Paese è obbligatorio; la
 * lingua della pagina viaggia nel payload. Ogni invio riuscito si verifica sul FINTO Zapier
 * (`helpers/finto-zapier.mjs`, avviato da `playwright.regression.config.ts`): se il lead non gli
 * arriva, la spec fallisce. Così un invio finito altrove, o perso, non passa per un verde.
 *
 * ⚠️ Lo zero dei 3 secondi anti-bot è l'idratazione, non `goto` (v. `tests/e2e/contact-form.spec.ts`):
 * si prova con un invio a vuoto che fa scattare `aria-invalid` senza toccare la rete.
 */

test.use({ locale: "it-IT" });

const FINESTRA_ANTIBOT_MS = 3000;
const f = it.contatti.form;

function modulo(page: Page): Locator {
  return page.locator("form:has(select[name='paese'])").first();
}

/** Idratato e fuori dalla finestra anti-bot: da qui un invio valido parte davvero. */
async function pronto(form: Locator): Promise<() => Promise<void>> {
  await form.locator("button[type='submit']").click();
  await expect(form.locator("input[name='nome']")).toHaveAttribute("aria-invalid", "true");
  const idratato = Date.now();
  return async () => {
    const resta = FINESTRA_ANTIBOT_MS - (Date.now() - idratato);
    if (resta > 0) await form.page().waitForTimeout(resta + 100);
  };
}

async function compila(form: Locator, email: string) {
  await form.locator("input[name='nome']").fill("Mario");
  await form.locator("input[name='cognome']").fill("Rossi");
  await form.locator("input[name='email']").fill(email);
}

/** Conta le Server Action partite mentre gira `fai`. */
async function invii(page: Page, fai: () => Promise<void>): Promise<number> {
  let n = 0;
  const conta = (r: { method(): string; headers(): Record<string, string> }) => {
    if (r.method() === "POST" && r.headers()["next-action"]) n++;
  };
  page.on("request", conta);
  await fai();
  page.off("request", conta);
  return n;
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
const unica = (caso: string) => `e2e+${caso}-${Date.now()}-${test.info().testId}@example.com`;

test("/contatti · «Altro»: etichetta, errore, errore che sparisce, invio", async ({ page }) => {
  await page.goto("/contatti");
  const form = modulo(page);
  const attendi = await pronto(form);
  const email = unica("altro");
  await compila(form, email);
  await form.locator("select[name='paese']").selectOption("IT");

  const note = form.locator("textarea[name='note']");
  const etichetta = form.locator("label:has(textarea[name='note'])");
  await expect(etichetta).toContainText(f.noteFacoltative);
  await expect(note).toHaveAttribute("aria-required", "false");

  await form.locator("select[name='richiesta']").selectOption("altro");
  await expect(etichetta).toContainText(f.noteAltro);
  await expect(note).toHaveAttribute("aria-required", "true");

  // Senza note: errore sotto il campo e nessuna Server Action.
  const partiti = await invii(page, async () => {
    await form.locator("button[type='submit']").click();
    await expect(etichetta).toContainText(f.errors.noteRequired);
  });
  expect(partiti, "senza note non deve partire niente").toBe(0);
  await expect(note).toHaveAttribute("aria-invalid", "true");
  const descritto = await note.getAttribute("aria-describedby");
  expect(descritto, "l'errore è collegato al campo").toBeTruthy();
  await expect(page.locator(`[id='${descritto!.split(" ")[0]}']`)).toHaveText(
    f.errors.noteRequired,
  );

  // Le note diventano facoltative → l'errore già mostrato sparisce; tornano obbligatorie → torna.
  await form.locator("select[name='richiesta']").selectOption("preventivo");
  await expect(etichetta).not.toContainText(f.errors.noteRequired);
  await expect(etichetta).toContainText(f.noteFacoltative);
  await form.locator("select[name='richiesta']").selectOption("altro");
  await expect(etichetta).toContainText(f.errors.noteRequired);

  await note.fill("Vorrei una colonna su misura.");
  await attendi();
  await form.locator("button[type='submit']").click();
  await expect(form.locator("output")).toBeVisible();

  const lead = await leadPer(email);
  expect(lead).toMatchObject({
    richiesta: "altro",
    paese: "IT",
    note: "Vorrei una colonna su misura.",
    lingua: "it",
    source: "contatti",
  });
  expect(lead).not.toHaveProperty("_ts");
  expect(lead).not.toHaveProperty("_gotcha");
  // `pagina` serve solo a calcolare la source (14/10/2026): a Zapier non arriva.
  expect(lead).not.toHaveProperty("pagina");
});

test("/contatti · «Altro Paese»: etichetta, errore, invio con «Kosovo»", async ({ page }) => {
  await page.goto("/contatti");
  const form = modulo(page);
  const attendi = await pronto(form);
  const email = unica("zz");
  await compila(form, email);
  await form.locator("select[name='richiesta']").selectOption("preventivo");
  await form.locator("select[name='paese']").selectOption("ZZ");

  const etichetta = form.locator("label:has(textarea[name='note'])");
  await expect(etichetta).toContainText(f.notePaese);

  const partiti = await invii(page, async () => {
    await form.locator("button[type='submit']").click();
    await expect(etichetta).toContainText(f.errors.notePaeseRequired);
  });
  expect(partiti).toBe(0);

  await form.locator("textarea[name='note']").fill("Kosovo");
  await attendi();
  await form.locator("button[type='submit']").click();
  await expect(form.locator("output")).toBeVisible();

  expect(await leadPer(email)).toMatchObject({
    paese: "ZZ",
    note: "Kosovo",
    lingua: "it",
    source: "contatti",
  });
});

test("/en/contact · Paesi in inglese, gli 8 in testa nell'ordine, «Other country» ultimo", async ({
  page,
}) => {
  await page.goto("/en/contact");
  const opzioni = await modulo(page)
    .locator("select[name='paese'] option")
    .evaluateAll((os) =>
      os.map((o) => ({
        valore: (o as HTMLOptionElement).value,
        testo: o.textContent ?? "",
        spento: (o as HTMLOptionElement).disabled,
      })),
    );

  // 0 = segnaposto; poi gli otto della costante PAESI_IN_TESTA.
  expect(opzioni[0]).toMatchObject({ valore: "", spento: true });
  expect(opzioni.slice(1, 9).map((o) => o.testo)).toEqual([
    "Italy",
    "Germany",
    "France",
    "Spain",
    "United Kingdom",
    "Switzerland",
    "United States",
    "Greece",
  ]);
  expect(opzioni[9].spento, "separatore dopo gli 8").toBe(true);

  const valori = opzioni.map((o) => o.valore).filter((v) => /^[A-Z]{2}$/.test(v));
  expect(new Set(valori).size, "nessun doppione").toBe(valori.length);
  expect(valori).toHaveLength(250); // 249 ISO + ZZ

  expect(opzioni.at(-1)).toEqual({
    valore: "ZZ",
    testo: en.contatti.form.paeseAltro,
    spento: false,
  });
});

test("home · invio con Paese scelto e note vuote", async ({ page }) => {
  await page.goto("/");
  const form = modulo(page);
  await form.scrollIntoViewIfNeeded();
  const attendi = await pronto(form);
  const email = unica("home");
  await compila(form, email);
  await form.locator("select[name='richiesta']").selectOption("consulenza");
  await form.locator("select[name='paese']").selectOption("CH");
  await attendi();
  await form.locator("button[type='submit']").click();
  await expect(form.locator("output")).toBeVisible();

  expect(await leadPer(email)).toMatchObject({
    richiesta: "consulenza",
    paese: "CH",
    note: "",
    lingua: "it",
    source: "home",
  });
});

/**
 * Senza Referer (14/10/2026): il browser può non mandarlo (`Referrer-Policy: no-referrer`, o la
 * policy predefinita cambiata nelle preferenze). Source e lingua arrivano lo stesso, perché il
 * modulo dichiara la pagina (`usePathname`) e la lingua (`useLocale`).
 */
test("/de/kontakt senza Referer · source e lingua dalla pagina", async ({ page }) => {
  let tolti = 0;
  await page.route("**/*", (route) => {
    const req = route.request();
    if (req.method() !== "POST" || !req.headers()["next-action"]) return route.continue();
    const senza = { ...req.headers() };
    delete senza.referer;
    tolti++;
    return route.continue({ headers: senza });
  });

  await page.goto("/de/kontakt");
  const form = modulo(page);
  const attendi = await pronto(form);
  const email = unica("de-senza-referer");
  await compila(form, email);
  await form.locator("select[name='richiesta']").selectOption("consulenza");
  await form.locator("select[name='paese']").selectOption("DE");
  await attendi();
  await form.locator("button[type='submit']").click();
  await expect(form.locator("output")).toBeVisible();

  expect(tolti, "la Server Action è partita senza Referer").toBeGreaterThan(0);
  expect(await leadPer(email)).toMatchObject({ source: "contatti", lingua: "de", paese: "DE" });
});
