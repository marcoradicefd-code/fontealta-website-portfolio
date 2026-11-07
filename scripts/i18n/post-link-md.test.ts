// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  aggiungiLink,
  conLink,
  leggiParagrafo,
  linkDelBlocco,
  parsePostFile,
  rottaNellaLingua,
  type PostBlock,
} from "./post-link-md";

const blocco = (key: string, ...pezzi: Array<[string, string[]?]>): PostBlock => ({
  _type: "block",
  _key: key,
  style: "normal",
  markDefs: [],
  children: pezzi.map(([text, marks = []], i) => ({
    _type: "span",
    _key: `${key}s${i}`,
    text,
    marks,
  })),
});

const BODY: PostBlock[] = [
  blocco(
    "b1",
    ["Una doccia da esterno in acciaio "],
    ["inox AISI 316", ["strong"]],
    [" dura al mare."],
  ),
  { ...blocco("b2", ["Il cloro della piscina."]), listItem: "bullet", level: 1 },
  { ...blocco("b3", ["Un titolo"]), style: "h2" },
];

const file = (corpo: string, lang = "de") =>
  parsePostFile(`---\n_id: post-x\nslug: x\nlang: ${lang}\n---\n\n# Titolo\n\n${corpo}\n`).file!;

const esiste = (type: string, slug: string) => type === "post" && slug === "inox-al-mare";

describe("il file leggibile", () => {
  it("legge intestazione, titolo e un paragrafo per blocco", () => {
    const f = file("Uno.\n\n- Due.\n\n## Tre");
    expect(f).toMatchObject({ id: "post-x", slug: "x", lang: "de", title: "Titolo" });
    expect(f.paragraphs).toEqual(["Uno.", "- Due.", "## Tre"]);
  });

  it("un paragrafo: testo senza segni e posizione dei link, anche dentro il grassetto", () => {
    expect(leggiParagrafo("Vedi **[la guida](/de/gartendusche)** qui.")).toEqual({
      testo: "Vedi la guida qui.",
      link: [{ da: 5, a: 13, href: "/de/gartendusche" }],
    });
  });
});

describe("le rotte nella lingua del file", () => {
  it("riconosce il percorso tradotto e lo slug", () => {
    expect(rottaNellaLingua("/de/gartendusche", "de")).toEqual({ route: "/doccia-da-esterno" });
    expect(rottaNellaLingua("/doccia-da-esterno", "it")).toEqual({ route: "/doccia-da-esterno" });
    expect(rottaNellaLingua("/en/collections/club", "en")).toEqual({
      route: "/collezioni/[slug]",
      slug: "club",
    });
    expect(rottaNellaLingua("/fr/blog/inox-al-mare", "fr")).toEqual({
      route: "/blog/[slug]",
      slug: "inox-al-mare",
    });
  });

  it("rifiuta il percorso di un'altra lingua, quello italiano in un file tedesco, e le rotte escluse", () => {
    expect(rottaNellaLingua("/en/outdoor-shower", "de")).toBeNull();
    expect(rottaNellaLingua("/doccia-da-esterno", "de")).toBeNull();
    expect(rottaNellaLingua("/area-riservata", "it")).toBeNull();
    expect(rottaNellaLingua("https://fontealta.it/doccia-da-esterno", "it")).toBeNull();
  });
});

