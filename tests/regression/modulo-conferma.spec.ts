import { expect, test, type Locator, type Page } from "@playwright/test";

import it from "../../src/messages/it.json";
import { SPUNTA } from "../../src/app/(site)/[locale]/contatti/_components/icone-invio";
import { ricevutiDaZapier } from "./helpers/finto-zapier";

/**
 * Il bottone di invio che diventa la conferma (14/10/2026).
 *
 * Successo: «Inviato», `aria-disabled`, riga di conferma col nome (non l'email), campi bloccati.
 * Errore: si torna a «Invia», riga rossa, campi modificabili. «Invia un'altra richiesta» svuota e
 * riporta il fuoco su «Nome». Ogni invio riuscito si verifica sul finto Zapier, che risponde 500
 * quando l'email contiene `+errore500`.
 *
 * I plugin dell'animazione (MorphSVGPlugin, Flip) stanno in due chunk a parte, richiesti solo al
 * primo invio e mai con il movimento ridotto: si riconoscono dal contenuto (`shapeIndex` è solo
 * in MorphSVG, `fitChild` solo in Flip), non dal nome del file, che cambia a ogni build.
 */

test.use({ locale: "it-IT" });

const FINESTRA_ANTIBOT_MS = 3000;
const f = it.contatti.form;

function modulo(page: Page): Locator {
  return page.locator("form:has(select[name='paese'])").first();
}

/** Conta le richieste dei due chunk dei plugin, leggendone il contenuto. */
function contaChunkPlugin(page: Page) {
  const visti = { morph: 0, flip: 0 };
  page.on("response", async (r) => {
    if (!r.url().endsWith(".js")) return;
    const corpo = await r.text().catch(() => "");
    if (corpo.includes("shapeIndex")) visti.morph++;
    if (corpo.includes("fitChild")) visti.flip++;
  });
  return visti;
}

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
  await form.locator("select[name='richiesta']").selectOption("preventivo");
  await form.locator("select[name='paese']").selectOption("IT");
}

// Indirizzo unico per prova: con 2 worker i finti Zapier e Brevo sono condivisi, e
// `testId` (26/10/2026) rende l'indirizzo unico anche se due worker scrivono nello stesso
// millisecondo. Lungo al più circa 107 caratteri, sotto i 120 che lo schema accetta.
const unica = (caso: string) => `e2e+${caso}-${Date.now()}-${test.info().testId}@example.com`;
/** La riga di conferma porta il nome e NON l'email (Marco, 14/10/2026). */
const riga = f.confermaRiga.replace("{nome}", "Mario");

async function attendiLead(email: string, quanti = 1) {
  await expect
    .poll(async () => (await ricevutiDaZapier()).filter((l) => l.email === email).length, {
      message: `il finto Zapier deve ricevere ${quanti} lead di ${email}`,
    })
    .toBe(quanti);
}

test("/contatti · successo: «Inviato», riga col nome e senza email, campi bloccati, fuoco sul bottone", async ({
  page,
}) => {
  const chunk = contaChunkPlugin(page);
  await page.goto("/contatti");
  const form = modulo(page);
  const attendi = await pronto(form);
  const email = unica("conferma");
  await compila(form, email);
  await attendi();
  const bottone = form.locator("button[type='submit']");
  await bottone.click();

  await expect(form.locator("output")).toHaveText(riga);
  await expect(form.locator("output")).toContainText("Mario");
  await expect(form.locator("output")).not.toContainText(email);
  await expect(bottone).toHaveAttribute("aria-disabled", "true");
  await expect(bottone).toBeFocused();
  await expect(bottone).toHaveAccessibleName(f.inviato);
  for (const nome of ["nome", "cognome", "email", "telefono", "azienda"]) {
    await expect(form.locator(`input[name='${nome}']`)).toHaveAttribute("readonly", "");
  }
  await expect(form.locator("textarea[name='note']")).toHaveAttribute("readonly", "");
  await expect(form.locator("select[name='paese']")).toBeDisabled();
  await expect(form.locator("select[name='richiesta']")).toBeDisabled();
  await attendiLead(email);
  await expect.poll(() => chunk.morph, { message: "MorphSVG richiesto al primo invio" }).toBe(1);
  await expect.poll(() => chunk.flip, { message: "Flip richiesto al primo invio" }).toBe(1);
});

