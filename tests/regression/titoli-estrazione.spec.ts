import { expect, test, type Page } from "@playwright/test";

import { leggiRuoliEDom } from "./helpers/ax-tree";

/**
 * Un titolo deve dire le stesse parole a chi lo ASCOLTA e a chi lo ESTRAE
 * (settembre 2026).
 *
 * ⚠️ **Non è un difetto di accessibilità, ed è stato misurato prima di
 * scriverlo.** Chromium inserisce da sé uno spazio al `<br>` quando calcola il
 * nome accessibile: su `/en` l'H1 valeva già `"Steel and Colour."` mentre il suo
 * `textContent` valeva `"Steeland Colour."`. Chi usa uno screen reader sentiva
 * bene; a leggere male era chiunque concateni i nodi di testo — `textContent`, le
 * regex che spogliano i tag, i crawler e gli estrattori che costruiscono risposte
 * partendo dall'HTML. Su quattro titoli del sito, in due lingue, uscivano
 * «Acciaioe Colore», «Steeland Colour», «qualità,Altamente», «acquain acciaio».
 *
 * ⚠️ **L'asserzione NON è «c'è uno spazio prima del `<br>`»**, che descriverebbe
 * il rimedio e non il difetto. È che **le due letture coincidano**: il testo
 * estratto ingenuamente e il nome accessibile, a spazi normalizzati, devono dare
 * la stessa stringa. Così la guardia vale anche per una forma futura che separi
 * due parole solo visivamente — un `<span>` posizionato, una pseudo-classe — e
 * non solo per il `<br>` che conosciamo oggi.
 *
 * Il nome accessibile si legge da `Accessibility.getPartialAXTree` via CDP,
 * Chromium-only, per la stessa ragione della guardia dei filtri: quello che
 * calcola Playwright è una sua implementazione, non l'albero del browser.
 */

const ROTTE = ["/", "/en", "/collezioni", "/en/collections", "/chi-siamo", "/produzione"];

/** Spazi collassati e bordi tagliati: due letture della stessa frase. */
const normalizza = (s: string) => s.replace(/\s+/g, " ").trim();

interface Titolo {
  tag: string;
  estratto: string;
  accessibile: string;
}

/**
 * I titoli esposti, con le DUE letture accostate: il nome accessibile e il testo
 * che estrarrebbe chi concatena i nodi. Vengono dallo STESSO `nodeId`, non da due
 * enumerazioni correlate per indice — due elenchi che oggi combaciano e domani
 * potrebbero non farlo confronterebbero in silenzio elementi diversi.
 */
async function titoli(page: Page): Promise<Titolo[]> {
  return (await leggiRuoliEDom(page, "h1, h2"))
    .filter((n) => !n.ignorato && n.nome)
    .map((n) => ({ tag: n.tag, estratto: n.testo, accessibile: n.nome }));
}

test.describe("i titoli si leggono uguale a voce e in estrazione", () => {
  for (const rotta of ROTTE) {
    test(`${rotta}: testo estratto e nome accessibile coincidono`, async ({ page }) => {
      await page.goto(rotta, { waitUntil: "load" });
      const trovati = await titoli(page);
      expect(trovati.length, `${rotta} senza intestazioni leggibili`).toBeGreaterThan(0);

      for (const t of trovati) {
        expect(
          normalizza(t.estratto),
          `${rotta} · <${t.tag}> letto in due modi diversi\n  estratto: ${JSON.stringify(t.estratto)}\n  a voce  : ${JSON.stringify(t.accessibile)}`,
        ).toBe(normalizza(t.accessibile));
      }
    });
  }

  /**
   * Il controllo strutturale, più economico e più diretto: dentro un titolo un
   * `<br>` non può stare attaccato a una parola. Non sostituisce quello sopra —
   * descrive il rimedio, non il difetto — ma dice SUBITO dove intervenire quando
   * l'altro fallisce.
   */
  test("dentro un titolo nessun <br> è incollato alla parola che lo precede", async ({ page }) => {
    for (const rotta of ROTTE) {
      const html = await (await page.request.get(rotta)).text();
      for (const [, dentro] of html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)) {
        expect(
          /\S<br/i.test(dentro),
          `${rotta}: <br> incollato in ${JSON.stringify(dentro.slice(0, 90))}`,
        ).toBe(false);
      }
    }
  });

  /**
   * La guardia provata contro sé stessa: rimesso il `<br>` attaccato, le due
   * letture devono divergere. Senza questa prova non sapremmo se l'asserzione sa
   * distinguere i due casi o se passa sempre.
   */
  test("incollando il <br> le due letture divergono: la controprova", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const prima = await titoli(page);
    expect(prima.every((t) => normalizza(t.estratto) === normalizza(t.accessibile))).toBe(true);

    await page.evaluate(() => {
      document.querySelectorAll("h1, h2").forEach((h) => {
        h.innerHTML = h.innerHTML.replace(/\s+<br/gi, "<br");
      });
    });
    const dopo = await titoli(page);
    const divergenti = dopo.filter((t) => normalizza(t.estratto) !== normalizza(t.accessibile));
    expect(divergenti.length, "la sonda non distingue i due casi").toBeGreaterThan(0);
  });
});
