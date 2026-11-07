import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

/**
 * La pagina della tavola dell'officina (`/officina`, 27/10/2026; spec
 * `docs/specs/tavola-officina.md`). Gira su Chromium e su WebKit (progetto
 * `webkit-officina`), senza CDP.
 *
 * Custodisce: l'iframe alto quanto la finestra meno l'header; niente footer; nessuno
 * scroll della pagina (Lenis non ha codice per questa pagina: lo tiene questa spec);
 * la lingua dall'header, con l'iframe ricreato e nessuna voce nella cronologia; la
 * voce che parte solo al clic; la tastiera che entra ed esce dalla tavola (WCAG
 * 2.1.2); le scorciatoie da un carattere solo col chiosco (WCAG 2.1.4); gli eventi delle
 * statistiche, solo quelli veri.
 */

const LINGUE = {
  it: "/officina",
  en: "/en/workshop",
  de: "/de/werkstatt",
  fr: "/fr/atelier",
  es: "/es/taller",
} as const;

const NAV_H = 64;
const tavola = (page: Page) => page.frameLocator("iframe[src^='/officina-tavola/']");
const frameTavola = (page: Page) =>
  page.frames().find((f) => f.url().includes("/officina-tavola/"));

/** La tavola ha disegnato la sua interfaccia: c'è l'indice dei reparti. */
async function tavolaPronta(page: Page) {
  await expect(tavola(page).locator("#idx button").first()).toBeAttached({ timeout: 20_000 });
}

/** Lenis anima la rotella: si aspetta che abbia finito prima di leggere `scrollY`. */
async function dopoLaRotella(page: Page) {
  await page.waitForTimeout(400);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
}

for (const [larghezza, altezza] of [
  [1440, 900],
  [390, 844],
] as const) {
  test.describe(`a ${larghezza}`, () => {
    test.use({ viewport: { width: larghezza, height: altezza } });

    test("l'iframe prende la finestra meno l'header, e il footer non c'è", async ({ page }) => {
      await page.goto("/officina");
      const box = await page.locator("iframe[src^='/officina-tavola/']").boundingBox();
      expect(box).not.toBeNull();
      expect(Math.round(box!.y)).toBe(NAV_H);
      expect(Math.round(box!.height)).toBe(altezza - NAV_H);
      expect(Math.round(box!.width)).toBe(larghezza);
      await expect(page.locator("footer")).toBeHidden();
      const doc = await page.evaluate(() => ({
        scroll: document.documentElement.scrollHeight,
        finestra: innerHeight,
      }));
      expect(doc.scroll, "il documento non deve scorrere").toBe(doc.finestra);
    });

    test("la rotella sopra l'header e sopra la tavola non muove la pagina", async ({ page }) => {
      await page.goto("/officina");
      await tavolaPronta(page);
      await page.mouse.move(larghezza / 2, NAV_H / 2);
      await page.mouse.wheel(0, 800);
      await dopoLaRotella(page);
      expect(await page.evaluate(() => scrollY), "rotella sull'header").toBe(0);
      await page.mouse.move(larghezza / 2, NAV_H + (altezza - NAV_H) / 2);
      await page.mouse.wheel(0, 800);
      await dopoLaRotella(page);
      expect(await page.evaluate(() => scrollY), "rotella sulla tavola").toBe(0);
    });

    test("il selettore di lingua della tavola è nascosto: comanda l'header", async ({ page }) => {
      await page.goto("/officina");
      await tavolaPronta(page);
      await expect(tavola(page).locator("html")).toHaveClass(/\bembed\b/);
      await expect(tavola(page).locator("#langsw")).toBeHidden();
    });
  });
}

test("la tavola parla la lingua della pagina, in tutte e cinque", async ({ page }) => {
  for (const [lingua, percorso] of Object.entries(LINGUE)) {
    await page.goto(percorso);
    const iframe = page.locator("iframe[src^='/officina-tavola/']");
    await expect(iframe).toHaveAttribute(
      "src",
      `/officina-tavola/index.html?embed=1&lang=${lingua}`,
    );
    await expect(iframe).toHaveAttribute("title", /\S/);
    await expect(tavola(page).locator("html")).toHaveAttribute("lang", lingua);
    await expect(page.locator("h1")).toHaveCount(1);
  }
});

