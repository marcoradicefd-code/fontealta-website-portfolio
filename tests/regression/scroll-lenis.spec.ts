import { test, expect, type Page } from "@playwright/test";

/**
 * Regressione scroll-Lenis (fix aa4c05f). Due meccanismi, due assert deterministici.
 *
 * ⚠️ TEST A MECCANISMO, NON A RIPRODUZIONE — leggere prima di "semplificare".
 * La race cold-cache non è riproducibile deterministicamente in headless: Lenis
 * monta a contenuto già settled → il suo `resize()` iniziale legge l'altezza piena
 * e il limite è corretto, con o senza fix (un test-race qui è "teatro verde", passa
 * anche SENZA il fix — dimostrato con checkout aa4c05f^). Ciò che va CUSTODITO è il
 * MECCANISMO: (a) il limite Lenis traccia la crescita del body DOPO il mount, e
 * (b) il carousel riserva la sua altezza post-init. Perciò:
 *  - Test (a) FORZA la causa (appende contenuto al body post-mount) e verifica che
 *    il limite la tracci → fail SENZA la cintura `ResizeObserver(document.body)`,
 *    pass CON. NON re-introdurre un test-race: è già stato dimostrato invalido.
 *  - Test (b) verifica la min-height riservata del carousel → deterministico, warm,
 *    indipendente dalla race.
 *
 * Richiede il build con NEXT_PUBLIC_E2E=1 (espone window.__lenis) → `pnpm test:e2e`.
 */

// Slow-3G-like — via CDP Network.emulateNetworkConditions (Chromium-only). Cornice
// "cold": non è ciò che rende valido il test (lo è la crescita forzata), ma tiene
// il contesto vicino alla condizione del cliente.
const SLOW_3G = {
  offline: false,
  latency: 400,
  downloadThroughput: 50 * 1024,
  uploadThroughput: 20 * 1024,
};

declare global {
  interface Window {
    __lenis?: {
      limit: number;
      /** `false` a riposo, `"smooth"` durante uno scrollTo programmatico. Un
       *  valore che resta `"smooth"` a lungo dopo il clic = animazione abortita. */
      isScrolling: boolean | string;
      scrollTo: (target: number, opts?: { immediate?: boolean }) => void;
    };
    /** Campionamento di scrollY frame per frame, armato dai test degli anchor. */
    __ys?: number[];
  }
}

/** Attende che document.scrollHeight resti stabile per `quietMs`, o fino a `maxWaitMs`.
 *  Polling; nessuna asserzione sul tempo. */
async function waitForScrollHeightQuiet(page: Page, quietMs = 2500, maxWaitMs = 60_000) {
  await page.evaluate(
    ({ quietMs, maxWaitMs }) =>
      new Promise<void>((resolve) => {
        const start = Date.now();
        let last = document.documentElement.scrollHeight;
        let stableSince = Date.now();
        const iv = setInterval(() => {
          const h = document.documentElement.scrollHeight;
          if (h !== last) {
            last = h;
            stableSince = Date.now();
          }
          if (Date.now() - stableSince >= quietMs || Date.now() - start >= maxWaitMs) {
            clearInterval(iv);
            resolve();
          }
        }, 200);
      }),
    { quietMs, maxWaitMs },
  );
}

