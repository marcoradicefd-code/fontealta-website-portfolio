import { describe, expect, it } from "vitest";

import { isUsePageCode, lingueConTitolo, ordinaCard, titoloNellaLingua } from "@/lib/pagina-uso";

/**
 * Il cancello delle pagine d'uso (spec `seo-pagine-contenuto.md` § 5, c1b): una lingua esiste solo se ha il
 * titolo. Pagina, sitemap e `llms.txt` passano tutte da qui, e una lingua contata per sbaglio diventerebbe
 * una 404 annunciata negli hreflang.
 */
describe("lingueConTitolo", () => {
  it("tiene le sole lingue con un titolo vero, nell'ordine di ACTIVE_LOCALES", () => {
    expect(lingueConTitolo({ es: "Ducha", it: "Doccia", en: "Shower" })).toEqual([
      "it",
      "en",
      "es",
    ]);
  });

  it("un titolo vuoto, di soli spazi o non stringa non conta", () => {
    expect(lingueConTitolo({ it: "Doccia", en: "", de: "   ", fr: 42, es: null })).toEqual(["it"]);
  });

  it("niente titoli, niente lingue", () => {
    for (const v of [null, undefined, "Doccia", 7, {}]) expect(lingueConTitolo(v)).toEqual([]);
  });
});

describe("titoloNellaLingua", () => {
  const titoli = { it: "  Doccia da esterno ", en: "Outdoor shower", de: " " };

  it("dà il titolo pulito della lingua", () => {
    expect(titoloNellaLingua(titoli, "it")).toBe("Doccia da esterno");
    expect(titoloNellaLingua(titoli, "en")).toBe("Outdoor shower");
  });

  it("nessun ripiego: una lingua senza titolo è null, anche se l'italiano c'è", () => {
    expect(titoloNellaLingua(titoli, "de")).toBeNull();
    expect(titoloNellaLingua(titoli, "fr")).toBeNull();
    expect(titoloNellaLingua(null, "it")).toBeNull();
  });
});

describe("isUsePageCode", () => {
  it("riconosce solo i codici con una rotta", () => {
    expect(isUsePageCode("outdoor-shower")).toBe(true);
    expect(isUsePageCode("home")).toBe(false);
    expect(isUsePageCode("toString")).toBe(false);
    expect(isUsePageCode(null)).toBe(false);
  });
});

describe("ordinaCard", () => {
  const c = (slug: string) => ({ _id: `collection-${slug}-it`, slug });
  // L'ordine del catalogo, come arriva dalla query.
  const catalogo = ["ille", "flamingo", "club", "club-large", "spring", "yacht"].map(c);
  const id = (slug: string) => `collection-${slug}-it`;

  it("prima quelle in evidenza nell'ordine del campo, poi le altre in quello del catalogo", () => {
    const fuori = ordinaCard(catalogo, [id("club"), id("spring"), id("club-large")]);
    expect(fuori.map((x) => x.slug)).toEqual([
      "club",
      "spring",
      "club-large",
      "ille",
      "flamingo",
      "yacht",
    ]);
  });

  it("senza evidenza resta l'ordine del catalogo, intero", () => {
    expect(ordinaCard(catalogo, null).map((x) => x.slug)).toEqual(catalogo.map((x) => x.slug));
    expect(ordinaCard(catalogo, []).map((x) => x.slug)).toEqual(catalogo.map((x) => x.slug));
  });

  it("un id in evidenza assente, vuoto o ripetuto non crea card e non ne duplica", () => {
    const fuori = ordinaCard(catalogo, [id("yacht"), "collection-sparita-it", null, id("yacht")]);
    expect(fuori.map((x) => x.slug)).toEqual([
      "yacht",
      "ille",
      "flamingo",
      "club",
      "club-large",
      "spring",
    ]);
  });

  it("una collezione senza slug non diventa una card", () => {
    const fuori = ordinaCard(
      [...catalogo, { _id: "collection-x-it", slug: null }],
      ["collection-x-it"],
    );
    expect(fuori).toHaveLength(catalogo.length);
  });
});
