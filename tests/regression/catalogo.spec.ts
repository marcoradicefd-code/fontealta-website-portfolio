import { expect, test, type Locator, type Page } from "@playwright/test";

import en from "../../src/messages/en.json";
import it from "../../src/messages/it.json";
import { CATALOGO_URL } from "../../src/lib/catalogo";
import { ricevutiDaBrevo, ricevutiDaZapier } from "./helpers/finto-zapier";

/**
 * La sezione del catalogo (19/10/2026, decisioni di Marco; grill del 16/10).
 *
 * - Il modulo del catalogo su `/collezioni` e `/contatti`: nome, cognome (dal 20/10), email e Paese,
 *   con la casella della newsletter (dal 19/10). Prima Zapier (`richiesta: "catalogo"`, source della rotta),
 *   poi Brevo col template della lingua del PAESE. «Ti abbiamo inviato» solo con un 2xx;
 *   altrimenti il ripiego, e in tutti e due i casi il link al PDF.
 * - Il menu «Di cosa hai bisogno» ha tre voci; un `catalogo` mandato da una pagina in cache
 *   va a Zapier e fa partire l'email lo stesso.
 * - La riga «Cerchi il catalogo?» porta a `#catalogo` sotto la nav, sulla pagina o su `/contatti`.
 * - I vecchi `?richiesta=catalogo#progettare` finiscono su `#catalogo`, senza query.
 *
 * Ogni invio riuscito si verifica sul finto Zapier e sul finto Brevo (`playwright.regression.config.ts`).
 */

test.use({ locale: "it-IT" });

const FINESTRA_ANTIBOT_MS = 3000;
const f = it.contatti.form;

// Indirizzo unico per prova: con 2 worker i finti Zapier e Brevo sono condivisi, e
// `testId` (26/10/2026) rende l'indirizzo unico anche se due worker scrivono nello stesso
// millisecondo. Lungo al più circa 107 caratteri, sotto i 120 che lo schema accetta.
const unica = (caso: string) => `e2e+${caso}-${Date.now()}-${test.info().testId}@example.com`;

function moduloCatalogo(page: Page): Locator {
  return page.locator("#catalogo form");
}

/** Aspetta l'idratazione (il clic a vuoto dà gli errori) e poi la finestra anti-bot. */
async function pronto(form: Locator): Promise<() => Promise<void>> {
  await form.locator("button[type='submit']").click();
  await expect(form.locator("input[name='nome']")).toHaveAttribute("aria-invalid", "true");
  const idratato = Date.now();
  return async () => {
    const resta = FINESTRA_ANTIBOT_MS - (Date.now() - idratato);
    if (resta > 0) await form.page().waitForTimeout(resta + 100);
  };
}

async function inviaCatalogo(page: Page, email: string, paese: string) {
  const form = moduloCatalogo(page);
  await form.scrollIntoViewIfNeeded();
  const attendi = await pronto(form);
  await form.locator("input[name='nome']").fill("Mario");
  await form.locator("input[name='cognome']").fill("Rossi");
  await form.locator("input[name='email']").fill(email);
  await form.locator("select[name='paese']").selectOption(paese);
  await attendi();
  await form.locator("button[type='submit']").click();
  await expect(form.locator("output")).toBeVisible({ timeout: 15_000 });
  return form;
}

async function leadPer(email: string) {
  return (await ricevutiDaZapier()).find((l) => l.email === email);
}

async function brevoPer(email: string) {
  return (await ricevutiDaBrevo()).find((b) => b.to?.[0]?.email === email);
}

/** Il bordo alto del bersaglio si ferma sotto la nav: `scroll-margin-top: var(--fa-nav-h)`. */
async function atterraSottoLaNav(page: Page, selettore: string) {
  const nav = await page.evaluate(() =>
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fa-nav-h")),
  );
  await expect
    .poll(
      async () =>
        Math.abs(
          (await page.locator(selettore).evaluate((el) => el.getBoundingClientRect().top)) - nav,
        ),
      { timeout: 5000 },
    )
    .toBeLessThanOrEqual(1);
}

