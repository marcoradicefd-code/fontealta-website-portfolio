import { expect, test, type Page } from "@playwright/test";

/**
 * Regressione «la foto nitida, la sfocatura solo sotto il testo» (set 2026).
 *
 * Tutte le asserzioni leggono VALORI COMPUTATI, mai `className`: una classe
 * presente non dice che la regola si applichi. È la lezione del bug delle
 * checkbox e quella del `backdrop-filter` mangiato da Lightning CSS — lì il
 * computed style valeva `none` mentre la regola sembrava applicarsi.
 *
 * ⚠️ Il confine è `sm` (640px), non `md`: è lo stesso degli scrim, e la ragione è
 * che sotto quella soglia il testo occupa tutta la card, quindi la zona cambia
 * forma invece di restringersi.
 */

const APERTURA_MS = 580;

async function apriPrimaCard(page: Page) {
  await page.goto("/produzione", { waitUntil: "networkidle" });
  const card = page.locator("article[data-aperta]").first();
  await card.locator("button[aria-expanded]").click();
  await expect(card).toHaveAttribute("data-aperta", "true");
  await page.waitForTimeout(APERTURA_MS + 400);
  return card;
}

test.use({ locale: "it-IT" });

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("la foto della card aperta non ha nessun filtro", async ({ page }) => {
    const card = await apriPrimaCard(page);
    const filtri = await card.locator("img").evaluate((el) => {
      const cs = getComputedStyle(el);
      return { filter: cs.filter, backdropFilter: cs.backdropFilter };
    });
    expect(filtri.filter, "filter sulla <img>").toBe("none");
    expect(filtri.backdropFilter, "backdrop-filter sulla <img>").toBe("none");
  });

  test("la zona del testo sfoca, ed è la colonna del testo e non la card", async ({ page }) => {
    const card = await apriPrimaCard(page);
    const z = await card.locator(".fa-card-testo").evaluate((el) => {
      const art = el.closest("article");
      const num = art?.querySelector("span[aria-hidden='true']");
      if (!art || !num) throw new Error("struttura della card inattesa");
      const cs = getComputedStyle(el);
      const rz = el.getBoundingClientRect();
      const rc = art.getBoundingClientRect();
      const rn = num.getBoundingClientRect();
      const sfuma = Number.parseFloat(cs.getPropertyValue("--card-text-sfuma")) / 100;
      return {
        backdropFilter: cs.backdropFilter,
        opacity: Number(cs.opacity),
        quota: rz.width / rc.width,
        // ⚠️ Il numero si confronta col PIENO della zona, non col suo box. Il box
        // comprende la fascia di dissolvenza, dove la maschera è quasi
        // trasparente: misurato, a 1024 il box arriva a 823 e il numero comincia
        // a 816, ma lì l'alfa è praticamente zero e il numero si vede nitido.
        // Confrontare i box darebbe un rosso su una cosa che va bene.
        numeroFuoriDalPieno: rn.left >= rz.left + rz.width * (1 - sfuma),
        // …e comunque la zona non deve scivolarci sotto: se sborda, di poco.
        sconfinamento: Math.max(0, rz.right - rn.left) / rn.width,
      };
    });
    expect(z.backdropFilter, "backdrop-filter computato sulla zona").toContain("blur");
    expect(z.opacity, "la zona è accesa a card aperta").toBe(1);
    // Prima della modifica lo strato sfocato era il 106,8% della card. Il tetto
    // e' largo perche' la zona include la fascia di dissolvenza, che a card
    // stretta puo' arrivare a buona parte della larghezza: l'asserzione che
    // conta davvero e' quella sul numero, qui sotto.
    expect(z.quota, "la zona non deve coprire tutta la card").toBeLessThan(0.92);
    expect(z.numeroFuoriDalPieno, "il numero non deve stare sul pieno della zona").toBe(true);
    expect(z.sconfinamento, "la zona non deve scivolare sotto il numero").toBeLessThan(0.1);
  });

  test("il diagonale è identico da chiusa e da aperta", async ({ page }) => {
    // Decisione di Marco sul preview, 8 settembre: aprire una card non cambia
    // NIENTE della fotografia — aperta è chiusa più la zona del testo. Prima
    // questo strato usciva all'apertura, e c'era anche un velo piatto che ora
    // non esiste più. Valori computati, non `className`.
    await page.goto("/produzione", { waitUntil: "networkidle" });
    const card = page.locator("article[data-aperta]").first();
    const diagonale = card.locator('[data-strato="diagonale"]');
    const leggi = () =>
      diagonale.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { opacity: cs.opacity, sfondo: cs.backgroundImage, durata: cs.transitionDuration };
      });

    const chiusa = await leggi();
    await card.locator("button[aria-expanded]").click();
    await expect(card).toHaveAttribute("data-aperta", "true");
    await page.waitForTimeout(APERTURA_MS + 400);
    const aperta = await leggi();

    expect(chiusa.opacity, "opaco da chiusa").toBe("1");
    expect(aperta.opacity, "e opaco anche da aperta").toBe("1");
    expect(aperta.sfondo, "stessi fermi nei due stati").toBe(chiusa.sfondo);
    expect(aperta.durata, "e nessuna transizione da animare").toBe("0s");

    // Il velo piatto è stato rimosso, non azzerato: non deve tornare.
    const veli = await card.evaluate(
      (el) => [...el.querySelectorAll(":scope > div[aria-hidden='true']")].length,
    );
    expect(veli, "due strati di scrim più la zona, non quattro").toBe(3);
  });

  test("la transizione è SOLO su opacity", async ({ page }) => {
    // Il contratto: si anima l'opacità e nient'altro. Mai `backdrop-filter`,
    // che sarebbe una seconda animazione sopra quella dell'altezza.
    const card = await apriPrimaCard(page);
    const t = await card.locator(".fa-card-testo").evaluate((el) => {
      const cs = getComputedStyle(el);
      return { prop: cs.transitionProperty, durata: cs.transitionDuration };
    });
    expect(t.prop, "solo opacity in transizione").toBe("opacity");
    expect(t.durata, "e una durata vera").not.toBe("0s");
  });

  test("da chiusa non c'è nessun backdrop-filter da comporre", async ({ page }) => {
    await page.goto("/produzione", { waitUntil: "networkidle" });
    const valori = await page
      .locator("article[data-aperta='false'] .fa-card-testo")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).backdropFilter));
    expect(valori.length, "nove card chiuse").toBe(9);
    expect(
      valori.every((v) => v === "none"),
      `trovato: ${valori.join(", ")}`,
    ).toBe(true);
  });
});

