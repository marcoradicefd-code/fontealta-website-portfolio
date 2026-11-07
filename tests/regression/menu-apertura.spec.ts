import { expect, test, type Browser, type Page } from "@playwright/test";

import { decodificaPng, luminanzaMedia, pixel } from "./helpers/png";
import { fermaVideoSulPoster } from "./helpers/video-fermo";

/**
 * Il menu mobile è FISSO e non abbaglia (PR di rifinitura, set 2026).
 *
 * Storia in tre tempi. Marco ha visto un lampo chiaro al tap sull'hamburger e mentre il
 * pannello scendeva. Primo giro: lo scrim della barra si smontava nello stesso commit del
 * tap (barra da luminanza 70 a 141 su Android, da 40 a 63 su iOS) e il pannello sfumava
 * col fondo; curati, e verdi qui a passi di 16 ms. Secondo giro: sull'iPhone vero il lampo
 * c'era ancora. Terzo: **Marco ha deciso il menu fisso**, senza rivelazione né discesa. Al
 * tap il pannello compare intero, alla chiusura sparisce di colpo: senza animazione non
 * esiste un fotogramma intermedio. Se il lampo restasse anche così, la causa è FUORI dal
 * pannello (tap highlight, header), e questo test lo dice per esclusione.
 *
 * Cosa custodisce, su ogni rotta con l'header trasparente:
 *   - il PRIMO fotogramma dopo il tap ha già il fondo d'inchiostro, dipinto;
 *   - i fotogrammi dopo sono identici al primo (nessuna animazione nascosta);
 *   - il primo fotogramma dopo la chiusura è già la pagina a riposo;
 *   - l'hamburger non prende mai un fondo.
 *
 * ⚠️ **L'OROLOGIO È FINTO, e deve esserlo.** `page.clock` controlla
 * `requestAnimationFrame`, `Date` e `performance.now`: il fotogramma «subito dopo il tap»
 * è davvero il commit di React da solo, e ogni passo da 16 ms è lo stesso a ogni
 * esecuzione.
 *
 * ⚠️ **Si campiona il COLORE DIPINTO, non lo stile calcolato.** Nel primo giro lo stile
 * diceva `rgb(11, 18, 21)` in ogni fotogramma anche quando la foto passava attraverso il
 * pannello: era l'opacità. La guardia strutturale resta, ma quella che custodisce
 * l'abbaglio è la luminanza misurata sullo screenshot.
 *
 * ⚠️ **Gira su Chromium E su WebKit** (progetto `webkit-menu` nella config): il `:hover`
 * che resta attaccato dopo un tocco esiste solo su WebKit.
 *
 * Controprova del primo giro (17/09/2026), contro la produzione a `25b9492`: rossa su tutte
 * e quattro le rotte e su entrambi i motori, anche con la sola luminanza (barra al tap da 73
 * a 149 sulla home in Chromium). Controprova del menu fisso (17/09/2026), questa spec
 * contro il pannello a clip-path del secondo giro (`ebcea2d`): rossa su tutte e quattro le
 * rotte e su entrambi i motori, al controllo sul clip. E rossa anche togliendo ogni
 * controllo strutturale e il colore del fondo, cioè con la sola luminanza (provato su
 * Chromium): i fotogrammi dopo il primo non sono il primo, perché il pannello si rivela.
 * A +16 ms la barra passava da 78,6 a 25,4 sulla home, e /produzione a +32 ms.
 */

const ROTTE_TRASPARENTI = ["/", "/collezioni", "/chi-siamo", "/produzione"];
const INCHIOSTRO: [number, number, number] = [11, 18, 21];
/** Tolleranza sulla luminanza: la compressione e l'antialias muovono di 1-2 livelli. */
const TOLLERANZA = 3;

async function apri(browser: Browser, browserName: string, rotta: string) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    // `isMobile` esiste solo su Chromium: su WebKit Playwright lo rifiuta.
    isMobile: browserName === "chromium",
    reducedMotion: "no-preference",
    locale: "it-IT",
  });
  const page = await ctx.newPage();
  await page.clock.install();
  await page.goto(rotta);
  // Idratato: Lenis aggiunge la sua classe a <html> quando il provider monta.
  await page.waitForFunction(() => document.documentElement.classList.contains("lenis"));
  // Solo le immagini dentro lo schermo: quelle pigre più in basso non si caricano
  // mai finché non si scorre, e aspettarle blocca il test fino al timeout.
  await page.waitForFunction(
    () =>
      [...document.images]
        // Solo quelle visualizzate: un’immagine nascosta (la facciata di /produzione sotto 1024 px, 27/10/2026)
        // ha il rettangolo a zero, quindi «in cima», e non si carica mai.
        .filter((i) => i.getClientRects().length > 0 && i.getBoundingClientRect().top < innerHeight)
        .every((i) => i.complete),
    null,
    { polling: 200 },
  );
  // Il video dell'hero cambia luminanza da solo: fermo sul poster, si misura solo il menu.
  await fermaVideoSulPoster(page);
  const adesso = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(adesso + 1000);
  return { ctx, page };
}

/** Barra (0-64) e fascia sotto la barra (64-320), dallo screenshot. */
async function campiona(page: Page) {
  const img = decodificaPng(
    await page.screenshot({ clip: { x: 0, y: 0, width: 390, height: 320 } }),
  );
  return {
    barra: luminanzaMedia(img, 0, 0, 390, 64),
    fascia: luminanzaMedia(img, 0, 64, 390, 320),
    // Fra il wordmark (finisce a ~200) e l'hamburger (parte a ~322): fondo puro.
    fondoBarra: pixel(img, 280, 32),
  };
}