// (a) CINTURA — il limite Lenis traccia la crescita tardiva del body.
test("cintura: il limite Lenis traccia la crescita del body post-mount (no stale)", async ({
  page,
  context,
}) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", SLOW_3G);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".fa-coverflow .swiper-initialized", { timeout: 90_000 });
  await page.waitForFunction(() => typeof window.__lenis?.limit === "number", null, {
    timeout: 30_000,
  });
  await waitForScrollHeightQuiet(page);

  const beforeRealMax = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );

  // CRESCITA TARDIVA DETERMINISTICA: appende contenuto al body DOPO che Lenis ha
  // misurato → riproduce la causa (pagina che cresce dopo la misura) senza dipendere
  // dalla race di timing del load reale.
  const GROW = 1500;
  const afterRealMax = await page.evaluate((grow) => {
    const d = document.createElement("div");
    d.id = "__e2e_grow";
    d.setAttribute("aria-hidden", "true");
    d.style.height = `${grow}px`;
    document.body.appendChild(d);
    return document.documentElement.scrollHeight - window.innerHeight;
  }, GROW);

  // Guardia setup: la crescita è entrata davvero nel DOM.
  expect(afterRealMax, "la crescita forzata deve aumentare scrollHeight").toBeGreaterThan(
    beforeRealMax + GROW - 50,
  );

  // ASSERZIONE CAUSA (poll, nessuno sleep fisso): il limite Lenis traccia la crescita.
  // Senza la cintura ResizeObserver(document.body) il limite resta stale (< afterRealMax):
  // la window `resize` non scatta (viewport invariato) e il ResizeObserver di Lenis su
  // documentElement è cieco alla crescita del contenuto sotto `html{height:100%}`.
  await expect
    .poll(() => page.evaluate(() => window.__lenis?.limit ?? -1), {
      timeout: 8_000,
      message: "il limite Lenis deve tracciare la crescita del body (no stale)",
    })
    .toBeGreaterThanOrEqual(afterRealMax - 2);

  // ASSERZIONE SINTOMO: scroll fino al nuovo fondo → window.scrollY deve arrivarci.
  await page.evaluate((max) => window.__lenis?.scrollTo(max, { immediate: true }), afterRealMax);
  await expect
    .poll(() => page.evaluate(() => Math.round(window.scrollY)), {
      timeout: 30_000,
      message: "window.scrollY deve raggiungere il nuovo fondo reale",
    })
    .toBeGreaterThanOrEqual(afterRealMax - 2);
});

// (b) CAROUSEL — l'altezza post-init non scende sotto la min-height riservata.
test("carousel: l'altezza post-init rispetta la min-height riservata (no crescita post-render)", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".fa-coverflow .swiper-initialized", { timeout: 60_000 });

  const { offsetHeight, cssMinHeight } = await page.evaluate(() => {
    const el = document.querySelector(".fa-coverflow") as HTMLElement | null;
    if (!el) return { offsetHeight: 0, cssMinHeight: 0 };
    const min = parseFloat(getComputedStyle(el).minHeight) || 0;
    return { offsetHeight: Math.round(el.offsetHeight), cssMinHeight: Math.round(min) };
  });

  // Part (b) del fix: senza la min-height riservata questo è 0 → fallisce qui.
  expect(cssMinHeight, "il carousel deve riservare una min-height (>0)").toBeGreaterThan(0);
  // Post-init combacia con la riserva → SSR e post-init allineati, niente crescita.
  expect(
    offsetHeight,
    "l'altezza post-init non deve scendere sotto la min-height riservata",
  ).toBeGreaterThanOrEqual(cssMinHeight - 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// ANCHOR INTERNI — gestore unico nel LenisProvider (fix 31/08/2026).
//
// `anchors: true` di Lenis chiamava `scrollTo` senza `preventDefault`: l'azione
// predefinita del link restava viva e, al SECONDO clic sullo stesso frammento,
// abortiva l'animazione dopo un frame (misurato: 349 px su 3594, 10/10 desktop
// e mobile). Questi tre test custodiscono il MECCANISMO del fix, non l'aneddoto.
// ─────────────────────────────────────────────────────────────────────────────

const CTA = 'a[href="#progettare"]';

/** Riporta in cima con la ROTELLA: dev'essere un gesto vero, che Lenis consuma.
 *  Un `window.scrollTo(0,0)` lascerebbe lo stato interno di Lenis dov'era. */
async function conLaRotellaInCima(page: Page) {
  for (let i = 0; i < 40; i++) {
    if ((await page.evaluate(() => Math.round(window.scrollY))) === 0) break;
    await page.mouse.wheel(0, -1200);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(400);
}

/** L'altezza della nav fissa, letta da `--fa-nav-h`: la stessa fonte che usano
 *  l'header, lo `scroll-margin-top` dei bersagli e l'offset del provider. Letta e
 *  non scritta 64, altrimenti il test smetterebbe di custodire il token. */
const altezzaNav = (page: Page) =>
  page.evaluate(() =>
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fa-nav-h")),
  );

const rectTop = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? Math.round(el.getBoundingClientRect().top) : Number.NaN;
  }, sel);