test("cambio di lingua dall'header: l'iframe si ricrea, e Indietro torna alla pagina di prima", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/produzione");
  await page.goto("/officina");
  await tavolaPronta(page);
  await page.locator("header button[aria-haspopup='listbox']").click();
  await page.getByRole("option", { name: "English" }).click();
  await page.waitForURL("**/en/workshop");
  await expect(tavola(page).locator("html")).toHaveAttribute("lang", "en");
  // La lingua cambia con `router.replace`, e l'iframe non ha lasciato voci sue: Indietro
  // esce dalla pagina, invece di riportare la tavola all'italiano.
  await page.goBack();
  await page.waitForURL((u) => u.pathname === "/produzione");
});

test("a 390, il menu si apre e si chiude senza muovere la pagina, e cambia la lingua", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/produzione");
  await page.goto("/officina");
  await tavolaPronta(page);
  const hamburger = page.locator("header nav > button[aria-expanded]");
  const pannello = page.locator("div[data-lenis-prevent]").first();

  await hamburger.click();
  await expect(pannello).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await hamburger.click();
  await expect(pannello).toBeHidden();
  expect(await page.evaluate(() => scrollY)).toBe(0);

  await hamburger.click();
  await pannello.locator("button[aria-haspopup='listbox']").click();
  await pannello.getByRole("option", { name: "Deutsch" }).click();
  await page.waitForURL("**/de/werkstatt");
  await expect(page.locator("iframe[src^='/officina-tavola/']")).toHaveAttribute(
    "src",
    "/officina-tavola/index.html?embed=1&lang=de",
  );
  await expect(tavola(page).locator("html")).toHaveAttribute("lang", "de");
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.goBack();
  await page.waitForURL((u) => u.pathname === "/produzione");
});

test("la voce: nessuna richiesta prima del clic, poi il file con l'impronta del manifest", async ({
  page,
  request,
}) => {
  const manifest = (await (await request.get("/officina-tavola/manifest.json")).json()) as {
    voce: string;
  };
  expect(manifest.voce).toMatch(
    /^https:\/\/media\.fontealta\.it\/tavola\/voce-it-[0-9a-f]{8}\.mp3$/,
  );
  const richieste: string[] = [];
  // Il file non si scarica davvero: conta l'indirizzo chiesto, non la rete.
  await page.route("https://media.fontealta.it/**", (r) => {
    richieste.push(r.request().url());
    return r.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.alloc(0) });
  });
  await page.goto("/officina");
  await tavolaPronta(page);
  await page.waitForTimeout(1000);
  expect(richieste, "nessuna richiesta della voce prima del clic").toEqual([]);
  await tavola(page).locator("#voice").click();
  await expect.poll(() => richieste).toContain(manifest.voce);
});

