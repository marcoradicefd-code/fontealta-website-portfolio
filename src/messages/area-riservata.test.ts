import { describe, expect, it } from "vitest";

import en from "./en.json";
import itMessages from "./it.json";

/**
 * Guardie sul copy della pagina «Area Riservata».
 *
 * Due cose che nessun altro controllo vede: la PARITÀ delle chiavi fra IT e EN
 * (una chiave presente da un lato solo non rompe il build, rompe la pagina in
 * una lingua sola, e solo a runtime), e il VINCOLO che il copy non prometta
 * tempi. Il secondo è una decisione di prodotto: una data o un «a breve»
 * invecchiano da soli e diventano una promessa mancata, e la pagina resterà su
 * finché l'Area Pro vera non esiste.
 */

const NS = "areaRiservata" as const;
const CHIAVI = ["metaTitle", "metaDescription", "eyebrow", "title", "body", "cta"] as const;

const copie = {
  it: itMessages[NS] as Record<string, string>,
  en: en[NS] as Record<string, string>,
};

/**
 * Vietate le PROMESSE, non la parola «tempo»: il titolo IT approvato è
 * «L'acciaio ha i suoi tempi.» e quello EN «Steel takes its time.». Confini di
 * parola ovunque, altrimenti `day` pesca dentro `today`, che è un presente e non
 * una scadenza.
 */
const MESI =
  "gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|january|february|march|april|may|june|july|august|september|october|november|december";

const PROMESSE: RegExp[] = [
  /\bpresto\b/i,
  /\ba breve\b/i,
  /\bprossimamente\b/i,
  /\bin arrivo\b/i,
  /\bsettimane?\b/i,
  /\bmesi\b/i,
  /\bentro\b/i,
  /\bcersaie\b/i,
  /\bsoon\b/i,
  /\bshortly\b/i,
  /\bweeks?\b/i,
  /\bmonths?\b/i,
  /\bstay tuned\b/i,
  /\b20\d{2}\b/,
  new RegExp(`\\b(${MESI})\\b`, "i"),
];

describe("copy Area Riservata", () => {
  it("ha lo stesso insieme di chiavi in IT e EN", () => {
    expect(Object.keys(copie.it).sort()).toEqual(Object.keys(copie.en).sort());
  });

  for (const [locale, copia] of Object.entries(copie)) {
    describe(locale, () => {
      it("porta tutte le chiavi attese, non vuote", () => {
        for (const chiave of CHIAVI) {
          expect(copia[chiave], `${locale}.${NS}.${chiave}`).toBeTypeOf("string");
          expect(copia[chiave]?.trim().length, `${locale}.${NS}.${chiave}`).toBeGreaterThan(0);
        }
      });

      it("non promette tempi", () => {
        for (const [chiave, valore] of Object.entries(copia)) {
          for (const promessa of PROMESSE) {
            expect(promessa.test(valore), `${locale}.${NS}.${chiave} → ${promessa}`).toBe(false);
          }
        }
      });

      // Regole tipografiche del progetto: em dash vietata nel copy, apostrofo
      // curly `’` e mai l'ASCII `'`.
      it("rispetta le regole tipografiche", () => {
        for (const [chiave, valore] of Object.entries(copia)) {
          expect(valore.includes("—"), `em dash in ${locale}.${NS}.${chiave}`).toBe(false);
          expect(valore.includes("'"), `apostrofo ASCII in ${locale}.${NS}.${chiave}`).toBe(false);
        }
      });
    });
  }

  // L'etichetta del link vive in `nav`, il titolo della pagina in `areaRiservata`:
  // due namespace diversi che devono dire la stessa cosa, o il menu porta a una
  // pagina che si chiama in un altro modo.
  it("allinea l'etichetta del menu al titolo della pagina", () => {
    expect(itMessages.nav.areaPro).toBe(copie.it.eyebrow);
    expect(en.nav.areaPro).toBe(copie.en.eyebrow);
  });
});
