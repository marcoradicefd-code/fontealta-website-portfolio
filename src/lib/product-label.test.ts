import { describe, expect, it } from "vitest";

import { productLabel, productLabelParts, type LabelLookup } from "./product-label";

/** Traduttore finto: risolve dal dizionario, `has` dice se la chiave esiste. */
const lookup = (dict: Record<string, string>): LabelLookup => {
  const fn = ((key: string) => dict[key] ?? key) as LabelLookup;
  fn.has = (key: string) => key in dict;
  return fn;
};

const t = {
  macro: lookup({ doccia: "Doccia", lavabo: "Lavabo" }),
  subtype: lookup({ colonna: "Colonna", "miscelatore-parete": "Miscelatore parete" }),
};

describe("productLabel", () => {
  it("compone macro e sottotipo con l'em dash spaziata", () => {
    // ⚠️ La coppia NON è `doccia/colonna`: dal 21/09/2026 quella ha un termine
    // ufficiale del catalogo che scavalca la composizione, e qui si misura la
    // composizione. Scegliere una coppia con l'override farebbe passare il test
    // per la ragione sbagliata — o cadere, come è successo.
    expect(
      productLabel({ productMacro: "doccia", productSubtype: "miscelatore-parete" }, t, "it"),
    ).toBe("Doccia — Miscelatore parete");
  });

  it("chiave i18n del SOTTOTIPO mancante → slug grezzo, non pill assente", () => {
    // Il buco di traduzione deve restare visibile a schermo: nasconderlo tornando
    // null farebbe sparire la pill e nessuno se ne accorgerebbe.
    expect(productLabel({ productMacro: "doccia", productSubtype: "soffitto" }, t, "it")).toBe(
      "Doccia — soffitto",
    );
  });

  it("chiave i18n della MACRO mancante → slug grezzo, stesso principio", () => {
    expect(productLabel({ productMacro: "giardino", productSubtype: "colonna" }, t, "it")).toBe(
      "giardino — Colonna",
    );
  });

  it("macro senza sottotipo → null: mezza etichetta è peggio di nessuna", () => {
    expect(productLabel({ productMacro: "doccia" }, t, "it")).toBeNull();
    expect(productLabel({ productMacro: "doccia", productSubtype: null }, t, "it")).toBeNull();
  });

  it("sottotipo senza macro → null, simmetrico al caso opposto", () => {
    expect(productLabel({ productSubtype: "colonna" }, t, "it")).toBeNull();
    expect(productLabel({ productMacro: null, productSubtype: "colonna" }, t, "it")).toBeNull();
  });

  it("senza nessun campo ritorna null, così il chiamante omette la pill", () => {
    expect(productLabel({}, t, "it")).toBeNull();
    expect(productLabel({ productMacro: null, productSubtype: null }, t, "it")).toBeNull();
  });
});

describe("productLabelParts", () => {
  /**
   * Le parti separate esistono perché la pill non è più l'unico consumatore: la
   * `description` delle schede compone le stesse due etichette in una frase, con
   * un'altra punteggiatura e in un ORDINE che cambia con la lingua. Il degrado
   * deve restare uno solo per entrambe.
   */
  it("restituisce le due etichette risolte, senza unirle", () => {
    expect(productLabelParts({ productMacro: "doccia", productSubtype: "colonna" }, t)).toEqual({
      macro: "Doccia",
      subtype: "Colonna",
    });
  });

  it("degrada allo slug grezzo esattamente come la pill", () => {
    expect(productLabelParts({ productMacro: "giardino", productSubtype: "soffitto" }, t)).toEqual({
      macro: "giardino",
      subtype: "soffitto",
    });
  });

  it("senza sottotipo torna la sola macro, e NON null", () => {
    // Qui sta la differenza con `productLabel`: la pill vuole la coppia completa
    // perché mezza etichetta è peggio di nessuna, la frase invece sa cavarsela
    // con il solo ambiente in forma preposizionale.
    expect(productLabelParts({ productMacro: "doccia" }, t)).toEqual({
      macro: "Doccia",
      subtype: null,
    });
  });

  it("senza macro torna null: non c'è niente da dire", () => {
    expect(productLabelParts({ productSubtype: "colonna" }, t)).toBeNull();
    expect(productLabelParts({ productMacro: null, productSubtype: "colonna" }, t)).toBeNull();
  });

  it("la pill continua a comporre dalle stesse parti", () => {
    // Controprova che non sono due strade: se un giorno divergessero, qui cade.
    // ⚠️ La coppia è `doccia/soffione` e non più `doccia/colonna`: dal
    // 21/09/2026 le tre colonne hanno un TERMINE UFFICIALE che scavalca la
    // composizione, e su quelle questo test misurerebbe l'override invece della
    // composizione che dice di misurare.
    const parti = productLabelParts({ productMacro: "doccia", productSubtype: "soffione" }, t);
    expect(productLabel({ productMacro: "doccia", productSubtype: "soffione" }, t, "it")).toBe(
      `${parti?.macro} — ${parti?.subtype}`,
    );
  });

  it("sulle tre colonne il termine ufficiale del catalogo scavalca la composizione", () => {
    // Una parola sola, quindi senza em dash: è il termine del listino, non una
    // bonifica tipografica.
    expect(productLabel({ productMacro: "doccia", productSubtype: "colonna" }, t, "de")).toBe(
      "Duschsäule",
    );
    expect(productLabel({ productMacro: "lavabo", productSubtype: "colonna" }, t, "es")).toBe(
      "Columna de lavabo",
    );
    expect(productLabel({ productMacro: "doccia", productSubtype: "colonna" }, t, "it")).toBe(
      "Colonna doccia",
    );
  });

  it("dove il catalogo non ha un termine proprio, la pill resta composta", () => {
    // `giardino/colonna` sull'Excel è «Colonna con…»: nessun nome di tipo, e la
    // composizione di sempre è già quella giusta.
    const parti = productLabelParts({ productMacro: "giardino", productSubtype: "colonna" }, t);
    expect(productLabel({ productMacro: "giardino", productSubtype: "colonna" }, t, "de")).toBe(
      `${parti?.macro} — ${parti?.subtype}`,
    );
  });
});
