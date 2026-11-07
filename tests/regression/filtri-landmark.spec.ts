import { expect, test } from "@playwright/test";

import { leggiRuoli } from "./helpers/ax-tree";

/**
 * I filtri delle collezioni sono un **landmark**, non un blocco anonimo di
 * bottoni (settembre 2026).
 *
 * Prima di questa PR le due pagine con filtri non avevano nessun `<aside>`:
 * misurato sul servito, zero. Chi naviga per landmark — il modo normale di
 * orientarsi in una pagina lunga con uno screen reader — trovava la navigazione
 * principale, il percorso, il contenuto e poi cinquantatré card, senza niente che
 * dicesse dove sono i comandi per restringerle.
 *
 * ⚠️ **`getByRole("complementary")` NON è l'albero di accessibilità, e qui la
 * differenza ribalta il verdetto.** Playwright calcola i ruoli con la propria
 * implementazione, che mappa `aside` → `complementary` e basta; il browser invece
 * applica la regola di ARIA in HTML, per cui un `aside` annidato dentro un
 * elemento di sezionamento vale `generic` **e diventa `complementary` solo se ha
 * un nome accessibile**. Misurato su Chromium con CDP, provino sintetico: `aside`
 * in `section` con `aria-label` → `complementary`; lo stesso senza → `generic`.
 * Con `getByRole` la controprova FALLIVA — il ruolo risultava presente anche a
 * etichetta rimossa — e un test così avrebbe continuato a passare il giorno che
 * qualcuno togliesse l'`aria-label`, cioè esattamente il giorno in cui il
 * landmark smette di esistere. Stessa lezione del `getComputedStyle` sulle
 * checkbox: si asserisce quello che l'utente riceve, non quello che il markup
 * sembra dire.
 *
 * Per questo il ruolo si legge da **`Accessibility.getPartialAXTree`** via CDP.
 * Il protocollo è solo di Chromium, ed è la stessa ragione per cui questa
 * configurazione è Chromium-only.
 *
 * ⚠️ **UNO alla volta, non due.** Le due viste — pill desktop e barra compatta
 * mobile — sono nel DOM insieme, ma una delle due è sempre `display:none`, che la
 * rende `ignored` nell'albero. Se un giorno il confine `lg` si rompesse, un
 * lettore annuncerebbe due gruppi «Filtri» identici: è il difetto che l'ultima
 * asserzione coglie, e non lo coglierebbe un conteggio dei tag nell'HTML.
 */

const PAGINE = [
  { path: "/collezioni/boss", nome: "Filtri" },
  { path: "/en/collections/boss", nome: "Filters" },
  { path: "/collezioni/corpi-a-incasso", nome: "Filtri" },
  { path: "/en/collections/concealed-bodies", nome: "Filters" },
];

const VIEWPORT = [
  { etichetta: "desktop", width: 1440, height: 900 },
  { etichetta: "mobile", width: 390, height: 844 },
];

test.describe("i filtri sono un landmark con un nome", () => {
  for (const vp of VIEWPORT) {
    for (const { path, nome } of PAGINE) {
      test(`${vp.etichetta} · ${path} espone un solo «${nome}»`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(path, { waitUntil: "load" });

        const aside = await leggiRuoli(page, "aside");
        const esposti = aside.filter((a) => !a.ignorato);

        // Esattamente uno esposto: l'altra vista è `display:none` e quindi ignorata.
        expect(
          esposti.map((a) => `${a.ruolo}:${a.nome}`),
          `${path} a ${vp.etichetta}: un solo landmark atteso`,
        ).toEqual([`complementary:${nome}`]);

        // E contiene i comandi, non è una scatola vuota accanto a loro.
        const comandi = page.locator("aside:visible button");
        expect(await comandi.count(), "landmark senza comandi dentro").toBeGreaterThan(0);
      });
    }
  }

  /**
   * La guardia provata contro sé stessa: tolto l'`aria-label`, il ruolo deve
   * SCENDERE a `generic`. Senza questa prova le asserzioni qui sopra passerebbero
   * anche in un mondo dove il nome non conta — ed è proprio il mondo che
   * `getByRole` descriveva.
   */
  test("senza nome accessibile il ruolo scende a generic: la controprova", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/collezioni/boss", { waitUntil: "load" });

    const prima = (await leggiRuoli(page, "aside")).filter((a) => !a.ignorato);
    expect(prima.map((a) => a.ruolo)).toEqual(["complementary"]);

    await page.evaluate(() =>
      document.querySelectorAll("aside").forEach((e) => e.removeAttribute("aria-label")),
    );
    const dopo = (await leggiRuoli(page, "aside")).filter((a) => !a.ignorato);
    expect(
      dopo.map((a) => a.ruolo),
      "senza nome dovrebbe valere generic",
    ).toEqual(["generic"]);
  });
});
