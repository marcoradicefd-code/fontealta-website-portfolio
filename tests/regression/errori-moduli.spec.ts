import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Gli errori dei moduli (Marco, 28/10/2026): un rosso per fondo (`--color-fa-error` su chiaro,
 * `--color-fa-error-on-dark` su scuro), grassetto, icona davanti nascosta ai lettori di schermo, bordo
 * `aria-invalid` col rosso del suo fondo. Prima un rosso solo, #9b2c2c, che sui fondi scuri valeva 2,51:1.
 *
 * Ogni modulo va in errore con un invio vuoto: solo la validazione nel browser, nessun invio. Il contrasto
 * si misura sui glifi (rule misure-e-test): a DPR 2 uno scatto col testo e uno col testo trasparente, e il
 * p95 dei pixel del glifo contro il fondo. Lo spessore del bordo non si asserisce (Chromium calcola 1px
 * per 1,5 px): si asserisce il colore.
 */
test.use({ deviceScaleFactor: 2 });

const MODULI = [
  { nome: "home", url: "/", form: "section form:has(.fa-home-input)", fondo: "light" },
  {
    nome: "contatti",
    url: "/contatti",
    form: "form:has(.fa-contact-input):not(footer form)",
    fondo: "dark",
  },
  { nome: "catalogo", url: "/contatti", form: "#catalogo form", fondo: "light" },
  { nome: "newsletter", url: "/contatti", form: "footer form", fondo: "dark" },
] as const;

/** Il colore che il token risolve, come lo scrive il browser. */
const coloreDelToken = (page: Page, token: string) =>
  page.evaluate((t) => {
    const s = document.createElement("span");
    s.style.color = `var(${t})`;
    document.body.appendChild(s);
    const c = getComputedStyle(s).color;
    s.remove();
    return c;
  }, token);

/** In vista e fermo: due fotogrammi dopo lo scorrimento. */
async function inVista(el: Locator) {
  await el.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
  await el.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  );
}

/** Contrasto sui glifi: p95 dei pixel che cambiano spegnendo il testo, contro il fondo sotto di loro. */
async function contrastoGlifi(page: Page, el: Locator): Promise<number> {
  await inVista(el);
  const box = (await el.boundingBox())!;
  const clip = { x: box.x, y: box.y, width: box.width, height: box.height };
  const acceso = (await page.screenshot({ clip })).toString("base64");
  await el.evaluate((e) =>
    (e as HTMLElement).style.setProperty("color", "transparent", "important"),
  );
  const spento = (await page.screenshot({ clip })).toString("base64");
  await el.evaluate((e) => (e as HTMLElement).style.removeProperty("color"));
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

for (const m of MODULI) {
  test(`errori del modulo ${m.nome}: rosso del suo fondo, grassetto, icona, contrasto ≥ 4,5 sui glifi`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(m.url);
    const form = page.locator(m.form).first();
    await inVista(form);
    // la validazione nativa (newsletter) fermerebbe l'invio prima di quella del modulo
    await form.evaluate((f) => {
      (f as HTMLFormElement).noValidate = true;
    });
    await form.locator("button[type=submit]").first().click();

    const token = m.fondo === "dark" ? "--fa-error-on-dark" : "--fa-error";
    const rosso = await coloreDelToken(page, token);
    // il peso risolto dal ruolo --fa-error-font-weight (alias di --font-weight-bold, 700)
    const peso = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--fa-error-font-weight").trim(),
    );
    expect(peso, "il ruolo del peso è emesso e vale 700").toBe("700");
    const messaggi = form.locator("span:has(> svg.lucide-circle-alert)");
    await expect(messaggi.first()).toBeVisible();
    const n = await messaggi.count();
    expect(n, "almeno due messaggi").toBeGreaterThanOrEqual(2);
    for (let i = 0; i < n; i++) {
      const msg = messaggi.nth(i);
      const stile = await msg.evaluate((e) => {
        const cs = getComputedStyle(e);
        return {
          colore: cs.color,
          peso: cs.fontWeight,
          icona: e.querySelector("svg")!.getAttribute("aria-hidden"),
        };
      });
      expect(stile.colore, `${m.nome}: colore del messaggio ${i}`).toBe(rosso);
      expect(stile.peso, `${m.nome}: peso dal ruolo`).toBe(peso);
      expect(stile.icona, `${m.nome}: icona nascosta ai lettori di schermo`).toBe("true");
      const testo = msg.locator("> span");
      expect(
        await contrastoGlifi(page, testo),
        `${m.nome}: contrasto del messaggio ${i}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    // il bordo dei campi in errore: il rosso del suo fondo
    const bordi = await form
      .locator('input[aria-invalid="true"], select[aria-invalid="true"]')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).borderBottomColor));
    expect(bordi.length, `${m.nome}: campi in errore`).toBeGreaterThan(0);
    for (const b of bordi) expect(b, `${m.nome}: bordo aria-invalid`).toBe(rosso);
  });
}
