import { describe, expect, it } from "vitest";

import { REQUEST_TYPES, RICHIESTE_NEL_MENU, contactSchema, etichettaNote } from "./schema";

/**
 * Note, Paese e lingua del modulo (13/10/2026). Le regole sulle note sono di Marco:
 * «altro» → minimo 10; «Altro Paese» (`ZZ`) con le altre richieste → minimo 2; altrimenti
 * facoltative. Lo stesso schema valida nel browser e rivalida sul server.
 */
const base = {
  nome: "Mario",
  cognome: "Rossi",
  email: "mario@example.com",
  telefono: "",
  azienda: "",
  richiesta: "preventivo",
  paese: "IT",
  note: "",
};

const campiInErrore = (valori: Record<string, unknown>) => {
  const r = contactSchema.safeParse(valori);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}:${i.message}`);
};

describe("note", () => {
  it("«altro» senza note → errore su note", () => {
    expect(campiInErrore({ ...base, richiesta: "altro" })).toEqual(["note:noteRequired"]);
  });
  it("«altro» con 10 caratteri o più → ok", () => {
    expect(campiInErrore({ ...base, richiesta: "altro", note: "Rubinetto." })).toEqual([]);
  });
  it("«altro» con 9 caratteri, spazi esclusi → errore", () => {
    expect(campiInErrore({ ...base, richiesta: "altro", note: "  123456789  " })).toEqual([
      "note:noteRequired",
    ]);
  });
  it("«preventivo» senza note → ok", () => {
    expect(campiInErrore(base)).toEqual([]);
  });
  it("«preventivo» + ZZ senza note → errore", () => {
    expect(campiInErrore({ ...base, paese: "ZZ" })).toEqual(["note:notePaeseRequired"]);
  });
  it("«preventivo» + ZZ con «Kosovo» → ok", () => {
    expect(campiInErrore({ ...base, paese: "ZZ", note: "Kosovo" })).toEqual([]);
  });
  it("«altro» + ZZ con 5 caratteri → errore: vale il minimo 10", () => {
    expect(campiInErrore({ ...base, richiesta: "altro", paese: "ZZ", note: "Kosov" })).toEqual([
      "note:noteRequired",
    ]);
  });
  it("oltre 1000 caratteri → errore", () => {
    expect(campiInErrore({ ...base, note: "x".repeat(1001) })).toHaveLength(1);
  });
  /**
   * ⚠️ Un menu lasciato vuoto è un errore BLOCCANTE per Zod 4, e senza `when` il controllo
   * delle note non girerebbe: chi sceglie «altro» e non sceglie il Paese vedrebbe l'errore
   * delle note solo al secondo invio. Misurato togliendo `when`: qui resta solo `paese`.
   */
  it("«altro» senza Paese: compaiono insieme l'errore del Paese e quello delle note", () => {
    expect(campiInErrore({ ...base, paese: "", richiesta: "altro" }).sort()).toEqual([
      "note:noteRequired",
      "paese:paeseRequired",
    ]);
  });
});

describe("paese", () => {
  it("ZZ accettato", () => {
    expect(campiInErrore({ ...base, paese: "ZZ", note: "Kosovo" })).toEqual([]);
  });
  it.each([
    ["assente", undefined],
    ["vuoto", ""],
    ["codice inesistente XX", "XX"],
    ["Kosovo XK, fuori dall'elenco", "XK"],
    // Il menu manda solo maiuscole: normalizzare servirebbe solo a chi chiama la Action
    // senza passare dal modulo. Si rifiuta.
    ["minuscolo it", "it"],
  ])("%s → errore paeseRequired", (_caso, paese) => {
    expect(campiInErrore({ ...base, paese })).toEqual(["paese:paeseRequired"]);
  });
});

describe("lingua", () => {
  it.each([
    ["non valida", "xx"],
    ["di 50 caratteri", "x".repeat(50)],
    ["di tipo sbagliato", 42],
  ])("una lingua %s NON rifiuta il lead: ci pensa il server", (_caso, lingua) => {
    expect(campiInErrore({ ...base, lingua })).toEqual([]);
  });
});

describe("etichetta delle note", () => {
  it.each([
    ["altro", "IT", "noteAltro"],
    ["altro", "ZZ", "noteAltroPaese"],
    ["preventivo", "ZZ", "notePaese"],
    ["catalogo", "IT", "noteFacoltative"],
    [undefined, undefined, "noteFacoltative"],
  ])("%s + %s → %s", (richiesta, paese, attesa) => {
    expect(etichettaNote(richiesta, paese)).toBe(attesa);
  });
});

/**
 * Il catalogo esce dal menu e ha il suo modulo (19/10/2026, Marco): nome, cognome (dal 20/10/2026),
 * email e Paese. Lo schema accetta ancora `"catalogo"`, perché una pagina aperta da prima lo manda.
 */
describe("catalogo", () => {
  it("il menu ha tre voci, senza il catalogo; lo schema ne accetta quattro", () => {
    expect([...RICHIESTE_NEL_MENU]).toEqual(["preventivo", "consulenza", "altro"]);
    expect(REQUEST_TYPES).toContain("catalogo");
  });

  it("il mini-modulo: nome, cognome, email e Paese bastano", () => {
    expect(
      campiInErrore({
        nome: "Mario",
        cognome: "Rossi",
        email: "mario@example.com",
        paese: "DE",
        richiesta: "catalogo",
      }),
    ).toEqual([]);
  });

  it("il mini-modulo senza cognome → cognomeRequired (dal 20/10/2026 anche col catalogo)", () => {
    // Il modulo manda sempre il campo, vuoto se non compilato (`defaultValues` del hook).
    const mini = {
      nome: "Mario",
      cognome: "",
      email: "m@example.com",
      paese: "DE",
      richiesta: "catalogo",
    };
    expect(campiInErrore(mini)).toEqual(["cognome:cognomeRequired"]);
    expect(campiInErrore({ ...mini, cognome: " " })).toEqual(["cognome:cognomeRequired"]);
  });

  it("il mini-modulo con «Altro Paese» vuole le note", () => {
    expect(
      campiInErrore({
        nome: "Mario",
        cognome: "Rossi",
        email: "m@example.com",
        paese: "ZZ",
        richiesta: "catalogo",
        note: "",
      }),
    ).toEqual(["note:notePaeseRequired"]);
  });

  it("un modulo generale con «catalogo» (pagina in cache) passa anche col cognome", () => {
    expect(campiInErrore({ ...base, richiesta: "catalogo" })).toEqual([]);
  });

  it.each(["preventivo", "consulenza", "altro", "catalogo"])(
    "«%s» senza cognome → cognomeRequired",
    (richiesta) => {
      const note = richiesta === "altro" ? "Una richiesta." : "";
      expect(campiInErrore({ ...base, richiesta, note, cognome: "" })).toEqual([
        "cognome:cognomeRequired",
      ]);
      expect(campiInErrore({ ...base, richiesta, note, cognome: "   " })).toEqual([
        "cognome:cognomeRequired",
      ]);
    },
  );

  it("menu vuoti e cognome vuoto → l'errore del cognome c'è già al primo invio", () => {
    const errori = campiInErrore({ ...base, cognome: "", richiesta: "", paese: "" });
    expect(errori).toContain("cognome:cognomeRequired");
    expect(errori).toContain("richiesta:richiestaRequired");
    expect(errori).toContain("paese:paeseRequired");
  });
});

/** La casella della newsletter (19/10/2026): facoltativa, mai un rifiuto del lead. */
describe("newsletter", () => {
  it("assente → false", () => {
    const r = contactSchema.safeParse(base);
    expect(r.success && r.data.newsletter).toBe(false);
  });
  it("true → true", () => {
    const r = contactSchema.safeParse({ ...base, newsletter: true });
    expect(r.success && r.data.newsletter).toBe(true);
  });
  it.each([["sì"], [1], [null]])("%s → false, e il lead passa", (valore) => {
    const r = contactSchema.safeParse({ ...base, newsletter: valore });
    expect(r.success).toBe(true);
    expect(r.success && r.data.newsletter).toBe(false);
  });
});
