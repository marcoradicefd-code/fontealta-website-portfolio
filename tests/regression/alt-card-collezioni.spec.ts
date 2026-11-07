import { expect, test, type Page } from "@playwright/test";

/**
 * Le cover delle card di collezione hanno un alt, il monogramma no
 * (settembre 2026).
 *
 * Su `/collezioni` le 22 card servivano la cover con `alt=""`: 25 alt vuoti su 26
 * immagini, misurato sul servito. Non era una violazione di accessibilità — il
 * link attorno alla card porta già `aria-label` col nome, e per uno screen reader
 * vince quello, tanto che `image-alt` di axe non segnalava niente — ma era una
 * perdita secca per le ricerche per immagini e per i lettori che non sono
 * persone: ventidue fotografie di prodotto senza un nome.
 *
 * ⚠️ **L'asserzione NON è «nessun alt vuoto sulla pagina»**, che sarebbe falsa e
 * anche sbagliata da pretendere: il monogramma È decorativo e il suo alt vuoto è
 * la forma corretta. È «ogni card mostra o una cover con un nome, o un
 * segnaposto muto», cioè la regola vera, con la coppia che la prova: alt pieno
 * dove c'è la foto, alt vuoto dove c'è il monogramma.
 *
 * ⚠️ **La stessa card vive anche sulla scheda modello**, nel blocco delle
 * collezioni affini: l'alt arriva anche lì, ed è corretto — è la stessa immagine
 * con lo stesso ruolo. La rotta è nell'elenco proprio per dirlo.
 */

const PAGINE = [
  { path: "/collezioni", atteso: 22, lingua: "it" as const },
  { path: "/en/collections", atteso: 22, lingua: "en" as const },
  { path: "/modello/b40l", atteso: null, lingua: "it" as const },
];

/** Per ogni card: l'alt della sua immagine, e se è la cover o il monogramma. */
async function immaginiDelleCard(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('a[href*="/collezioni/"], a[href*="/collections/"]')]
      .map((a) => {
        const img = a.querySelector("img");
        if (!img) return null;
        const src = img.getAttribute("src") ?? "";
        return {
          alt: img.getAttribute("alt") ?? "",
          monogramma: src.includes("/brand/fontealta-monogram"),
          href: a.getAttribute("href") ?? "",
        };
      })
      .filter((x): x is { alt: string; monogramma: boolean; href: string } => x !== null),
  );
}

test.describe("le cover delle card di collezione hanno un nome", () => {
  for (const { path, atteso, lingua } of PAGINE) {
    test(`${path}: cover con alt, monogrammi muti`, async ({ page }) => {
      await page.goto(path, { waitUntil: "load" });
      const img = await immaginiDelleCard(page);
      expect(img.length, `${path} senza card di collezione`).toBeGreaterThan(0);
      if (atteso !== null) expect(img.length, "numero di card").toBe(atteso);

      const cover = img.filter((i) => !i.monogramma);
      const monogrammi = img.filter((i) => i.monogramma);

      // Nessuna cover muta: è il difetto che il rapporto ha misurato.
      const mute = cover.filter((i) => i.alt.trim() === "");
      expect(
        mute.map((m) => m.href),
        `cover senza alt su ${path}`,
      ).toEqual([]);

      // E i segnaposto restano muti: un monogramma descritto direbbe
      // «logo Fontealta» al posto del nome di una collezione.
      const parlanti = monogrammi.filter((i) => i.alt.trim() !== "");
      expect(
        parlanti.map((m) => m.href),
        `monogrammi con alt su ${path}`,
      ).toEqual([]);

      // L'alt è nella lingua della pagina, non una stringa fissa: la forma IT
      // porta la parola davanti, quella EN dietro.
      for (const c of cover) {
        if (lingua === "it") expect(c.alt).toMatch(/^Collezione .+/);
        else expect(c.alt).toMatch(/.+ collection$/);
      }
    });
  }

  /**
   * La guardia provata contro sé stessa: svuotati gli alt delle cover,
   * l'asserzione deve fallire. Serve a dire che la sonda distingue davvero una
   * cover da un monogramma, invece di trovare zero perché guarda nel posto
   * sbagliato — il modo in cui un test verde non dimostra niente.
   */
  test("svuotando gli alt delle cover la sonda se ne accorge: la controprova", async ({ page }) => {
    await page.goto("/collezioni", { waitUntil: "load" });
    const prima = await immaginiDelleCard(page);
    expect(prima.filter((i) => !i.monogramma && i.alt.trim() === "")).toEqual([]);

    await page.evaluate(() =>
      document.querySelectorAll("img").forEach((i) => {
        if (!(i.getAttribute("src") ?? "").includes("/brand/fontealta-monogram")) {
          i.setAttribute("alt", "");
        }
      }),
    );
    const dopo = await immaginiDelleCard(page);
    expect(
      dopo.filter((i) => !i.monogramma && i.alt.trim() === "").length,
      "la sonda non vede le cover",
    ).toBeGreaterThan(0);
  });
});
