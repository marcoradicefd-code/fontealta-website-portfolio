import { describe, expect, it } from "vitest";

import { ACTIVE_LOCALES } from "@/i18n/routing";
import { taglineForLocale } from "@/lib/tagline";

describe("taglineForLocale", () => {
  it("dà il testo della lingua chiesta", () => {
    const t = { it: "Minimalismo esclusivo.", en: "Exclusive minimalism." };
    expect(taglineForLocale(t, "it")).toBe("Minimalismo esclusivo.");
    expect(taglineForLocale(t, "en")).toBe("Exclusive minimalism.");
  });

  /**
   * ⚠️ **L'asserzione che vale più di tutte.** Un ripiego sull'italiano
   * rimetterebbe testo italiano sulle 22 pagine inglesi, cioè esattamente il
   * difetto per cui il campo è rimasto vuoto su 22 collezioni su 22.
   */
  it("NON ripiega sull'italiano quando l'inglese manca", () => {
    expect(taglineForLocale({ it: "Solo italiano." }, "en")).toBeNull();
    expect(taglineForLocale({ it: "Solo italiano.", en: null }, "en")).toBeNull();
    expect(taglineForLocale({ it: "Solo italiano.", en: "" }, "en")).toBeNull();
  });

  it("gli spazi soli valgono vuoto", () => {
    // È il modo tipico in cui un campo «vuoto» non è vuoto: si apre Studio, si
    // batte invio e si salva.
    expect(taglineForLocale({ it: "   \n " }, "it")).toBeNull();
  });

  it("il campo assente, nullo o non ancora migrato non rompe niente", () => {
    expect(taglineForLocale(null, "it")).toBeNull();
    expect(taglineForLocale(undefined, "it")).toBeNull();
    // Una stringa lasciata da prima della migrazione: GROQ la restituirebbe così
    // solo se qualcuno proiettasse il campo grezzo. Non deve diventare un crash.
    expect(taglineForLocale("vecchia stringa" as never, "it")).toBeNull();
  });

  it("oggi, coi dati veri, ogni lingua attiva torna a mani vuote", () => {
    // 22 collezioni su 22 hanno `tagline` nulla al 10/09/2026: è la ragione per
    // cui questa PR non cambia un byte di ciò che il sito serve.
    for (const locale of ACTIVE_LOCALES) expect(taglineForLocale(null, locale)).toBeNull();
  });
});
