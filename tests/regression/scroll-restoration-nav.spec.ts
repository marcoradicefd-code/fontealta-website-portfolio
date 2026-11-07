import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Indietro e Avanti del browser tornano dove si era; le navigazioni in avanti
 * partono in cima (decisione di Marco, 12/10/2026: revoca la regola di luglio
 * «il Back riporta in cima», PR #91). Diagnosi nel commento lungo in
 * src/lib/lenis-provider.tsx.
 *
 * COSA SI CUSTODISCE:
 *  (a) il caso del 31/07: Back da una scheda modello con la collezione scorsa OLTRE
 *      il fondo della scheda. Allora il ripristino veniva tagliato al fondo della
 *      pagina corta e lo scroll anchoring trascinava sul footer. Oggi deve tornare
 *      alla posizione di partenza: né footer né cima;
 *  (b) dopo il Back Lenis ha il limite della pagina che si vede e lo scroll dell'utente
 *      non viene annullato: ruotando verso il basso la pagina SCENDE (era il difetto del
 *      limite rimasto a quello della scheda, 12/10), sia col Back dato appena l'URL cambia
 *      (tre giri) sia a scheda assestata;
 *  (c) dalla lista delle collezioni, Back torna alla card cliccata;
 *  (d) le navigazioni in avanti restano in cima;
 *  (e) Back su una collezione filtrata ritrova filtri e posizione;
 *  (f) Back mentre Lenis sta ancora animando uno scroll sulla scheda: la posizione
 *      ripristinata non viene sovrascritta dall'animazione (12/10: tornava a 1200
 *      invece di 2400).
 *
 * ⚠️ LA PRECONDIZIONE DI (a) È IL TEST. Se la posizione salvata non supera il fondo
 * della scheda modello non c'è nessun taglio da evitare, e un verde non prova niente.
 * Per questo la soglia è asserita PRIMA di guardare l'esito.
 *
 * ⚠️ Il clic si fa col mouse sul centro di una card che è GIÀ nel viewport, non con
 * `locator.click()`: quello porta l'elemento in vista da sé quando lo giudica coperto,
 * e la posizione da cui si parte non è più quella misurata (visto il 12/10: 3863 letti
 * prima del clic, 4018 al clic). Basta il centro: a 1280×720 una card modello alta
 * 450 non sta quasi mai intera fra la nav e il fondo.
 *
 * Controprova (12/10, tre giri ciascuna). Su `main` (Back sempre in cima): (e) e (f) falliscono
 * 3 volte su 3, (a) 2 su 3 e (b) «subito» 2 su 3; (c) passa 3 su 3 e (b) «assestata» pure.
 * Non sono difetti della guardia: su `main` il Back in cima è una GARA, a volte il browser
 * rimette la posizione dopo Lenis e vince, e (c) non può fallire in modo affidabile. Sul
 * codice del ramo prima della cura del limite (con `resize()` nell'effetto del ritorno)
 * falliscono (b) «subito» e (f) 3 volte su 3: servono il build E2E (`window.__lenis`) e,
 * per (b), che il Back cada nel fotogramma del commit della scheda.
 *
 * ⚠️ Prima di leggere un rosso come conferma, controllare che la pagina renda davvero:
 * un server rimasto in piedi da un build vecchio serve chunk inesistenti e pagine
 * vuote alte quanto il viewport.
 */

const COLLEZIONE = "/collezioni/ille";

/**
 * Browser italiano. Senza questo, `devices["Desktop Chrome"]` annuncia `en-US` in
 * Accept-Language, next-intl negozia la lingua (`localePrefix: "as-needed"`) e
 * dirotta su `/en/collections/ille`: si misurerebbe un'altra pagina, con un'altra
 * altezza, credendo di essere su quella italiana.
 */
test.use({ locale: "it-IT" });

const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
const maxScroll = (page: Page) =>
  page.evaluate(() => Math.round(document.documentElement.scrollHeight - window.innerHeight));

/**
 * Stato di Lenis. `window.__lenis` esiste solo nel build E2E (NEXT_PUBLIC_E2E=1, come
 * `pnpm test:e2e`): in un build normale restituisce null e le asserzioni su Lenis si
 * saltano, restano quelle sulla posizione.
 */
const lenis = (page: Page) =>
  page.evaluate(() => {
    const l = (
      window as unknown as {
        __lenis?: { limit: number; targetScroll: number; isScrolling: string | false };
      }
    ).__lenis;
    return l
      ? { limit: Math.round(l.limit), target: Math.round(l.targetScroll), animando: l.isScrolling }
      : null;
  });

/** Attende che lo scroll Lenis si fermi, senza sleep fissi. */
async function fermo(page: Page) {
  await expect
    .poll(
      async () => {
        const a = await scrollY(page);
        await page.waitForTimeout(150);
        return a === (await scrollY(page));
      },
      { timeout: 10_000, message: "lo scroll Lenis deve fermarsi" },
    )
    .toBe(true);
  return scrollY(page);
}

/** Scroll con la ruota: passa da Lenis (smoothWheel), come il gesto reale. */
async function scrollaConLaRuota(page: Page, quanto: number) {
  await page.mouse.move(640, 360);
  for (let i = 0; i < Math.ceil(Math.abs(quanto) / 400); i++) {
    await page.mouse.wheel(0, Math.sign(quanto) * 400);
    await page.waitForTimeout(30);
  }
  return fermo(page);
}

/** Clicca col mouse la prima card col centro nel viewport; restituisce posizione e href. */
async function cliccaCardInVista(page: Page, cards: Locator) {
  const altezza = page.viewportSize()?.height ?? 720;
  const n = await cards.count();
  for (let i = 0; i < n; i++) {
    const box = await cards.nth(i).boundingBox();
    const centro = box ? box.y + box.height / 2 : -1;
    if (!box || centro < 80 || centro > altezza - 80) continue;
    const href = await cards.nth(i).getAttribute("href");
    const y = await scrollY(page);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    return { y, href: href ?? "" };
  }
  const centri = await cards.evaluateAll((els) =>
    els.map((el) =>
      Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2),
    ),
  );
  throw new Error(
    `nessuna card col centro nel viewport: la precondizione non regge ` +
      `(scrollY ${await scrollY(page)}, ${n} card, centri ${centri.slice(0, 12).join(", ")})`,
  );
}

