import { expect, test, type Page } from "@playwright/test";

/**
 * Regressione «Area Riservata in costruzione» (settembre 2026).
 *
 * Custodisce tre cose che il typecheck non vede e che rientrerebbero in silenzio:
 *
 *  1. la ROTTA risponde in entrambe le lingue. Il pathname vive nella mappa di
 *     `routing.ts`, che è una whitelist: una voce senza pagina resta dichiarata
 *     valida e viene servita dal catch-all come 404. È esattamente lo stato in cui
 *     `/area-pro` è rimasto per mesi.
 *  2. il `noindex` sta SULLA ROTTA. Oggi non si vedrebbe comunque, perché il gate
 *     M20 spegne l'indicizzazione dell'intero sito finché `NEXT_PUBLIC_SITE_URL`
 *     non è il dominio di produzione. Al cutover quel gate si riapre in un colpo
 *     solo, e questa pagina deve restare fuori: il momento in cui la guardia serve
 *     è il momento in cui nessuno la starà guardando.
 *  3. il LINK è vivo in header e footer, e punta al pathname della lingua giusta.
 *
 * ⚠️ Un contesto per test, ed è deliberato: `NEXT_LOCALE` è il cookie funzionale di
 * next-intl e sopravvive alle navigazioni. Riusando un contesto solo, dopo una
 * visita EN una rotta IT non prefissata verrebbe servita in inglese e si
 * misurerebbe un'altra pagina credendo di essere su questa. Playwright crea un
 * contesto nuovo per `test`, quindi basta non condividerlo a mano.
 */

const IT = "/area-riservata";
// ⚠️ L'URL inglese resta `/pro-area`, com'era: la rinomina ha toccato la CHIAVE
// della mappa e il pathname IT, non quello EN, perché le etichette inglesi del
// sito dicono «Pro Area» e un indirizzo diverso sarebbe un terzo nome.
const EN = "/en/pro-area";

/** Il `<meta name="robots">` come lo serve la pagina, non come lo dichiara il codice. */
const metaRobots = (page: Page) =>
  page.locator('meta[name="robots"]').getAttribute("content", { timeout: 10_000 });

/** Un link vivo: è un `<a>`, ha l'href giusto, e non porta addosso nessuno stato spento. */
async function asserisciLinkVivo(page: Page, dove: "header" | "footer", href: string) {
  const link = page.locator(`${dove} a[href="${href}"]`);
  await expect(link, `${dove}: il link ad Area Riservata deve esistere`).toHaveCount(1);
  await expect(link).toBeVisible();
  expect(await link.getAttribute("aria-disabled"), `${dove}: aria-disabled`).toBeNull();
  expect(await link.getAttribute("disabled"), `${dove}: disabled`).toBeNull();
}

test.describe("IT", () => {
  test.use({ locale: "it-IT" });

  test("la pagina risponde, è noindex e il titolo è quello approvato", async ({ page }) => {
    const risposta = await page.goto(IT);
    expect(risposta?.status(), "status della rotta IT").toBe(200);
    expect(new URL(page.url()).pathname, "nessun dirottamento di lingua").toBe(IT);

    expect(await metaRobots(page)).toContain("noindex");
    await expect(page).toHaveTitle("Area Riservata | Fontealta");
    await expect(page.locator("h1")).toHaveText("L’acciaio ha i suoi tempi.");
    // Un solo bottone, e porta ai contatti.
    await expect(
      page.locator("main a[href='/contatti'], a[href='/contatti']").first(),
    ).toBeVisible();
  });

  test("header e footer linkano la pagina, senza stati spenti", async ({ page }) => {
    await page.goto("/");
    await asserisciLinkVivo(page, "header", IT);
    await asserisciLinkVivo(page, "footer", IT);
  });

  test("il vecchio /area-pro non è più una rotta dichiarata", async ({ page }) => {
    // La rinomina è completa solo se la chiave vecchia è sparita dalla whitelist:
    // due chiavi per una pagina sola lascerebbero un URL valido che risponde 404.
    const risposta = await page.goto("/area-pro");
    expect(risposta?.status(), "/area-pro deve essere 404").toBe(404);
  });
});

test.describe("EN", () => {
  test.use({ locale: "en-US" });

  test("la pagina risponde, è noindex e il titolo è quello approvato", async ({ page }) => {
    const risposta = await page.goto(EN);
    expect(risposta?.status(), "status della rotta EN").toBe(200);
    expect(new URL(page.url()).pathname, "nessun dirottamento di lingua").toBe(EN);

    expect(await metaRobots(page)).toContain("noindex");
    await expect(page).toHaveTitle("Pro Area | Fontealta");
    await expect(page.locator("h1")).toHaveText("Steel takes its time.");
  });

  test("/en/reserved-area non è mai stato una rotta", async ({ page }) => {
    // Guardia sul nome che NON abbiamo adottato: se un giorno qualcuno
    // ribattezzasse il pathname EN, questo test lo dice invece di lasciare due
    // indirizzi buoni per la stessa pagina.
    const risposta = await page.goto("/en/reserved-area");
    expect(risposta?.status(), "/en/reserved-area deve essere 404").toBe(404);
  });

  test("header e footer linkano il pathname inglese", async ({ page }) => {
    await page.goto("/en");
    await asserisciLinkVivo(page, "header", EN);
    await asserisciLinkVivo(page, "footer", EN);
  });
});
