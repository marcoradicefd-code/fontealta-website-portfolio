import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { ALL_LOCALES, type Locale } from "@/i18n/routing";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import itMessages from "@/messages/it.json";
import { MACRO_SUBTYPES } from "@/sanity/schemas/documents/model-taxonomy";

import { productLabelParts } from "./product-label";
import { LABEL_IN_SENTENCE, labelInSentence } from "./label-in-sentence";
import { productTypePhrase } from "./product-type-phrase";
import { sentenceCase } from "./sentence-case";

/**
 * La frase di tipo e la description della scheda modello, rese con i messaggi
 * VERI delle cinque lingue e con il motore ICU di next-intl.
 *
 * ⚠️ Le frasi attese di IT, EN, FR ed ES sono quelle servite in produzione il
 * 16/09/2026 su `b40l`, PRIMA di questa modifica: sono l'oracolo
 * dell'invarianza, non un testo riscritto per far passare il test.
 */
const MESSAGGI = { it: itMessages, en, de, fr, es } as const;

const tradotto = (locale: Locale) => ({
  modello: createTranslator({ locale, messages: MESSAGGI[locale], namespace: "modello" }),
  macro: createTranslator({ locale, messages: MESSAGGI[locale], namespace: "productCategories" }),
  subtype: createTranslator({ locale, messages: MESSAGGI[locale], namespace: "productSubtypes" }),
});

type Traduttori = ReturnType<typeof tradotto>;

/** Etichette risolte come le risolve la pagina, con `has()` per il degrado. */
function parti(t: Traduttori, macro: string, subtype: string | null) {
  // Due lookup separati e non uno generico: l'unione dei due traduttori ha firme
  // incompatibili e `tsc` la rifiuta come non chiamabile.
  const lookupMacro = Object.assign((k: string) => t.macro(k as never), {
    has: (k: string) => t.macro.has(k as never),
  });
  const lookupSubtype = Object.assign((k: string) => t.subtype(k as never), {
    has: (k: string) => t.subtype.has(k as never),
  });
  return productLabelParts(
    { productMacro: macro, productSubtype: subtype },
    { macro: lookupMacro, subtype: lookupSubtype },
  );
}

function frase(locale: Locale, macro: string, subtype: string | null) {
  const t = tradotto(locale);
  return productTypePhrase(parti(t, macro, subtype), locale, {
    withSubtype: (values) => t.modello("tipo", values),
    macroOnly: (values) => t.modello("tipoSoloAmbiente", values),
  });
}

/** La composizione PRIMA di questa modifica: etichette in minuscolo per tutte le
 *  lingue, iniziale maiuscola. Serve come controprova dell'invarianza. */
function fraseDiPrima(locale: Locale, macro: string, subtype: string | null) {
  const t = tradotto(locale);
  const p = parti(t, macro, subtype);
  if (!p) return null;
  const giu = (v: string) => v.toLocaleLowerCase(locale);
  const s = p.subtype
    ? t.modello("tipo", { subtype: giu(p.subtype), categoria: giu(p.macro) })
    : t.modello("tipoSoloAmbiente", { categoria: giu(p.macro) });
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
}

describe("description della scheda modello · un modello per lingua (B40L)", () => {
  const ATTESE: Record<Locale, string> = {
    it: "Boss B40L. Colonna per lavabo Fontealta in acciaio inox AISI 316, 4 finiture disponibili.",
    en: "Boss B40L. Basin column by Fontealta, AISI 316 stainless steel, 4 finishes available.",
    de: "Boss B40L. Säule für Waschtisch von Fontealta aus Edelstahl AISI 316, 4 verfügbare Oberflächen.",
    fr: "Boss B40L. Colonne pour lavabo Fontealta en acier inox AISI 316, 4 finitions disponibles.",
    es: "Boss B40L. Columna para lavabo Fontealta en acero inoxidable AISI 316, 4 acabados disponibles.",
  };

  it.each(ALL_LOCALES)("%s", (locale) => {
    const tipo = frase(locale, "lavabo", "colonna");
    expect(tipo).not.toBeNull();
    const description = tradotto(locale).modello("metaDescriptionTipo", {
      nome: "Boss B40L",
      tipo: tipo!,
      finiture: 4,
    });
    expect(description).toBe(ATTESE[locale]);
  });
});

