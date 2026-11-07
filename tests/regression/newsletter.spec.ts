import { expect, test, type Locator, type Page } from "@playwright/test";

import de from "../../src/messages/de.json";
import en from "../../src/messages/en.json";
import es from "../../src/messages/es.json";
import fr from "../../src/messages/fr.json";
import it from "../../src/messages/it.json";
import { routing } from "../../src/i18n/routing";
import { aggiunteAListaDaBrevo, contattiDaBrevo, ricevutiDaZapier } from "./helpers/finto-zapier";

/**
 * La casella della newsletter e la riga privacy (19/10/2026, decisioni di Marco).
 *
 * - In tutti i moduli: la casella, facoltativa e mai spuntata; sotto il bottone la riga «Inviando la
 *   richiesta dichiari di aver letto l’informativa sulla privacy.» col link in una scheda nuova.
 * - Casella spuntata → UNA chiamata a `POST /contacts` del finto Brevo (niente doppia conferma), con la
 *   lista della lingua del Paese più la 25 («Iscritti dal sito», 20/10/2026), `updateEnabled: false`,
 *   mai `emailBlacklisted`; per un contatto che c'è già (400 `duplicate_parameter`) le sole due liste,
 *   senza attributi. Parte in `after()`, dopo
 *   la risposta: si aspetta con un `poll`.
 * - Senza casella → nessuna chiamata. La risposta è la stessa con e senza casella, e per un indirizzo
 *   già iscritto. Dopo l'invio la casella resta com'era (`aria-disabled`, clic ignorati).
 */

test.use({ locale: "it-IT" });

const FINESTRA_ANTIBOT_MS = 3000;
const f = it.contatti.form;
const testo = (html: string) => html.replace(/<\/?link>/g, "");

// Indirizzo unico per prova: con 2 worker i finti Zapier e Brevo sono condivisi, e
// `testId` (26/10/2026) rende l'indirizzo unico anche se due worker scrivono nello stesso
// millisecondo. Lungo al più circa 107 caratteri, sotto i 120 che lo schema accetta.
const unica = (caso: string) => `e2e+${caso}-${Date.now()}-${test.info().testId}@example.com`;

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

/** Il modulo generale di `/contatti`. */
function moduloContatti(page: Page): Locator {
  return page.locator("form:has(select[name='richiesta'])").first();
}

async function inviaContatti(page: Page, email: string, paese: string, casella: boolean) {
  const form = moduloContatti(page);
  const attendi = await pronto(form);
  await form.locator("input[name='nome']").fill("Mario");
  await form.locator("input[name='cognome']").fill("Rossi");
  await form.locator("input[name='email']").fill(email);
  await form.locator("select[name='paese']").selectOption(paese);
  await form.locator("select[name='richiesta']").selectOption("preventivo");
  if (casella) await form.locator("input[name='newsletter']").check();
  await attendi();
  await form.locator("button[type='submit']").click();
  await expect(form.locator("output")).toBeVisible({ timeout: 15_000 });
  return form;
}

async function contattiPer(email: string) {
  return (await contattiDaBrevo()).filter((c) => c.email === email);
}

async function aggiuntePer(email: string) {
  return (await aggiunteAListaDaBrevo()).filter((a) => a.corpo.emails?.toString() === email);
}

const MODULI = [
  ["/", "form:has(select[name='richiesta'])"],
  ["/contatti", "form:has(select[name='richiesta'])"],
  ["/finiture", "form:has(select[name='richiesta'])"],
  ["/collezioni", "#catalogo form"],
  ["/contatti", "#catalogo form"],
] as const;

test.describe("casella e riga privacy in ogni modulo", () => {
  for (const [percorso, selettore] of MODULI) {
    test(`${percorso} ${selettore} · casella mai spuntata, riga privacy in una scheda nuova`, async ({
      page,
    }) => {
      await page.goto(percorso);
      const form = page.locator(selettore).first();
      await form.scrollIntoViewIfNeeded();
      const casella = form.locator("input[name='newsletter']");
      await expect(casella).toHaveCount(1);
      await expect(casella).not.toBeChecked();
      await expect(form.getByText(testo(f.newsletterCasella).slice(0, 40))).toBeVisible();

      const riga = form.locator("p", { hasText: testo(f.privacyRiga) });
      await expect(riga).toHaveCount(1);
      const link = riga.getByRole("link", { name: "informativa sulla privacy" });
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
      await expect(link).toHaveAttribute("href", "/menzioni-legali#privacy");
    });
  }

  /** La riga privacy nelle cinque lingue, su `/contatti`. */
  for (const [lingua, messaggi] of Object.entries({ it, en, de, fr, es })) {
    test(`/contatti in ${lingua} · riga privacy e casella nella lingua`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const voce = routing.pathnames["/contatti"] as Record<string, string>;
      await page.goto(lingua === "it" ? voce.it : `/${lingua}${voce[lingua]}`);
      const form = moduloContatti(page);
      await expect(
        form.locator("p", { hasText: testo(messaggi.contatti.form.privacyRiga) }),
      ).toHaveCount(1);
      await expect(form.locator("input[name='newsletter']")).not.toBeChecked();
      await expect(
        form.getByText(testo(messaggi.contatti.form.newsletterCasella).slice(0, 30)),
      ).toBeVisible();
      await context.close();
    });
  }

  test("il link «informativa» nella casella apre l'informativa in una scheda nuova, e la casella resta spuntata com'era", async ({
    page,
    context,
  }) => {
    await page.goto("/contatti");
    const form = moduloContatti(page);
    await form.scrollIntoViewIfNeeded();
    const casella = form.locator("input[name='newsletter']");
    const link = form.locator("label:has(input[name='newsletter'])").getByRole("link");
    await expect(link).toHaveAttribute("target", "_blank");
    const [scheda] = await Promise.all([context.waitForEvent("page"), link.click()]);
    await scheda.waitForLoadState();
    expect(new URL(scheda.url()).pathname).toBe("/menzioni-legali");
    expect(new URL(scheda.url()).hash).toBe("#privacy");
    await expect(casella).not.toBeChecked();
    await scheda.close();
  });
});

