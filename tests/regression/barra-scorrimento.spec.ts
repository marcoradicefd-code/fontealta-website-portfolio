import { expect, test, type Browser, type Page } from "@playwright/test";

import { decodificaPng, luminanzaMedia } from "./helpers/png";
import { fermaVideoSulPoster } from "./helpers/video-fermo";

/**
 * La barra della nav SFUMA alla soglia di scorrimento, e non si accende mai (16/10/2026).
 *
 * Sulle quattro rotte con l'header trasparente, superati i 10 px la barra passa da
 * trasparente a inchiostro al 90% con `backdrop-filter`, in 300 ms (`transition-all` sull'
 * header): la dissolvenza è voluta, decisione di Marco dopo la prova di un cambio di colpo.
 * Il difetto era sotto `xl`: lo scrim si SMONTAVA nel commit della soglia mentre il fondo
 * partiva da alfa 0, e al primo fotogramma la barra diventava più CHIARA di com'era (390,
 * home: luminanza 93 → 156) prima di scendere; tornando su, lo scrim tornava di colpo e la
 * barra scendeva sotto il nero di regime prima di risalire. Ora lo scrim resta montato e
 * sfuma con il fondo.
 *
 * Cosa custodisce, a 1440 e a 390, su Chromium E su WebKit (progetto `webkit-barra`):
 *   - scendendo, nessun fotogramma più chiaro di quello prima della soglia;
 *   - salendo, nessun fotogramma più scuro della barra a regime;
 *   (3 livelli di tolleranza) e lo scrim ancora montato dopo la soglia.
 *
 * ⚠️ COME SI CAMPIONA. Le transizioni CSS corrono a tempo vero anche con l'orologio finto
 * (rule `misure-e-test`), e uno screenshot dopo l'altro ne coglie pochi fotogrammi, a caso.
 * Qui si prendono le transizioni di header e scrim con `getAnimations()`, si mettono in
 * pausa e si portano a 0, 16, 32 … 300 ms con `currentTime`: ogni scatto è lo stesso
 * istante a ogni esecuzione, su tutti e due i motori. Il commit della soglia si aspetta con
 * un `MutationObserver` sulla classe dell'header, e lo stile si forza subito dentro, così le
 * transizioni esistono già prima del primo fotogramma.
 */

const ROTTE_TRASPARENTI = ["/", "/collezioni", "/chi-siamo", "/produzione"];
/** Tolleranza sulla luminanza: la compressione e l'antialias muovono di 1-2 livelli. */
const TOLLERANZA = 3;
/**
 * Un pixel oltre la soglia (`scrollY > 10`). Con 40 la foto sotto la barra si spostava di 40
 * px e il confronto col riposo misurava anche quello: a 390 sulla home il fotogramma 0, col
 * fondo ancora ad alfa 0, era già 76 contro 93.
 */
const SOGLIA_SUPERATA = 11;
const DURATA = 300;
const PASSO = 16;

async function apri(browser: Browser, width: number, height: number, rotta: string) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
    locale: "it-IT",
  });
  const page = await ctx.newPage();
  await page.clock.install();
  await page.goto(rotta);
  // Idratato: Lenis aggiunge la sua classe a <html> quando il provider monta.
  await page.waitForFunction(() => document.documentElement.classList.contains("lenis"));
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
  // Il video dell'hero cambia luminanza da solo: fermo sul poster, si misura solo la barra.
  await fermaVideoSulPoster(page);
  const adesso = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(adesso + 1000);
  return { ctx, page };
}

async function barra(page: Page, width: number) {
  const img = decodificaPng(await page.screenshot({ clip: { x: 0, y: 0, width, height: 64 } }));
  return luminanzaMedia(img, 0, 0, width, 64);
}

/**
 * Scorre a `y`, aspetta il commit che cambia la classe dell'header e mette in pausa a 0 le
 * transizioni di header e scrim. Restituisce quante sono.
 */
