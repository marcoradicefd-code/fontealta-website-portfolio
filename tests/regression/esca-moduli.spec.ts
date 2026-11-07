import { expect, test } from "@playwright/test";

/**
 * Il campo esca dei moduli (`_gotcha`), 4/11/2026: l'etichetta nella lingua della pagina, e il campo
 * nascosto a tutti come prima. Fuori schermo e non `display: none` (i bot saltano i campi
 * nascosti), escluso dai lettori di schermo, dalla tastiera e dall'autocompletamento. Su `/contatti`
 * ci sono il modulo generale, quello del catalogo e la newsletter del piè di pagina.
 */
const PAGINE = [
  { path: "/contatti", etichetta: "Non compilare questo campo" },
  { path: "/en/contact", etichetta: "Leave this field empty" },
  { path: "/de/kontakt", etichetta: "Dieses Feld leer lassen" },
  { path: "/fr/contact", etichetta: "Ne pas remplir ce champ" },
  { path: "/es/contacto", etichetta: "No rellenar este campo" },
];

for (const { path, etichetta } of PAGINE) {
  test(`${path}: le esche hanno l'etichetta della lingua e restano nascoste`, async ({ page }) => {
    await page.goto(path);
    const esche = page.locator("input[name='_gotcha']");
    await expect(esche).toHaveCount(3);
    for (const input of await esche.all()) {
      await expect(input).toHaveAttribute("tabindex", "-1");
      await expect(input).toHaveAttribute("autocomplete", "off");
      const stato = await input.evaluate((el) => {
        const box = el.closest("[aria-hidden='true']") as HTMLElement | null;
        const r = el.getBoundingClientRect();
        return {
          nascostoAiLettori: Boolean(box),
          display: box ? getComputedStyle(box).display : "",
          fuoriSchermo: r.right <= 0,
          etichetta: (el.closest("label")?.textContent ?? "").trim(),
        };
      });
      expect(stato).toEqual({
        nascostoAiLettori: true,
        display: "block",
        fuoriSchermo: true,
        etichetta,
      });
    }
  });
}