test.describe("tastiera", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  /**
   * ⚠️ **Su WebKit il Tab di chi usa la tastiera è Opzione+Tab.** WebKit, come Safari con
   * le impostazioni di base, col solo Tab salta link e bottoni: misurato il 27/10/2026
   * (`tmp/officina/sonda-fuoco*.cjs`), entrava nel documento della tavola senza
   * raggiungerne un controllo e ne usciva al Tab dopo, mentre con Alt+Tab attraversa
   * Ferma le animazioni, Precedente, Avvia, Successivo, Tavola intera e Voce, e con
   * Alt+Maiusc+Tab torna alla pill dell'header. Chi naviga con la tastiera su Safari ha
   * «Premi Tab per evidenziare ogni elemento» acceso, o usa Opzione+Tab: è quella persona
   * che il test simula.
   */
  const tasti = (browserName: string) =>
    browserName === "webkit"
      ? { avanti: "Alt+Tab", indietro: "Alt+Shift+Tab" }
      : { avanti: "Tab", indietro: "Shift+Tab" };

  /** Il nodo che ha il fuoco nel documento della PAGINA. */
  const fuocoPagina = (page: Page) =>
    page.evaluate(() => {
      const a = document.activeElement;
      return {
        tag: a?.tagName.toLowerCase() ?? "",
        inHeader: !!a?.closest("header"),
        skip: !!a?.classList.contains("skip-to-content"),
      };
    });

  test("skip link, poi Tab nella tavola; Esc resta alla tavola", async ({ page, browserName }) => {
    const { avanti } = tasti(browserName);
    await page.goto("/officina");
    await tavolaPronta(page);
    await page.keyboard.press(avanti);
    expect((await fuocoPagina(page)).skip, "il primo Tab è lo skip link").toBe(true);
    // Un fotogramma fra Tab ed Enter: la sequenza di una persona (rule `misure-e-test`).
    await page.waitForTimeout(16);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(50);
    expect((await fuocoPagina(page)).tag).toBe("main");
    await page.keyboard.press(avanti);
    expect((await fuocoPagina(page)).tag, "dopo il main, il fuoco entra nella tavola").toBe(
      "iframe",
    );
    const dentro = await frameTavola(page)!.evaluate(
      () => document.activeElement !== document.body,
    );
    expect(dentro, "un controllo della tavola ha il fuoco").toBe(true);
    const url = page.url();
    await page.keyboard.press("Escape");
    expect(page.url()).toBe(url);
    expect((await fuocoPagina(page)).tag).toBe("iframe");
  });

  test("nessuna trappola (WCAG 2.1.2): Tab e Maiusc+Tab escono dalla tavola verso l'header", async ({
    page,
    browserName,
  }) => {
    const { avanti, indietro } = tasti(browserName);
    await page.goto("/officina");
    await tavolaPronta(page);
    // Ultimo controllo dell'header (la pill Area Riservata), poi Tab: si entra nella tavola.
    await page.locator("header a[href='/area-riservata']").focus();
    await page.keyboard.press(avanti);
    expect((await fuocoPagina(page)).tag).toBe("iframe");
    const dentro = await frameTavola(page)!.evaluate(
      () => document.activeElement?.tagName.toLowerCase() ?? "",
    );
    expect(dentro, "il fuoco è su un controllo della tavola").toBe("button");

    // Indietro: Maiusc+Tab dal primo controllo della tavola torna all'header.
    await page.keyboard.press(indietro);
    expect((await fuocoPagina(page)).inHeader, "Maiusc+Tab torna all'header").toBe(true);

    // Avanti: Tab attraversa la tavola e ne esce; dopo la tavola non c'è niente (il footer
    // non c'è), e il fuoco ricomincia dall'inizio della pagina: skip link o header.
    await page.keyboard.press(avanti);
    let uscito = false;
    for (let i = 0; i < 120 && !uscito; i++) {
      await page.keyboard.press(avanti);
      uscito = (await fuocoPagina(page)).tag !== "iframe";
    }
    expect(uscito, "Tab deve uscire dalla tavola").toBe(true);
    const f = await fuocoPagina(page);
    expect(f.skip || f.inHeader || f.tag === "body", JSON.stringify(f)).toBe(true);
    // Da lì il fuoco raggiunge di nuovo l'header.
    for (let i = 0; i < 3 && !(await fuocoPagina(page)).inHeader; i++) {
      await page.keyboard.press(avanti);
    }
    expect((await fuocoPagina(page)).inHeader, "dopo l'uscita, l'header").toBe(true);
  });

  /**
   * WCAG 2.1.4 (Marco, 28/10/2026): sul sito nessuna scorciatoia da un carattere. B, S, M
   * e i numeri non fanno niente; restano frecce, PagSu/PagGiù, Spazio ed Esc. Il fuoco sta
   * su un controllo della tavola, dove le lettere arrivano al suo gestore: la freccia alla
   * fine prova che i tasti lo raggiungono.
   */
  test("sul sito le lettere e i numeri non fanno niente (WCAG 2.1.4), le frecce sì", async ({
    page,
  }) => {
    // l'orologio finto scorre come quello vero; serve a far passare i 600 ms dei numeri senza un'attesa fissa
    await page.clock.install();
    await page.goto("/officina");
    await tavolaPronta(page);
    const t = tavola(page);
    await t.locator("#motion").focus();
    const stato = () =>
      frameTavola(page)!.evaluate(() => ({
        num: document.getElementById("num")!.textContent,
        play: document.getElementById("play")!.textContent,
        voce: document.getElementById("voice")!.getAttribute("aria-pressed"),
        muta: (document.getElementById("voce") as HTMLAudioElement).muted,
        titolo: document.getElementById("title")!.textContent,
      }));
    const prima = await stato();
    for (const tasto of ["b", "s", "m", "5"]) await page.keyboard.press(tasto);
    // i numeri aspettavano 600 ms il secondo tasto (10, 11, 12): si fa passare più di quel tempo,
    // così un salto al reparto 5 avrebbe già avuto luogo (Sonar S2925: niente attese fisse)
    await page.clock.runFor(800);
    expect(await stato()).toEqual(prima);
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await stato()).num).toBe("01");
  });
});

