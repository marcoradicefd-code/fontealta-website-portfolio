import { expect, test, type Page } from "@playwright/test";

import { perPuntoDiCodice } from "../../scripts/i18n/ordine";

/**
 * «Approfondisci» sotto le risposte delle FAQ (Marco, 4/11/2026; spec `faq-pagine-uso.md` § 8).
 *
 * Le pagine sono quelle degli ingressi verso la pagina d'uso (Club, Club Large, Spring, Origo Rame,
 * Community) nelle cinque lingue. Le attese non scrivono testi: per ogni «Approfondisci» servito,
 * il testo da 3 a 12 parole, la destinazione che risponde 200, la freccia nascosta ai lettori di
 * schermo, il JSON-LD che non lo contiene, e l'evento con due proprietà sole. Richiede il carico
 * degli ingressi (3a): senza nessun «Approfondisci» la prova è rossa.
 */
const PAGINE = [
  "/collezioni/club",
  "/collezioni/club-large",
  "/collezioni/spring",
  "/collezioni/origo-rame",
  "/collezioni/community",
  "/en/collections/club",
  "/de/kollektionen/spring",
  "/fr/collections/community",
  "/es/colecciones/origo-rame",
];

async function eventi(page: Page) {
  return page.evaluate(() => (window as unknown as { __va: unknown[] }).__va);
}

test("gli «Approfondisci» serviti: testo, destinazione, freccia, JSON-LD e statistiche", async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __va: unknown[]; va: (...a: unknown[]) => void };
    w.__va = [];
    w.va = (...a) => w.__va.push(a);
  });
  let visti = 0;
  for (const path of PAGINE) {
    await page.goto(path);
    const link = page.locator("[data-faq-approfondisci] a");
    const n = await link.count();
    if (n === 0) continue;
    const ld = (await page.locator("script[type='application/ld+json']").allTextContents()).join();
    for (let i = 0; i < n; i++) {
      const a = link.nth(i);
      const testo = ((await a.textContent()) ?? "").trim();
      const parole = testo.split(/\s+/).filter(Boolean).length;
      expect(parole, `${path}: «${testo}»`).toBeGreaterThanOrEqual(3);
      expect(parole, `${path}: «${testo}»`).toBeLessThanOrEqual(12);
      expect(ld, `${path}: il JSON-LD non porta «Approfondisci»`).not.toContain(testo);
      await expect(a.locator("svg")).toHaveAttribute("aria-hidden", "true");
      const href = (await a.getAttribute("href"))!;
      expect((await request.get(href)).status(), href).toBe(200);
      visti++;
    }
    // Il clic sul primo: la domanda va aperta, e l'evento porta due proprietà.
    // ⚠️ `{ has: link.first() }` non sceglie il primo link: il `first()` vale dentro ogni regione,
    // e con due «Approfondisci» sulla stessa pagina (Spring dal 5/11/2026) le regioni erano due.
    // La prima regione in ordine di pagina è quella del primo link.
    const pannello = page
      .locator("[role=region]")
      .filter({ has: page.locator("[data-faq-approfondisci] a") })
      .first();
    const id = (await pannello.getAttribute("aria-labelledby"))!;
    await page.locator(`#${id}`).click();
    const destinazione = await link.first().getAttribute("href");
    await link.first().click();
    await page.waitForURL((u) => u.pathname === destinazione);
    const ev = (await eventi(page)) as Array<[string, { name: string; data: object }]>;
    const ultimo = ev.filter(([, e]) => e?.name === "faq_approfondisci").at(-1)?.[1];
    expect(ultimo, path).toBeTruthy();
    expect(Object.keys(ultimo!.data).sort(perPuntoDiCodice)).toEqual(["destinazione", "pagina"]);
    expect(ultimo!.data).toMatchObject({ pagina: path });
  }
  expect(
    visti,
    "nessun «Approfondisci» sulle pagine degli ingressi: carico 3a fatto?",
  ).toBeGreaterThan(0);
});
