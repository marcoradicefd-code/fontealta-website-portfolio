import { describe, expect, it } from "vitest";

import { buildCollectionPage } from "@/lib/collection-jsonld";

/**
 * ⚠️ **Un JSON-LD sbagliato non si vede**, e su un `ItemList` il modo tipico di
 * sbagliarlo è un conteggio che non combacia con la pagina: il markup resta
 * valido, i validatori passano, e il dato dice una cosa falsa su quante cose la
 * pagina mostra. Metà di questi test guarda proprio quello.
 */

const BASE = {
  name: "Boss",
  url: "https://fontealta.it/collezioni/boss",
  locale: "it",
  websiteId: "https://fontealta.it#website",
};

const TRE = [
  { name: "B40L", url: "https://fontealta.it/modello/b40l" },
  { name: "B40C", url: "https://fontealta.it/modello/b40c" },
  { name: "B90", url: "https://fontealta.it/modello/b90" },
];

describe("CollectionPage", () => {
  const ld = buildCollectionPage({ ...BASE, description: "Le colonne Boss.", items: TRE });

  it("dichiara il tipo, il nome, l'URL e la lingua della pagina", () => {
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("CollectionPage");
    expect(ld.name).toBe("Boss");
    expect(ld.url).toBe(BASE.url);
    expect(ld.inLanguage).toBe("it");
  });

  it("si aggancia al WebSite per riferimento, non ripetendolo", () => {
    expect(ld.isPartOf).toEqual({ "@id": "https://fontealta.it#website" });
  });

  it("senza description la chiave NON esiste, non è una stringa vuota", () => {
    expect("description" in buildCollectionPage({ ...BASE, items: TRE })).toBe(false);
    expect("description" in buildCollectionPage({ ...BASE, description: "  ", items: TRE })).toBe(
      false,
    );
  });
});

describe("ItemList", () => {
  it("numera da 1, in ordine, e dichiara quante voci ha", () => {
    const ld = buildCollectionPage({ ...BASE, items: TRE }) as {
      mainEntity?: {
        numberOfItems: number;
        itemListElement: Array<{ position: number; name: string; url: string }>;
      };
    };
    expect(ld.mainEntity?.numberOfItems).toBe(3);
    expect(ld.mainEntity?.itemListElement.map((e) => e.position)).toEqual([1, 2, 3]);
    expect(ld.mainEntity?.itemListElement.map((e) => e.name)).toEqual(["B40L", "B40C", "B90"]);
  });

  it("il conteggio dichiarato è SEMPRE quello delle voci servite", () => {
    // Il difetto che questo coglie: una voce scartata a valle mentre
    // `numberOfItems` resta quello di partenza. Il numero è ciò che un
    // consumatore confronta con la pagina.
    for (const n of [1, 2, 5, 40]) {
      const items = Array.from({ length: n }, (_, i) => ({
        name: `M${i}`,
        url: `https://fontealta.it/modello/m${i}`,
      }));
      const ld = buildCollectionPage({ ...BASE, items }) as {
        mainEntity?: { numberOfItems: number; itemListElement: unknown[] };
      };
      expect(ld.mainEntity?.numberOfItems).toBe(n);
      expect(ld.mainEntity?.itemListElement).toHaveLength(n);
    }
  });

  it("una voce senza nome o senza URL non entra, e non lascia un buco nelle posizioni", () => {
    const ld = buildCollectionPage({
      ...BASE,
      items: [TRE[0], { name: "", url: "https://x/y" }, { name: "B90", url: "" }, TRE[1]],
    }) as {
      mainEntity?: { numberOfItems: number; itemListElement: Array<{ position: number }> };
    };
    expect(ld.mainEntity?.numberOfItems).toBe(2);
    expect(ld.mainEntity?.itemListElement.map((e) => e.position)).toEqual([1, 2]);
  });

  it("con zero voci il mainEntity NON esiste: una lista vuota è un'affermazione", () => {
    const ld = buildCollectionPage({ ...BASE, items: [] });
    expect("mainEntity" in ld).toBe(false);
  });

  it("nessuna voce dichiara un prezzo o una misura", () => {
    // Il vincolo del 10/09/2026: niente misure e niente prezzi, né sul sito né
    // nei dati strutturati. Qui si guarda il JSON servito, non l'intenzione.
    const testo = JSON.stringify(buildCollectionPage({ ...BASE, items: TRE }));
    for (const vietata of ["Product", "offers", "price", "sku", "gtin", "width", "height"]) {
      expect(testo, `il nodo dichiara ${vietata}`).not.toContain(vietata);
    }
  });
});
