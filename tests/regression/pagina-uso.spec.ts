import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { perPuntoDiCodice } from "../../scripts/i18n/ordine";

import { ricevutiDaZapier } from "./helpers/finto-zapier";

/**
 * La pagina d'uso «doccia da esterno» (spec `docs/specs/seo-pagine-contenuto.md` § 5, c1b).
 *
 * Le attese si leggono dalla pagina servita e dal file italiano versionato (le collezioni a video,
 * nell'ordine): la spec non scrive testi. Richiede il documento su Sanity in tutte e cinque le
 * lingue: il merge della c1b viene dopo il carico (Marco, 4/11/2026).
 */
const PAGINE = [
  { lingua: "it", path: "/doccia-da-esterno" },
  { lingua: "en", path: "/en/outdoor-shower" },
  { lingua: "de", path: "/de/gartendusche" },
  { lingua: "fr", path: "/fr/douche-exterieure" },
  { lingua: "es", path: "/es/ducha-exterior" },
] as const;

/** Le collezioni con almeno una colonna doccia, al 4/11/2026 (criterio in `USE_PAGE_QUERY`). */
const COLLEZIONI_CON_COLONNA = [
  "ille",
  "flamingo",
  "skinny",
  "classy",
  "twiggy",
  "boss",
  "boss-wide",
  "origo",
  "club",
  "club-large",
  "origo-rame",
  "onda",
  "arko",
  "square",
  "spring",
  "community",
  "yacht",
];

type Ld = Record<string, unknown> & { "@type"?: string };

async function jsonLd(page: Page): Promise<Ld[]> {
  const blocchi = await page.locator("script[type='application/ld+json']").allTextContents();
  return blocchi.flatMap((b) => {
    const o = JSON.parse(b) as Ld & { "@graph"?: Ld[] };
    return o["@graph"] ?? [o];
  });
}

const meta = (page: Page, sel: string) => page.locator(sel).first().getAttribute("content");
const testo = (s: string | null) => (s ?? "").replace(/[ \t\n\r]+/g, " ").trim();

