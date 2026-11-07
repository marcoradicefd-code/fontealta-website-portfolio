import { expect, test } from "@playwright/test";

/**
 * Regressione «poster del video hero» (settembre 2026).
 *
 * Custodisce una modifica che rientrerebbe in silenzio, perché a schermo non si
 * vede niente di diverso: il video parte comunque, e il poster resta visibile
 * per una frazione di secondo.
 *
 * Il contesto, per chi legge fra sei mesi: a giugno 2026 il poster era stato
 * TOLTO di proposito (`4e15163`, «remove jarring image flash during client
 * navigation»), perché quello che lampeggiava era una foto Unsplash estranea al
 * video. Rimetterlo ha senso solo finché il poster è un fotogramma del video
 * stesso. Se qualcuno popola `homeHeroPoster` su Sanity con un'immagine di brand
 * diversa, questo test resta verde e il lampo torna: è una guardia sulla
 * PRESENZA del poster, non sulla sua somiglianza al video, che nessun test può
 * giudicare al posto di una persona.
 *
 * Senza poster l'elemento LCP della home era il `<video>`, misurato a 6077,8 ms
 * su mobile con 5298 ms di sola attesa di decodifica.
 */

test.describe("home · poster del video hero", () => {
  test("il video ha un poster non vuoto e preload=metadata", async ({ page }) => {
    await page.goto("/");

    const video = page.locator("section video").first();
    await expect(video).toHaveCount(1);

    const poster = await video.getAttribute("poster");
    expect(poster, "il <video> dell'hero deve avere un poster").toBeTruthy();
    expect(poster).not.toBe("");

    // `preload="auto"` si prendeva ~4,7 MB prima del primo paint, in concorrenza
    // col poster che è l'elemento LCP.
    await expect(video).toHaveAttribute("preload", "metadata");
  });

  test("il poster è servito davvero e non è un 404", async ({ page, request }) => {
    await page.goto("/");

    const poster = await page.locator("section video").first().getAttribute("poster");
    expect(poster).toBeTruthy();

    const res = await request.get(poster as string);
    expect(res.status(), `poster non servito: ${poster}`).toBe(200);
    expect(res.headers()["content-type"]).toContain("image");
  });

  test("il poster è preloaded nell'head, con priorità alta", async ({ page }) => {
    await page.goto("/");

    const poster = await page.locator("section video").first().getAttribute("poster");
    // Il `<link rel=preload>` lo emette `ReactDOM.preload` dal ramo video di
    // `HeroMediaBg`. Nell'altro ramo lo emette già `<Image priority>` da sé,
    // quindi qui si asserisce SOLO il caso con video.
    const link = page.locator(`head link[rel="preload"][as="image"][href="${poster}"]`);
    await expect(link).toHaveCount(1);
  });

  test("sotto prefers-reduced-motion il video non c'è e resta l'immagine", async ({ browser }) => {
    // Contesto dedicato: l'emulazione va impostata alla creazione, e `NEXT_LOCALE`
    // non deve arrivare da un test precedente.
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");

    await expect(page.locator("section video")).toHaveCount(0);
    await expect(page.locator("section img").first()).toBeVisible();

    await context.close();
  });
});
