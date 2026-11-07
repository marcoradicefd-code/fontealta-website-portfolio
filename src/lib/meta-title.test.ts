import { describe, expect, it } from "vitest";

import {
  BUDGET_TITOLO,
  descriptionHead,
  dominantMacro,
  firstBlockText,
  fitsTitle,
  headBudget,
  HEAD_CAP,
  LAYOUT_SUFFIX,
  MAX_TITLE,
  MIN_BUDGET,
  modelHead,
} from "./meta-title";

/**
 * L'aritmetica dei `title`. Le stringhe di prova sono quelle vere del catalogo,
 * non inventate: «Accessories RE12.AST.FS» è il nome più lungo dei 595 modelli,
 * e le teste sono le voci dell'Excel dei contenuti nelle cinque lingue.
 */

const NOME_PEGGIORE = "Accessories RE12.AST.FS";
const blocchi = (testo: string) => [{ _type: "block", children: [{ text: testo }] }];

describe("la testa della description", () => {
  it("si ferma alla prima virgola", () => {
    expect(descriptionHead("Rubinetto temporizzato a pressione, acciaio inox", 38, "it")).toBe(
      "Rubinetto temporizzato a pressione",
    );
  });

  it("quando supera il budget taglia PRIMA di una preposizione", () => {
    // 41 caratteri, budget 38. I tagli ammessi sono davanti a «per» e a «con»:
    // vince il più lungo che ci sta, cioè quello davanti a «con».
    expect(descriptionHead("Colonna per lavabo con rubinetto d’arresto", 38, "it")).toBe(
      "Colonna per lavabo",
    );
  });

  it("la testa che ci sta INTERA non si tocca", () => {
    // Il taglio è un rimedio, non una regola di stile: se il budget la contiene,
    // la testa resta tutta, preposizioni comprese.
    expect(descriptionHead("Waschtischsäule mit Wasserhahn", 36, "de")).toBe(
      "Waschtischsäule mit Wasserhahn",
    );
  });

  it("⛔ non lascia un aggettivo senza il suo sostantivo", () => {
    // Il caso che ha fatto nascere la regola: col taglio alla parola intera
    // questa dava «Selbstschließender», che è una parola intera ma non è una
    // cosa. Il primo taglio ammesso è «Selbstschließender Hahn», 23 caratteri
    // contro 22 di budget: non ci sta, e allora la testa non si scrive.
    expect(
      descriptionHead("Selbstschließender Hahn mit Druckknopf Edelstahl Aisi 316", 22, "de"),
    ).toBe("");
    // Con un carattere in più di budget il sintagma ci sta, e torna.
    expect(
      descriptionHead("Selbstschließender Hahn mit Druckknopf Edelstahl Aisi 316", 23, "de"),
    ).toBe("Selbstschließender Hahn");
  });

  it("senza nessun taglio ammesso non inventa una testa", () => {
    expect(descriptionHead("Selbstschließendermitdruckknopf", 12, "de")).toBe("");
  });

  it("su testo vuoto o budget nullo non inventa niente", () => {
    expect(descriptionHead("", 38, "it")).toBe("");
    expect(descriptionHead(undefined, 38, "it")).toBe("");
    expect(descriptionHead("Miscelatore", 0, "it")).toBe("");
  });
});

describe("il primo blocco della description", () => {
  it("legge il testo del primo blocco e ignora i successivi", () => {
    expect(
      firstBlockText([
        { _type: "block", children: [{ text: "Waschtischsäule mit Wasserhahn" }] },
        { _type: "block", children: [{ text: "Un secondo paragrafo che non c’entra" }] },
      ]),
    ).toBe("Waschtischsäule mit Wasserhahn");
  });

  it("unisce gli span dello stesso blocco", () => {
    expect(firstBlockText([{ children: [{ text: "Colonna " }, { text: "doccia" }] }])).toBe(
      "Colonna doccia",
    );
  });

  it("su description assente risponde stringa vuota, non esplode", () => {
    expect(firstBlockText(undefined)).toBe("");
    expect(firstBlockText(null)).toBe("");
    expect(firstBlockText([])).toBe("");
  });
});

describe("il budget, che è la parte che tiene in piedi la regola", () => {
  it("è quello che avanza dopo nome, separatore e suffisso", () => {
    // it: 60 − 12 − 3 − 23 = 22
    expect(headBudget(NOME_PEGGIORE, "it")).toBe(22);
  });

  it("non supera mai il tetto voluto, anche con un nome cortissimo", () => {
    expect(headBudget("I30", "it")).toBe(HEAD_CAP);
  });

  it("è più stretto nelle lingue che scrivono più largo", () => {
    // Non è un capriccio: a parità di caratteri lo spagnolo supera i 580 px.
    expect(BUDGET_TITOLO.es).toBeLessThan(BUDGET_TITOLO.it);
    expect(headBudget(NOME_PEGGIORE, "es")).toBeLessThan(headBudget(NOME_PEGGIORE, "it"));
  });
});

describe("la testa del modello", () => {
  it("compone col nome più lungo del catalogo restando nei 60", () => {
    for (const locale of ["it", "en", "de", "fr", "es"] as const) {
      const testa = modelHead(
        NOME_PEGGIORE,
        blocchi("Rubinetto temporizzato a pressione acciaio inox"),
        locale,
      );
      const titolo = testa ? `${NOME_PEGGIORE} · ${testa}` : NOME_PEGGIORE;
      expect(titolo.length + LAYOUT_SUFFIX.length, `${locale}: «${titolo}»`).toBeLessThanOrEqual(
        MAX_TITLE,
      );
    }
  });

  it("con un nome che non lascia spazio alla testa torna vuota", () => {
    // 50 caratteri di nome: il budget scende sotto il minimo e la testa non si
    // scrive. Meglio un titolo corto che un moncone di otto lettere.
    const nomeLunghissimo = "A".repeat(50);
    expect(modelHead(nomeLunghissimo, blocchi("Miscelatore da lavabo"), "it")).toBe("");
    expect(headBudget(nomeLunghissimo, "it")).toBeLessThan(MIN_BUDGET);
  });

  it("senza description non inventa una testa", () => {
    expect(modelHead("Boss B40L", undefined, "it")).toBe("");
  });
});

describe("il title della collezione", () => {
  it("accetta la composizione quando sta nel limite", () => {
    expect(fitsTitle("Colonne doccia Boss")).toBe(true);
  });

  it("la rifiuta quando il suffisso la porta oltre", () => {
    // 49 + 12 = 61: un carattere oltre, e il chiamante ricade sul solo titolo.
    expect(fitsTitle("A".repeat(49))).toBe(false);
    expect(fitsTitle("A".repeat(48))).toBe(true);
  });
});

describe("la macro dominante", () => {
  it("è quella con più articoli, non la prima incontrata", () => {
    // I numeri veri di Boss: 26 doccia, 14 vasca, 12 lavabo, 1 bidet.
    const modelli = [
      ...Array.from({ length: 12 }, () => ({ productMacro: "lavabo" })),
      ...Array.from({ length: 14 }, () => ({ productMacro: "vasca" })),
      ...Array.from({ length: 26 }, () => ({ productMacro: "doccia" })),
      { productMacro: "bidet" },
    ];
    expect(dominantMacro(modelli)).toBe("doccia");
  });

  it("su una collezione senza macro non ne inventa una", () => {
    expect(dominantMacro([])).toBeUndefined();
    expect(dominantMacro([{ productMacro: null }])).toBeUndefined();
  });
});