/**
 * Il chiosco (?kiosk=1) dal 28/10/2026 (Marco): il racconto del sito in loop, sui tempi della voce e coi
 * sottotitoli sempre visibili, muto di base; invito fisso e cinque lingue sempre a schermo, nessun bottone
 * del tocco. Con l'orologio finto il giro avanza di un secondo per salto (`fastForward`): ogni salto dà un
 * fotogramma, e il giro somma al più un secondo per fotogramma.
 */
const CHIOSCO = "/officina-tavola/index.html?kiosk=1&lang=it";

/** Fa scorrere il giro di `secondi`, un secondo per salto. */
async function scorri(page: Page, secondi: number) {
  for (let s = 0; s < secondi; s++) await page.clock.fastForward(1000);
}

/**
 * Sottotitolo e descrizione della tavola nella lingua di ?lang= (28/10/2026, difetto trovato da Cowork in
 * produzione, presente dalla #311): in `applyStatic` le due istruzioni stavano dopo un commento `//` sulla
 * stessa riga, quindi non giravano, e `#msub` e l'aria-label del canvas restavano in italiano in ogni lingua.
 * I testi attesi si leggono da `tavola/i18n/<lingua>.json`; gli spazi non separabili che `i18n.py` mette nel
 * francese si confrontano come spazi.
 */
test("la tavola scrive sottotitolo e descrizione del canvas nella lingua di ?lang=", async ({
  page,
}) => {
  const spazi = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");
  for (const lingua of ["en", "de", "fr", "es"]) {
    const ui = JSON.parse(
      readFileSync(path.join(process.cwd(), "tavola", "i18n", `${lingua}.json`), "utf-8"),
    ).ui as { sottotitolo: string; descrizioneTavola: string };
    await page.goto(`/officina-tavola/index.html?lang=${lingua}`);
    await expect(page.locator("html")).toHaveAttribute("lang", lingua);
    expect(spazi((await page.locator("#msub").textContent()) ?? ""), `${lingua}: #msub`).toBe(
      spazi(ui.sottotitolo),
    );
    expect(
      spazi((await page.locator("#scene").getAttribute("aria-label")) ?? ""),
      `${lingua}: aria-label del canvas`,
    ).toBe(spazi(ui.descrizioneTavola));
  }
});

test("col chiosco (?kiosk=1) R e i numeri funzionano, invito e lingue sempre a schermo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("https://media.fontealta.it/**", (r) => r.abort());
  await page.goto(CHIOSCO);
  const num = page.locator("#num");
  // il chiosco parte da solo col racconto, dal reparto 1
  await expect(num).toHaveText("01", { timeout: 10_000 });
  await expect(page.locator("#kinvito")).toHaveText("Tocca un reparto per vederlo da vicino");
  await expect(page.locator("#klang button")).toHaveCount(5);
  await expect(page.locator("#klang")).toBeVisible();
  await expect(page.locator("#tapcta")).toHaveCount(0);
  await page.keyboard.press("7");
  await expect(num).toHaveText("07");
  await page.keyboard.press("r");
  await expect(num).toHaveText("01");
  await expect(page.locator("#klang")).toBeVisible();
});

