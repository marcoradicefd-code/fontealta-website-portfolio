import { describe, expect, it } from "vitest";

import {
  articoloFields,
  checkArticolo,
  checkCreazione,
  copertinaNuova,
  dimensioniAsset,
  linkInterni,
  parseArticoloFile,
  percorsoNellaLingua,
  publishedAtDi,
} from "./articolo-md";

const H = "image-bbbb-1520x1013-jpg";
const resolve = (type: string, slug: string) =>
  type === "post" && slug === "come-scegliere-acciaio-inox-316" ? "post-come-scegliere" : undefined;

/** Un articolo valido, da guastare un pezzo alla volta. */
const ok = `---
slug: aisi-316-contro-304-parte-1
lang: it
autore: Andrea Farnocchia
keyword: differenza tra aisi 304 e 316
seo.title: AISI 304 o 316: differenza e quale scegliere
seo.description: Differenza tra acciaio inox AISI 304 e 316: il molibdeno, la resistenza a sale e cloro e quando scegliere l’uno o l’altro.
excerpt: La differenza tra AISI 304 e 316 è il molibdeno: ecco cosa cambia al mare e in piscina.
sostituisce: aisi-316-contro-304-parte-2
---

<!-- Una nota per chi rilegge: non arriva su Sanity. -->

# AISI 304 o 316: differenza e quale scegliere

La differenza tra AISI 304 e 316 è il molibdeno, e Fontealta lavora il 316.

[[in sintesi]]
- Il 316 aggiunge molibdeno.
- Il 304 basta al chiuso.
- Al mare serve il 316.

## Che differenza c’è?

Le due leghe a confronto:
| Proprietà | AISI 304 | AISI 316 |
|---|---|---|
| Molibdeno | assente | presente |

[[foto: ${H} | Colonna doccia in acciaio a bordo piscina]]

## Quando serve il 316?

1. Al chiuso basta il 304.
2. Al mare serve il 316, come spiega [come scegliere l’acciaio](/blog/come-scegliere-acciaio-inox-316).

## Domande frequenti

### Il 316 arrugginisce?
In condizioni normali no.
`;

const parse = (s: string) => parseArticoloFile(s, resolve);
const errori = (s: string, autore = "Andrea Farnocchia") => {
  const { file, problems } = parse(s);
  return [...problems, ...(file ? checkArticolo(file, { autore, otherDescriptions: [] }) : [])]
    .filter((p) => p.level === "error")
    .map((p) => p.message);
};

describe("articolo: il file", () => {
  it("un file nella forma giusta si legge senza errori", () => {
    expect(errori(ok)).toEqual([]);
  });

  it("l'H1 è il titolo, l'apertura sta in testa al corpo, poi box, tabella, foto, elenco numerato e H3", () => {
    const f = parse(ok).file!;
    expect(f.title).toBe("AISI 304 o 316: differenza e quale scegliere");
    expect(f.slug).toBe("aisi-316-contro-304-parte-1");
    expect(f.excerpt).toMatch(/^La differenza/);
    const tipi = f.body.map((b) =>
      b._type === "block" ? (b as { style?: string }).style : b._type,
    );
    expect(tipi.slice(0, 5)).toEqual(["normal", "keyPoints", "h2", "normal", "comparisonTable"]);
    expect(tipi).toContain("figure");
    expect(tipi).toContain("h3");
    expect(f.body.some((b) => (b as { listItem?: string }).listItem === "number")).toBe(true);
    // Il corpo controllato da `checkUseBody` comincia dopo l'apertura.
    expect(f.corpo[0]._type).toBe("keyPoints");
  });

  it("i commenti non arrivano su Sanity", () => {
    expect(JSON.stringify(articoloFields(parse(ok).file!).fields)).not.toMatch(/nota per chi/);
  });

  it("le chiavi che il post non conosce, e quelle che mancano, sono errori", () => {
    expect(errori(ok.replace("excerpt:", "estratto:")).join()).toMatch(/excerpt/);
    expect(errori(ok.replace("slug: aisi", "code: aisi")).join()).toMatch(/slug/);
  });

  it("i limiti: title 60, description 155, estratto 160", () => {
    expect(
      errori(ok.replace("seo.title: AISI", `seo.title: ${"x".repeat(60)} AISI`)).join(),
    ).toMatch(/seo.title di \d+ caratteri/);
    expect(errori(ok.replace("excerpt: La", `excerpt: ${"x".repeat(160)} La`)).join()).toMatch(
      /excerpt di \d+ caratteri/,
    );
  });

  it("l'autore deve essere quello del post", () => {
    expect(errori(ok, "Altro Autore").join()).toMatch(/autore/);
  });

  it("em dash, apostrofo dritto, prezzi e «tutto inox» fermano il file", () => {
    expect(errori(ok.replace("Al chiuso basta", "Al chiuso — basta")).join()).toMatch(/trattino/);
    expect(errori(ok.replace("Che differenza c’è", "Che differenza c'è")).join()).toMatch(
      /apostrofo/,
    );
    expect(errori(ok.replace("In condizioni normali no.", "Costa 900 euro.")).join()).toMatch(
      /prezzo/,
    );
  });
});

