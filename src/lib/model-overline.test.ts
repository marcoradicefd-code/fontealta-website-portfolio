import { describe, expect, it } from "vitest";

import { modelOverline } from "./model-overline";

describe("modelOverline", () => {
  it("toglie il codice come suffisso esatto", () => {
    expect(modelOverline("Origo C50AS.YCWS.ME.D", "C50AS.YCWS.ME.D", "Yacht")).toBe("Origo");
    expect(modelOverline("Waterline WX47C.SK.K", "WX47C.SK.K", "Waterline")).toBe("Waterline");
    expect(modelOverline("ILLE I30", "I30", "ILLE")).toBe("ILLE");
  });

  // Il motivo per cui non si splitta sul primo spazio: quattro titoli sono multi-parola.
  it("tiene insieme i titoli multi-parola", () => {
    expect(modelOverline("Boss Wide BW76.AST", "BW76.AST", "Community")).toBe("Boss Wide");
    expect(modelOverline("Club Large CL1", "CL1", "Club Large")).toBe("Club Large");
    expect(modelOverline("Origo Rame OR5", "OR5", "Origo Rame")).toBe("Origo Rame");
  });

  // Il caso che ha motivato il refinement: il nome cita la linea di prodotto, la
  // collezione di vendita è un'altra. Vince il nome.
  it("preferisce il prefisso del nome alla collezione della pagina", () => {
    expect(modelOverline("Classy C40.YCWS.M", "C40.YCWS.M", "Yacht")).toBe("Classy");
    expect(modelOverline("Boss B76.AST", "B76.AST", "Community")).toBe("Boss");
  });

  it("ricade sulla collezione quando il nome non finisce col codice", () => {
    expect(modelOverline("Miscelatore da parete", "MX1", "Skinny")).toBe("Skinny");
    expect(modelOverline(null, "MX1", "Skinny")).toBe("Skinny");
    expect(modelOverline("", "MX1", "Skinny")).toBe("Skinny");
  });

  // Un codice a metà nome NON è un suffisso: tagliarlo darebbe un prefisso falso.
  it("non tratta come suffisso un codice che compare altrove", () => {
    expect(modelOverline("MX1 versione lunga", "MX1", "Skinny")).toBe("Skinny");
  });

  // Confronto case-sensitive: meglio la rete che un prefisso plausibile e sbagliato.
  it("non fa match a meno di maiuscole", () => {
    expect(modelOverline("Ille i30", "I30", "ILLE")).toBe("ILLE");
  });

  it("torna null quando non resta niente di vero da mostrare", () => {
    // Corpo a incasso: name assente → displayName è il codice, e nessuna collezione.
    expect(modelOverline("MR.INC", "MR.INC", null)).toBeNull();
    expect(modelOverline(null, null, null)).toBeNull();
    expect(modelOverline("I30", "I30", undefined)).toBeNull();
  });

  it("normalizza gli spazi ai bordi", () => {
    expect(modelOverline("  Origo   C50AS  ", "  C50AS  ", "Yacht")).toBe("Origo");
    expect(modelOverline("Miscelatore", "MX1", "   Skinny   ")).toBe("Skinny");
    expect(modelOverline("Miscelatore", "MX1", "   ")).toBeNull();
  });
});