test.describe("stile della casella", () => {
  /**
   * Lo stile della casella (19/10/2026, Marco): la traccia dei controlli, niente oro. Asserzione
   * STRUTTURALE sui colori calcolati, ricavati dai token nella pagina e non scritti qui: da spuntata,
   * fondo e bordo del colore della traccia (navy su chiaro, bianco su scuro), la spunta visibile in
   * crema su chiaro e in inchiostro su scuro. Non un punto campionato dallo scatto, che sulla spunta
   * dava 1,0 anche con il fondo giusto.
   *
   * ⚠️ Lo spessore NON si asserisce: Chromium calcola `1px` per un bordo dichiarato da 1,5 px, a DPR 1,
   * 2 e 3, anche su un `div` qualunque (sonda del 19/10/2026). Il valore calcolato non dice quello
   * che è scritto nel CSS, quindi non fa da guardia.
   */
  for (const [percorso, selettore, scuro] of [
    ["/contatti", "form:has(select[name='richiesta'])", true],
    ["/", "form:has(select[name='richiesta'])", false],
    ["/collezioni", "#catalogo form", false],
  ] as const) {
    test(`${percorso} ${selettore} · da spuntata, colori della traccia ${scuro ? "su scuro" : "su chiaro"}, niente oro`, async ({
      page,
    }) => {
      await page.goto(percorso);
      const form = page.locator(selettore).first();
      await form.scrollIntoViewIfNeeded();
      const casella = form.locator("input[name='newsletter']");
      await casella.check();
      const stile = await casella.evaluate((el, suScuro) => {
        // Il colore di un token, risolto dal browser come lo usa la pagina.
        const token = (nome: string) => {
          const prova = document.createElement("span");
          prova.style.color = `var(${nome})`;
          document.body.append(prova);
          const c = getComputedStyle(prova).color;
          prova.remove();
          return c;
        };
        const c = getComputedStyle(el);
        const spunta = el.nextElementSibling as SVGElement;
        const s = getComputedStyle(spunta);
        return {
          fondo: c.backgroundColor,
          bordo: c.borderTopColor,
          spunta: s.color,
          spuntaVisibile: s.opacity,
          traccia: token(suScuro ? "--fa-stroke-color" : "--fa-stroke-color-on-light"),
          attesaSpunta: token(suScuro ? "--fa-ink" : "--fa-white"),
          oro: token("--fa-gold"),
        };
      }, scuro);
      expect(stile.fondo).toBe(stile.traccia);
      expect(stile.bordo).toBe(stile.traccia);
      expect(stile.spunta).toBe(stile.attesaSpunta);
      expect(stile.spuntaVisibile).toBe("1");
      for (const colore of [stile.fondo, stile.bordo, stile.spunta])
        expect(colore).not.toBe(stile.oro);
    });
  }
});