const stato = (page: Page) =>
  page.evaluate(() => {
    const pannello = document.querySelector<HTMLElement>("div.overscroll-contain");
    const hamburger = document.querySelector<HTMLElement>(
      "header nav > button:not([aria-haspopup])",
    );
    if (!pannello || !hamburger) throw new Error("pannello o hamburger non trovati");
    const p = getComputedStyle(pannello);
    return {
      visibile: p.visibility !== "hidden",
      clip: p.clipPath,
      opacita: p.opacity,
      fondo: p.backgroundColor,
      fondoHamburger: getComputedStyle(hamburger).backgroundColor,
    };
  });

const PASSI = 10;

for (const rotta of ROTTE_TRASPARENTI) {
  test(`${rotta}: il menu fisso compare già scuro e sparisce di colpo`, async ({
    browser,
    browserName,
  }) => {
    const { ctx, page } = await apri(browser, browserName, rotta);
    const hamburger = page.locator("header nav > button:not([aria-haspopup])");
    const riposo = await campiona(page);
    expect((await stato(page)).fondoHamburger, "l'hamburger non deve avere un fondo").toBe(
      "rgba(0, 0, 0, 0)",
    );

    // APERTURA · il commit del tap, prima di qualunque fotogramma.
    await hamburger.tap();
    const aperto = await campiona(page);
    const s = await stato(page);
    expect(s.visibile, "al primo fotogramma il pannello è già visibile").toBe(true);
    expect(s.opacita, "e opaco").toBe("1");
    expect(s.fondo).toBe("rgb(11, 18, 21)");
    expect(s.clip, "nessuna rivelazione a clip-path").toBe("none");
    for (const [i, v] of aperto.fondoBarra.entries())
      expect(
        Math.abs(v - INCHIOSTRO[i]),
        `apertura: fondo della barra ${aperto.fondoBarra.join(",")} al primo fotogramma`,
      ).toBeLessThanOrEqual(TOLLERANZA);
    expect(s.fondoHamburger, "l'hamburger non prende un fondo al tocco").toBe("rgba(0, 0, 0, 0)");
    // Nessuna animazione nascosta: i fotogrammi dopo sono il primo.
    for (let passo = 1; passo <= PASSI; passo++) {
      await page.clock.runFor(16);
      const c = await campiona(page);
      expect(
        Math.abs(c.barra - aperto.barra),
        `apertura +${passo * 16} ms: barra ${c.barra.toFixed(1)} contro ${aperto.barra.toFixed(1)}`,
      ).toBeLessThanOrEqual(TOLLERANZA);
      expect(
        Math.abs(c.fascia - aperto.fascia),
        `apertura +${passo * 16} ms: fascia ${c.fascia.toFixed(1)} contro ${aperto.fascia.toFixed(1)}`,
      ).toBeLessThanOrEqual(TOLLERANZA);
    }

    // CHIUSURA · il primo fotogramma è già la pagina a riposo.
    await hamburger.tap();
    const chiuso = await campiona(page);
    expect((await stato(page)).visibile, "alla chiusura il pannello sparisce subito").toBe(false);
    for (let passo = 0; passo <= PASSI / 2; passo++) {
      if (passo) await page.clock.runFor(16);
      const c = passo ? await campiona(page) : chiuso;
      expect(
        Math.abs(c.barra - riposo.barra),
        `chiusura +${passo * 16} ms: barra ${c.barra.toFixed(1)} contro riposo ${riposo.barra.toFixed(1)}`,
      ).toBeLessThanOrEqual(TOLLERANZA);
      expect(
        Math.abs(c.fascia - riposo.fascia),
        `chiusura +${passo * 16} ms: fascia ${c.fascia.toFixed(1)} contro riposo ${riposo.fascia.toFixed(1)}`,
      ).toBeLessThanOrEqual(TOLLERANZA);
    }
    expect((await stato(page)).fondoHamburger, "l'hamburger non resta con un fondo").toBe(
      "rgba(0, 0, 0, 0)",
    );
    await ctx.close();
  });
}

test("cinque aperture e chiusure senza spostamenti di layout", async ({ browser, browserName }) => {
  const { ctx, page } = await apri(browser, browserName, "/");
  await page.evaluate(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as Array<{
        value: number;
        hadRecentInput: boolean;
      }>)
        w.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: false });
  });
  const hamburger = page.locator("header nav > button:not([aria-haspopup])");
  for (let giro = 0; giro < 5; giro++) {
    await hamburger.tap();
    await page.clock.runFor(600);
    await expect(hamburger).toHaveAttribute("aria-expanded", "true");
    await hamburger.tap();
    await page.clock.runFor(600);
    await expect(hamburger).toHaveAttribute("aria-expanded", "false");
    // Chiuso davvero: fuori dal fuoco e dall'interazione.
    expect(
      (await stato(page)).visibile,
      `giro ${giro + 1}: il pannello chiuso resta visibile`,
    ).toBe(false);
  }
  // ⚠️ `layout-shift` esiste solo su Chromium: su WebKit la somma resta 0 per
  // assenza di voci, non per misura, e il test lo dice invece di fingere.
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  if (browserName === "chromium") expect(cls, "spostamenti di layout aprendo e chiudendo").toBe(0);
  await ctx.close();
});
