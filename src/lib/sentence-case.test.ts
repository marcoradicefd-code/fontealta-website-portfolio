import { describe, expect, it } from "vitest";

import { sentenceCase } from "./sentence-case";

describe("sentenceCase", () => {
  it("lowercases a mixed-case phrase and capitalizes the first char", () => {
    // meta productType label
    expect(sentenceCase("Doccia — Colonna", "it")).toBe("Doccia — colonna");
  });

  it("preserves an all-uppercase acronym mid-string", () => {
    // selected-finish caption
    expect(sentenceCase("PVD Nero Assoluto Spazzolato", "it")).toBe("PVD nero assoluto spazzolato");
  });

  it("capitalizes the first char of an all-lowercase input", () => {
    expect(sentenceCase("brushed stainless steel", "en")).toBe("Brushed stainless steel");
  });

  it("does not alter a leading acronym (first char already uppercase)", () => {
    // capitalize-first must be a no-op on the acronym's first letter
    expect(sentenceCase("PVD Nero", "it")).toBe("PVD nero");
  });

  it("leaves a digit-leading token untouched (meta '8 finiture')", () => {
    expect(sentenceCase("8 finiture", "it")).toBe("8 finiture");
  });

  it("returns empty for empty input", () => {
    expect(sentenceCase("", "it")).toBe("");
  });

  it("in tedesco i sostantivi restano maiuscoli (riga meta dell'hero)", () => {
    expect(sentenceCase("Waschtisch — Säule", "de")).toBe("Waschtisch — Säule");
    expect(sentenceCase("4 Oberflächen", "de")).toBe("4 Oberflächen");
  });

  it("francese e spagnolo abbassano come l'italiano", () => {
    expect(sentenceCase("Lavabo — Colonne", "fr")).toBe("Lavabo — colonne");
    expect(sentenceCase("Lavabo — Columna", "es")).toBe("Lavabo — columna");
  });
});
