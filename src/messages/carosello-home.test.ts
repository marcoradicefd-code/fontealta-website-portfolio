import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "./en.json";
import itMessages from "./it.json";

/**
 * L'etichetta dei pallini del carosello della home.
 *
 * ⚠️ **Questo test nasce da un difetto che nessun controllo del progetto
 * vedeva.** `featuredGoTo` è una stringa ICU che dichiara `{n}`, e veniva
 * chiesta a next-intl **senza** quell'argomento: sotto `pnpm dev` la home
 * rispondeva `FORMATTING_ERROR` a ogni render, mentre `typecheck`, `lint`,
 * `test` e `build` restavano tutti verdi — un argomento ICU mancante non è un
 * errore di tipo, e in produzione next-intl lo inghiotte. Il segnaposto poi
 * veniva sostituito a mano nel client con un `.replace()`, cioè una
 * formattazione fatta fuori dal formattatore.
 *
 * La regola che questo file tiene ferma: **una stringa che dichiara un
 * argomento va chiamata con quell'argomento**. La prima asserzione è quella che
 * conta, perché è l'unica che sarebbe diventata rossa sul codice vecchio.
 */

const LINGUE = { it: itMessages, en } as const;

describe("featuredGoTo · l'etichetta dei pallini", () => {
  for (const [locale, messages] of Object.entries(LINGUE)) {
    it(`${locale}: chiamata SENZA argomento segnala un errore di formattazione`, () => {
      const onError = vi.fn();
      const t = createTranslator({
        locale,
        messages,
        namespace: "home",
        onError,
      });
      // Il valore restituito non conta: quello che conta è che next-intl si
      // lamenti. È il difetto che girava in sviluppo, reso visibile qui.
      t("featuredGoTo");
      expect(onError, "una stringa con {n} chiamata senza n deve dare errore").toHaveBeenCalled();
      expect(String(onError.mock.calls[0]?.[0])).toContain("FORMATTING_ERROR");
    });

    it(`${locale}: con il nome della collezione esce una frase intera`, () => {
      const onError = vi.fn();
      const t = createTranslator({ locale, messages, namespace: "home", onError });
      const etichetta = t("featuredGoTo", { n: "Boss" });

      expect(onError, "nessun errore atteso quando l'argomento c'è").not.toHaveBeenCalled();
      expect(etichetta, "il nome non compare nell'etichetta").toContain("Boss");
      // Nessun segnaposto rimasto: era il sintomo del `.replace()` fatto a valle.
      expect(etichetta, "segnaposto non sostituito").not.toContain("{n}");
      expect(etichetta.trim(), "etichetta vuota").not.toBe("");
    });

    it(`${locale}: un nome con virgolette non rompe l'etichetta`, () => {
      const t = createTranslator({ locale, messages, namespace: "home" });
      // L'etichetta finisce dentro un attributo HTML costruito a stringa: il
      // valore deve arrivarci intero, l'escape lo fa il carosello.
      expect(t("featuredGoTo", { n: 'Boss "Wide"' })).toContain('Boss "Wide"');
    });
  }
});

/**
 * L'alt della cover delle card in evidenza.
 *
 * ⚠️ **Una stringa che deve contenere il nome, e per ogni lingua**: un alt che
 * perdesse il segnaposto direbbe «Collezione» su tutte e sei le card, cioè la
 * stessa frase per sei immagini diverse — che per una ricerca per immagini è
 * come non averlo. La coppia di asserzioni (contiene il nome, non contiene il
 * segnaposto) è quella che lo tiene fermo.
 */
describe("featuredCardAlt · l'alt della cover", () => {
  for (const [locale, messages] of Object.entries(LINGUE)) {
    it(`${locale}: contiene il nome della collezione e nessun segnaposto`, () => {
      const onError = vi.fn();
      const t = createTranslator({ locale, messages, namespace: "home", onError });
      const alt = t("featuredCardAlt", { nome: "Boss" });

      expect(onError).not.toHaveBeenCalled();
      expect(alt).toContain("Boss");
      expect(alt).not.toContain("{nome}");
      expect(alt.trim()).not.toBe("");
      // Non è solo il nome nudo: un alt che ripete il titolo e basta non dice a
      // chi lo legge che cosa sta guardando.
      expect(alt.trim().length, "l'alt è il solo nome").toBeGreaterThan("Boss".length);
    });

    it(`${locale}: due collezioni danno due alt diversi`, () => {
      const t = createTranslator({ locale, messages, namespace: "home" });
      expect(t("featuredCardAlt", { nome: "Boss" })).not.toBe(
        t("featuredCardAlt", { nome: "Twiggy" }),
      );
    });
  }
});