/** Dove DEVE fermarsi il bordo alto del bersaglio, dopo il salto.
 *
 *  Regola, non costante: lo scroll si ferma a `docTop − nav`, ma non può essere
 *  negativo. Quindi il bordo atterra a `nav` per un bersaglio abbastanza in basso
 *  (#progettare, docTop 3594 → 64) e a `docTop` per uno in cima, dove lo scroll è
 *  già a zero e non c'è niente sopra da scoprire (#main-content, docTop 0 → 0).
 *  Scriverlo come regola tiene il test onesto su entrambi i bersagli. */
const atterraggioAtteso = (docTop: number, nav: number) => Math.min(nav, Math.max(0, docTop));

const docTop = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : Number.NaN;
  }, sel);

/**
 * Aspetta che Lenis sia FERMO, invece di aspettare un tempo fisso.
 *
 * ⚠️ Prima qui c'era `waitForTimeout(1500)`, e quel numero era una moneta
 * lanciata. Misurato il 9/09/2026 sullo stesso build: l'animazione verso
 * `#progettare` si ferma dopo **1475 ms sulla home inglese** e **1613 ms su
 * quella italiana**. Il test passava per **25 millisecondi**, e passava
 * sull'inglese perché `localeDetection` era acceso e mandava Playwright, che
 * chiede `Accept-Language: en-US`, da `/` a `/en` senza che il test lo sapesse.
 * Spento quel redirect (PR SEO), il test ha cominciato a misurare l'italiano e
 * il margine non c'era più.
 *
 * L'asserzione NON si indebolisce, si rimette a fuoco: quello che deve valere è
 * «l'animazione prima o poi finisce», perché la firma del bug è `isScrolling`
 * che resta `"smooth"` **per sempre**. «Ferma esattamente a 1500 ms» era un
 * accidente della durata, non l'invariante. Il tetto a 5 s tiene il test capace
 * di fallire davvero.
 */
async function attendiLenisFermo(page: Page, max = 5000) {
  const scaduto = Date.now() + max;
  while (Date.now() < scaduto) {
    if ((await page.evaluate(() => String(window.__lenis?.isScrolling))) === "false") return;
    await page.waitForTimeout(50);
  }
}

// (a) DOPPIO CLIC + ATTERRAGGIO — il secondo clic deve arrivare come il primo, e
// tutti e due devono fermarsi SOTTO la nav, non dietro.
test("anchor: due clic di fila arrivano al form, e atterrano sotto la nav", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1200); // idratazione + mount del provider
  const nav = await altezzaNav(page);
  expect(nav, "--fa-nav-h non è leggibile").toBeGreaterThan(0);
  const atteso = atterraggioAtteso(await docTop(page, "#progettare"), nav);
  expect(atteso, "#progettare è troppo in alto per poter atterrare sotto la nav").toBe(nav);

  await page.locator(CTA).first().click();
  await attendiLenisFermo(page);
  expect(Math.abs((await rectTop(page, "#progettare")) - atteso), "primo clic").toBeLessThanOrEqual(
    1,
  );

  await conLaRotellaInCima(page);
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);

  await page.locator(CTA).first().click();
  await attendiLenisFermo(page);
  expect(
    Math.abs((await rectTop(page, "#progettare")) - atteso),
    "secondo clic",
  ).toBeLessThanOrEqual(1);

  // La firma dell'animazione abortita: `isScrolling` che resta "smooth" per
  // sempre. A riposo Lenis torna `false`.
  expect(await page.evaluate(() => String(window.__lenis?.isScrolling))).toBe("false");

  // MATRICE dell'atterraggio: due percorsi × due viewport, stesso punto.
  // - animato = il gestore del provider, `offset: -altezzaNav()`
  // - nativo  = prefers-reduced-motion, il provider NON intercetta e comanda
  //             lo `scroll-margin-top` del bersaglio
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    for (const percorso of ["no-preference", "reduce"] as const) {
      await page.setViewportSize(vp);
      await page.emulateMedia({ reducedMotion: percorso });
      await page.goto("/");
      await page.waitForTimeout(1200);
      const h = await altezzaNav(page);
      const att = atterraggioAtteso(await docTop(page, "#progettare"), h);
      await page.locator(CTA).first().click();
      await page.waitForTimeout(1500);
      const top = await rectTop(page, "#progettare");
      expect(
        Math.abs(top - att),
        `${vp.width}px · ${percorso === "reduce" ? "nativo" : "animato"}: rect.top=${top}, atteso=${att}, nav=${h}`,
      ).toBeLessThanOrEqual(1);
    }
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
});

