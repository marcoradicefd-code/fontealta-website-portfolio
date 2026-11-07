import { expect, test } from "@playwright/test";

/**
 * La mappa di Google in `/contatti` non imposta cookie: è l'affermazione della cookie
 * policy («nella configurazione adottata la mappa non imposta cookie», misurata il
 * 16/09/2026), ed è la ragione per cui il sito non ha un banner di consenso.
 *
 * ⚠️ **Se questo test diventa rosso, non si «aggiusta» il test: serve il banner.**
 * Vuol dire che Google ha cambiato comportamento, e la cookie policy dice che in quel
 * caso il consenso si chiede prima di caricare la mappa.
 *
 * ⚠️ Lo zero va dimostrato non vuoto: il test pretende prima che la mappa abbia
 * davvero parlato con Google. Uno zero misurato su un iframe mai caricato resterebbe
 * verde anche il giorno che la mappa imposta cookie.
 */
test("la mappa di /contatti non imposta cookie di terze parti", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const sito = new URL(baseURL ?? "http://localhost:3000").hostname;

  let richiesteGoogle = 0;
  page.on("request", (req) => {
    if (/(^|\.)google(apis)?\.com$|(^|\.)gstatic\.com$/.test(new URL(req.url()).hostname))
      richiesteGoogle++;
  });

  await page.goto("/contatti");
  const mappa = page.locator('iframe[src*="google.com/maps"]');
  await mappa.scrollIntoViewIfNeeded();
  await expect.poll(() => richiesteGoogle, { timeout: 30_000 }).toBeGreaterThan(5);
  // Lascia finire il caricamento della mappa: i cookie arrivano con le risposte.
  await page.waitForLoadState("networkidle");

  const terzi = (await context.cookies())
    .filter((c) => !c.domain.replace(/^\./, "").endsWith(sito))
    .map((c) => `${c.name} @ ${c.domain}`);
  expect(terzi, "cookie di terze parti: la cookie policy e il banner vanno rivisti").toEqual([]);
  await context.close();
});

/**
 * I cookie che la cookie policy elenca, e nessun altro (17/09/2026, con Vercel Web
 * Analytics, che si dichiara senza cookie). `NEXT_LOCALE` lo imposta il server a ogni
 * risposta; i due di anteprima li imposta lo Studio solo a chi modifica i contenuti.
 *
 * ⚠️ **Se questo test diventa rosso per un cookie nuovo, non si allarga l'elenco:
 * serve il banner**, oppure si toglie lo strumento che l'ha portato. L'elenco si tocca
 * solo insieme alla cookie policy, nella stessa PR.
 *
 * ⚠️ Lo zero va dimostrato non vuoto anche qui: il test pretende `NEXT_LOCALE`, cioè
 * la prova che il barattolo dei cookie è stato letto dopo risposte vere del sito.
 */
const COOKIE_AMMESSI = ["NEXT_LOCALE", "__prerender_bypass", "sanity-preview-perspective"];

// `/officina` (27/10/2026): la tavola nell'iframe è dello stesso sito, e i suoi cookie
// stanno nello stesso barattolo. Lì il footer non c'è: si naviga col logo dell'header.
for (const percorso of ["/", "/contatti", "/de/kollektionen", "/officina"]) {
  test(`${percorso}: solo i cookie dichiarati, dopo 10 s e una navigazione`, async ({
    browser,
    baseURL,
  }) => {
    // Contesto nuovo per pagina: `NEXT_LOCALE` sopravvive alle navigazioni.
    const context = await browser.newContext();
    const page = await context.newPage();
    const sito = new URL(baseURL ?? "http://localhost:3000").hostname;

    expect((await page.goto(percorso))?.status()).toBe(200);
    await page.waitForLoadState("networkidle");
    // Permanenza, non sincronizzazione: uno script può impostare un cookie a tempo,
    // e la cookie policy parla di quello che resta a chi sta sulla pagina.
    await page.waitForTimeout(10_000);

    // La navigazione passa dal footer, che c'è a ogni larghezza: il menu del
    // desktop compare solo da `xl`.
    const partenza = new URL(page.url()).pathname;
    const contenitore = (await page.locator("footer").isVisible()) ? "footer" : "header";
    const destinazione = await page
      .locator(`${contenitore} a[href^="/"]`)
      .evaluateAll(
        (link, attuale) =>
          link
            .map((a) => a.getAttribute("href") ?? "")
            .find((h) => h !== attuale && !h.includes("#")),
        partenza,
      );
    expect(destinazione, `un link interno in ${contenitore}`).toBeTruthy();
    await page.locator(`${contenitore} a[href="${destinazione}"]`).first().click();
    await page.waitForURL((u) => u.pathname !== partenza);
    await page.waitForLoadState("networkidle");

    const cookie = await context.cookies();
    expect(cookie.map((c) => c.name)).toContain("NEXT_LOCALE");
    const nonDichiarati = cookie
      .filter(
        (c) => !COOKIE_AMMESSI.includes(c.name) || !c.domain.replace(/^\./, "").endsWith(sito),
      )
      .map((c) => `${c.name} @ ${c.domain}`);
    expect(
      nonDichiarati,
      "cookie non dichiarati: la cookie policy e il banner vanno rivisti",
    ).toEqual([]);
    await context.close();
  });
}
