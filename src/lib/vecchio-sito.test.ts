import { describe, expect, it } from "vitest";

import { destinazioneVecchioSito, slugDalCodice } from "./vecchio-sito";

/**
 * I casi vengono dai log di produzione del 21/09-19/10/2026. Gli slug vivi sono una fotografia
 * scritta qui, non letta da Sanity: il test prova la regola, non il catalogo di oggi.
 */
const MODELLI = new Set([
  "c50r-me",
  "q120",
  "bw76-e",
  "sa300-sc",
  "b40l-m",
  "p22-m",
  "col90-2",
  "w35",
  "q86",
]);
// prettier-ignore
const COLLEZIONI = new Set([
  "corpi-a-incasso", "accessories", "arko", "boss", "boss-wide", "classy", "club", "club-large",
  "community", "flamingo", "ille", "in-out", "kitchen", "onda", "origo", "origo-rame", "skinny",
  "spring", "square", "twiggy", "waterline", "yacht",
]);
const dest = (f: string) => destinazioneVecchioSito(f, MODELLI, COLLEZIONI);

describe("slugDalCodice", () => {
  it("minuscolo e «.» → «-», come le 591 schede del catalogo", () => {
    expect(slugDalCodice("C50R.ME")).toBe("c50r-me");
    expect(slugDalCodice("COL90.2")).toBe("col90-2");
    expect(slugDalCodice("W35")).toBe("w35");
  });
});

describe("vecchio .aspx → scheda viva: vince il codice", () => {
  it.each([
    ["ORIGO_RAME-C50R.ME.aspx", "/modello/c50r-me"],
    ["SPRING-COL90.2.aspx", "/modello/col90-2"],
    // La collezione del vecchio sito non è quella di oggi: IDRA è in Community, W35 è Skinny, Q86 è Square.
    ["IDRA-Q120.aspx", "/modello/q120"],
    ["WATERLINE-W35.aspx", "/modello/w35"],
    ["SKINNY-Q86.aspx", "/modello/q86"],
    // Nome di collezione col trattino: il taglio giusto è il secondo.
    ["BOSS-WIDE-BW76.E.aspx", "/modello/bw76-e"],
    // Codice scritto col trattino invece del punto: lo slug è lo stesso.
    ["WATERLINE-SA300-SC.aspx", "/modello/sa300-sc"],
    ["WATERLINE-SA300.SC.aspx", "/modello/sa300-sc"],
    // Maiuscole miste e minuscole.
    ["Boss-B40L.M.aspx", "/modello/b40l-m"],
    ["idra-q120.aspx", "/modello/q120"],
    ["INeOUT-P22.M.aspx", "/modello/p22-m"],
  ])("%s → %s", (file, attesa) => expect(dest(file)).toBe(attesa));
});

describe("vecchio .aspx → collezione, se il codice non è vivo", () => {
  it.each([
    ["WATERLINE-W60-E.aspx", "/collezioni/waterline"],
    ["CLUB-C90-MIX-EXTRA.aspx", "/collezioni/club"],
    ["ORIGO-RAME-C50-R-EXTRA.aspx", "/collezioni/origo-rame"],
    ["BOSS_WIDE-BW76.T.aspx", "/collezioni/boss-wide"],
    ["INeOUT-P34.aspx", "/collezioni/in-out"],
    ["waterline-mx2.aspx", "/collezioni/waterline"],
  ])("%s → %s", (file, attesa) => expect(dest(file)).toBe(attesa));
});

describe("collezioni ritirate (Marco, 20/10/2026)", () => {
  it.each([
    ["LARES-P60.aspx", "/collezioni/community"],
    ["lares-p60.aspx", "/collezioni/community"],
    ["LARES-PQ80-EXTRA.aspx", "/collezioni/community"],
    ["ZENIT-Q70.M.aspx", "/collezioni"],
    ["ZENIT-Q70-MIX-EXTRA.aspx", "/collezioni"],
  ])("%s → %s", (file, attesa) => expect(dest(file)).toBe(attesa));
});

describe("nessuna destinazione → la pagina dà 404", () => {
  it.each([
    "career.aspx",
    "home.aspx",
    "Telerik.Web.UI.DialogHandler.aspx",
    "SKINNY-.aspx",
    "-S40.aspx",
    "PIPPO-XYZ.aspx",
    "constructor-X.aspx",
    "SKINNY-S40.html",
    "%E0%A4%A.aspx",
  ])("%s → null", (file) => expect(dest(file)).toBeNull());
});