/** Gli slug delle collezioni in evidenza, dal file italiano (spec § 3), nell'ordine. */
function collezioniDelFile(): string[] {
  const file = readFileSync(
    join(process.cwd(), "docs/content/pagine-uso/it/outdoor-shower.md"),
    "utf-8",
  );
  const riga = /^collezioni:\s*(.+)$/m.exec(file)?.[1] ?? "";
  return riga
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

for (const { lingua, path } of PAGINE) {
  test.describe(`pagina d'uso ${path}`, () => {
    test("200, lingua, un solo H1 e titoli senza salti", async ({ page }) => {
      const r = await page.goto(path);
      expect(r?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", lingua);
      await expect(page.locator("h1")).toHaveCount(1);
      const livelli = await page
        .locator("main h1, main h2, main h3, main h4")
        .evaluateAll((els) => els.map((e) => Number(e.tagName[1])));
      for (let i = 1; i < livelli.length; i++)
        expect(livelli[i] - livelli[i - 1], `salto di livello: ${livelli}`).toBeLessThanOrEqual(1);
    });

    test("metadati: canonical a sé, hreflang reciproci, og completi", async ({ page, request }) => {
      await page.goto(path);
      const canonical = await page.locator("link[rel=canonical]").getAttribute("href");
      expect(new URL(canonical!).pathname).toBe(path);
      const alternati = await page
        .locator("link[rel=alternate][hreflang]")
        .evaluateAll(
          (els) =>
            Object.fromEntries(
              els.map((e) => [e.getAttribute("hreflang") ?? "", e.getAttribute("href") ?? ""]),
            ) as Record<string, string>,
        );
      expect(Object.keys(alternati).sort()).toEqual(["de", "en", "es", "fr", "it", "x-default"]);
      expect(alternati[lingua]).toBe(canonical);
      // Reciproco: ogni lingua dichiara la stessa mappa.
      for (const url of Object.values(alternati)) {
        const html = await (await request.get(new URL(url).pathname)).text();
        for (const altro of Object.values(alternati)) expect(html).toContain(`href="${altro}"`);
      }
      const titolo = await page.title();
      const og = await meta(page, "meta[property='og:title']");
      expect(titolo).toBe(`${og} | Fontealta`);
      expect(await meta(page, "meta[name=description]")).toBe(
        await meta(page, "meta[property='og:description']"),
      );
      expect(await meta(page, "meta[property='og:image']")).toBeTruthy();
      expect(await meta(page, "meta[property='og:image:alt']")).toBeTruthy();
      expect(await meta(page, "meta[property='og:locale']")).toBeTruthy();
      expect(await meta(page, "meta[name='twitter:card']")).toBeTruthy();
    });

    test("il JSON-LD dice ciò che la pagina mostra", async ({ page }) => {
      await page.goto(path);
      const ld = await jsonLd(page);

      const webPage = ld.find((o) => o["@type"] === "WebPage")!;
      expect(webPage.name).toBe(testo(await page.locator("h1").textContent()));
      expect(webPage.description).toBe(await meta(page, "meta[name=description]"));
      expect(webPage.url).toBe(await page.locator("link[rel=canonical]").getAttribute("href"));
      expect(webPage.inLanguage).toBe(lingua);
      expect(webPage).not.toHaveProperty("dateModified");
      // Stessi `@id` dei nodi del layout.
      const ids = ld.map((o) => o["@id"]);
      expect(ids).toContain((webPage.isPartOf as { "@id": string })["@id"]);
      expect(ids).toContain((webPage.publisher as { "@id": string })["@id"]);

      const briciole = ld.find((o) => o["@type"] === "BreadcrumbList")!;
      const voci = (briciole.itemListElement as Array<{ name: string }>).map((v) => v.name);
      const aVideo = await page
        .locator("main nav ol li")
        .evaluateAll((els) =>
          els.map((e) => (e.textContent ?? "").replace("›", "").replace(/\s+/g, " ").trim()),
        );
      expect(voci).toEqual(aVideo.filter(Boolean));

      const faq = ld.find((o) => o["@type"] === "FAQPage")!;
      const domande = (faq.mainEntity as Array<{ name: string }>).map((q) => q.name);
      const bottoni = await page.locator("h3[id^='faq-'] > button").allTextContents();
      expect(domande).toEqual(bottoni.map(testo));
    });

    test("FAQ in fondo con le risposte nell'HTML, nessun «Scrivici», una sola CTA", async ({
      page,
    }) => {
      await page.goto(path);
      const pannelli = page.locator("[role=region][id^='faq-']");
      expect(await pannelli.count()).toBeGreaterThan(0);
      for (const t of await pannelli.allTextContents()) expect(t.trim().length).toBeGreaterThan(0);
      // Il «Non trovi la risposta? Scrivici» è un paragrafo sotto l'accordion: qui non c'è (Q12).
      await expect(
        page.locator("section[aria-labelledby='faq-section-title'] .fa-container > p"),
      ).toHaveCount(0);
      await expect(page.locator("#progettare")).toHaveCount(1);
    });

    test("foto: alt pieni, tutte pigre, sizes dichiarato", async ({ page }) => {
      await page.goto(path);
      const foto = page.locator("article figure img");
      expect(await foto.count()).toBeGreaterThan(0);
      for (const img of await foto.all()) {
        expect((await img.getAttribute("alt"))?.trim()).toBeTruthy();
        expect(await img.getAttribute("loading")).toBe("lazy");
        expect(await img.getAttribute("sizes")).toBeTruthy();
      }
    });

    test("le card: prima quelle in evidenza, poi le altre nell'ordine del catalogo", async ({
      page,
    }) => {
      // Card automatiche (Marco, 4/11/2026): ogni collezione con una colonna doccia, più quelle in
      // evidenza della riga del file, che vengono prima; le altre nell'ordine di /collezioni.
      const ultimo = (hrefs: string[]) => hrefs.map((h) => h.split("/").pop() ?? "");
      await page.goto("/collezioni");
      const catalogo = ultimo(
        await page
          .locator("a[href^='/collezioni/']")
          .evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? "")),
      );
      await page.goto(path);
      const card = ultimo(
        await page
          .locator("section[aria-labelledby='collezioni-uso'] a")
          .evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? "")),
      );
      const inEvidenza = collezioniDelFile();
      expect(card.slice(0, inEvidenza.length)).toEqual(inEvidenza);
      const resto = card.slice(inEvidenza.length);
      const ordine = [...new Set(catalogo)];
      expect(resto).toEqual(ordine.filter((slug) => resto.includes(slug)));
      // Le 17 collezioni con una colonna doccia al 4/11/2026: una collezione nuova con una colonna
      // la fa crescere da sola, e questa riga va aggiornata col dato.
      expect([...card].sort(perPuntoDiCodice)).toEqual(
        [...COLLEZIONI_CON_COLONNA].sort(perPuntoDiCodice),
      );
    });

    test("il piè di pagina non ha la voce della pagina d'uso", async ({ page }) => {
      // Tolta il 4/11/2026 (Marco): ci portano le FAQ delle collezioni e i post.
      await page.goto(path);
      const footer = page.locator("footer");
      await expect(footer.locator(`a[href='${path}']`)).toHaveCount(0);
      // La prima colonna di link è quella delle collezioni, e c'è ancora.
      expect(await footer.locator("ul").first().locator("li").count()).toBeGreaterThan(10);
    });

    test("nessun link interno rotto nel corpo", async ({ page, request }) => {
      await page.goto(path);
      // Solo il corpo: con tutto l'articolo il «Home» delle briciole bastava a far passare la prova
      // anche con zero link nel corpo (verificatore del 4/11). Spec § 2: 3-5 link interni in uscita.
      const hrefs = await page
        .locator("[data-corpo-uso] a[href^='/']")
        .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("href")!))]);
      expect(hrefs.length).toBeGreaterThanOrEqual(3);
      for (const h of hrefs) expect((await request.get(h)).status(), h).toBe(200);
    });
  });
}