describe("articolo: i link interni", () => {
  it("la rotta del link diventa il percorso della lingua", () => {
    expect(percorsoNellaLingua("/doccia-da-esterno", undefined, "de")).toBe("/de/gartendusche");
    expect(percorsoNellaLingua("/doccia-da-esterno", undefined, "it")).toBe("/doccia-da-esterno");
    expect(percorsoNellaLingua("/blog/[slug]", "abc", "en")).toBe("/en/blog/abc");
    expect(percorsoNellaLingua("/", undefined, "fr")).toBe("/fr");
    expect(percorsoNellaLingua("/", undefined, "it")).toBe("/");
  });

  it("i link del corpo escono con rotta e documento", () => {
    expect(linkInterni(parse(ok).file!.body)).toEqual([
      { route: "/blog/[slug]", ref: "post-come-scegliere" },
    ]);
  });
});

/**
 * Un post nuovo (c2, Marco, 5/11/2026): le chiavi di creazione nel file italiano, `copertina.alt` in
 * tutte le lingue, la copertina orizzontale e larga almeno 1.200 px (16:9 o un avviso), il giorno mai
 * nel futuro, e le cinque lingue insieme.
 */
describe("articolo: la creazione di un post nuovo", () => {
  const COP = "image-cccc-3840x2160-jpg";
  const LINGUE = ["it", "en", "de", "fr", "es"];
  const OGGI = "2026-11-05";
  const conChiavi = (lang: string, extra: string) =>
    ok
      .replace("lang: it", `lang: ${lang}`)
      .replace("sostituisce: aisi-316-contro-304-parte-2", extra.trim());
  const file = (lang: string, extra: string) => parse(conChiavi(lang, extra)).file!;
  const IT = `copertina: ${COP}\ncategoria: Materia e Acciaio\npubblicato: 2026-11-05\ncopertina.alt: Colonna doccia in acciaio a bordo piscina`;
  const ALTRA = "copertina.alt: Stainless steel shower column by a pool";
  const tutte = (it = IT) =>
    new Map(LINGUE.map((l) => [l, l === "it" ? file("it", it) : file(l, ALTRA)]));
  const messaggi = (files: Map<string, ReturnType<typeof file>>, livello = "error") =>
    checkCreazione(files, { lingue: LINGUE, oggi: OGGI })
      .filter((p) => p.level === livello)
      .map((p) => p.message);

  it("le chiavi si leggono: creazione e alt della copertina", () => {
    const f = file("it", IT);
    expect(f.creazione).toEqual({
      copertina: COP,
      categoria: "Materia e Acciaio",
      pubblicato: "2026-11-05",
    });
    expect(f.copertinaAlt).toBe("Colonna doccia in acciaio a bordo piscina");
    expect(errori(conChiavi("it", IT))).toEqual([]);
  });

  it("un post nuovo nella forma giusta: nessun errore, nessun avviso", () => {
    expect(messaggi(tutte())).toEqual([]);
    expect(messaggi(tutte(), "warning")).toEqual([]);
  });

  it("serve ogni lingua, nello stesso giro", () => {
    const quattro = tutte();
    quattro.delete("de");
    expect(messaggi(quattro).join()).toMatch(/manca il file in de/);
  });

  it("le chiavi di creazione solo nel file italiano, l'alt in ogni lingua", () => {
    const f = tutte();
    f.set("en", file("en", `${ALTRA}\ncategoria: Materia e Acciaio`));
    f.set("fr", file("fr", ""));
    const m = messaggi(f).join("\n");
    expect(m).toMatch(/en: categoria solo nel file italiano/);
    expect(m).toMatch(/fr: manca «copertina.alt»/);
  });

  it("il file italiano deve avere copertina, categoria e pubblicato", () => {
    expect(messaggi(tutte(IT.replace(/categoria: .*\n/, ""))).join()).toMatch(/manca «categoria»/);
  });

  it("la copertina: orizzontale, almeno 1.200 px, e un avviso se non è 16:9", () => {
    const con = (id: string) => tutte(IT.replace(COP, id));
    expect(messaggi(con("image-cccc-1080x1620-jpg")).join()).toMatch(/orizzontale/);
    expect(messaggi(con("image-cccc-1120x630-jpg")).join()).toMatch(/almeno 1200/);
    expect(messaggi(con("image-cccc-1920x1056-jpg"))).toEqual([]);
    expect(messaggi(con("image-cccc-1920x1056-jpg"), "warning").join()).toMatch(/16:9/);
    expect(messaggi(con("cover.jpg")).join()).toMatch(/non è l'id di un'immagine/);
  });

  it("l'alt italiano della copertina ha almeno 3 caratteri, come vuole lo schema", () => {
    const corto = tutte(IT.replace(/copertina\.alt: .*/, "copertina.alt: ab"));
    expect(messaggi(corto).join()).toMatch(/it: «copertina\.alt» di almeno 3 caratteri/);
    expect(messaggi(tutte(IT.replace(/copertina\.alt: .*/, "copertina.alt: abc")))).toEqual([]);
  });

  it("la copertina nasce imageWithMeta, con l'alt italiano in alt e le lingue in altI18n", () => {
    expect(copertinaNuova(COP, "Colonna doccia in acciaio a bordo piscina")).toEqual({
      _type: "imageWithMeta",
      asset: { _type: "reference", _ref: COP },
      alt: "Colonna doccia in acciaio a bordo piscina",
      altI18n: { _type: "localizedStringOptional" },
    });
  });

  it("il giorno: valido e mai nel futuro", () => {
    const con = (g: string) => tutte(IT.replace("pubblicato: 2026-11-05", `pubblicato: ${g}`));
    expect(messaggi(con("2026-11-12")).join()).toMatch(/nel futuro/);
    expect(messaggi(con("2026-02-30")).join()).toMatch(/AAAA-MM-GG/);
    expect(messaggi(con("5/11/2026")).join()).toMatch(/AAAA-MM-GG/);
    expect(messaggi(con("2026-11-04"))).toEqual([]);
  });

  it("publishedAt è mezzogiorno UTC del giorno; le dimensioni si leggono dall'id", () => {
    expect(publishedAtDi("2026-11-05")).toBe("2026-11-05T12:00:00Z");
    expect(dimensioniAsset("image-ab12-3840x2160-jpg")).toEqual({ w: 3840, h: 2160 });
    expect(dimensioniAsset("file-ab12-pdf")).toBeNull();
  });

  it("l'alt della copertina passa dai controlli di tipografia", () => {
    expect(
      errori(conChiavi("it", `${IT.replace("Colonna doccia", "Colonna d'acciaio")}`)).join(),
    ).toMatch(/apostrofo/);
  });
});
