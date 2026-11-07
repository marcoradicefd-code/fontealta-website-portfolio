import { afterEach, describe, expect, it, vi } from "vitest";

import { ALL_LOCALES } from "@/i18n/routing";

import { CODICI_ISO, CODICI_PAESE, PAESI_IN_TESTA, elencoPaesi } from "./paesi";

describe("elenco ISO", () => {
  it("249 codici alpha-2, maiuscoli, senza doppioni e senza XK", () => {
    expect(CODICI_ISO).toHaveLength(249);
    expect(new Set(CODICI_ISO).size).toBe(249);
    expect(CODICI_ISO.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
    expect(CODICI_ISO).not.toContain("XK");
  });
  it("il campo accetta anche ZZ, una volta sola", () => {
    expect(CODICI_PAESE.filter((c) => c === "ZZ")).toHaveLength(1);
  });
});

describe.each(ALL_LOCALES)("menu dei Paesi · %s", (lingua) => {
  const { inTesta, altri } = elencoPaesi(lingua);

  it("in testa gli 8 della costante, nel loro ordine", () => {
    expect(inTesta.map((p) => p.codice)).toEqual([...PAESI_IN_TESTA]);
  });
  it("tutti i 249 una volta sola, nessun doppione fra testa e resto", () => {
    const tutti = [...inTesta, ...altri].map((p) => p.codice);
    expect(tutti).toHaveLength(249);
    expect(new Set(tutti).size).toBe(249);
  });
  it("il resto è in ordine alfabetico nella lingua della pagina", () => {
    const nomi = altri.map((p) => p.nome);
    expect(nomi).toEqual([...nomi].sort(new Intl.Collator(lingua).compare));
  });
  it("nessun nome vuoto", () => {
    expect([...inTesta, ...altri].every((p) => p.nome.trim() !== "")).toBe(true);
  });
});

describe("codice che Intl non sa nominare", () => {
  afterEach(() => vi.restoreAllMocks());

  it("mostra il codice, mai una riga vuota", () => {
    // Un Intl che non conosce nessun codice: è il caso di un codice ISO nuovo su un CLDR vecchio.
    vi.spyOn(Intl, "DisplayNames").mockImplementation(function () {
      return { of: () => undefined } as unknown as Intl.DisplayNames;
    });
    const { inTesta, altri } = elencoPaesi("it");
    expect([...inTesta, ...altri].every((p) => p.nome === p.codice)).toBe(true);
  });
});

it("in inglese «Italy» è il primo e Germany il secondo", () => {
  const { inTesta } = elencoPaesi("en");
  expect(inTesta.slice(0, 2).map((p) => p.nome)).toEqual(["Italy", "Germany"]);
});

/**
 * La difesa del 20/10/2026. Dal 14/10 il primo segmento di un indirizzo come
 * `/apple-touch-icon.png` arrivava qui come lingua, e `Intl.DisplayNames` lanciava un
 * RangeError: 500 in produzione. Le stringhe sono quelle dei log; `xx` è un tag valido per
 * `Intl` ma non una lingua del sito, e anche lui deve dare l'italiano.
 */
describe("lingua che non è fra le attive", () => {
  const italiano = elencoPaesi("it");
  it.each(["apple-touch-icon.png", "ORIGO_RAME-C50R.ME.aspx", "xyz.php", "null", "", "xx"])(
    "«%s» non lancia e dà il menu italiano",
    (lingua) => {
      expect(() => elencoPaesi(lingua)).not.toThrow();
      expect(elencoPaesi(lingua)).toEqual(italiano);
    },
  );
});
