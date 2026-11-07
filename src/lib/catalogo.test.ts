import { describe, expect, it } from "vitest";

import { ALL_LOCALES } from "@/i18n/routing";

import { CATALOGO_URL, TEMPLATE_CATALOGO, linguaDaPaese } from "./catalogo";
import { CODICI_PAESE } from "./paesi";

/** La lingua dell'email del catalogo viene dal Paese (Q6 del grill, 16/10/2026). Letterali apposta. */
describe("linguaDaPaese", () => {
  it.each([
    ["IT", "it"],
    ["DE", "de"],
    ["CH", "de"],
    ["FR", "fr"],
    ["ES", "es"],
    ["GB", "en"],
    ["US", "en"],
    ["GR", "en"],
    ["AT", "de"],
    ["BE", "en"],
    ["ZZ", "en"],
  ])("%s → %s", (paese, lingua) => {
    expect(linguaDaPaese(paese)).toBe(lingua);
  });

  it("su tutti i 250 valori del menu: sei Paesi fuori dall'inglese, nessuna lingua inventata", () => {
    const perLingua: Record<string, number> = {};
    for (const p of CODICI_PAESE) {
      const l = linguaDaPaese(p);
      perLingua[l] = (perLingua[l] ?? 0) + 1;
    }
    expect(CODICI_PAESE).toHaveLength(250);
    expect(perLingua).toEqual({ it: 1, de: 3, fr: 1, es: 1, en: 244 });
  });
});

describe("TEMPLATE_CATALOGO e CATALOGO_URL", () => {
  it("un template per lingua, i 97-101 creati su Brevo il 16/10", () => {
    expect(TEMPLATE_CATALOGO).toEqual({ it: 97, en: 98, de: 99, fr: 100, es: 101 });
    expect(Object.keys(TEMPLATE_CATALOGO).sort()).toEqual([...ALL_LOCALES].sort());
  });

  it("il PDF è uno solo, pubblico, su media.fontealta.it", () => {
    expect(CATALOGO_URL).toBe("https://media.fontealta.it/catalogo/fontealta-catalogo.pdf");
  });
});