async function superaSoglia(page: Page, y: number) {
  return page.evaluate(
    (y) =>
      new Promise<number>((fatto) => {
        const h = document.querySelector("header")!;
        const prima = h.className;
        new MutationObserver((_, o) => {
          if (h.className === prima) return;
          o.disconnect();
          const scrim = document.querySelector<HTMLElement>(".fa-nav-scrim");
          // Forza lo stile: le transizioni nascono qui, prima del primo fotogramma.
          void getComputedStyle(h).backgroundColor;
          if (scrim) void getComputedStyle(scrim).opacity;
          // L'header E quel che c'è dentro: alla soglia si spegne anche `.fa-nav-chiara`, e
          // le voci e le pill hanno il loro `transition-colors`.
          const anim = document.getAnimations().filter((a) => {
            const t = (a.effect as KeyframeEffect | null)?.target;
            return t === scrim || (t instanceof Node && h.contains(t));
          });
          for (const a of anim) {
            a.pause();
            a.currentTime = 0;
          }
          (window as unknown as { __barra: Animation[] }).__barra = anim;
          fatto(anim.length);
        }).observe(h, { attributes: true, attributeFilter: ["class"] });
        window.scrollTo(0, y);
      }),
    y,
  );
}

/** Luminanza della barra a 0, 16, 32 … 300 ms della transizione, e alla fine. */
async function fotogrammi(page: Page, width: number) {
  const out: { t: number; barra: number }[] = [];
  for (let t = 0; t <= DURATA; t += PASSO) {
    await page.evaluate((t) => {
      for (const a of (window as unknown as { __barra: Animation[] }).__barra) a.currentTime = t;
    }, t);
    out.push({ t, barra: await barra(page, width) });
  }
  await page.evaluate(() => {
    for (const a of (window as unknown as { __barra: Animation[] }).__barra) a.finish();
  });
  out.push({ t: DURATA + PASSO, barra: await barra(page, width) });
  return out;
}

const scrimMontato = (page: Page) =>
  page.evaluate(() => document.querySelectorAll(".fa-nav-scrim").length);

for (const [width, height] of [
  [1440, 900],
  [390, 844],
] as const) {
  for (const rotta of ROTTE_TRASPARENTI) {
    test(`${rotta} a ${width}: la barra sfuma senza accendersi, in giù e in su`, async ({
      browser,
    }) => {
      const { ctx, page } = await apri(browser, width, height, rotta);
      const riposo = await barra(page, width);

      // SCENDENDO · nessun fotogramma più chiaro di quello prima della soglia.
      expect(await superaSoglia(page, SOGLIA_SUPERATA), "la barra sfuma").toBeGreaterThan(0);
      expect(await scrimMontato(page), "lo scrim resta montato").toBe(1);
      const giu = await fotogrammi(page, width);
      for (const f of giu)
        expect(
          f.barra,
          `in giù a ${f.t} ms: barra ${f.barra.toFixed(1)}, prima della soglia ${riposo.toFixed(1)}`,
        ).toBeLessThanOrEqual(riposo + TOLLERANZA);
      const regime = giu.at(-1)!.barra;
      expect(regime, "a regime la barra è più scura che a riposo").toBeLessThan(riposo);

      // SALENDO · nessun fotogramma più scuro della barra a regime.
      expect(await superaSoglia(page, 0), "la barra sfuma").toBeGreaterThan(0);
      const su = await fotogrammi(page, width);
      for (const f of su)
        expect(
          f.barra,
          `in su a ${f.t} ms: barra ${f.barra.toFixed(1)}, a regime ${regime.toFixed(1)}`,
        ).toBeGreaterThanOrEqual(regime - TOLLERANZA);
      expect(
        Math.abs(su.at(-1)!.barra - riposo),
        `tornata su, la barra è quella di partenza (${su.at(-1)!.barra.toFixed(1)} contro ${riposo.toFixed(1)})`,
      ).toBeLessThanOrEqual(TOLLERANZA);
      await ctx.close();
    });
  }
}
