import { afterEach, describe, expect, it, vi } from "vitest";

import { MACRO_ORDER, resolveMacro } from "./product-category";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveMacro", () => {
  it("restituisce la macro quando il valore è nell'enum", () => {
    for (const macro of MACRO_ORDER) {
      expect(resolveMacro({ productMacro: macro })).toBe(macro);
    }
  });

  it("valore fuori enum → null E un errore rumoroso, mai un fallimento muto", () => {
    // Scenario reale: una scrittura diretta via @sanity/client bypassa la validazione
    // dello Studio. Senza il log l'articolo sparirebbe dai filtri in silenzio, perché
    // i consumatori lo scartano con MACRO_ORDER.filter(...).
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(resolveMacro({ productMacro: "lavandino" })).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain("lavandino");
  });

  it("campo assente o vuoto → null in silenzio: è assenza di dato, non corruzione", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(resolveMacro({})).toBeNull();
    expect(resolveMacro({ productMacro: null })).toBeNull();
    expect(resolveMacro({ productMacro: "" })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});