test("col chiosco il racconto gira in loop: dodici reparti coi sottotitoli, scheda finale, di nuovo dal reparto 1", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("https://media.fontealta.it/**", (r) => r.abort());
  await page.clock.install();
  await page.goto(CHIOSCO);
  const num = page.locator("#num");
  const play = page.locator("#play");
  await expect(play).toHaveText("Pausa", { timeout: 10_000 });
  await expect(page.locator("#caption"), "sottotitoli anche a voce muta").toBeVisible();
  const visti = new Set<string>();
  let finale = false;
  // il racconto dura 251 s sui tempi della voce, la scheda finale 14 s
  for (let s = 0; s < 290; s += 5) {
    await scorri(page, 5);
    const n = await num.textContent();
    if ((await play.textContent()) === "Pausa") {
      if (finale && n === "01") break;
      visti.add(n ?? "");
    } else finale = true;
  }
  expect(visti.size, "i dodici reparti").toBe(12);
  expect(finale, "la scheda finale").toBe(true);
  await expect(play, "di nuovo in giro").toHaveText("Pausa");
  await expect(num).toHaveText("01");
});

test("col chiosco la voce è muta di base: senza &voce=1 nessun play()", async ({ page }) => {
  await page.addInitScript(() => {
    const w = globalThis as unknown as { __play: number };
    w.__play = 0;
    HTMLMediaElement.prototype.play = function () {
      w.__play++;
      return Promise.resolve();
    };
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("https://media.fontealta.it/**", (r) => r.abort());
  await page.clock.install();
  await page.goto(CHIOSCO);
  await expect(page.locator("#play")).toHaveText("Pausa", { timeout: 10_000 });
  await scorri(page, 40);
  await expect(page.locator("#num"), "il giro avanza sull'orologio").toHaveText("02");
  expect(await page.evaluate(() => (globalThis as unknown as { __play: number }).__play)).toBe(0);
  await expect(page.locator("#caption")).toBeVisible();
});

test("col chiosco e &voce=1 la voce parte; se il browser la rifiuta il giro va avanti muto coi sottotitoli", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("https://media.fontealta.it/**", (r) => r.abort());
  // voce consentita: play() chiamato con l'audio acceso
  await page.addInitScript(() => {
    const w = globalThis as unknown as { __play: boolean[]; __rifiuta: boolean };
    w.__play = [];
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      w.__play.push(this.muted);
      return location.search.includes("rifiuta")
        ? Promise.reject(new DOMException("autoplay", "NotAllowedError"))
        : Promise.resolve();
    };
  });
  await page.goto(`${CHIOSCO}&voce=1`);
  await expect(page.locator("#play")).toHaveText("Pausa", { timeout: 10_000 });
  expect(
    await page.evaluate(() => (globalThis as unknown as { __play: boolean[] }).__play),
    "play() con l'audio acceso",
  ).toEqual([false]);

  // voce rifiutata (NotAllowedError): muto, sottotitoli, il giro va avanti sui tempi della voce
  await page.clock.install();
  await page.goto(`${CHIOSCO}&voce=1&rifiuta`);
  await expect(page.locator("#play")).toHaveText("Pausa", { timeout: 10_000 });
  await scorri(page, 40);
  await expect(page.locator("#num")).toHaveText("02");
  await expect(page.locator("#caption")).toBeVisible();
});

/**
 * Il chiosco non resta mai fermo (Marco, 28/10/2026, #318). Pausa, Tavola intera e Ferma il
 * movimento fermano il giro; dopo 45 s senza tocchi riparte dall'inizio. Con l'orologio finto
 * un salto di 46 s fa scattare il controllo una volta.
 */