/** Dopo il Back: la posizione si stabilizza e ci resta. */
async function attendiPosizione(page: Page, attesa: number) {
  await expect
    .poll(() => scrollY(page), {
      timeout: 8_000,
      message: `dopo il Back la pagina deve tornare a ${attesa}`,
    })
    .toBeGreaterThanOrEqual(attesa - 2);
  await page.waitForTimeout(1500);
  const finale = await scrollY(page);
  expect(Math.abs(finale - attesa), `tornata a ${finale}, attesa ${attesa}`).toBeLessThanOrEqual(2);
  return finale;
}

/** Apre la collezione e scrolla in profondità con la ruota. */
async function apriLaCollezione(page: Page, scrollA: number) {
  await page.goto(COLLEZIONE, { waitUntil: "domcontentloaded" });
  expect(page.url(), "la rotta IT non deve essere stata dirottata").toContain(COLLEZIONE);
  const cards = page.locator('main a[href*="/modello/"]');
  await cards.first().waitFor({ timeout: 30_000 });
  await scrollaConLaRuota(page, scrollA);
  return cards;
}

/**
 * Clicca una card modello in vista e aspetta la scheda. `assestata`: aspetta anche che la
 * scheda sia dipinta, come farebbe un utente. Senza, il Back dato dal chiamante arriva a
 * quando capita: su una navigazione client `networkidle` è già soddisfatto e ritorna
 * all'istante, quindi `goBack` può cadere meno di un fotogramma dopo il commit.
 */
async function vaiAllaSchedaModello(page: Page, scrollA: number, assestata = false) {
  const cards = await apriLaCollezione(page, scrollA);
  const altezzaLista = await page.evaluate(() => document.documentElement.scrollHeight);
  const { y } = await cliccaCardInVista(page, cards);
  await page.waitForURL(/\/modello\//, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  if (assestata) {
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight), { timeout: 8_000 })
      .not.toBe(altezzaLista);
    // Due fotogrammi: il ResizeObserver del body ha avuto il suo turno.
    await page.evaluate(
      () =>
        new Promise<void>((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok()))),
    );
  }
  return { yPrimaDelClick: y, maxModello: await maxScroll(page) };
}

