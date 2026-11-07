import { describe, expect, it } from "vitest";

import {
  contaAttivi,
  gruppiVisibili,
  leggiFiltri,
  ribalta,
  scriviFiltri,
  svuota,
  type GruppoFiltro,
} from "./filtri-url";

const FINITURE: GruppoFiltro = {
  chiave: "finitura",
  etichetta: "Finitura",
  // ordine di LISTINO, che è quello che deve uscire nell'URL
  opzioni: ["MX", "BX", "MB", "RL", "BB", "BC", "AB", "DB"].map((v) => ({
    valore: v,
    etichetta: v,
  })),
};
const AMBIENTI: GruppoFiltro = {
  chiave: "ambiente",
  etichetta: "Ambiente",
  opzioni: ["lavabo", "doccia", "vasca", "bidet"].map((v) => ({ valore: v, etichetta: v })),
};
const GRUPPI = [FINITURE, AMBIENTI];

const params = (q: string) => new URLSearchParams(q);

describe("leggiFiltri", () => {
  it("legge i due gruppi dalla query string", () => {
    const s = leggiFiltri(params("finitura=MX,BX&ambiente=lavabo"), GRUPPI);
    expect([...s.finitura]).toEqual(["MX", "BX"]);
    expect([...s.ambiente]).toEqual(["lavabo"]);
  });

  it("query vuota: ogni gruppo esiste ed è vuoto", () => {
    const s = leggiFiltri(params(""), GRUPPI);
    expect(s.finitura.size).toBe(0);
    expect(s.ambiente.size).toBe(0);
  });

  it("SCARTA i valori che non sono fra le opzioni", () => {
    // `?finitura=PIPPO` scritto a mano non deve dare una griglia vuota
    // inspiegabile: il valore sconosciuto sparisce, quelli buoni restano.
    const s = leggiFiltri(params("finitura=MX,PIPPO,BX&ambiente=marte"), GRUPPI);
    expect([...s.finitura]).toEqual(["MX", "BX"]);
    expect(s.ambiente.size).toBe(0);
  });

  it("tollera spazi e valori vuoti", () => {
    const s = leggiFiltri(params("finitura= MX , ,BX,"), GRUPPI);
    expect([...s.finitura]).toEqual(["MX", "BX"]);
  });
});

describe("scriviFiltri", () => {
  it("emette nell'ordine delle OPZIONI, non in quello dei clic", () => {
    // stesso insieme, inserito al contrario: stessa URL
    const a = { finitura: new Set(["DB", "MX"]), ambiente: new Set<string>() };
    const b = { finitura: new Set(["MX", "DB"]), ambiente: new Set<string>() };
    expect(scriviFiltri(a, GRUPPI)).toBe("finitura=MX,DB");
    expect(scriviFiltri(a, GRUPPI)).toBe(scriviFiltri(b, GRUPPI));
  });

  it("nessun filtro: stringa VUOTA, non un `?` orfano", () => {
    expect(scriviFiltri(svuota(GRUPPI), GRUPPI)).toBe("");
  });

  it("gruppo vuoto omesso, l'altro resta", () => {
    const s = { finitura: new Set<string>(), ambiente: new Set(["doccia", "lavabo"]) };
    expect(scriviFiltri(s, GRUPPI)).toBe("ambiente=lavabo,doccia");
  });

  it("andata e ritorno: leggere ciò che si è scritto dà lo stesso stato", () => {
    const s = { finitura: new Set(["BX", "AB"]), ambiente: new Set(["vasca"]) };
    const q = scriviFiltri(s, GRUPPI);
    const r = leggiFiltri(params(q), GRUPPI);
    expect([...r.finitura]).toEqual(["BX", "AB"]);
    expect([...r.ambiente]).toEqual(["vasca"]);
  });
});

describe("ribalta", () => {
  it("aggiunge e toglie senza mutare lo stato di partenza", () => {
    const s = svuota(GRUPPI);
    const conMX = ribalta(s, "finitura", "MX");
    expect(s.finitura.size).toBe(0);
    expect([...conMX.finitura]).toEqual(["MX"]);
    expect(ribalta(conMX, "finitura", "MX").finitura.size).toBe(0);
  });
});

describe("gruppiVisibili", () => {
  it("nasconde i gruppi con MENO di due opzioni", () => {
    // Yacht ha 1 finitura, 12 collezioni su 22 hanno 1 ambiente: selezionare
    // l'unica opzione equivale a non filtrare.
    const uno: GruppoFiltro = { ...FINITURE, opzioni: [{ valore: "MX", etichetta: "MX" }] };
    const zero: GruppoFiltro = { ...FINITURE, opzioni: [] };
    expect(gruppiVisibili([uno, AMBIENTI])).toEqual([AMBIENTI]);
    expect(gruppiVisibili([zero, uno])).toEqual([]);
    expect(gruppiVisibili(GRUPPI)).toHaveLength(2);
  });
});

describe("contaAttivi", () => {
  it("somma i filtri di tutti i gruppi", () => {
    expect(contaAttivi({ finitura: new Set(["MX", "BX"]), ambiente: new Set(["lavabo"]) })).toBe(3);
    expect(contaAttivi(svuota(GRUPPI))).toBe(0);
  });
});
