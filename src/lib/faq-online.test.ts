import { describe, expect, it } from "vitest";

import { faqOnline } from "./faq-online";

describe("faqOnline", () => {
  it("spento di default: senza la variabile le FAQ non vanno online", () => {
    expect(faqOnline({})).toBe(false);
  });

  it("si accende solo con FAQ_SITO=1, alla lettera", () => {
    expect(faqOnline({ FAQ_SITO: "1" })).toBe(true);
    for (const v of ["0", "", "true", "si", " 1"])
      expect(faqOnline({ FAQ_SITO: v }), v).toBe(false);
  });
});