// (b) NIENTE SOBBALZO — senza il fix il salto nativo portava la pagina a
// destinazione e Lenis la riportava INDIETRO (misurato: scrollY già 3594 e Lenis
// che chiede 994) per poi ri-scendere.
//
// ⚠️ NON si misura campionando scrollY a ogni frame: salto nativo e correzione di
// Lenis cadono nello STESSO frame, il campionatore vede solo il valore finale e il
// test passa anche senza il fix — verificato, era teatro verde. Si misura invece
// alla sorgente: ogni chiamata a `window.scrollTo`, con la posizione in cui la
// pagina si trova NEL MOMENTO della chiamata.
test("anchor: il primo clic non chiede mai di tornare indietro", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    window.__ys = [];
    // `scrollTo` ha due overload (options | x,y): si passa da `unknown[]`, altrimenti
    // lo spread non tipizza.
    const orig = window.scrollTo.bind(window) as (...args: unknown[]) => void;
    window.scrollTo = ((...a: unknown[]) => {
      const o = a[0];
      const top = o && typeof o === "object" && "top" in o ? (o as ScrollToOptions).top : undefined;
      // Positivo = ci stanno chiedendo di risalire rispetto a dove siamo ORA.
      if (typeof top === "number") window.__ys!.push(Math.round(window.scrollY - top));
      return orig(...a);
    }) as typeof window.scrollTo;
  });

  await page.locator(CTA).first().click();
  await page.waitForTimeout(2100);

  const richieste = await page.evaluate(() => window.__ys ?? []);
  expect(richieste.length, "Lenis non ha scritto nulla").toBeGreaterThan(30);
  // Tolleranza 2 px: arrotondamenti. Il difetto valeva ~2600 px.
  const indietro = richieste.filter((d) => d > 2);
  expect(indietro, `richieste all'indietro: ${indietro.slice(0, 5).join(", ")}`).toHaveLength(0);
  const nav = await altezzaNav(page);
  const atteso = atterraggioAtteso(await docTop(page, "#progettare"), nav);
  expect(Math.abs((await rectTop(page, "#progettare")) - atteso)).toBeLessThanOrEqual(1);
});

// (c) SKIP LINK — lo scroll non basta: senza il focus la pagina si sposta ma la
// navigazione da tastiera riparte dalla nav, cioè lo skip link non «salta».
test("anchor: lo skip link porta lo scroll E il focus dentro il main", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1200);

  // Si parte scrollati, così l'assert sullo scroll ha qualcosa da dimostrare.
  await page.mouse.wheel(0, 1500);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(500);

  await page.keyboard.press("Tab"); // dal body il primo tabulabile è lo skip link
  await expect(page.locator("a.skip-to-content")).toBeFocused();
  // UN FRAME fra Tab ed Enter. Non è un trucco per il verde: è la sequenza reale.
  // Con Enter nello STESSO frame del cambio di focus lo scroll sbaglia a
  // intermittenza (misurata la curva: 0 ms intermittente su 1440/1280/390, 16 ms
  // corretto 15 su 15, idem a 50/100/250). Due tasti a meno di un frame non sono
  // un utente, e senza questa attesa il test misurerebbe il banco, non il sito.
  await page.waitForTimeout(16);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);

  expect(await page.evaluate(() => document.activeElement?.id)).toBe("main-content");
  // #main-content sta a docTop 0: lo scroll è già a zero e sopra non c'è niente da
  // scoprire, quindi la regola dà 0, non 64.
  const nav = await altezzaNav(page);
  const atteso = atterraggioAtteso(await docTop(page, "#main-content"), nav);
  expect(Math.abs((await rectTop(page, "#main-content")) - atteso)).toBeLessThanOrEqual(1);
});
