import { expect, test, type Browser, type Page } from "@playwright/test";

import { ricevutiDaZapier } from "./helpers/finto-zapier";

/**
 * La CSP in Report-Only (15/10/2026): la sonda delle violazioni.
 *
 * In Report-Only il browser non blocca, ma l'evento `securitypolicyviolation`
 * scatta lo stesso: lo raccoglie uno script iniettato prima della pagina. Atteso
 * ZERO su un campione per tipo di pagina nelle cinque lingue (le stesse 85 pagine
 * dell'inventario), sull'invio del modulo (che carica MorphSVG e Flip), sul video
 * dell'hero e sulla mappa.
 *
 * ⚠️ Il build della suite non è di produzione (`VERCEL_ENV` assente), quindi la
 * policy servita è quella delle anteprime: la stessa di produzione più gli host
 * della toolbar di Vercel, che in locale non carica niente. Zero qui vuol dire
 * zero anche con la policy di produzione.
 *
 * ⚠️ La controprova (15/10): un build senza `cdn.sanity.io` in `img-src` fa
 * diventare rossi i tipi con immagini di Sanity.
 */

const LINGUE = ["it", "en", "de", "fr", "es"] as const;

/** Tipo di pagina → percorso ITALIANO della sitemap; le altre lingue dalle alternate. */
const TIPI: Array<[string, RegExp]> = [
  ["home", /^\/$/],
  ["collezioni", /^\/collezioni$/],
  ["corpi-a-incasso", /^\/collezioni\/corpi-a-incasso$/],
  ["corpo-a-incasso", /^\/collezioni\/corpi-a-incasso\/[^/]+$/],
  ["collezione", /^\/collezioni\/(?!corpi-a-incasso$)[^/]+$/],
  ["modello", /^\/modello\/b40l$/],
  ["produzione", /^\/produzione$/],
  ["finiture", /^\/finiture$/],
  ["blog", /^\/blog$/],
  ["post", /^\/blog\/[^/]+$/],
  ["chi-siamo", /^\/chi-siamo$/],
  ["contatti", /^\/contatti$/],
  ["referenze", /^\/referenze$/],
  ["referenza", /^\/referenze\/[^/]+$/],
  ["menzioni-legali", /^\/menzioni-legali$/],
];

/** Fuori dalla sitemap (noindex e 404): percorsi da `routing.ts`. */
const EXTRA: Record<string, Record<(typeof LINGUE)[number], string>> = {
  "area-riservata": {
    it: "/area-riservata",
    en: "/en/pro-area",
    de: "/de/pro-bereich",
    fr: "/fr/espace-pro",
    es: "/es/area-reservada",
  },
  // La pagina e la tavola nel suo iframe: le violazioni si leggono in tutti e due i documenti.
  officina: {
    it: "/officina",
    en: "/en/workshop",
    de: "/de/werkstatt",
    fr: "/fr/atelier",
    es: "/es/taller",
  },
  "404": {
    it: "/csp-pagina-inesistente",
    en: "/en/collections/csp-missing",
    de: "/de/kollektionen/csp-fehlt",
    fr: "/fr/collections/csp-absente",
    es: "/es/colecciones/csp-falta",
  },
};

type Violazione = { direttiva: string; bloccato: string; sorgente: string };

let campioni: Promise<Record<string, Record<string, string>>> | undefined;

/** Un campione per tipo, letto una volta sola dalla sitemap del build. */
function leggiCampioni(baseURL: string) {
  campioni ??= (async () => {
    const xml = await (await fetch(`${baseURL}/sitemap.xml`)).text();
    const scelti: Record<string, Record<string, string>> = { ...EXTRA };
    for (const blocco of xml.split("<url>").slice(1)) {
      const alt = Object.fromEntries(
        [...blocco.matchAll(/hreflang="([a-z-]+)"\s+href="([^"]+)"/g)].map(([, l, h]) => [l, h]),
      );
      if (!alt.it) continue;
      const pIt = new URL(alt.it).pathname.replace(/\/$/, "") || "/";
      for (const [tipo, re] of TIPI) {
        if (!scelti[tipo] && re.test(pIt))
          scelti[tipo] = Object.fromEntries(
            LINGUE.map((l) => [l, new URL(alt[l] ?? alt.it).pathname]),
          );
      }
    }
    return scelti;
  })();
  return campioni;
}

async function paginaConSonda(browser: Browser, baseURL: string): Promise<Page> {
  // Un contesto per pagina: `NEXT_LOCALE` sopravvive alle navigazioni (rule misure-e-test).
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    const w = window as unknown as { __csp: Violazione[] };
    w.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      w.__csp.push({
        direttiva: e.effectiveDirective,
        bloccato: e.blockedURI,
        sorgente: e.sourceFile,
      }),
    );
  });
  return ctx.newPage();
}

/**
 * Le violazioni della pagina e dei suoi iframe dello STESSO sito (la tavola di
 * `/officina`): la sonda è iniettata in ogni documento. Gli iframe di altri host (la
 * mappa) hanno la CSP del loro server, che non è la nostra, e restano fuori.
 */
const violazioni = async (page: Page) => {
  const origine = new URL(page.url()).origin;
  const nostri = page.frames().filter((f) => f.url().startsWith(origine));
  const perFrame = await Promise.all(
    nostri.map((f) =>
      f.evaluate(() => (window as unknown as { __csp?: Violazione[] }).__csp ?? []),
    ),
  );
  return perFrame.flat();
};

/** Fino in fondo con la rotella vera: Lenis intercetta `scrollTo`, e le immagini pigre vogliono la vista. */
async function scorri(page: Page) {
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(50);
    if (
      await page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 4)
    )
      break;
  }
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
}

