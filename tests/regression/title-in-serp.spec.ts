import { expect, test } from "@playwright/test";

/**
 * I `title` servono a un posto solo — la SERP — e lì si misurano in **pixel**,
 * non in caratteri (decisione di Marco, 21/09/2026: 60 caratteri e 580 px).
 *
 * ⚠️ **Questa guardia esiste perché i caratteri da soli non bastano, ed è un
 * esito misurato.** Con il budget a 60 caratteri per tutte le lingue: **zero**
 * title fuori dai 60 caratteri e **61 fuori dai 580 px** — 43 spagnoli, 8
 * tedeschi, 5 inglesi, 5 francesi, il peggiore a 612 px. Le lettere non sono
 * larghe uguali, e la stessa frase in spagnolo occupa più spazio. Da lì il
 * budget per lingua in `src/lib/meta-title.ts`.
 *
 * ⚠️ **Sta qui e non in `meta.test.ts`** perché la misura vuole un motore di
 * rendering vero: vitest gira in jsdom, che non ha le metriche dei font e
 * risponderebbe con un numero inventato. La guardia sui CARATTERI resta di là,
 * dove costa un millisecondo.
 *
 * ⚠️ Il font è **Arial 20**, la taglia del title nella SERP di Google su
 * desktop, non il font del sito: si misura come lo vede chi cerca.
 *
 * I campioni sono i PEGGIORI misurati il 21/09/2026 sui 595 modelli e sulle 22
 * collezioni, lingua per lingua — non pagine a caso. Se il catalogo cambia,
 * questa lista si rimisura con `tmp/title-template/verifica-tutti.mjs`.
 */

const MAX_CARATTERI = 60;
const MAX_PIXEL = 580;

/** Le pagine peggiori per larghezza, una famiglia per volta. */
const CAMPIONI = [
  // La home, che porta il marchio dentro la stringa.
  { percorso: "/", etichetta: "home it" },
  { percorso: "/en", etichetta: "home en" },
  { percorso: "/de", etichetta: "home de" },
  { percorso: "/fr", etichetta: "home fr" },
  { percorso: "/es", etichetta: "home es" },
  // I modelli che, col budget unico a 60 caratteri, sforavano i 580 px.
  { percorso: "/es/modelo/q53-ycws-m", etichetta: "modello es (era 612 px)" },
  { percorso: "/de/modell/w2mb-cd", etichetta: "modello de (era 609 px)" },
  { percorso: "/es/modelo/csr40-me", etichetta: "modello es (era 608 px)" },
  { percorso: "/modello/re12-ast-fs", etichetta: "modello it, nome più lungo" },
  { percorso: "/de/modell/re12-ast-fs", etichetta: "modello de, nome più lungo" },
  // La collezione col titolo più lungo fra quelle che ricevono il tipo.
  { percorso: "/collezioni/club-large", etichetta: "collezione it" },
  { percorso: "/de/kollektionen/club-large", etichetta: "collezione de" },
  { percorso: "/es/colecciones/club-large", etichetta: "collezione es" },
];

test.describe("i title stanno nella SERP, in caratteri e in pixel", () => {
  for (const campione of CAMPIONI) {
    test(`${campione.etichetta} (${campione.percorso})`, async ({ page }) => {
      const risposta = await page.goto(campione.percorso);
      expect(risposta?.status(), `HTTP su ${campione.percorso}`).toBe(200);

      const titolo = await page.title();
      expect(titolo.length, `caratteri di «${titolo}»`).toBeLessThanOrEqual(MAX_CARATTERI);

      // La larghezza dipinta, in Arial 20: si misura nella pagina, con un nodo
      // fuori flusso e senza a capo, così il box è esattamente il testo.
      const pixel = await page.evaluate((testo) => {
        const misuratore = document.createElement("div");
        misuratore.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
        misuratore.style.font = "20px Arial, sans-serif";
        misuratore.textContent = testo;
        document.body.append(misuratore);
        const larghezza = Math.round(misuratore.getBoundingClientRect().width);
        misuratore.remove();
        return larghezza;
      }, titolo);

      expect(pixel, `pixel di «${titolo}»`).toBeLessThanOrEqual(MAX_PIXEL);
    });
  }
});