/**
 * Porta il link in vista e lo clicca un fotogramma dopo, come farebbe una persona. Il clic di
 * Playwright su un link fuori vista fa un salto nativo e clicca nello STESSO fotogramma: Lenis ha
 * ancora il bersaglio vecchio (0 con la pagina a 776, misurato il 19/10) e l'animazione si pianta a
 * metà. Con un fotogramma in mezzo l'atterraggio è esatto (regola «due input in meno di un
 * fotogramma non sono un utente», `misure-e-test`).
 */
async function cliccaDaUtente(link: Locator) {
  await link.scrollIntoViewIfNeeded();
  await link
    .page()
    .evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await link.click();
}

test.describe("modulo del catalogo", () => {
  for (const percorso of ["/collezioni", "/contatti"]) {
    test(`${percorso} · è nell'HTML servito, con nome, cognome, email e Paese e basta`, async ({
      request,
    }) => {
      const html = await (await request.get(percorso)).text();
      const sezione = html.slice(html.indexOf('id="catalogo"'));
      expect(html).toContain('id="catalogo"');
      const form = sezione.slice(0, sezione.indexOf("</form>"));
      expect(form).toContain('name="nome"');
      expect(form).toContain('name="email"');
      expect(form).toContain('name="paese"');
      expect(form, "il cognome, dal 20/10").toContain('name="cognome"');
      expect(form, "niente menu della richiesta").not.toContain('name="richiesta"');
      expect(form).toContain(f.catalogoRicevi);
      // La casella della newsletter c'è anche qui, mai spuntata (19/10, D4 revocata): spec in
      // `newsletter.spec.ts`.
      expect(form).toContain('name="newsletter"');
      expect(form, "la casella non parte spuntata").not.toMatch(/name="newsletter"[^>]*checked/);
    });
  }

  for (const [larghezza, visibile] of [
    [390, false],
    [1440, true],
  ] as const) {
    test(`/collezioni a ${larghezza} · il sottotitolo della sezione ${visibile ? "c'è" : "non si mostra"}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: larghezza, height: 900 });
      await page.goto("/collezioni");
      const sotto = page.locator("#catalogo p", { hasText: it.catalogo.sottotitolo });
      await expect(sotto).toHaveCount(1);
      if (visibile) await expect(sotto).toBeVisible();
      else await expect(sotto).toBeHidden();
    });
  }

  test("/en/collections, Paese Italia · Zapier poi Brevo col template italiano, conferma con l'email", async ({
    page,
  }) => {
    await page.goto("/en/collections");
    const email = unica("catalogo-en-it");
    const form = await inviaCatalogo(page, email, "IT");

    expect(await leadPer(email)).toMatchObject({
      nome: "Mario",
      cognome: "Rossi",
      richiesta: "catalogo",
      paese: "IT",
      lingua: "en",
      source: "collezioni",
    });
    // La lingua dell'email la decide il Paese (IT → 97), non la pagina (EN).
    expect(await brevoPer(email)).toMatchObject({
      templateId: 97,
      to: [{ email, name: "Mario" }],
      params: { CATALOGO_URL, NOME: "Mario" },
      conChiave: true,
    });

    await expect(form.locator("output")).toHaveText(
      en.contatti.form.catalogoConferma.replace("{email}", email),
    );
    const link = form.getByRole("link", { name: en.contatti.form.catalogoScarica });
    await expect(link).toHaveAttribute("href", CATALOGO_URL);
    // Dopo l'invio restano la conferma e il link al PDF: niente «Invia un’altra richiesta» (Marco).
    await expect(form.getByRole("button", { name: en.contatti.form.nuovaRichiesta })).toHaveCount(
      0,
    );
    await expect(form.locator("button[type='submit']")).toHaveAttribute("aria-disabled", "true");
  });

  test("/contatti, Paese Svizzera · source «contatti» e template tedesco", async ({ page }) => {
    await page.goto("/contatti");
    const email = unica("catalogo-contatti-ch");
    const form = await inviaCatalogo(page, email, "CH");

    expect(await leadPer(email)).toMatchObject({
      richiesta: "catalogo",
      source: "contatti",
      lingua: "it",
    });
    expect((await brevoPer(email))?.templateId).toBe(99);
    await expect(form.locator("output")).toHaveText(f.catalogoConferma.replace("{email}", email));
  });

  for (const caso of ["brevo500", "brevo400-invalid", "brevotimeout"]) {
    test(`Brevo risponde male (+${caso}) · ripiego col link, mai «Ti abbiamo inviato»`, async ({
      page,
    }) => {
      await page.goto("/collezioni");
      const email = `e2e+${caso}-${Date.now()}@example.com`;
      const form = await inviaCatalogo(page, email, "FR");

      // Il lead è arrivato comunque: Brevo viene dopo Zapier e non lo tocca.
      expect(await leadPer(email)).toMatchObject({ richiesta: "catalogo" });
      expect(await brevoPer(email)).toBeTruthy();
      await expect(form.locator("output")).toHaveText(f.catalogoRipiego);
      await expect(form.getByRole("button", { name: f.nuovaRichiesta })).toHaveCount(0);
      await expect(form).not.toContainText("Ti abbiamo inviato");
      await expect(form.getByRole("link", { name: f.catalogoScarica })).toHaveAttribute(
        "href",
        CATALOGO_URL,
      );
    });
  }

  test("«Altro Paese» · le note compaiono e sono obbligatorie, poi arrivano a Zapier", async ({
    page,
  }) => {
    await page.goto("/collezioni");
    const form = moduloCatalogo(page);
    await form.scrollIntoViewIfNeeded();
    const attendi = await pronto(form);
    await expect(form.locator("textarea[name='note']")).toHaveCount(0);

    const email = unica("catalogo-zz");
    await form.locator("input[name='nome']").fill("Mario");
    await form.locator("input[name='cognome']").fill("Rossi");
    await form.locator("input[name='email']").fill(email);
    await form.locator("select[name='paese']").selectOption("ZZ");
    const note = form.locator("textarea[name='note']");
    await expect(note).toBeVisible();
    await expect(note).toHaveAttribute("aria-required", "true");

    await attendi();
    await form.locator("button[type='submit']").click();
    await expect(form).toContainText(f.errors.notePaeseRequired);

    await note.fill("Kosovo");
    await form.locator("button[type='submit']").click();
    await expect(form.locator("output")).toBeVisible({ timeout: 15_000 });
    expect(await leadPer(email)).toMatchObject({
      paese: "ZZ",
      note: "Kosovo",
      richiesta: "catalogo",
    });
    expect((await brevoPer(email))?.templateId).toBe(98); // ZZ → inglese
  });
});

test.describe("moduli generali", () => {
  for (const percorso of ["/", "/finiture", "/contatti", "/en/contact", "/collezioni"]) {
    test(`${percorso} · il menu ha tre voci, senza il catalogo`, async ({ page }) => {
      await page.goto(percorso);
      const menu = "form:has(select[name='richiesta']) select[name='richiesta']";
      // ⚠️ Fuori dalla home il modulo generale sta dentro un `<Suspense>`, e `evaluateAll` non
      // aspetta: nel giro intero del 20/10/2026 ha letto zero voci su `/finiture` e `/collezioni`
      // (30 su 30 da soli). Prima si aspetta che il menu ci sia.
      await expect(page.locator(`${menu} option[value='preventivo']`).first()).toBeAttached();
      const valori = await page
        .locator(`${menu} option`)
        .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
      expect(valori.length % 3, "una o più copie di tre voci").toBe(0);
      expect([...new Set(valori)]).toEqual(["preventivo", "consulenza", "altro"]);

      // Il segnaposto non sembra una scelta e non si può scegliere (Marco, 19/10/2026).
      const segnaposto = await page
        .locator("form:has(select[name='richiesta']) select[name='richiesta'] option[value='']")
        .evaluateAll((os) =>
          os.map((o) => ({ testo: o.textContent, spento: (o as HTMLOptionElement).disabled })),
        );
      const atteso = percorso.startsWith("/en")
        ? en.contatti.form.richiestaPlaceholder
        : f.richiestaPlaceholder;
      expect(segnaposto.length).toBeGreaterThan(0);
      for (const o of segnaposto) expect(o).toEqual({ testo: atteso, spento: true });
    });
  }

  test("una pagina in cache manda «catalogo» · Zapier e l'email del catalogo", async ({ page }) => {
    await page.goto("/finiture");
    const form = page.locator("form:has(select[name='richiesta'])").first();
    await form.scrollIntoViewIfNeeded();
    const attendi = await pronto(form);
    // Il menu di prima: la voce che oggi non c'è più.
    await form.locator("select[name='richiesta']").evaluate((s) => {
      const o = document.createElement("option");
      o.value = "catalogo";
      o.textContent = "Richiesta catalogo";
      s.append(o);
    });
    const email = unica("catalogo-generale");
    await form.locator("input[name='nome']").fill("Mario");
    await form.locator("input[name='cognome']").fill("Rossi");
    await form.locator("input[name='email']").fill(email);
    await form.locator("select[name='paese']").selectOption("ES");
    await form.locator("select[name='richiesta']").selectOption("catalogo");
    await attendi();
    await form.locator("button[type='submit']").click();
    await expect(form.locator("output")).toBeVisible({ timeout: 15_000 });

    expect(await leadPer(email)).toMatchObject({
      cognome: "Rossi",
      richiesta: "catalogo",
      source: "finiture",
    });
    expect((await brevoPer(email))?.templateId).toBe(101);
    await expect(form.locator("output")).toHaveText(f.catalogoConferma.replace("{email}", email));
    // Il modulo generale tiene «Invia un’altra richiesta» anche col catalogo.
    await expect(form.getByRole("button", { name: f.nuovaRichiesta })).toBeVisible();
  });
});

test.describe("rimando al catalogo", () => {
  /** In grassetto col peso delle etichette e sottolineato, su chiaro e su scuro (Marco, 19/10). */
  for (const percorso of ["/", "/finiture", "/contatti", "/collezioni"]) {
    test(`${percorso} · il rimando è in grassetto e si vede come link`, async ({ page }) => {
      await page.goto(percorso);
      const link = page.getByRole("link", { name: f.catalogoRimando }).first();
      await link.scrollIntoViewIfNeeded();
      const stile = await link.evaluate((a) => {
        const c = getComputedStyle(a);
        return { peso: Number(c.fontWeight), linea: c.textDecorationLine };
      });
      expect(stile.peso).toBe(600);
      expect(stile.linea).toContain("underline");
    });
  }

  test("/collezioni · il rimando del modulo generale porta a #catalogo sulla pagina", async ({
    page,
  }) => {
    await page.goto("/collezioni");
    const link = page.locator("#progettare").getByRole("link", { name: f.catalogoRimando });
    await expect(link).toHaveAttribute("href", "#catalogo");
    await cliccaDaUtente(link);
    await expect(page).toHaveURL(/\/collezioni#catalogo$/);
    await atterraSottoLaNav(page, "#catalogo");
  });

  test("/contatti · il rimando porta alla sezione sotto il modulo", async ({ page }) => {
    await page.goto("/contatti");
    const link = page.getByRole("link", { name: f.catalogoRimando });
    await expect(link).toHaveAttribute("href", "#catalogo");
    await cliccaDaUtente(link);
    await atterraSottoLaNav(page, "#catalogo");
  });

  for (const [da, href, arrivo] of [
    ["/finiture", "/contatti#catalogo", /\/contatti#catalogo$/],
    ["/", "/contatti#catalogo", /\/contatti#catalogo$/],
    ["/en/finishes", "/en/contact#catalogo", /\/en\/contact#catalogo$/],
  ] as const) {
    test(`${da} · il rimando porta a ${href}`, async ({ page }) => {
      await page.goto(da);
      const nome = da.startsWith("/en") ? en.contatti.form.catalogoRimando : f.catalogoRimando;
      const link = page.getByRole("link", { name: nome }).first();
      await expect(link).toHaveAttribute("href", href);
      await cliccaDaUtente(link);
      await expect(page).toHaveURL(arrivo);
      await atterraSottoLaNav(page, "#catalogo");
    });
  }

  test("vecchio link ?richiesta=catalogo#progettare · finisce su #catalogo, senza query", async ({
    page,
  }) => {
    await page.goto("/collezioni?richiesta=catalogo#progettare");
    await expect(page).toHaveURL(/\/collezioni#catalogo$/);
    await atterraSottoLaNav(page, "#catalogo");
    // Il modulo generale non preseleziona più niente.
    await expect(page.locator("#progettare select[name='richiesta']")).toHaveValue("");
  });
});
