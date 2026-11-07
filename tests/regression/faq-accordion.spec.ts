import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Le FAQ sul sito (spec `docs/specs/faq-pagine-uso.md` § 3, § 12; PR b del cantiere FAQ).
 *
 * Accordion sul pattern del W3C APG: il bottone unico figlio di un `h3`, `aria-expanded`,
 * `aria-controls` verso il pannello, il pannello `region` con `aria-labelledby`, Invio e Spazio,
 * la risposta nell'HTML servito anche chiusa, la ricerca nella pagina che apre (qui col
 * frammento di testo, `#:~:text=`, che usa lo stesso `beforematch`). Il link diretto `#faq-…`
 * apre la domanda e la ferma sotto la barra. La guardia del JSON-LD: le `Question.name` sono i
 * testi dei bottoni, nella lingua della pagina; DE senza FAQ non ha né sezione né `FAQPage`.
 *
 * I contrasti sui glifi a DPR 2 col metodo di `errori-moduli.spec.ts` (rule misure-e-test).
 * Le domande vengono dal dataset: la spec non scrive testi, legge quelli che la pagina mostra.
 */
test.use({ deviceScaleFactor: 2 });

// Dal 2/11/2026 (seconda ondata) le FAQ ci sono in tutte e cinque le lingue, su tutte le 22 collezioni
// e sulla home: le pagine «senza FAQ nella lingua» non esistono più sul sito. Il «nessun ripiego
// sull'italiano» lo custodisce `queries-locale.test.ts` (niente coalesce in FAQ_QUERY).
const PAGINE_CON_FAQ = [
  "/collezioni/boss",
  "/en/collections/boss",
  "/de/kollektionen/boss",
  "/fr/collections/boss",
  "/",
  "/en",
  "/de",
] as const;

const bottoni = (page: Page) => page.locator("h3[id^='faq-'] > button");

/** Due fotogrammi: il tempo di un commit di React e di un disegno. */
const dueFotogrammi = (page: Page) =>
  page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  );

/** I `FAQPage` della pagina servita. */
async function faqPageLd(page: Page) {
  const blocchi = await page.locator("script[type='application/ld+json']").allTextContents();
  return blocchi
    .map((b) => JSON.parse(b) as { "@type"?: string; mainEntity?: Array<{ name: string }> })
    .filter((o) => o["@type"] === "FAQPage");
}

async function inVista(el: Locator) {
  await el.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
  await el.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  );
}