for (const [tipo] of [...TIPI, ...Object.keys(EXTRA).map((k) => [k] as const)]) {
  test(`CSP · ${tipo} · zero violazioni nelle cinque lingue`, async ({ browser, baseURL }) => {
    test.setTimeout(150_000);
    const perLingua = (await leggiCampioni(baseURL!))[tipo];
    test.skip(!perLingua, `nessuna pagina «${tipo}» nella sitemap del build`);
    for (const lingua of LINGUE) {
      const page = await paginaConSonda(browser, baseURL!);
      await page.goto(perLingua[lingua], { waitUntil: "load" });
      await scorri(page);
      expect(await violazioni(page), `${tipo} · ${lingua} · ${perLingua[lingua]}`).toEqual([]);
      await page.context().close();
    }
  });
}

test("CSP · invio del modulo al finto Zapier, coi chunk di MorphSVG e Flip: zero violazioni", async ({
  browser,
  baseURL,
}) => {
  const page = await paginaConSonda(browser, baseURL!);
  await page.goto("/contatti");
  const form = page.locator("form:has(select[name='paese'])").first();
  await form.locator("button[type='submit']").click();
  await expect(form.locator("input[name='nome']")).toHaveAttribute("aria-invalid", "true");
  // `testId`: indirizzo unico anche con i finti condivisi fra 2 worker (26/10/2026).
  const email = `e2e+csp-${Date.now()}-${test.info().testId}@example.com`;
  await form.locator("input[name='nome']").fill("Mario");
  await form.locator("input[name='cognome']").fill("Rossi");
  await form.locator("input[name='email']").fill(email);
  await form.locator("select[name='richiesta']").selectOption("preventivo");
  await form.locator("select[name='paese']").selectOption("IT");
  await page.waitForTimeout(3100); // la finestra anti-bot di `actions.ts`
  await form.locator("button[type='submit']").click();
  await expect(form.locator("output")).toContainText("Mario");
  await expect
    .poll(async () => (await ricevutiDaZapier()).filter((l) => l.email === email).length)
    .toBe(1);
  expect(await violazioni(page)).toEqual([]);
  await page.context().close();
});

test("CSP · il video dell'hero parte da media.fontealta.it: zero violazioni", async ({
  browser,
  baseURL,
}) => {
  const page = await paginaConSonda(browser, baseURL!);
  await page.goto("/");
  const video = page.locator("video").first();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), {
      message: "il video deve arrivare ad avere dati: serve la rete verso media.fontealta.it",
      timeout: 30_000,
    })
    .toBeGreaterThanOrEqual(2);
  expect(await video.evaluate((v: HTMLVideoElement) => new URL(v.currentSrc).host)).toBe(
    "media.fontealta.it",
  );
  expect(await violazioni(page)).toEqual([]);
  await page.context().close();
});

test("CSP · la tavola di /officina: iframe, font e voce da media.fontealta.it, zero violazioni", async ({
  browser,
  baseURL,
}) => {
  const page = await paginaConSonda(browser, baseURL!);
  await page.goto("/officina");
  const tavola = page.frameLocator("iframe[src^='/officina-tavola/']");
  const voce = page.waitForRequest((r) => r.url().startsWith("https://media.fontealta.it/tavola/"));
  await tavola.locator("#voice").click();
  await voce;
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  expect(page.frames().filter((f) => f.url().includes("/officina-tavola/"))).toHaveLength(1);
  expect(await violazioni(page)).toEqual([]);
  await page.context().close();
});

test("CSP · la mappa di Google si carica: zero violazioni", async ({ browser, baseURL }) => {
  const page = await paginaConSonda(browser, baseURL!);
  await page.goto("/contatti");
  const iframe = page.locator("iframe[src*='google.com/maps']");
  await iframe.scrollIntoViewIfNeeded();
  await expect
    .poll(() => page.frames().some((f) => f.url().startsWith("https://www.google.com/maps")), {
      timeout: 30_000,
    })
    .toBe(true);
  expect(await violazioni(page)).toEqual([]);
  await page.context().close();
});

test("CSP · header presenti sul sito, assenti sullo Studio; x-powered-by spento", async ({
  request,
}) => {
  for (const p of ["/", "/en/about"]) {
    const h = (await request.get(p, { maxRedirects: 0 })).headers();
    expect(h["content-security-policy-report-only"], p).toContain("report-to csp-endpoint");
    expect(h["content-security-policy"], p).toBeUndefined();
    expect(h["reporting-endpoints"], p).toBe('csp-endpoint="/api/csp-report"');
    expect(h["x-powered-by"], p).toBeUndefined();
  }
  for (const p of ["/studio", "/studio/structure"]) {
    const h = (await request.get(p, { maxRedirects: 0 })).headers();
    expect(h["content-security-policy-report-only"], p).toBeUndefined();
  }
});

test("CSP · l'endpoint dei rapporti risponde 204 ai due formati e a uno sbagliato", async ({
  request,
}) => {
  const casi: Array<[string, unknown]> = [
    [
      "application/csp-report",
      {
        "csp-report": {
          "effective-directive": "img-src",
          "blocked-uri": "https://e2e.example/x.png",
        },
      },
    ],
    [
      "application/reports+json",
      [
        {
          type: "csp-violation",
          body: { effectiveDirective: "img-src", blockedURL: "https://e2e.example/y.png" },
        },
      ],
    ],
    ["text/plain", "niente"],
  ];
  for (const [tipo, corpo] of casi) {
    const r = await request.post("/api/csp-report", {
      headers: { "content-type": tipo },
      data: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    });
    expect(r.status(), tipo).toBe(204);
  }
});
