import { expect, test } from "@playwright/test";

/**
 * La facciata della tavola dell'officina in fondo a `/produzione` (27/10/2026, PR 4 del
 * cantiere; spec `docs/specs/tavola-officina.md`, «La facciata su /produzione»).
 *
 * Custodisce: un solo link per immagine e bottone, col nome del bottone e la didascalia come
 * descrizione; l'immagine muta e pigra; la lingua della pagina nel link; nessuna richiesta
 * alla tavola prima del clic; il clic su qualunque punto della figura; `officina_apri`.
 */

/** Pagina, destinazione, nome del link e didascalia, dai dizionari del 27/10/2026. */
const PAGINE = {
  it: {
    produzione: "/produzione",
    officina: "/officina",
    nome: "Esplora l’officina",
    didascalia: "Ricostruzione illustrata dell’officina di Viareggio.",
  },
  en: {
    produzione: "/en/production",
    officina: "/en/workshop",
    nome: "Explore the workshop",
    didascalia: "Illustrated reconstruction of the Viareggio workshop.",
  },
  de: {
    produzione: "/de/produktion",
    officina: "/de/werkstatt",
    nome: "Werkstatt entdecken",
    didascalia: "Illustrierte Rekonstruktion der Werkstatt in Viareggio.",
  },
  fr: {
    produzione: "/fr/production",
    officina: "/fr/atelier",
    nome: "Découvrez l’atelier",
    didascalia: "Reconstitution illustrée de l’atelier de Viareggio.",
  },
  es: {
    produzione: "/es/produccion",
    officina: "/es/taller",
    nome: "Explorar el taller",
    didascalia: "Reconstrucción ilustrada del taller de Viareggio.",
  },
} as const;

const figura = "figure:has(img[src*='facciata'])";

for (const [lingua, p] of Object.entries(PAGINE)) {
  test(`${lingua}: un solo link «${p.nome}» verso ${p.officina}, descritto dalla didascalia`, async ({
    page,
  }) => {
    await page.goto(p.produzione);
    const fig = page.locator(figura);
    await expect(fig).toHaveCount(1);
    await expect(fig.locator("a")).toHaveCount(1);
    // Il nome è ESATTAMENTE il testo del bottone: niente freccia, niente didascalia.
    const link = page.getByRole("link", { name: p.nome, exact: true });
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAccessibleName(p.nome);
    await expect(link).toHaveAttribute("href", p.officina);
    // La didascalia sta SOLO nella descrizione.
    await expect(link).toHaveAccessibleDescription(p.didascalia);
    await expect(fig.locator("figcaption")).toHaveText(p.didascalia);
    // Nessun controllo annidato dentro il link.
    await expect(link.locator("a, button, [role=button]")).toHaveCount(0);
    const img = fig.locator("img");
    await expect(img).toHaveAttribute("alt", "");
    await expect(img).toHaveAttribute("loading", "lazy");
  });
}

for (const larghezza of [1440, 1024]) {
  test(`a ${larghezza} il bottone sta sopra l'immagine, al centro, e la didascalia sotto`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: larghezza, height: 900 });
    await page.goto("/produzione");
    const fig = page.locator(figura);
    await fig.scrollIntoViewIfNeeded();
    const [img, bottone, didascalia] = await Promise.all([
      fig.locator("img").boundingBox(),
      page
        .getByRole("link", { name: "Esplora l’officina", exact: true })
        .getByText("Esplora l’officina")
        .boundingBox(),
      fig.locator("figcaption").boundingBox(),
    ]);
    const centroX = (b: { x: number; width: number }) => b.x + b.width / 2;
    const centroY = (b: { y: number; height: number }) => b.y + b.height / 2;
    expect(Math.abs(centroX(bottone!) - centroX(img!))).toBeLessThanOrEqual(1);
    expect(Math.abs(centroY(bottone!) - centroY(img!))).toBeLessThanOrEqual(1);
    expect(didascalia!.y).toBeGreaterThanOrEqual(img!.y + img!.height);
  });
}

/**
 * Sotto 1024 px la facciata non c'è (Marco, 27/10/2026, dopo la prova su iPhone: sul telefono la
 * tavola si vede troppo piccola). La pagina si scorre fino in fondo con la rotella vera, così
 * un'immagine pigra che dovesse partire parte: nessuna richiesta della facciata né della tavola,
 * nessun link verso `/officina`.
 */
for (const larghezza of [390, 768]) {
  test(`a ${larghezza} nessuna facciata: niente immagine scaricata, niente link a /officina`, async ({
    page,
  }) => {
    const richieste: string[] = [];
    page.on("request", (r) => {
      const u = decodeURIComponent(r.url());
      if (u.includes("facciata") || u.includes("/officina-tavola/")) richieste.push(r.url());
    });
    await page.setViewportSize({ width: larghezza, height: 844 });
    await page.goto("/produzione");
    for (let i = 0; i < 60; i++) {
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(40);
      if (
        await page.evaluate(
          () => innerHeight + scrollY >= document.documentElement.scrollHeight - 2,
        )
      )
        break;
    }
    await page.waitForLoadState("networkidle");
    expect(richieste, "nessuna richiesta della facciata o della tavola").toEqual([]);
    await expect(page.getByRole("link", { name: "Esplora l’officina" })).toHaveCount(0);
    await expect(page.locator("a[href='/officina']:visible")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Il tempo è un materiale." })).toBeVisible();
  });
}

test("nessuna richiesta alla tavola prima del clic; il clic su un angolo della figura apre /officina", async ({
  page,
}) => {
  const tavola: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/officina-tavola/")) tavola.push(u.pathname);
  });
  // `track()` chiama `window.va`, che in locale non esiste: lo si registra nella pagina.
  await page.addInitScript(() => {
    const w = globalThis as unknown as { va: (...a: unknown[]) => void; __va: unknown[] };
    w.__va = [];
    w.va = (...a: unknown[]) => w.__va.push(a);
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en/production");
  const img = page.locator(`${figura} img`);
  await img.scrollIntoViewIfNeeded();
  await expect
    .poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))
    .toBe(true);
  expect(tavola, "la tavola non si carica prima del clic").toEqual([]);

  // Un angolo dell'immagine, lontano dal bottone: tutta la figura è il link.
  const box = (await img.boundingBox())!;
  const va = await page.evaluate(() => (globalThis as unknown as { __va: unknown[] }).__va.length);
  expect(va).toBe(0);
  await page.mouse.click(box.x + 12, box.y + 12);
  await page.waitForURL("**/en/workshop");
  // L'evento parte prima della navigazione: la pagina nuova è un documento nuovo solo se la
  // navigazione non è client; qui è client (Link), e `__va` resta quello della pagina.
  const chiamate = await page.evaluate(() => (globalThis as unknown as { __va: unknown[] }).__va);
  expect(chiamate).toContainEqual(["event", { name: "officina_apri", data: { lingua: "en" } }]);
});