describe("aggiungiLink", () => {
  const sanity = { title: "Titolo", body: BODY };
  const corpo = (p1: string) => `${p1}\n\n- Il cloro della piscina.\n\n## Un titolo`;

  it("aggiunge solo l'annotazione: il testo e gli altri segni restano", () => {
    const r = aggiungiLink(
      file(
        corpo(
          "Una [doccia da esterno](/de/gartendusche) in acciaio **inox AISI 316** dura al mare.",
        ),
      ),
      sanity,
      esiste,
    );
    expect(r.errori).toEqual([]);
    expect(r.nuovi).toEqual([{ testo: "doccia da esterno", href: "/de/gartendusche" }]);
    const b = r.body![0];
    expect(b.children!.map((c) => c.text).join("")).toBe(
      "Una doccia da esterno in acciaio inox AISI 316 dura al mare.",
    );
    expect(linkDelBlocco(b)).toEqual([{ da: 4, a: 21, href: "/de/gartendusche" }]);
    expect(b.children!.find((c) => c.text === "inox AISI 316")!.marks).toEqual(["strong"]);
    // Gli altri blocchi non si toccano.
    expect(r.body!.slice(1)).toEqual(BODY.slice(1));
  });

  it("un link che attraversa due pezzi li porta tutti e due, col grassetto dove c'era", () => {
    const r = aggiungiLink(
      file(
        corpo("Una doccia da esterno in [acciaio inox AISI 316](/de/gartendusche) dura al mare."),
      ),
      sanity,
      esiste,
    );
    const b = r.body![0];
    const conLinkK = b.markDefs![0]._key;
    expect(b.children!.filter((c) => c.marks!.includes(conLinkK)).map((c) => c.text)).toEqual([
      "acciaio ",
      "inox AISI 316",
    ]);
    expect(b.children!.find((c) => c.text === "inox AISI 316")!.marks).toEqual([
      "strong",
      conLinkK,
    ]);
  });

  it("due giri danno lo stesso corpo, e senza link nuovi non si scrive niente", () => {
    const f = file(
      corpo("Una [doccia da esterno](/de/gartendusche) in acciaio inox AISI 316 dura al mare."),
    );
    expect(aggiungiLink(f, sanity, esiste).body).toEqual(aggiungiLink(f, sanity, esiste).body);
    const senza = aggiungiLink(
      file(corpo("Una doccia da esterno in acciaio inox AISI 316 dura al mare.")),
      sanity,
      esiste,
    );
    expect(senza).toMatchObject({ body: null, nuovi: [], errori: [] });
  });

  it("un carattere diverso, un paragrafo in più o un segno mancante fermano il post", () => {
    const diverso = aggiungiLink(
      file(
        corpo("Una [doccia da esterno](/de/gartendusche) in acciaio inox AISI 316 dura al mare!"),
      ),
      sanity,
      esiste,
    );
    expect(diverso.body).toBeNull();
    expect(diverso.errori[0]).toMatch(/blocco 1: il testo è diverso da Sanity al carattere 60/);
    expect(aggiungiLink(file("Uno.\n\nDue."), sanity, esiste).errori[0]).toMatch(
      /2 paragrafi nel file, 3 blocchi/,
    );
    const senzaSegno = aggiungiLink(
      file(
        "Una doccia da esterno in acciaio inox AISI 316 dura al mare.\n\nIl cloro della piscina.\n\n## Un titolo",
      ),
      sanity,
      esiste,
    );
    expect(senzaSegno.errori).toContain("blocco 2: il segno «-» davanti al paragrafo manca");
  });

  it("percorsi: della lingua giusta, del sito, con lo slug che esiste", () => {
    const err = (href: string) =>
      aggiungiLink(
        file(corpo(`Una [doccia da esterno](${href}) in acciaio inox AISI 316 dura al mare.`)),
        sanity,
        esiste,
      ).errori.join(" | ");
    expect(err("/en/outdoor-shower")).toMatch(/non è un percorso del sito in «de»/);
    expect(err("/de/blog/nessuno")).toMatch(/nessun post con slug «nessuno»/);
    expect(err("/de/blog/inox-al-mare")).toBe("");
  });

  it("un link già sul post si tiene: se nel file manca il post si ferma", () => {
    const conUno = conLink(BODY[0], [{ da: 4, a: 21, href: "/de/gartendusche" }], "s");
    const s2 = { title: "Titolo", body: [conUno, ...BODY.slice(1)] };
    const tolto = aggiungiLink(
      file(corpo("Una doccia da esterno in acciaio inox AISI 316 dura al mare.")),
      s2,
      esiste,
    );
    expect(tolto.errori[0]).toMatch(/su Sanity manca o è diverso nel file/);
    const tenuto = aggiungiLink(
      file(
        corpo("Una [doccia da esterno](/de/gartendusche) in acciaio inox AISI 316 dura al mare."),
      ),
      s2,
      esiste,
    );
    expect(tenuto).toMatchObject({ body: null, nuovi: [], errori: [] });
  });
});
