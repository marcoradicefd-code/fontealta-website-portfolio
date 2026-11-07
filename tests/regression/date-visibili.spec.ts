import { expect, test } from "@playwright/test";

/**
 * Le date di pubblicazione, nel markup e non solo nel JSON-LD (settembre 2026).
 *
 * Il difetto che questo test coglie è invisibile a ogni altro controllo: la data
 * di un articolo si legge in pagina da sempre, ma come **testo semplice**, e un
 * lettore automatico che non esegue il JSON-LD — molti di quelli che costruiscono
 * risposte non lo eseguono — non ha modo di sapere che «10 luglio 2026» è una
 * data di pubblicazione invece di una qualsiasi stringa dentro un paragrafo.
 *
 * ⚠️ **L'asserzione che conta è la TERZA**: che il `dateTime` del tag e il
 * `datePublished` del JSON-LD siano lo stesso istante. Sono due dichiarazioni
 * sulla stessa cosa, nate da due rami di codice diversi, ed è esattamente il
 * genere di coppia che diverge in silenzio: il markup si vede, il JSON-LD no, e
 * il giorno che qualcuno cambiasse la sorgente di uno dei due nessuno se ne
 * accorgerebbe. Le prime due — «il tag c'è» — da sole non lo direbbero.
 *
 * ⚠️ **`dateModified` non viene mai da `_updatedAt` di Sanity** (Marco, 5/11/2026 sera):
 * quel campo si muove a ogni scrittura, anche tecnica, e il 10/09/2026 valeva OGGI su
 * 12 post su 12 (la migrazione dei campi `seo`). È la data di «Aggiornato il»
 * (`revisedAt`) se c'è, altrimenti `datePublished`: la QUARTA asserzione lo prova sul
 * servito, con un post rivisto (la guida 316/304, IT ed EN) e uno mai rivisto (l'acqua
 * calda).
 */

const POST = [
  "/blog/aisi-316-contro-304-parte-1",
  "/en/blog/aisi-316-contro-304-parte-1",
  "/blog/doccia-esterno-acqua-calda-miscelatore",
];
const ELENCHI = ["/blog", "/en/blog"];

/** I `<time>` della pagina: `[{ dateTime, testo }]`, dal markup servito. */
function tags(html: string): Array<{ dateTime: string; testo: string }> {
  return [...html.matchAll(/<time[^>]*\bdatetime="([^"]*)"[^>]*>([\s\S]*?)<\/time>/gi)].map(
    (m) => ({
      dateTime: m[1],
      // Il testo può contenere i commenti che React usa per separare i nodi.
      testo: m[2].replace(/<!--[\s\S]*?-->/g, "").trim(),
    }),
  );
}

/** Le date dell'`Article`, dal blocco JSON-LD della pagina. */
function dateArticolo(html: string): { datePublished?: string; dateModified?: string } | null {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const ld = JSON.parse(m[1].replaceAll("\\u003c", "<")) as {
        "@type"?: string;
        datePublished?: string;
        dateModified?: string;
      };
      if (ld?.["@type"] === "Article") return ld;
    } catch {
      // Un blocco che non è JSON è un difetto suo, non di questo test.
    }
  }
  return null;
}

/** Il `datePublished` dell'`Article`, dal blocco JSON-LD della pagina. */
const datePublished = (html: string) => dateArticolo(html)?.datePublished ?? null;

test.describe("date visibili · il markup dice quando", () => {
  for (const path of POST) {
    test(`${path} avvolge la data in un <time> con dateTime ISO`, async ({ request }) => {
      const html = await (await request.get(path)).text();
      const trovati = tags(html);

      expect(trovati.length, "nessun <time> sull'articolo").toBeGreaterThanOrEqual(1);

      const iso = trovati[0].dateTime;
      expect(iso, `dateTime non ISO: ${iso}`).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(Number.isNaN(Date.parse(iso)), `dateTime non è una data: ${iso}`).toBe(false);
      expect(trovati[0].testo, "il <time> è vuoto: il tag c'è ma non avvolge niente").not.toBe("");

      // ⚠️ La sola asserzione che lega i due rami di codice.
      const dichiarata = datePublished(html);
      expect(dichiarata, "l'Article non dichiara datePublished").not.toBeNull();
      expect(
        Date.parse(iso),
        `il <time> dice ${iso}, il JSON-LD ${dichiarata}: due dichiarazioni sulla stessa data`,
      ).toBe(Date.parse(String(dichiarata)));

      // La data di modifica: quella di «Aggiornato il» (il secondo `<time>`) se c'è, altrimenti
      // la pubblicazione. Mai il timestamp di scrittura del CMS.
      const attesa = trovati[1]?.dateTime ?? dichiarata;
      expect(dateArticolo(html)?.dateModified, "dateModified dell'Article").toBe(attesa);
    });
  }

  for (const path of ELENCHI) {
    test(`${path} dà un <time> a ogni card`, async ({ request }) => {
      const html = await (await request.get(path)).text();
      const trovati = tags(html);

      /**
       * ⚠️ **Una card, un `<time>`**, e non «più di uno»: il numero di card
       * servite dipende dall'impaginazione e cambierà, ma il rapporto no. Con
       * una soglia generica una card che perdesse la data passerebbe finché ne
       * resta un'altra con la sua — cioè proprio il difetto che questo test
       * dovrebbe cogliere. Le card si contano dai link ai post, deduplicati
       * perché la featured e la griglia potrebbero puntare allo stesso slug.
       */
      const slug = new Set(
        [...html.matchAll(/href="\/(?:en\/)?blog\/([a-z0-9-]+)"/g)].map((m) => m[1]),
      );
      expect(slug.size, "nessuna card nell'elenco").toBeGreaterThan(0);
      expect(trovati.length, "una card senza data, o una data di troppo").toBe(slug.size);
      for (const t of trovati) {
        expect(t.dateTime, `dateTime non ISO: ${t.dateTime}`).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(t.testo, "un <time> vuoto nell'elenco").not.toBe("");
      }
    });
  }
});