test("col chiosco, dopo Pausa, Tavola intera o Ferma il movimento il racconto riparte dopo 45 s", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("https://media.fontealta.it/**", (r) => r.abort());
  await page.clock.install();
  const play = page.locator("#play");
  for (const bottone of ["#play", "#sheet", "#motion"]) {
    await page.goto(CHIOSCO);
    await expect(play).toHaveText("Pausa", { timeout: 10_000 });
    await page.locator(bottone).click();
    await expect(play, `fermo dopo ${bottone}`).not.toHaveText("Pausa");
    await page.clock.fastForward(46_000);
    await expect(play, `ripartito dopo ${bottone}`).toHaveText("Pausa");
    await expect(page.locator("#num")).toHaveText("01");
  }
});

/**
 * «Vista» (Marco, 28/10/2026): un bottone accanto a «Ferma il movimento» apre un pannello (disclosure) con
 * le caselle di cosa mostrare. Ciò che si spegne sparisce ed è inert; «Vista» resta raggiungibile. Esc, in
 * ordine: chiude il pannello e rimette il fuoco sul bottone, poi rimostra tutto, poi la vista d'insieme.
 * Nel chiosco il QR resta, e tutto torna a ogni ripartenza. Sul sito la scelta non si salva.
 */
/** I controlli della tavola che la tastiera raggiunge: visibili, fuori da un contenitore inert, attivi. */
const raggiungibili = () =>
  [...document.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input")]
    .filter((b) => b.getClientRects().length > 0 && !b.closest("[inert]") && !b.disabled)
    .map((b) => b.id || b.dataset.v || "");

test("sul sito «Vista» si usa da tastiera, e Esc fa i suoi tre passi", async ({
  page,
  browserName,
}) => {
  // su WebKit il Tab di chi usa la tastiera è Opzione+Tab (`tasti` nel blocco «tastiera»)
  const avanti = browserName === "webkit" ? "Alt+Tab" : "Tab";
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/officina");
  await tavolaPronta(page);
  const t = tavola(page);
  const f = () => frameTavola(page)!;
  const attivo = () =>
    f().evaluate(() => {
      const e = document.activeElement as HTMLInputElement | null;
      return e?.id || e?.dataset.v || "";
    });
  const vista = t.locator("#vista");
  await expect(vista).toHaveText("Vista");
  await expect(vista).toHaveAttribute("aria-expanded", "false");
  // accanto a «Ferma le animazioni», sulla stessa riga
  const [a, b] = await Promise.all([vista.boundingBox(), t.locator("#motion").boundingBox()]);
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
  expect(b!.x - (a!.x + a!.width)).toBeLessThan(16);
  // un reparto, poi il pannello dalla tastiera: «Vista» è il primo controllo della tavola
  await t.locator("#motion").focus();
  await page.keyboard.press("ArrowRight");
  await expect(t.locator("#num")).toHaveText("01");
  const play = await t.locator("#play").textContent();
  await page.locator("header a[href='/area-riservata']").focus();
  await page.keyboard.press(avanti);
  expect(await attivo()).toBe("vista");
  await page.keyboard.press("Enter");
  await expect(vista).toHaveAttribute("aria-expanded", "true");
  await expect(t.locator("#vistapanel")).toBeVisible();
  // Tab entra nel pannello; Spazio spegne la casella e non arriva al giro
  await page.keyboard.press(avanti);
  expect(await attivo()).toBe("etichette");
  await page.keyboard.press(" ");
  await expect(t.locator("[data-v='etichette']")).not.toBeChecked();
  await expect(t.locator("#play")).toHaveText(play!);
  // Esc 1: chiude il pannello e rimette il fuoco su «Vista»
  await page.keyboard.press("Escape");
  await expect(t.locator("#vistapanel")).toBeHidden();
  await expect(vista).toHaveAttribute("aria-expanded", "false");
  expect(await attivo()).toBe("vista");
  // Esc 2: rimostra tutto, il giro resta sul reparto
  await page.keyboard.press("Escape");
  await expect(t.locator("[data-v='etichette']")).toBeChecked();
  expect(await f().evaluate(() => document.documentElement.className)).not.toContain("vh-");
  await expect(t.locator("#num")).toHaveText("01");
  // Esc 3: la vista d'insieme, come sempre
  await page.keyboard.press("Escape");
  await expect(t.locator("#num")).toHaveText("12");
});

test("sul sito «Nascondi tutto» lascia raggiungibile solo «Vista», e gli elementi spenti sono inert", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/officina");
  await tavolaPronta(page);
  const t = tavola(page);
  await t.locator("#vista").click();
  await t.locator("#vnascondi").click();
  for (const s of [".index", "#card", "#motion"]) await expect(t.locator(s)).toBeHidden();
  // Esc dal pannello: si chiude, e resta «Vista»
  await page.keyboard.press("Escape");
  await expect(t.locator("#vistapanel")).toBeHidden();
  const f = frameTavola(page)!;
  expect(await f.evaluate(raggiungibili)).toEqual(["vista"]);
  expect(
    await f.evaluate(() =>
      [".index", "#card", "#motion", "#langsw"].map(
        (s) => !!document.querySelector(s)!.closest("[inert]"),
      ),
    ),
  ).toEqual([true, true, true, true]);
});