test("/contatti · movimento ridotto: stato finale subito, plugin mai richiesti", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const chunk = contaChunkPlugin(page);
  await page.goto("/contatti");
  const form = modulo(page);
  const attendi = await pronto(form);
  const email = unica("ridotto");
  await compila(form, email);
  await attendi();
  await form.locator("button[type='submit']").click();

  await expect(form.locator("output")).toBeVisible();
  // Nello stesso istante in cui c'è la riga, il bottone è già allo stato finale.
  const finale = await form.evaluate((f) => ({
    inviato: getComputedStyle(f.querySelector(".fa-invio-e-inviato")!).opacity,
    invia: getComputedStyle(f.querySelector(".fa-invio-e-invia")!).opacity,
    d: f.querySelector(".fa-invio-icona path")!.getAttribute("d"),
    riga: getComputedStyle(f.querySelector("output")!.parentElement!).opacity,
  }));
  expect(finale).toEqual({ inviato: "1", invia: "0", d: SPUNTA, riga: "1" });
  await attendiLead(email);
  await page.waitForTimeout(500);
  expect(chunk, "con il movimento ridotto i plugin non si caricano").toEqual({ morph: 0, flip: 0 });
});

test("/contatti · errore di invio: «Invia» di nuovo, riga rossa, campi modificabili", async ({
  page,
}) => {
  await page.goto("/contatti");
  const form = modulo(page);
  const attendi = await pronto(form);
  const email = unica("errore500");
  await compila(form, email);
  await attendi();
  const bottone = form.locator("button[type='submit']");
  await bottone.click();

  await expect(form.locator("[role='alert']")).toHaveText(f.errorGeneric);
  await expect(bottone).not.toHaveAttribute("aria-disabled", "true");
  await expect(bottone).toHaveAccessibleName(f.submit);
  await expect(form.locator("output")).toHaveCount(0);
  await expect(form.locator("input[name='nome']")).not.toHaveAttribute("readonly", "");
  await expect(form.locator("select[name='paese']")).toBeEnabled();
  // Il finto Zapier l'ha ricevuto e ha risposto 500: l'errore è quello vero del webhook.
  await attendiLead(email);
});

for (const [path, paginaAttesa, source] of [
  ["/contatti", "/contatti", "contatti"],
  ["/", "/", "home"],
] as const) {
  test(`${path} · doppio invio: due lead, e pagina e lingua tutte e due le volte`, async ({
    page,
  }) => {
    const corpi: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.headers()["next-action"]) corpi.push(r.postData() ?? "");
    });
    await page.goto(path);
    const form = modulo(page);
    await form.scrollIntoViewIfNeeded();
    const attendi = await pronto(form);
    const email = unica(`doppio-${source}`);
    await compila(form, email);
    await attendi();
    await form.locator("button[type='submit']").click();
    await expect(form.locator("output")).toBeVisible();

    await page.getByRole("button", { name: f.nuovaRichiesta }).click();
    await expect(form.locator("output")).toHaveCount(0);
    await expect(form.locator("input[name='nome']")).toBeFocused();
    await expect(form.locator("input[name='nome']")).toHaveValue("");
    await expect(form.locator("button[type='submit']")).toHaveAccessibleName(f.submit);

    await compila(form, email);
    await form.locator("button[type='submit']").click();
    await expect(form.locator("output")).toBeVisible();

    await attendiLead(email, 2);
    const lead = (await ricevutiDaZapier()).filter((l) => l.email === email);
    for (const l of lead) expect(l).toMatchObject({ source, lingua: "it" });
    const inviati = corpi.filter((c) => c.includes(email));
    expect(inviati, "due POST della Server Action").toHaveLength(2);
    for (const c of inviati) {
      expect(c).toContain(`"pagina":"${paginaAttesa}"`);
      expect(c).toContain('"lingua":"it"');
    }
  });
}

for (const path of ["/contatti", "/"]) {
  test(`${path} · pagina aperta senza invio: nessun chunk dei plugin`, async ({ page }) => {
    const chunk = contaChunkPlugin(page);
    await page.goto(path, { waitUntil: "load" });
    await modulo(page).waitFor();
    await page.waitForTimeout(1500);
    expect(chunk).toEqual({ morph: 0, flip: 0 });
  });
}
