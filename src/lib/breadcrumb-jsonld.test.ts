import { describe, expect, it } from "vitest";

import { buildBreadcrumbList } from "./breadcrumb-jsonld";

const BASE = "https://fontealta-website-sigma.vercel.app";

describe("buildBreadcrumbList", () => {
  it("colleziona: tre voci, position 1..3, l'ultima senza item", () => {
    const ld = buildBreadcrumbList(
      [{ name: "Home", path: "/" }, { name: "Collezioni", path: "/collezioni" }, { name: "Boss" }],
      BASE,
    );
    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement.map((e) => e.position)).toEqual([1, 2, 3]);
    expect(ld.itemListElement.map((e) => e.name)).toEqual(["Home", "Collezioni", "Boss"]);
    // ⚠️ La radice esce SENZA slash finale, come canonical e sitemap: `new
    // URL("/", base)` lo aggiungerebbe, e avremmo due nostre dichiarazioni
    // diverse sulla stessa pagina.
    expect(ld.itemListElement[0]).toHaveProperty("item", BASE);
    expect(ld.itemListElement[1]).toHaveProperty("item", `${BASE}/collezioni`);
    expect(ld.itemListElement[2]).not.toHaveProperty("item");
  });

  it("modello: quattro voci, la collezione è un anello intermedio linkato", () => {
    const ld = buildBreadcrumbList(
      [
        { name: "Home", path: "/" },
        { name: "Collezioni", path: "/collezioni" },
        { name: "Boss", path: "/collezioni/boss" },
        { name: "Boss B40L" },
      ],
      BASE,
    );
    expect(ld.itemListElement).toHaveLength(4);
    expect(ld.itemListElement[2]).toHaveProperty("item", `${BASE}/collezioni/boss`);
    expect(ld.itemListElement[3]).not.toHaveProperty("item");
  });

  it("corpi, indice: l'ultima voce è l'indice stesso e non si autolinka", () => {
    const ld = buildBreadcrumbList(
      [
        { name: "Home", path: "/" },
        { name: "Collezioni", path: "/collezioni" },
        { name: "Corpi a incasso" },
      ],
      BASE,
    );
    expect(ld.itemListElement.at(-1)).toEqual({
      "@type": "ListItem",
      position: 3,
      name: "Corpi a incasso",
    });
  });

  it("corpo: quattro voci in EN, percorsi localizzati", () => {
    const ld = buildBreadcrumbList(
      [
        { name: "Home", path: "/en" },
        { name: "Collections", path: "/en/collections" },
        { name: "Concealed bodies", path: "/en/collections/concealed-bodies" },
        { name: "CW.1" },
      ],
      BASE,
    );
    expect(ld.itemListElement.map((e) => e.position)).toEqual([1, 2, 3, 4]);
    expect(ld.itemListElement[1]).toHaveProperty("item", `${BASE}/en/collections`);
    expect(ld.itemListElement[2]).toHaveProperty("item", `${BASE}/en/collections/concealed-bodies`);
  });

  it("normalizza gli slash invece di concatenare", () => {
    // Una base che finisce con `/` e un percorso che comincia con `/` concatenati
    // a mano darebbero `//collezioni`: un URL valido, sbagliato, e che passa i
    // validatori di forma. `new URL` lo risolve per costruzione.
    const ld = buildBreadcrumbList([{ name: "Collezioni", path: "/collezioni" }], `${BASE}/`);
    expect(ld.itemListElement[0]).toHaveProperty("item", `${BASE}/collezioni`);
  });

  it("lista vuota: nessun elemento, non solleva", () => {
    expect(buildBreadcrumbList([], BASE).itemListElement).toEqual([]);
  });
});

describe("la radice e gli altri percorsi", () => {
  it("la home non porta lo slash finale, i percorsi interni non lo prendono", () => {
    const ld = buildBreadcrumbList(
      [{ name: "Home", path: "/" }, { name: "Collezioni", path: "/collezioni" }, { name: "Boss" }],
      BASE,
    );
    const items = ld.itemListElement.map((e) => ("item" in e ? e.item : null));
    expect(items[0]).toBe(BASE);
    expect(items[1]).toBe(`${BASE}/collezioni`);
    for (const i of items) expect(i?.endsWith("/")).not.toBe(true);
  });
});