test("col chiosco, con tutto nascosto il QR resta, e tutto torna alla ripartenza dopo 45 s", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.route("https://media.fontealta.it/**", (r) => r.abort());
  await page.clock.install();
  await page.goto(CHIOSCO);
  const play = page.locator("#play");
  await expect(play).toHaveText("Pausa", { timeout: 10_000 });
  await page.locator("#vista").click();
  await page.locator("#vnascondi").click();
  await expect(page.locator("#kband"), "il QR resta").toBeVisible();
  await expect(page.locator("#klang")).toBeHidden();
  await page.keyboard.press("Escape");
  expect(await page.evaluate(raggiungibili)).toEqual(["vista"]);
  // Spazio mette in pausa anche coi comandi nascosti (col fuoco fuori da «Vista», che lo prenderebbe per sé);
  // dopo 45 s il racconto riparte con tutto visibile
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(" ");
  await expect(play).not.toHaveText("Pausa");
  await page.clock.fastForward(46_000);
  await expect(play).toHaveText("Pausa");
  expect(await page.evaluate(() => document.documentElement.className)).not.toContain("vh-");
  await expect(page.locator("#klang")).toBeVisible();
  await expect(page.locator("[data-v='etichette']")).toBeChecked();
});

test("statistiche: solo gli eventi veri della tavola arrivano a track()", async ({ page }) => {
  // `track()` chiama `window.va`, che in locale non esiste: lo si registra nella pagina.
  await page.addInitScript(() => {
    if (globalThis.top !== globalThis.self) return;
    const w = globalThis as unknown as { va: (...a: unknown[]) => void; __va: unknown[] };
    w.__va = [];
    w.va = (...a: unknown[]) => w.__va.push(a);
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/officina");
  await tavolaPronta(page);

  // Un evento vero, da un clic vero: il primo reparto dell'indice.
  await tavola(page).locator("#idx button").first().click();

  // Tre falsi: dalla pagina stessa (non dalla tavola), un nome fuori elenco, e dati strani.
  await page.evaluate(() =>
    postMessage(
      { tipo: "fa-officina", nome: "officina_voce", dati: { lingua: "it" } },
      location.origin,
    ),
  );
  const f = frameTavola(page)!;
  await f.evaluate(() => {
    parent.postMessage(
      { tipo: "fa-officina", nome: "officina_apri", dati: { lingua: "it" } },
      location.origin,
    );
    parent.postMessage(
      { tipo: "fa-officina", nome: "officina_reparto", dati: { reparto: 99 } },
      location.origin,
    );
    // E uno buono, con una chiave in più che non deve arrivare alle statistiche.
    parent.postMessage(
      { tipo: "fa-officina", nome: "officina_voce", dati: { lingua: "it", email: "x@y.z" } },
      location.origin,
    );
  });
  await page.waitForTimeout(300);

  const chiamate = await page.evaluate(() => (globalThis as unknown as { __va: unknown[] }).__va);
  expect(chiamate).toEqual([
    ["event", { name: "officina_reparto", data: { reparto: 1 } }],
    ["event", { name: "officina_voce", data: { lingua: "it" } }],
  ]);
});
