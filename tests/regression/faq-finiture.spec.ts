import { expect, test, type Page } from "@playwright/test";

import { ACTIVE_LOCALES, routing } from "../../src/i18n/routing";
import { REDIRECT_GUIDA_316 } from "../../src/lib/redirects";

/**
 * La FAQ della pagina /finiture e il 301 della guida 316/304 (Marco, grill del 5/11/2026, Q4, Q18,
 * Q19). La FAQ è la stessa sezione della home (`FaqSection`): qui si guarda che ci sia in ogni lingua,
 * dal documento fisso `contentPage-finishes`, che il `FAQPage` dica le stesse domande dei bottoni e
 * che il link diretto apra la domanda. Le domande vengono dal dataset: la spec non scrive testi.
 */

const finiture = (locale: string) => {
  const forma = (routing.pathnames["/finiture"] as Record<string, string>)[locale];
  return locale === "it" ? forma : `/${locale}${forma}`;
};

const bottoni = (page: Page) => page.locator("h3[id^='faq-'] > button");

async function faqPageLd(page: Page) {
  const blocchi = await page.locator("script[type='application/ld+json']").allTextContents();
  return blocchi
    .map((b) => JSON.parse(b) as { "@type"?: string; mainEntity?: Array<{ name: string }> })
    .filter((o) => o["@type"] === "FAQPage");
}

for (const locale of ACTIVE_LOCALES) {
  test(`${finiture(locale)}: la FAQ c'è, e il FAQPage dice le domande dei bottoni`, async ({
    page,
  }) => {
    const res = await page.goto(finiture(locale));
    expect(res?.status()).toBe(200);
    const testi = (await bottoni(page).allTextContents()).map((t) => t.trim());
    expect(testi.length).toBeGreaterThanOrEqual(4);
    const ld = await faqPageLd(page);
    expect(ld).toHaveLength(1);
    expect(ld[0].mainEntity?.map((q) => q.name)).toEqual(testi);
  });
}

test("/finiture: il link diretto apre la domanda", async ({ page }) => {
  await page.goto(finiture("it"));
  const primo = bottoni(page).first();
  const id = await primo.evaluate((b) => b.parentElement!.id);
  await page.goto(`${finiture("it")}#${id}`);
  await expect(page.locator(`#${id} > button`)).toHaveAttribute("aria-expanded", "true");
});

for (const locale of ACTIVE_LOCALES) {
  const { source, destination } = REDIRECT_GUIDA_316[locale];
  test(`${source} risponde 301 verso la guida unica`, async ({ request }) => {
    const res = await request.get(source, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(new URL(res.headers().location, "http://x").pathname).toBe(destination);
  });
}