test.describe("pagina d'uso a 390", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("la pagina non sborda, la tabella scorre nel suo riquadro raggiungibile", async ({
    page,
  }) => {
    await page.goto("/doccia-da-esterno");
    const sborda = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(sborda).toBe(false);
    const tabella = page.locator("article [role=region][tabindex='0']");
    await expect(tabella).toHaveCount(1);
    await expect(tabella).toHaveAttribute("aria-label", /.+/);
  });
});

test("nessuno spostamento del layout al caricamento", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as Array<
        PerformanceEntry & { value: number; hadRecentInput: boolean }
      >)
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/doccia-da-esterno");
  await page.waitForLoadState("networkidle");
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(cls).toBeLessThan(0.01);
});

/**
 * La fonte del contatto (4/11/2026, c1b): una richiesta dalla pagina d'uso arriva al FINTO Zapier
 * con `source: "doccia-da-esterno"`, in italiano e in una lingua col segmento tradotto. Prima della
 * c1b arrivava «other». Indirizzo unico per prova (i finti sono condivisi fra i worker).
 */
for (const { lingua, path } of [PAGINE[0], PAGINE[2]]) {
  test(`${path} · il lead arriva a Zapier con source doccia-da-esterno`, async ({ page }) => {
    await page.goto(path);
    const form = page.locator("#progettare form");
    // Idratato (l'errore del primo invio vuoto) e fuori dalla finestra anti-bot di 3 s,
    // come in `modulo-modelli.spec.ts`.
    await form.locator("button[type='submit']").click();
    await expect(form.locator("input[name='nome']")).toHaveAttribute("aria-invalid", "true");
    const idratato = Date.now();
    const email = `e2e+pagina-uso-${lingua}-${Date.now()}-${test.info().testId}@example.com`;
    await form.locator("input[name='nome']").fill("Mario");
    await form.locator("input[name='cognome']").fill("Rossi");
    await form.locator("input[name='email']").fill(email);
    await form.locator("select[name='paese']").selectOption("IT");
    await form.locator("select[name='richiesta']").selectOption("preventivo");
    const resta = 3000 - (Date.now() - idratato);
    if (resta > 0) await page.waitForTimeout(resta + 100);
    await form.locator("button[type='submit']").click();
    await expect(form.locator("output")).toBeVisible();

    await expect
      .poll(async () => (await ricevutiDaZapier()).filter((l) => l.email === email).length, {
        message: `il finto Zapier deve ricevere il lead di ${email}`,
      })
      .toBe(1);
    expect((await ricevutiDaZapier()).find((l) => l.email === email)).toMatchObject({
      source: "doccia-da-esterno",
      lingua,
      richiesta: "preventivo",
    });
  });
}