/** Contrasto sui glifi: p95 dei pixel che cambiano spegnendo il colore, contro il fondo. */
async function contrastoGlifi(page: Page, el: Locator): Promise<number> {
  await inVista(el);
  const box = (await el.boundingBox())!;
  const clip = { x: box.x, y: box.y, width: box.width, height: box.height };
  const acceso = (await page.screenshot({ clip })).toString("base64");
  // La transizione del colore va spenta, o lo scatto prende il colore a metà strada.
  await el.evaluate((e) => {
    (e as HTMLElement).style.setProperty("transition", "none", "important");
    (e as HTMLElement).style.setProperty("color", "transparent", "important");
  });
  const spento = (await page.screenshot({ clip })).toString("base64");
  await el.evaluate((e) => {
    (e as HTMLElement).style.removeProperty("color");
    (e as HTMLElement).style.removeProperty("transition");
  });
  return page.evaluate(
    async ([a, s]) => {
      const pixel = async (b64: string) => {
        const i = new Image();
        i.src = `data:image/png;base64,${b64}`;
        await i.decode();
        const cv = new OffscreenCanvas(i.width, i.height);
        const x = cv.getContext("2d")!;
        x.drawImage(i, 0, 0);
        return x.getImageData(0, 0, i.width, i.height).data;
      };
      const lum = (r: number, g: number, b: number) => {
        const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const da = await pixel(a);
      const ds = await pixel(s);
      const rapporti: number[] = [];
      for (let k = 0; k < da.length; k += 4) {
        const d =
          Math.abs(da[k] - ds[k]) +
          Math.abs(da[k + 1] - ds[k + 1]) +
          Math.abs(da[k + 2] - ds[k + 2]);
        if (d <= 30) continue;
        const [l1, l2] = [lum(da[k], da[k + 1], da[k + 2]), lum(ds[k], ds[k + 1], ds[k + 2])].sort(
          (p, q) => q - p,
        );
        rapporti.push((l1 + 0.05) / (l2 + 0.05));
      }
      rapporti.sort((p, q) => p - q);
      return rapporti[Math.floor(rapporti.length * 0.95)] ?? 0;
    },
    [acceso, spento],
  );
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("struttura APG: h3 col bottone come unico figlio, aria-controls e aria-labelledby, tutte chiuse", async ({
  page,
}) => {
  await page.goto("/collezioni/boss");
  const n = await bottoni(page).count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const b = bottoni(page).nth(i);
    const forma = await b.evaluate((btn) => {
      const h = btn.parentElement!;
      const pannello = document.getElementById(btn.getAttribute("aria-controls") ?? "");
      return {
        heading: h.tagName,
        figli: h.children.length,
        testoSoloNelBottone: h.textContent === btn.textContent,
        tipo: btn.getAttribute("type"),
        espanso: btn.getAttribute("aria-expanded"),
        ruolo: pannello?.getAttribute("role"),
        etichetta: pannello?.getAttribute("aria-labelledby") === btn.id,
        nascosto: pannello?.getAttribute("hidden"),
        altezza: btn.getBoundingClientRect().height,
        icona: btn.querySelector("svg")?.getAttribute("aria-hidden"),
      };
    });
    expect(forma).toEqual({
      heading: "H3",
      figli: 1,
      testoSoloNelBottone: true,
      tipo: "button",
      espanso: "false",
      ruolo: "region",
      etichetta: true,
      nascosto: "until-found",
      altezza: expect.any(Number),
      icona: "true",
    });
    expect(forma.altezza).toBeGreaterThanOrEqual(44);
  }
  // l'h3 sta sotto l'H2 della sezione
  await expect(page.locator("section:has(h3[id^='faq-']) h2")).toHaveCount(1);
});

test("la risposta di un pannello chiuso è nell'HTML servito", async ({ page, request }) => {
  await page.goto("/collezioni/boss");
  const prima = await page.locator("[role=region][id^='faq-']").first().textContent();
  expect(prima?.trim().length).toBeGreaterThan(40);
  const html = await (await request.get("/collezioni/boss")).text();
  expect(html).toContain(prima!.trim().slice(0, 60));
});

test("tastiera: Tab arriva ai bottoni in ordine, Invio e Spazio aprono e chiudono, il fuoco resta", async ({
  page,
}) => {
  await page.goto("/collezioni/boss");
  const n = await bottoni(page).count();
  const primo = bottoni(page).first();
  await primo.focus();
  for (let i = 1; i < n; i++) {
    await page.keyboard.press("Tab");
    await expect(bottoni(page).nth(i)).toBeFocused();
  }
  await primo.focus();
  const pannello = page.locator(`#${await primo.getAttribute("aria-controls")}`);
  await page.keyboard.press("Enter");
  await expect(primo).toHaveAttribute("aria-expanded", "true");
  await expect(pannello).toBeVisible();
  await expect(primo).toBeFocused();
  await page.keyboard.press("Space");
  await expect(primo).toHaveAttribute("aria-expanded", "false");
  await expect(pannello).toBeHidden();
  await expect(primo).toBeFocused();
});

test("più domande aperte insieme; aprire scrive #faq-… e manda faq_apri", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __va: unknown[]; va: (...a: unknown[]) => void };
    w.__va = [];
    w.va = (...a) => w.__va.push(a);
  });
  await page.goto("/collezioni/boss");
  const [a, b] = [bottoni(page).nth(0), bottoni(page).nth(1)];
  await a.click();
  await b.click();
  await expect(a).toHaveAttribute("aria-expanded", "true");
  await expect(b).toHaveAttribute("aria-expanded", "true");
  const idB = (await b.getAttribute("aria-controls"))!.replace(/-panel$/, "");
  expect(new URL(page.url()).hash).toBe(`#${idB}`);
  const eventi = await page.evaluate(() => (window as unknown as { __va: unknown[] }).__va);
  expect(eventi).toContainEqual([
    "event",
    // Due proprietà sole (piano Pro, 4/11/2026): il percorso porta già la lingua.
    { name: "faq_apri", data: { pagina: "/collezioni/boss", domanda: idB } },
  ]);
  // chiudere quella dell'hash toglie l'hash
  await b.click();
  expect(new URL(page.url()).hash).toBe("");
});