describe("la mappa per lingua", () => {
  it("in tedesco i sostantivi restano maiuscoli, nella frase e nell'hero", () => {
    expect(frase("de", "doccia", "colonna")).toBe("Säule für Dusche");
    expect(frase("de", "giardino", null)).toBe("Für Garten");
    // l'hero compone «n + finishesTitle» e lo passa a sentenceCase, come qui
    expect(sentenceCase(`4 ${de.modello.finishesTitle}`, "de")).toBe("4 Oberflächen");
    expect(labelInSentence("Säule", "de")).toBe("Säule");
  });

  it("nelle altre lingue l'etichetta si abbassa, anche nell'hero", () => {
    expect(sentenceCase(`4 ${itMessages.modello.finishesTitle}`, "it")).toBe("4 finiture");
    expect(sentenceCase(`4 ${en.modello.finishesTitle}`, "en")).toBe("4 finishes");
    expect(sentenceCase(`4 ${fr.modello.finishesTitle}`, "fr")).toBe("4 finitions");
    expect(sentenceCase(`4 ${es.modello.finishesTitle}`, "es")).toBe("4 acabados");
  });

  it("dichiara una regola per ognuna delle lingue, nessuna di più", () => {
    expect(Object.keys(LABEL_IN_SENTENCE).sort()).toEqual([...ALL_LOCALES].sort());
  });

  it("senza etichette non compone niente", () => {
    expect(
      productTypePhrase(null, "de", { withSubtype: () => "x", macroOnly: () => "x" }),
    ).toBeNull();
  });
});

describe("invarianza su IT, EN, FR ed ES · tutte le coppie del catalogo", () => {
  const coppie = Object.entries(MACRO_SUBTYPES).flatMap(([macro, subtypes]) => [
    ...subtypes.map((s) => [macro, s] as const),
    [macro, null] as const,
  ]);

  it.each(["it", "en", "fr", "es"] as const)(
    "%s: stessa frase di prima su ogni coppia",
    (locale) => {
      for (const [macro, subtype] of coppie) {
        expect(frase(locale, macro, subtype)).toBe(fraseDiPrima(locale, macro, subtype));
      }
    },
  );

  /** Il comportamento di `sentenceCase` PRIMA di questa modifica, senza lingua: ogni parola
   *  che non è una sigla va in minuscolo, poi l'iniziale in maiuscolo. Scritto in un'altra
   *  forma e non copiato, così l'oracolo non ripete il codice che controlla. */
  const sentenceCaseDiPrima = (input: string) => {
    const sigla = (w: string) => w === w.toUpperCase() && w !== w.toLowerCase();
    const giu = input.replace(/\S+/g, (w) => (sigla(w) ? w : w.toLowerCase()));
    return giu.charAt(0).toUpperCase() + giu.slice(1);
  };

  it.each(["it", "en", "fr", "es"] as const)(
    "%s: stessa riga meta dell'hero di prima su ogni coppia",
    (locale) => {
      const t = tradotto(locale);
      for (const [macro, subtype] of coppie) {
        const p = parti(t, macro, subtype);
        if (!p?.subtype) continue;
        const riga = `${p.macro} — ${p.subtype}`;
        expect(sentenceCase(riga, locale)).toBe(sentenceCaseDiPrima(riga));
      }
      const finiture = `4 ${MESSAGGI[locale].modello.finishesTitle}`;
      expect(sentenceCase(finiture, locale)).toBe(sentenceCaseDiPrima(finiture.toLowerCase()));
    },
  );

  it("de: la frase cambia davvero, altrimenti il test sopra non dimostrerebbe niente", () => {
    const diverse = coppie.filter(([m, s]) => frase("de", m, s) !== fraseDiPrima("de", m, s));
    expect(diverse.length).toBeGreaterThan(0);
  });
});