test.describe("desktop, prefers-reduced-motion", () => {
  // ⚠️ In questa versione di Playwright `reducedMotion` NON è un'opzione di test
  // di primo livello: passa da `contextOptions` (verificato sui tipi installati,
  // `playwright/types/test.d.ts`, dove è nell'esempio di `contextOptions`).
  test.use({
    viewport: { width: 1440, height: 900 },
    contextOptions: { reducedMotion: "reduce" },
  });

  test("nessuna transizione sulla zona, e la sfocatura resta solo sull'aperta", async ({
    page,
  }) => {
    const card = await apriPrimaCard(page);
    const z = await card.locator(".fa-card-testo").evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        // `transition-property` computato: sotto `reduce` la regola non si
        // applica affatto, quindi resta il valore iniziale.
        prop: cs.transitionProperty,
        durata: cs.transitionDuration,
        backdropFilter: cs.backdropFilter,
        opacity: Number(cs.opacity),
      };
    });
    expect(z.durata, "nessuna durata di transizione").toBe("0s");
    expect(z.backdropFilter, "la sfocatura c'è comunque, non è un'animazione").toContain("blur");
    expect(z.opacity, "e la zona è accesa").toBe(1);
  });
});

test.describe("sotto md", () => {
  test.use({ viewport: { width: 700, height: 900 } });

  test("a 700 vale già la forma mobile, e il testo è tutto coperto", async ({ page }) => {
    // ⚠️ Il confine è `md` e non `sm`: col confine a `sm` il paragrafo sbordava
    // dalla zona di 114px a questa larghezza, cioè le ultime parole di ogni riga
    // restavano senza fondo.
    const card = await apriPrimaCard(page);
    const g = await card.evaluate((el) => {
      const z = el.querySelector(".fa-card-testo");
      const p = el.querySelector("p");
      if (!z || !p) throw new Error("struttura della card inattesa");
      return {
        backdropFilter: getComputedStyle(z).backdropFilter,
        scoperto: Math.max(0, p.getBoundingClientRect().right - z.getBoundingClientRect().right),
      };
    });
    expect(g.backdropFilter, "sotto md non si sfoca").toBe("none");
    expect(g.scoperto, "nessuna parte di testo fuori dalla zona").toBe(0);
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("sotto il breakpoint la zona non sfoca ed è un gradiente dal basso", async ({ page }) => {
    const card = await apriPrimaCard(page);
    const z = await card.locator(".fa-card-testo").evaluate((el) => {
      const art = el.closest("article");
      if (!art) throw new Error("struttura della card inattesa");
      const cs = getComputedStyle(el);
      const rz = el.getBoundingClientRect();
      const rc = art.getBoundingClientRect();
      return {
        backdropFilter: cs.backdropFilter,
        background: cs.backgroundImage,
        quota: rz.width / rc.width,
      };
    });
    expect(z.backdropFilter, "niente sfocatura su mobile").toBe("none");
    expect(z.background, "gradiente, non fondo piatto").toContain("gradient");
    // Su mobile il testo prende tutta la larghezza, quindi la zona anche.
    expect(z.quota).toBeGreaterThan(0.95);
  });
});