test("link diretto: #faq-… apre la domanda e la ferma sotto la barra fissa", async ({ page }) => {
  await page.goto("/collezioni/boss");
  const id = await page.locator("h3[id^='faq-']").nth(2).getAttribute("id");
  // Da una pagina vuota: l'indirizzo con l'hash si carica da zero, come chi arriva da un link.
  // ⚠️ Due goto nello stesso documento a meno di 200 ms (il secondo è un hashchange prima
  // dell'idratazione) perdono l'hash 8 volte su 15: l'avvio del router riscrive l'URL di partenza.
  // Aspettando l'idratazione, 15 su 15 (sonda del 30/10/2026). È il banco, non un utente.
  await page.goto("about:blank");
  await page.goto(`/collezioni/boss#${id}`);
  const bottone = page.locator(`#${id}-button`);
  await expect(bottone).toHaveAttribute("aria-expanded", "true");
  await dueFotogrammi(page);
  const [top, barra] = await page.evaluate((i) => {
    const nav = getComputedStyle(document.documentElement).getPropertyValue("--fa-nav-h");
    return [document.getElementById(i)!.getBoundingClientRect().top, Number.parseFloat(nav)];
  }, id!);
  expect(Math.abs(top - barra)).toBeLessThanOrEqual(2);
});

test("la ricerca nella pagina apre un pannello chiuso (frammento di testo, Chromium)", async ({
  page,
}) => {
  await page.goto("/collezioni/boss");
  const pannello = page.locator("[role=region][id^='faq-']").nth(1);
  const parole = (await pannello.locator("p").first().textContent())!
    .split(/\s+/)
    .slice(3, 8)
    .join(" ");
  // Da una pagina vuota, cioè caricata da zero, come chi arriva da Google con un `#:~:text=`. Prima
  // dello script in linea della sezione falliva 8 volte su 10: il browser cercava il testo quando i
  // pannelli erano ancora `hidden=""` (sonda del 30/10/2026).
  await page.goto("about:blank");
  await page.goto(`/collezioni/boss#:~:text=${encodeURIComponent(parole)}`);
  await expect(pannello).toBeVisible();
  await expect(bottoni(page).nth(1)).toHaveAttribute("aria-expanded", "true");
});

for (const url of PAGINE_CON_FAQ) {
  test(`JSON-LD ${url}: le Question sono i bottoni visibili, una per una`, async ({ page }) => {
    await page.goto(url);
    const ld = await faqPageLd(page);
    expect(ld).toHaveLength(1);
    const nomi = ld[0].mainEntity!.map((q) => q.name);
    const testi = (await bottoni(page).allTextContents()).map((t) => t.trim());
    expect(nomi).toEqual(testi);
    expect(new Set(nomi).size).toBe(nomi.length);
  });
}

test("solo sulla collezione la riga «Non trovi la risposta?» col link a /contatti", async ({
  page,
}) => {
  await page.goto("/collezioni/boss");
  const link = page.locator("section:has(h3[id^='faq-']) a[href='/contatti']");
  await expect(link).toHaveCount(1);
  await page.goto("/");
  await expect(page.locator("section:has(h3[id^='faq-']) a[href='/contatti']")).toHaveCount(0);
});

test("contrasti sui glifi a DPR 2: domanda, risposta, grassetto e link ≥ 4,5; icona ≥ 3", async ({
  page,
}) => {
  await page.goto("/collezioni/boss");
  const n = await bottoni(page).count();
  for (let i = 0; i < n; i++) await bottoni(page).nth(i).click();
  const sezione = page.locator("section:has(h3[id^='faq-'])");
  const misure = {
    domanda: await contrastoGlifi(page, bottoni(page).first().locator("span")),
    risposta: await contrastoGlifi(page, sezione.locator("[role=region] p").first()),
    grassetto: await contrastoGlifi(page, sezione.locator("[role=region] strong").first()),
    link: await contrastoGlifi(page, sezione.locator("[role=region] a").first()),
    icona: await contrastoGlifi(page, bottoni(page).first().locator("svg")),
  };
  expect(misure.domanda).toBeGreaterThanOrEqual(4.5);
  expect(misure.risposta).toBeGreaterThanOrEqual(4.5);
  expect(misure.grassetto).toBeGreaterThanOrEqual(4.5);
  expect(misure.link).toBeGreaterThanOrEqual(4.5);
  expect(misure.icona).toBeGreaterThanOrEqual(3);
  // il grassetto dal ruolo, mai sottolineato; il link sottolineato
  const stile = await sezione.evaluate((s) => {
    const strong = s.querySelector("[role=region] strong")!;
    const a = s.querySelector("[role=region] a")!;
    const ruolo = document.createElement("b");
    ruolo.style.fontWeight = "var(--fa-strong-font-weight)";
    document.body.appendChild(ruolo);
    const peso = getComputedStyle(ruolo).fontWeight;
    ruolo.remove();
    return {
      pesoGrassetto: getComputedStyle(strong).fontWeight === peso,
      grassettoSottolineato: getComputedStyle(strong).textDecorationLine,
      linkSottolineato: getComputedStyle(a).textDecorationLine,
    };
  });
  expect(stile).toEqual({
    pesoGrassetto: true,
    grassettoSottolineato: "none",
    linkSottolineato: "underline",
  });
});

