import { describe, expect, it } from "vitest";

import { matchesActiveMacros } from "./concealed-body-filter";

/**
 * I 17 corpi a incasso in produzione, ridotti a codice + macro servite. Letti dal
 * dataset `production` il 29/07/2026, dopo l'arricchimento di PR 2.
 *
 * È una fixture di dati REALI e non inventati apposta: i conteggi qui sotto sono gli
 * stessi che il visual check asserisce sulla pagina viva, quindi se il dato cambia le
 * due reti si contraddicono e qualcuno se ne accorge.
 */
const BODIES: { code: string; servesMacros: string[] }[] = [
  { code: "CW.1", servesMacros: ["lavabo", "doccia", "vasca"] },
  { code: "CW.2", servesMacros: ["lavabo", "doccia", "vasca"] },
  { code: "HF1.INC", servesMacros: ["doccia"] },
  { code: "HF2.INC", servesMacros: ["doccia"] },
  { code: "HF3.INC", servesMacros: ["doccia"] },
  { code: "HF4.INC", servesMacros: ["doccia"] },
  { code: "MR.INC", servesMacros: ["lavabo", "doccia"] },
  { code: "MR2.INC", servesMacros: ["doccia"] },
  { code: "MR3.INC", servesMacros: ["doccia"] },
  { code: "MX.INC", servesMacros: ["doccia"] },
  { code: "ST.INC", servesMacros: ["doccia"] },
  { code: "W2MP.INC", servesMacros: ["lavabo", "vasca"] },
  { code: "W3MP.INC", servesMacros: ["vasca", "doccia"] },
  { code: "W3P.INC", servesMacros: ["lavabo"] },
  { code: "W4MP.INC", servesMacros: ["vasca"] },
  { code: "WM30.INC", servesMacros: ["lavabo"] },
  { code: "WMP.INC", servesMacros: ["lavabo"] },
];

const count = (...macros: string[]) =>
  BODIES.filter((b) => matchesActiveMacros(b, new Set(macros))).length;

describe("matchesActiveMacros", () => {
  it("senza filtri attivi passano tutti i 17 corpi", () => {
    expect(count()).toBe(17);
  });

  it("conta 7 · 12 · 5 sui tre ambienti, come il dato vivo", () => {
    expect(count("lavabo")).toBe(7);
    expect(count("doccia")).toBe(12);
    expect(count("vasca")).toBe(5);
  });

  /**
   * ⚠️ QUESTO È IL TEST CHE VALE. La somma dei tre gruppi è 24 su 17 corpi perché
   * sette corpi servono più di un ambiente e vanno contati in ognuno.
   *
   * Se qualcuno riscrivesse il predicato a uguaglianza stretta — copiando quello
   * delle collezioni, `activeTypes.has(resolveMacro(m))` — ogni corpo comparirebbe
   * sotto un ambiente solo e la somma tornerebbe 17. Che è il totale dei corpi: un
   * numero che a colpo d'occhio sembra corretto. Solo l'asserzione sulla SOMMA lo
   * smaschera.
   */
  it("la somma dei tre gruppi è 24, non 17: i corpi multi-ambiente si contano più volte", () => {
    expect(count("lavabo") + count("doccia") + count("vasca")).toBe(24);
    expect(BODIES.length).toBe(17);
  });

  it("compone i gruppi in OR: lavabo + vasca è l'unione (9), non l'intersezione", () => {
    expect(count("lavabo", "vasca")).toBe(9);
  });

  it("un corpo multi-ambiente compare sotto ognuno degli ambienti che serve", () => {
    const cw1 = BODIES.find((b) => b.code === "CW.1")!;
    expect(matchesActiveMacros(cw1, new Set(["lavabo"]))).toBe(true);
    expect(matchesActiveMacros(cw1, new Set(["doccia"]))).toBe(true);
    expect(matchesActiveMacros(cw1, new Set(["vasca"]))).toBe(true);
  });

  it("un corpo mono-ambiente non compare sotto gli altri", () => {
    const wmp = BODIES.find((b) => b.code === "WMP.INC")!;
    expect(matchesActiveMacros(wmp, new Set(["lavabo"]))).toBe(true);
    expect(matchesActiveMacros(wmp, new Set(["doccia"]))).toBe(false);
    expect(matchesActiveMacros(wmp, new Set(["vasca"]))).toBe(false);
  });

  it("servesMacros assente o vuoto non passa un filtro attivo, ma passa senza filtri", () => {
    expect(matchesActiveMacros({ servesMacros: null }, new Set(["doccia"]))).toBe(false);
    expect(matchesActiveMacros({ servesMacros: [] }, new Set(["doccia"]))).toBe(false);
    expect(matchesActiveMacros({ servesMacros: null }, new Set())).toBe(true);
  });
});
