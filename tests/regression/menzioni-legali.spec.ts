import { expect, test, type Page } from "@playwright/test";

/**
 * «Menzioni legali»: i 308 dei vecchi indirizzi, l'accordion e le sue ancore, la stampa.
 *
 * ⚠️ Un contesto nuovo per test: `NEXT_LOCALE` sopravvive alle navigazioni e una
 * visita in un'altra lingua falserebbe quella dopo.
 */

// «societa» è la prima dal 26/10/2026, e quindi quella aperta all'arrivo.
const SEZIONI = ["societa", "termini", "privacy", "cookie", "ai"] as const;

async function aperte(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLDetailsElement>("details[data-legal-section]")]
      .filter((d) => d.open)
      .map((d) => d.id),
  );
}

test.describe("menzioni legali · redirect", () => {
  const CASI = [
    ["/privacy-policy", "/menzioni-legali#privacy"],
    ["/cookie-policy", "/menzioni-legali#cookie"],
    ["/en/privacy-policy", "/en/legal-notice#privacy"],
    ["/de/cookie-policy", "/de/rechtliche-hinweise#cookie"],
    ["/fr/privacy-policy", "/fr/mentions-legales#privacy"],
    ["/es/cookie-policy", "/es/aviso-legal#cookie"],
  ] as const;

  for (const [vecchio, nuovo] of CASI) {
    test(`${vecchio} risponde 308 verso ${nuovo}, ancora compresa`, async ({ request }) => {
      const res = await request.get(vecchio, { maxRedirects: 0 });
      expect(res.status()).toBe(308);
      expect(res.headers()["location"]).toBe(nuovo);
    });
  }

  test("arrivando da /privacy-policy la sezione privacy è aperta", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/privacy-policy");
    await expect(page).toHaveURL(/\/menzioni-legali#privacy$/);
    await expect(page.locator("details#privacy")).toHaveAttribute("open", "");
    await context.close();
  });
});

test.describe("menzioni legali · accordion", () => {
  test("cinque sezioni con H2 e ancora, solo la prima aperta", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const res = await page.goto("/menzioni-legali");
    expect(res?.status()).toBe(200);

    const ids = await page
      .locator("details[data-legal-section]")
      .evaluateAll((els) => els.map((e) => e.id));
    expect(ids).toEqual([...SEZIONI]);
    for (const id of SEZIONI) {
      await expect(page.locator(`details#${id} > summary h2`)).toHaveCount(1);
    }
    expect(await aperte(page)).toEqual(["societa"]);
    await context.close();
  });

  test("il link del footer alla stessa pagina apre la sezione", async ({ browser }) => {
    // Gli anchor della stessa pagina li gestisce il LenisProvider con replaceState, che
    // non emette hashchange: senza l'ascoltatore del clic la sezione resterebbe chiusa.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/menzioni-legali");
    await page.locator('footer a[href$="/menzioni-legali#cookie"]').click();
    await expect(page.locator("details#cookie")).toHaveAttribute("open", "");
    await context.close();
  });

  /**
   * Dal 19/10/2026 la riga sotto il modulo apre l'informativa in una SCHEDA NUOVA (Marco): chi sta
   * compilando non perde il modulo. Nella scheda nuova la sezione privacy è aperta.
   */
  test("la riga sotto il modulo apre la sezione privacy in una scheda nuova", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/contatti");
    const link = page
      .locator("form p")
      .getByRole("link", { name: "informativa sulla privacy" })
      .first();
    const [scheda] = await Promise.all([context.waitForEvent("page"), link.click()]);
    await expect(scheda).toHaveURL(/\/menzioni-legali#privacy$/);
    await expect(scheda.locator("details#privacy")).toHaveAttribute("open", "");
    await expect(page).toHaveURL(/\/contatti$/);
    await context.close();
  });

  test("in stampa si aprono tutte, e dopo tornano come erano", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/menzioni-legali");
    await expect.poll(() => aperte(page)).toEqual(["societa"]);

    /**
     * ⚠️ **L'evento si RILANCIA finché non attecchisce, e non è un trucco per il
     * verde: è la condizione da aspettare.** `beforeprint` lo ascolta un
     * gestore montato dal client, e su un server appena avviato la prima visita
     * a questa pagina può arrivare al `dispatchEvent` prima che l'idratazione
     * sia finita: l'evento parte, non lo ascolta nessuno, e nessuna sezione si
     * apre. Misurato il 21/09/2026 con il build E2E a server freddo: il PRIMO
     * giro rosso, il secondo e il terzo verdi — e nel giro intero della suite
     * questa è la prima visita alla pagina, quindi è sempre il primo giro.
     *
     * Un `waitForTimeout` coprirebbe la stessa cosa per caso. Qui si aspetta il
     * fatto: che il gestore ci sia. Stessa famiglia della lezione dello
     * skip-link — due tasti separati da meno di un frame non sono un utente, e
     * una stampa chiesta prima che la pagina sia viva non è una stampa.
     */
    await expect
      .poll(async () => {
        await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
        return aperte(page);
      })
      .toEqual([...SEZIONI]);

    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    expect(await aperte(page)).toEqual(["societa"]);
    await context.close();
  });
});