test("fuoco da tastiera navy; con prefers-reduced-motion l'icona non anima e il pannello si apre subito", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/collezioni/boss");
  const primo = bottoni(page).first();
  await primo.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const [anello, navy] = await primo.evaluate((b) => {
    const s = document.createElement("span");
    s.style.color = "var(--color-fa-navy)";
    document.body.appendChild(s);
    const c = getComputedStyle(s).color;
    s.remove();
    return [getComputedStyle(b).boxShadow, c];
  });
  expect(anello).toContain(navy);
  const icona = primo.locator("svg");
  expect(await icona.evaluate((e) => getComputedStyle(e).transitionProperty)).toBe("none");
  await page.keyboard.press("Enter");
  const pannello = page.locator(`#${await primo.getAttribute("aria-controls")}`);
  // né animazioni CSS né l'altezza scritta da GSAP sul pannello
  expect(
    await pannello.evaluate(
      (p) => p.getAnimations().length + ((p as HTMLElement).style.height ? 1 : 0),
    ),
  ).toBe(0);
});

test("hover: velo navy e domanda navy; chiusura animata, il pannello si nasconde a fine corsa", async ({
  page,
}) => {
  await page.goto("/collezioni/boss");
  const primo = bottoni(page).first();
  await inVista(primo);
  const [velo, navy] = await page.evaluate(() => {
    // il velo del bottone secondario su chiaro (la classe c'è nel CSS perché la usa `Button`)
    const s = document.createElement("span");
    s.className = "bg-fa-navy/8";
    s.style.color = "var(--color-fa-navy)";
    document.body.appendChild(s);
    const c = [getComputedStyle(s).backgroundColor, getComputedStyle(s).color];
    s.remove();
    return c;
  });
  await primo.hover();
  await expect.poll(() => primo.evaluate((b) => getComputedStyle(b).backgroundColor)).toBe(velo);
  await expect.poll(() => primo.evaluate((b) => getComputedStyle(b).color)).toBe(navy);

  await primo.click();
  const pannello = page.locator(`#${await primo.getAttribute("aria-controls")}`);
  await expect(pannello).toBeVisible();
  await page.waitForTimeout(300);
  await primo.click();
  // lo stato cambia subito, il pannello resta visibile mentre si chiude
  await expect(primo).toHaveAttribute("aria-expanded", "false");
  expect(await pannello.getAttribute("hidden")).toBeNull();
  await expect(pannello).toHaveAttribute("hidden", "until-found");
  await expect(pannello).toBeHidden();
});

test("con prefers-reduced-motion la chiusura è immediata", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/collezioni/boss");
  const primo = bottoni(page).first();
  const pannello = page.locator(`#${await primo.getAttribute("aria-controls")}`);
  await primo.click();
  await primo.click();
  expect(await pannello.getAttribute("hidden")).not.toBeNull();
});

test("in stampa tutte le risposte sono aperte", async ({ page }) => {
  await page.goto("/collezioni/boss");
  await page.emulateMedia({ media: "print" });
  const visibili = await page
    .locator("[role=region][id^='faq-']")
    .evaluateAll((ps) => ps.map((p) => p.checkVisibility()));
  expect(visibili.length).toBeGreaterThan(0);
  expect(visibili.every(Boolean)).toBe(true);
});