/**
 * Clicca una card e dà il Back appena l'URL è quello della scheda, senza aspettare che la
 * scheda sia dipinta: su una navigazione client `networkidle` è già soddisfatto e ritorna
 * all'istante, quindi `goBack` cade meno di un fotogramma dopo il commit. Un utente non
 * ci arriva, il banco sì. Cade prima del fotogramma solo a volte: il chiamante ripete.
 */
async function clicEBackSubito(page: Page, cards: Locator) {
  await cliccaCardInVista(page, cards);
  await page.waitForURL(/\/modello\//, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`${COLLEZIONE}$`), { timeout: 30_000 });
  await page.waitForTimeout(120);
}

/**
 * STRUTTURALE, non dipende dalla gara: dopo il Back il limite di Lenis è quello della
 * pagina che si vede e il suo bersaglio è dove si è. Col limite rimasto a quello della
 * scheda (2156 su una pagina da 8176) la prima ruota tagliava il bersaglio e la pagina
 * SALIVA da 2400 a 2156. Si aspetta: il ResizeObserver lo allinea al fotogramma. Senza
 * `window.__lenis` (build normale) non c'è niente da leggere e si salta.
 */
async function limiteDiLenisGiusto(page: Page, dove: string) {
  if ((await lenis(page)) === null) return;
  await expect
    .poll(
      async () => {
        const [l, max] = await Promise.all([lenis(page), maxScroll(page)]);
        return l !== null && l.limit >= max - 2 && Math.abs(l.target - (await scrollY(page))) <= 2;
      },
      {
        timeout: 4_000,
        message: `${dove}: dopo il Back il limite di Lenis deve essere quello della pagina nuova`,
      },
    )
    .toBe(true);
}

// (a) Il caso del 31/07: Back con la collezione scorsa oltre il fondo della scheda.
test("Back da una scheda modello torna alla posizione di partenza, non al footer né in cima", async ({
  page,
}) => {
  const { yPrimaDelClick, maxModello } = await vaiAllaSchedaModello(page, 4000);

  // GUARDIA DI SETUP — senza questa soglia il test non prova niente (vedi testata).
  expect(
    yPrimaDelClick,
    `la posizione salvata (${yPrimaDelClick}) deve superare il fondo della scheda modello ` +
      `(${maxModello}): è la condizione del taglio, senza non c'è niente da custodire`,
  ).toBeGreaterThan(maxModello);

  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForURL(new RegExp(COLLEZIONE), { timeout: 30_000 });
  await attendiPosizione(page, yPrimaDelClick);
});

// (b) Dopo il Back Lenis ha il limite della pagina che si vede, e lo scroll dell'utente
// non viene annullato. Due flussi: Back dato appena l'URL cambia (il caso del banco) e a
// scheda assestata (il caso dell'utente).
test("dopo il Back dato subito Lenis ha il limite giusto e la ruota scende", async ({ page }) => {
  const cards = await apriLaCollezione(page, 2400);
  // Prima del 12/10 il primo giro, a freddo, falliva 4 volte su 4: il limite restava
  // quello della scheda. Gli altri due sono a caldo (la scheda è già in cache) e coprono
  // il caso in cui il commit arriva più in fretta.
  for (let giro = 1; giro <= 3; giro++) {
    await clicEBackSubito(page, cards);
    await limiteDiLenisGiusto(page, `giro ${giro}`);
  }
  const tornato = await scrollY(page);
  const dopo = await scrollaConLaRuota(page, 2400);
  expect(
    dopo,
    `lo scroll dell'utente è stato annullato: da ${tornato} a ${dopo} dopo 2400 px di ruota`,
  ).toBeGreaterThan(tornato + 300);
});

test("dopo il Back a scheda assestata Lenis ha il limite giusto e la ruota scende", async ({
  page,
}) => {
  await vaiAllaSchedaModello(page, 2400, true);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForURL(new RegExp(COLLEZIONE), { timeout: 30_000 });
  await page.waitForTimeout(120);
  const tornato = await scrollY(page);
  await limiteDiLenisGiusto(page, "scheda assestata");
  const dopo = await scrollaConLaRuota(page, 2400);
  expect(
    dopo,
    `lo scroll dell'utente è stato annullato: da ${tornato} a ${dopo} dopo 2400 px di ruota`,
  ).toBeGreaterThan(tornato + 300);
});

// (f) Back mentre Lenis sta ancora animando uno scroll sulla scheda.
test("Back mentre Lenis anima uno scroll sulla scheda torna alla posizione di partenza", async ({
  page,
}) => {
  const { yPrimaDelClick } = await vaiAllaSchedaModello(page, 2400, true);
  await page.mouse.move(640, 360);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(100);

  // GUARDIA DI SETUP — se l'animazione è già finita non c'è niente da cancellare.
  const l = await lenis(page);
  if (l !== null) {
    expect(l.animando, "Lenis deve stare ancora animando quando si dà il Back").toBe("smooth");
  }

  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForURL(new RegExp(COLLEZIONE), { timeout: 30_000 });
  await attendiPosizione(page, yPrimaDelClick);
});

// (c) Dalla lista delle collezioni, Back torna alla card cliccata.
test("Back dalla pagina di una collezione torna alla card nella lista", async ({ page }) => {
  await page.goto("/collezioni", { waitUntil: "domcontentloaded" });
  const cards = page.locator('main a[href^="/collezioni/"]');
  await cards.first().waitFor({ timeout: 30_000 });
  await scrollaConLaRuota(page, 1600);
  const { y, href } = await cliccaCardInVista(page, cards);
  expect(y, "la lista deve essere scorsa, altrimenti cima e ritorno coincidono").toBeGreaterThan(
    800,
  );
  await page.waitForURL((u) => u.pathname === href, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");

  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/collezioni$/, { timeout: 30_000 });
  await attendiPosizione(page, y);
});

// (d) Le navigazioni in avanti restano in cima.
test("le navigazioni in avanti partono in cima", async ({ page }) => {
  await page.goto("/collezioni", { waitUntil: "domcontentloaded" });
  const collezioni = page.locator('main a[href^="/collezioni/"]');
  await collezioni.first().waitFor({ timeout: 30_000 });
  await scrollaConLaRuota(page, 1600);
  const { href } = await cliccaCardInVista(page, collezioni);
  await page.waitForURL((u) => u.pathname === href, { timeout: 30_000 });
  await expect.poll(() => scrollY(page), { timeout: 8_000 }).toBeLessThanOrEqual(5);

  const modelli = page.locator('main a[href*="/modello/"]');
  await modelli.first().waitFor({ timeout: 30_000 });
  await scrollaConLaRuota(page, 1200);
  await cliccaCardInVista(page, modelli);
  await page.waitForURL(/\/modello\//, { timeout: 30_000 });
  await expect.poll(() => scrollY(page), { timeout: 8_000 }).toBeLessThanOrEqual(5);
});

// (e) Back su una collezione filtrata ritrova filtri e posizione.
test("Back su una collezione filtrata ritrova filtri e posizione", async ({ page }) => {
  const modelli = page.locator('main a[href*="/modello/"]');
  await page.goto("/collezioni/boss", { waitUntil: "load" });
  await modelli.first().waitFor({ timeout: 30_000 });
  const tutti = await modelli.count();

  // ⚠️ Il filtro deve RESTRINGERE la griglia: `?finitura=MX` su Boss non toglie niente
  // (53 su 53, misurato il 12/10), e un conteggio uguale non proverebbe il ritorno.
  await page.goto("/collezioni/boss?ambiente=doccia", { waitUntil: "load" });
  // I filtri entrano all'hydration: si conta la griglia quando il numero è fermo.
  await expect.poll(() => modelli.count(), { timeout: 8_000 }).toBeLessThan(tutti);
  const filtrati = await modelli.count();
  await scrollaConLaRuota(page, 1600);
  const { y } = await cliccaCardInVista(page, modelli);
  await page.waitForURL(/\/modello\//, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");

  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/collezioni\/boss/, { timeout: 30_000 });
  expect(new URL(page.url()).search, "il filtro deve essere ancora nell'URL").toBe(
    "?ambiente=doccia",
  );
  await expect(modelli, "la griglia deve essere ancora filtrata").toHaveCount(filtrati);
  await attendiPosizione(page, y);
});
