import { describe, expect, it } from "vitest";

import { formaDellaRiga } from "@/sanity/schemas/objects/misure-chiavi";

import { misuraPrincipale, valoreAlt, type MisuraVisibile } from "./misure";

const NB = " ";

describe("misuraPrincipale: la sola misura che va a video, dentro l'alt", () => {
  it("niente specs, niente famiglia, niente righe valide: null", () => {
    expect(misuraPrincipale(null)).toBeNull();
    expect(misuraPrincipale({ misure: [{ chiave: "altezzaTotale", valore: 2300 }] })).toBeNull();
    expect(misuraPrincipale({ famiglia: "colonna", misure: [] })).toBeNull();
    expect(
      misuraPrincipale({ famiglia: "colonna", misure: [{ chiave: "quota", valore: 83 }] }),
    ).toBeNull();
    expect(
      misuraPrincipale({ famiglia: "colonna", misure: [{ chiave: "altezzaTotale" }] }),
    ).toBeNull();
  });

  it("colonna: l'altezza totale, anche se non è la prima riga", () => {
    expect(
      misuraPrincipale({
        famiglia: "colonna",
        misure: [
          { chiave: "sporgenza", valore: 450 },
          { chiave: "altezzaTotale", valore: 2300 },
        ],
      }),
    ).toEqual({ chiave: "altezzaTotale", forma: "valore", valore: 2300, tolleranza: null });
  });

  it("il kit doccia non ne ha (decisione 2)", () => {
    expect(
      misuraPrincipale({
        famiglia: "kitDoccia",
        misure: [{ chiave: "interasseAttacchi", valore: 150, tolleranza: 15 }],
      }),
    ).toBeNull();
  });

  it("incasso: Ø placca, altrimenti la sporgenza della bocca", () => {
    const placca = { chiave: "diametroPlacca", valore: 70 };
    const bocca = { chiave: "sporgenzaBocca", min: 170, max: 200 };
    expect(misuraPrincipale({ famiglia: "incasso", misure: [bocca, placca] })?.chiave).toBe(
      "diametroPlacca",
    );
    expect(misuraPrincipale({ famiglia: "incasso", misure: [bocca] })?.chiave).toBe(
      "sporgenzaBocca",
    );
  });

  it("una riga con due forme, o un intervallo rovesciato, non vale", () => {
    const due = { chiave: "altezzaTotale", valore: 10, min: 1, max: 2 };
    const rovescio = { chiave: "altezzaTotale", min: 20, max: 10 };
    expect(misuraPrincipale({ famiglia: "piano", misure: [due] })).toBeNull();
    expect(misuraPrincipale({ famiglia: "piano", misure: [rovescio] })).toBeNull();
    expect(formaDellaRiga({ lati: [200] })).not.toBe(true);
    expect(formaDellaRiga({ min: 900, max: 1300 })).toBe(true);
  });
});

const valore = (v: number, t: number | null = null): MisuraVisibile => ({
  chiave: "altezzaTotale",
  forma: "valore",
  valore: v,
  tolleranza: t,
});
const intervallo: MisuraVisibile = {
  chiave: "altezzaTotale",
  forma: "intervallo",
  min: 1060,
  max: 1460,
  regolabile: true,
};

describe("valoreAlt: cm esatti, in inglese mm coi pollici a una cifra decimale", () => {
  it("cm esatti, anche coi decimali", () => {
    expect(valoreAlt(valore(2300), "it")).toBe(`230${NB}cm`);
    expect(valoreAlt(valore(1217), "it")).toBe(`121,7${NB}cm`);
    expect(valoreAlt(valore(2300), "de")).toBe(`230${NB}cm`);
  });

  it("inglese: mm col separatore e i pollici, sempre con una cifra decimale", () => {
    expect(valoreAlt(valore(2300), "en")).toBe(`2,300${NB}mm (90.6${NB}in)`);
    expect(valoreAlt(valore(50), "en")).toBe(`50${NB}mm (2.0${NB}in)`);
  });

  it("dell'intervallo solo il minimo, della tolleranza solo il valore (decisione 3)", () => {
    expect(valoreAlt(intervallo, "it")).toBe(`106${NB}cm`);
    expect(valoreAlt(intervallo, "en")).toBe(`1,060${NB}mm (41.7${NB}in)`);
    expect(valoreAlt(valore(150, 15), "it")).toBe(`15${NB}cm`);
    expect(valoreAlt(intervallo, "it")).not.toMatch(/–/);
  });

  it("i due lati col lato lungo prima, come nel listino, comunque siano salvati", () => {
    const s09: MisuraVisibile = { chiave: "soffione", forma: "lati", lati: [140, 250] };
    expect(valoreAlt(s09, "it")).toBe(`25${NB}×${NB}14${NB}cm`);
    expect(valoreAlt(s09, "en")).toBe(`250${NB}×${NB}140${NB}mm (9.8${NB}×${NB}5.5${NB}in)`);
    expect(valoreAlt({ ...s09, lati: [250, 140] }, "it")).toBe(`25${NB}×${NB}14${NB}cm`);
  });
});