/**
 * La sezione dei dati societari (26/10/2026): i valori arrivano da `@/lib/azienda` dentro i
 * segnaposto dei messaggi, quindi si controlla il reso e non il dizionario. La politica per
 * la qualità è in italiano solo su it; in en, de, fr ed es si scarica quella inglese.
 */
test.describe("menzioni legali · dati societari", () => {
  const CASI = [
    { url: "/menzioni-legali", politica: "fontealta-politica-qualita-it.pdf" },
    { url: "/en/legal-notice", politica: "fontealta-quality-policy-en.pdf" },
    { url: "/de/rechtliche-hinweise", politica: "fontealta-quality-policy-en.pdf" },
    { url: "/fr/mentions-legales", politica: "fontealta-quality-policy-en.pdf" },
    { url: "/es/aviso-legal", politica: "fontealta-quality-policy-en.pdf" },
  ];
  for (const { url, politica } of CASI) {
    test(`${url}#societa: estremi, PEC e i due PDF`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`${url}#societa`);
      const sezione = page.locator("details#societa");
      await expect(sezione).toHaveAttribute("open", "");
      const testo = (await sezione.innerText()).replace(/\s+/g, " ");
      for (const atteso of [
        "Rubinetteria F & F L’Artigiana S.r.l.",
        "IT01718720467",
        "01718720467 (REA LU-166066)",
        "10.400,00 €",
        "fontealta_lartigiana@pec.it",
        "Q/00802/24",
        "Q gest",
        "2027",
      ]) {
        expect(testo, atteso).toContain(atteso);
      }
      expect(testo, "un segnaposto non riempito").not.toMatch(/[{}]/);
      await expect(sezione.locator('a[href="mailto:fontealta_lartigiana@pec.it"]')).toHaveCount(1);
      const pdf = sezione.locator('a[href$=".pdf"]');
      await expect(pdf).toHaveCount(2);
      const href = await pdf.evaluateAll((as) => as.map((a) => a.getAttribute("href")));
      expect(href).toEqual([
        "https://media.fontealta.it/documenti/certificazioni/fontealta-certificato-iso-9001-2015.pdf",
        `https://media.fontealta.it/documenti/qualita/${politica}`,
      ]);
      for (const a of await pdf.all()) {
        await expect(a).toHaveAttribute("target", "_blank");
        await expect(a).toHaveAttribute("rel", "noopener");
        await expect(a).toContainText("PDF");
      }
      // La riga legale del footer, uguale in tutte le lingue, con lo spazio unificatore fra
      // sigla e numero (a 390 il numero non va a capo da solo).
      const riga = await page
        .locator("footer p")
        .filter({ hasText: "REA" })
        .last()
        .evaluate((p) => p.textContent ?? "");
      expect(riga.replace(/[ \t\n\r]+/g, " ")).toBe(
        "Rubinetteria F & F L’Artigiana S.r.l. · P.IVA e C.F.\u00a0IT01718720467 · REA\u00a0LU-166066 · Capitale sociale\u00a010.400,00 €\u00a0i.v.",
      );
      await context.close();
    });
  }
});
