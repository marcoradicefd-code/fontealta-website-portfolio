import { expect, test, type Page } from "@playwright/test";

/**
 * La rotella nei contenitori che scorrono per conto loro (16/10/2026).
 *
 * Lenis (`smoothWheel: true`) prende ogni evento `wheel` della finestra, chiama
 * `preventDefault` e anima la finestra da script: il pannello sotto il puntatore non
 * scorre, e la pagina sotto sì, anche col `body` a `overflow: hidden`. Misurato su `main`
 * a 1024×600: menu fermo, pagina 400 → 698; foglio dei filtri fermo, pagina 900 → 1198.
 * La cura è `data-lenis-prevent`, che fa uscire Lenis prima del `preventDefault`
 * (`lenis.mjs:605-612`): la rotella torna nativa.
 *
 * Custodisce, col mouse vero:
 *   - menu hamburger aperto, lingue espanse: il pannello scorre, la pagina no;
 *   - foglio dei filtri: il corpo scorre, e con il puntatore sullo SFONDO del `<dialog>`
 *     la pagina non si muove;
 *   - chiusi menu e foglio, la rotella sulla pagina passa di nuovo da Lenis.
 *
 * Richiede il build E2E (`window.__lenis`) → `pnpm test:e2e`.
 */

type ConLenis = {
  __lenis?: {
    isScrolling: unknown;
    on: (e: string, f: (l: { isScrolling: unknown }) => void) => void;
  };
  __visti?: unknown[];
};

/** Lenis fermo e la pagina ferma: due letture uguali a 150 ms. */
async function ferma(page: Page) {
  await expect
    .poll(() => page.evaluate(() => String((window as unknown as ConLenis).__lenis?.isScrolling)), {
      timeout: 5000,
    })
    .toBe("false");
  let prima = -1;
  await expect
    .poll(
      async () => {
        const y = await page.evaluate(() => window.scrollY);
        const stabile = y === prima;
        prima = y;
        return stabile;
      },
      { intervals: [150], timeout: 5000 },
    )
    .toBe(true);
}

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
const scrollTop = (page: Page, sel: string) => page.locator(sel).evaluate((el) => el.scrollTop);

/** Rotella sul punto dato, poi attesa che tutto sia fermo. */
async function rotella(page: Page, x: number, y: number, dy = 300) {
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(300);
  await ferma(page);
}

/** (b) Con la pagina libera, la rotella passa da Lenis: «smooth», poi scrollY cresce. */
async function lenisScorreLaPagina(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as ConLenis;
    w.__visti = [];
    w.__lenis!.on("scroll", (l) => w.__visti!.push(l.isScrolling));
  });
  const prima = await scrollY(page);
  const { width, height } = page.viewportSize()!;
  await rotella(page, width / 2, height / 2);
  const visti = await page.evaluate(() => (window as unknown as ConLenis).__visti);
  expect(visti, "la rotella passa da Lenis").toContain("smooth");
  expect(await scrollY(page), "e la pagina scorre").toBeGreaterThan(prima);
}

test.describe("rotella nei contenitori", () => {
  test("menu hamburger a 1024×600, lingue espanse: scorre il pannello, non la pagina", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 600 });
    await page.goto("/collezioni");
    await page.waitForFunction(() => "__lenis" in window);
    await rotella(page, 512, 300, 400);
    const pagina = await scrollY(page);
    expect(pagina, "la pagina sotto è già scorsa").toBeGreaterThan(0);

    const pannello = "div.overscroll-contain";
    await page.locator("header nav > button:not([aria-haspopup])").click();
    await page.locator(`${pannello} button[aria-haspopup="listbox"]`).click();
    // Il box lingue cresce con GSAP: si aspetta che il pannello abbia da scorrere.
    await expect
      .poll(() => page.locator(pannello).evaluate((el) => el.scrollHeight - el.clientHeight))
      .toBeGreaterThan(100);
    const prima = await scrollTop(page, pannello);

    await rotella(page, 512, 300);
    expect(await scrollTop(page, pannello), "il pannello scorre").toBeGreaterThan(prima);
    expect(await scrollY(page), "la pagina sotto non si muove").toBe(pagina);

    // (b) Menu chiuso: la pagina torna a Lenis.
    await page.locator("header nav > button:not([aria-haspopup])").click();
    await expect(page.locator(pannello)).toBeHidden();
    await lenisScorreLaPagina(page);
  });

  test("foglio dei filtri a 1000×420: scorre il corpo, e lo sfondo non muove la pagina", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 420 });
    await page.goto("/collezioni/boss");
    await page.waitForFunction(() => "__lenis" in window);
    await rotella(page, 500, 210, 900);
    const pagina = await scrollY(page);
    expect(pagina).toBeGreaterThan(0);

    // La pill fissa dei filtri, sotto `lg`.
    await page.locator(".fa-filtri-flottante button").click();
    const corpo = "dialog[open] .overflow-y-auto";
    await expect(page.locator(corpo)).toBeVisible();
    // Il foglio sale con un'animazione di 250 ms: misurato a metà, il box del corpo sta
    // più in basso di dove finirà e il puntatore cade sullo sfondo.
    await page
      .locator("dialog[open]")
      .evaluate((d) =>
        Promise.all(d.getAnimations({ subtree: true }).map((a) => a.finished)).then(() => {}),
      );
    expect(
      await page.locator(corpo).evaluate((el) => el.scrollHeight - el.clientHeight),
      "il corpo ha da scorrere",
    ).toBeGreaterThan(0);

    const box = (await page.locator(corpo).boundingBox())!;
    await rotella(page, box.x + box.width / 2, box.y + box.height / 2);
    expect(await scrollTop(page, corpo), "il corpo del foglio scorre").toBeGreaterThan(0);
    expect(await scrollY(page), "la pagina sotto non si muove").toBe(pagina);

    // (a) Puntatore sullo sfondo (`::backdrop`), sopra il foglio: fuori dal corpo.
    const foglio = (await page.locator("dialog[open]").boundingBox())!;
    expect(foglio.y, "sopra il foglio c'è dello sfondo").toBeGreaterThan(20);
    await rotella(page, 500, foglio.y / 2);
    expect(await scrollY(page), "sullo sfondo la pagina non si muove").toBe(pagina);

    // (b) Foglio chiuso: la pagina torna a Lenis.
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await lenisScorreLaPagina(page);
  });
});