test.describe("iscrizione su Brevo", () => {
  for (const [paese, lista] of [
    ["IT", 19],
    ["DE", 21],
    ["AT", 21],
    ["FR", 20],
    ["US", 23],
  ] as const) {
    test(`casella spuntata, Paese ${paese} · una chiamata a /contacts con le liste ${lista} e 25`, async ({
      page,
    }) => {
      await page.goto("/contatti");
      const email = unica(`nl-${paese.toLowerCase()}`);
      await inviaContatti(page, email, paese, true);

      await expect.poll(async () => (await contattiPer(email)).length, { timeout: 10_000 }).toBe(1);
      const [contatto] = await contattiPer(email);
      expect(contatto).toMatchObject({
        listIds: [lista, 25],
        updateEnabled: false,
        conChiave: true,
        attributes: { NOME: "Mario", PAESE: paese, LOCALE: "it", SOURCE: "contatti" },
      });
      expect(contatto).not.toHaveProperty("emailBlacklisted");
      // Dal 20/10/2026 anche il cognome (Marco), col filtro del nome.
      expect(contatto.attributes).toHaveProperty("COGNOME", "Rossi");
      expect(await ricevutiDaZapier().then((l) => l.find((x) => x.email === email))).toMatchObject({
        newsletterRichiesta: "sì",
      });
    });
  }

  test("casella NON spuntata · nessuna chiamata a /contacts, newsletterRichiesta «no»", async ({
    page,
  }) => {
    await page.goto("/contatti");
    const email = unica("nl-no");
    const form = await inviaContatti(page, email, "IT", false);
    await expect(form.locator("output")).toHaveText(f.confermaRiga.replace("{nome}", "Mario"));
    // `after()` gira subito dopo la risposta: due secondi bastano per vedere che non è partito niente.
    await page.waitForTimeout(2000);
    expect(await contattiPer(email)).toHaveLength(0);
    // Né la lista della lingua né la 25, neanche dal ramo del contatto esistente.
    expect(await aggiuntePer(email)).toHaveLength(0);
    expect(await ricevutiDaZapier().then((l) => l.find((x) => x.email === email))).toMatchObject({
      newsletterRichiesta: "no",
    });
  });

  test("contatto già presente · stessa risposta, e la seconda volta SOLO le due liste, senza attributi", async ({
    page,
  }) => {
    const email = unica("nl-gia");
    const righe: string[] = [];
    for (let giro = 0; giro < 2; giro++) {
      await page.goto("/contatti");
      const form = await inviaContatti(page, email, "IT", true);
      righe.push((await form.locator("output").textContent()) ?? "");
    }
    await expect.poll(async () => (await contattiPer(email)).length, { timeout: 10_000 }).toBe(2);
    // Il primo `POST /contacts` porta già le due liste; il secondo riceve 400 `duplicate_parameter`,
    // e poi l'aggiunta alla lista della lingua e alla 25, con la sola email.
    expect((await contattiPer(email))[0]).toMatchObject({ listIds: [19, 25] });
    await expect.poll(async () => (await aggiuntePer(email)).length).toBe(2);
    expect(await aggiuntePer(email)).toEqual([
      { listId: 19, corpo: { emails: [email] }, conChiave: true },
      { listId: 25, corpo: { emails: [email] }, conChiave: true },
    ]);
    expect(righe[0]).toBe(righe[1]);
    expect(righe[0]).toBe(`${f.confermaRiga.replace("{nome}", "Mario")}${f.newsletterConferma}`);
  });

  test("Brevo in errore (+brevo500) · stessa risposta, nessun segno nella pagina", async ({
    page,
  }) => {
    await page.goto("/contatti");
    const email = unica("nl-brevo500").replace("e2e+", "e2e+brevo500-");
    const form = await inviaContatti(page, email, "IT", true);
    await expect(form.locator("output")).toHaveText(
      `${f.confermaRiga.replace("{nome}", "Mario")}${f.newsletterConferma}`,
    );
    await expect.poll(async () => (await contattiPer(email)).length, { timeout: 10_000 }).toBe(1);
  });

  test("modulo del catalogo con la casella · riga del catalogo e riga della newsletter", async ({
    page,
  }) => {
    await page.goto("/collezioni");
    const form = page.locator("#catalogo form");
    await form.scrollIntoViewIfNeeded();
    const attendi = await pronto(form);
    const email = unica("nl-catalogo");
    await form.locator("input[name='nome']").fill("Mario");
    await form.locator("input[name='cognome']").fill("Rossi");
    await form.locator("input[name='email']").fill(email);
    await form.locator("select[name='paese']").selectOption("AT");
    await form.locator("input[name='newsletter']").check();
    await attendi();
    await form.locator("button[type='submit']").click();
    await expect(form.locator("output")).toHaveText(
      `${f.catalogoConferma.replace("{email}", email)}${f.newsletterConferma}`,
      { timeout: 15_000 },
    );
    await expect.poll(async () => (await contattiPer(email)).length, { timeout: 10_000 }).toBe(1);
    expect((await contattiPer(email))[0]).toMatchObject({
      listIds: [21, 25],
      attributes: { SOURCE: "collezioni" },
    });
  });

  test("dopo l'invio la casella resta spuntata e non cambia; «Invia un’altra richiesta» la svuota", async ({
    page,
  }) => {
    await page.goto("/contatti");
    const form = await inviaContatti(page, unica("nl-blocco"), "IT", true);
    const casella = form.locator("input[name='newsletter']");
    await expect(casella).toBeChecked();
    await expect(casella).toHaveAttribute("aria-disabled", "true");
    // Aspetto di sempre: non `disabled`, che il browser disegna grigio.
    await expect(casella).not.toHaveAttribute("disabled", /.*/);

    await casella.click({ force: true });
    await expect(casella).toBeChecked();
    await form
      .locator("label:has(input[name='newsletter'])")
      // `force`: Playwright non clicca un'etichetta col controllo `aria-disabled`, una persona sì.
      .click({ position: { x: 200, y: 10 }, force: true });
    await expect(casella).toBeChecked();
    await casella.focus();
    await page.keyboard.press("Space");
    await expect(casella).toBeChecked();

    await form.getByRole("button", { name: f.nuovaRichiesta }).click();
    await expect(casella).not.toBeChecked();
    await expect(casella).not.toHaveAttribute("aria-disabled", /.*/);
    await casella.check();
    await expect(casella).toBeChecked();
  });
});
