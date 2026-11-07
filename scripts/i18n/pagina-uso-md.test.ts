import { describe, expect, it } from "vitest";

import { assetSize, checkUseBody, mentionsMeasure } from "../../sanity/lib/pagina-uso-rules";
import { codiceConferma } from "./carico-lib";
import { checkUsePage, liveUseFields, parseUsePageFile, pageFields } from "./pagina-uso-md";

const V = "image-aaaa-1080x1620-jpg";
const H = "image-bbbb-1520x1013-jpg";
const resolve = (type: string, slug: string) =>
  type === "collection" && slug === "club" ? "collection-club-it" : undefined;

/** Un file valido, da guastare un pezzo alla volta. */
const head = `---
code: outdoor-shower
kind: use
lang: it
keyword: doccia da esterno
seo.title: Doccia da esterno in acciaio AISI 316 e ottone
seo.description: Doccia da esterno di Fontealta in acciaio AISI 316: colonne per giardino, piscina, terrazza e yacht, con le idee e cosa serve per installarla bene.
collezioni: club
---
`;
const ok = `${head}
# La doccia da esterno di Fontealta

La doccia da esterno di Fontealta porta l’acqua in giardino, a bordo piscina e sul ponte di uno yacht.

## Idee per una doccia da esterno
Un paragrafo con la **frase chiave** e un [link a Club](/collezioni/club).
- una voce
- un’altra voce
### Vicino alla piscina
[[foto: ${H} | Colonna doccia sul ponte di uno yacht]]

## Cosa serve per installarla
Un confronto fra le soluzioni:
| Soluzione | Dove sta | Acqua calda |
| --- | --- | --- |
| Colonna | in mezzo al prato | con miscelatore |
| A parete | contro il muro di casa | dall’impianto di casa |
[[coppia: ${V} | Doccia sotto l’arco || ${V} | Colonna sulla battigia]]
`;

const parse = (s: string) => parseUsePageFile(s, resolve);
const errors = (s: string) =>
  [
    ...parse(s).problems,
    ...(parse(s).file
      ? checkUsePage(parse(s).file!, {
          faqQuestions: ["Si può avere l’acqua calda?"],
          otherDescriptions: [],
          collectionSlugs: new Set(["club"]),
        })
      : []),
  ]
    .filter((p) => p.level === "error")
    .map((p) => p.message);

describe("pagina d'uso: il file", () => {
  it("un file nella forma giusta si legge senza errori", () => {
    expect(errors(ok)).toEqual([]);
    const f = parse(ok).file!;
    expect(f.title).toBe("La doccia da esterno di Fontealta");
    expect(f.intro).toMatch(/^La doccia da esterno/);
    expect(f.collections).toEqual(["club"]);
    const types = f.body.map((b) =>
      b._type === "block"
        ? `${(b as { style?: string }).style}${(b as { listItem?: string }).listItem ? "-li" : ""}`
        : b._type,
    );
    expect(types).toEqual([
      "h2",
      "normal",
      "normal-li",
      "normal-li",
      "h3",
      "figure",
      "h2",
      "normal",
      "comparisonTable",
      "figurePair",
    ]);
  });

  it("i link interni diventano internalLink con la referenza", () => {
    const p = parse(ok).file!.body[1] as { markDefs?: Array<Record<string, unknown>> };
    expect(p.markDefs?.[0]).toMatchObject({
      _type: "internalLink",
      route: "/collezioni/[slug]",
      reference: { _ref: "collection-club-it" },
    });
  });

  it("i commenti non arrivano su Sanity, «DA VERIFICARE» e TESTO fermano il file", () => {
    const conNota = ok.replace("## Idee", "<!-- foto: nota-solo-per-chi-scrive -->\n## Idee");
    expect(errors(conNota)).toEqual([]);
    expect(JSON.stringify(parse(conNota).file)).not.toContain("nota-solo-per-chi-scrive");
    expect(errors(ok.replace("## Idee", "<!-- DA VERIFICARE -->\n## Idee")).join()).toMatch(
      /DA VERIFICARE/,
    );
    expect(errors(ok.replace("Un paragrafo con", "TESTO")).join()).toMatch(/segnaposto TESTO/);
  });

  it("la forma che il formato non prevede è un errore", () => {
    const casi: Array<[string, string, RegExp]> = [
      ["### Vicino", "#### Vicino", /fino all'H3/],
      ["- una voce", "  - una voce", /un livello/],
      ["- una voce", "  1. una voce", /un livello/],
      ["- una voce", "> una citazione", /forma non ammessa/],
      ["[link a Club](/collezioni/club)", "[link](https://example.com)", /link esterni/],
      [`[[foto: ${H}`, "[[foto: PROFILE-p17-021", /foto da scegliere/],
      [
        "La doccia da esterno di Fontealta porta",
        "La **doccia** di Fontealta porta",
        /testo semplice/,
      ],
    ];
    for (const [a, b, atteso] of casi) expect(errors(ok.replace(a, b)).join(" · ")).toMatch(atteso);
  });
});

describe("pagina d'uso: gerarchia, grassetti, tabella, foto", () => {
  it("H3 prima di un H2 è un salto di livello", () => {
    const s = ok.replace("## Idee per una doccia da esterno", "### Idee per una doccia da esterno");
    expect(errors(s).join()).toMatch(/H3 prima di un H2/);
  });

  it("al massimo un grassetto per sezione, mai una frase intera, mai due volte lo stesso", () => {
    expect(errors(ok.replace("- una voce", "- una **voce**")).join()).toMatch(
      /più di un grassetto/,
    );
    // Una frase intera, col punto dentro o fuori dal grassetto (verificatore del 3/11).
    const frase = (t: string) => errors(ok.replace("Un confronto fra le soluzioni:", t)).join();
    expect(frase("**La colonna resiste anche al mare.** Fra le soluzioni:")).toMatch(
      /frase intera/,
    );
    expect(frase("Prima. **La colonna resiste anche al mare**. Fra le soluzioni:")).toMatch(
      /frase intera/,
    );
    // Una voce d'elenco di una parola e una domanda breve non sono frasi intere.
    expect(errors(ok.replace("- un’altra voce", "- **Club**")).join()).not.toMatch(/frase intera/);
    expect(frase("Il motivo: **perché AISI 316?** Fra le soluzioni:")).not.toMatch(/frase intera/);
    expect(
      errors(
        ok.replace("Un confronto fra le soluzioni:", "Un confronto con la **frase chiave**:"),
      ).join(),
    ).toMatch(/due volte/);
    // Il grassetto di una sezione nuova riparte da zero.
    expect(
      errors(ok.replace("Un confronto fra le soluzioni:", "Un **confronto** fra le soluzioni:")),
    ).toEqual([]);
  });

  it("la tabella: colonne, righe, celle, frase che la introduce, una sola", () => {
    const cinque = ok
      .replace("| Soluzione | Dove sta | Acqua calda |", "| A | B | C | D | E |")
      .replace("| --- | --- | --- |", "| --- | --- | --- | --- | --- |");
    expect(errors(cinque).join()).toMatch(/5 colonne/);
    expect(
      errors(
        ok.replace(
          "| Colonna | in mezzo al prato | con miscelatore |",
          "| Colonna | | con miscelatore |",
        ),
      ).join(),
    ).toMatch(/nessuna cella vuota/);
    expect(
      errors(
        ok.replace(
          "| Colonna | in mezzo al prato | con miscelatore |",
          "| Colonna | in mezzo al prato |",
        ),
      ).join(),
    ).toMatch(/2 celle su 3/);
    expect(errors(ok.replace("Un confronto fra le soluzioni:\n", "")).join()).toMatch(
      /frase che la introduce/,
    );
    const nove = ok.replace(
      "| A parete | contro il muro di casa | dall’impianto di casa |",
      Array.from({ length: 8 }, (_, i) => `| r${i} | dove ${i} | come ${i} |`).join("\n"),
    );
    expect(errors(nove).join()).toMatch(/9 righe/);
    const due = `${ok}\nUn altro confronto:\n| X | Y |\n| --- | --- |\n| a | b |\n`;
    expect(errors(due).join()).toMatch(/una tabella per pagina/);
  });

  it("la coppia vuole due verticali, e ogni foto il suo alt", () => {
    expect(errors(ok.replace(`[[coppia: ${V}`, `[[coppia: ${H}`)).join()).toMatch(
      /due foto verticali/,
    );
    expect(errors(ok.replace("| Colonna doccia sul ponte di uno yacht]]", "]]")).join()).toMatch(
      /manca l'alt/,
    );
    expect(assetSize(V)).toEqual({ width: 1080, height: 1620 });
  });
});

describe("pagina d'uso: contenuto", () => {
  it("niente misure, prezzi, «tutto inox»; AISI 316 non è una misura", () => {
    expect(mentionsMeasure("acciaio AISI 316")).toBe(false);
    expect(mentionsMeasure("uno scarico da 40 mm")).toBe(true);
    expect(mentionsMeasure("a 2 m dalla casa")).toBe(true);
    expect(mentionsMeasure("about 7 ft tall")).toBe(true);
    expect(errors(ok.replace("in mezzo al prato", "a 3 m dal prato")).join()).toMatch(/misura/);
    expect(errors(ok.replace("una voce", "da 900 €")).join()).toMatch(/prezzo/);
    expect(errors(ok.replace("una voce", "tutto inox")).join()).toMatch(/tutto inox/);
    expect(errors(ok.replace("una voce", "una voce — e poi")).join()).toMatch(/em dash/);
  });

  it("un titolo uguale a una domanda delle FAQ è un errore", () => {
    const s = ok.replace("### Vicino alla piscina", "### Si può avere l’acqua calda?");
    expect(errors(s).join()).toMatch(/domanda delle FAQ/);
  });

  it("limiti del title e della description, description unica, collezioni solo in italiano", () => {
    expect(errors(ok.replace(/seo\.title: .*/, "seo.title: Doccia da esterno")).join()).toMatch(
      /seo.title di/,
    );
    const f = parse(ok).file!;
    const p = checkUsePage(
      { ...f, lang: "en" },
      { faqQuestions: [], otherDescriptions: [f.seoDescription], collectionSlugs: new Set() },
    ).map((x) => x.message);
    expect(p.join()).toMatch(/uguale a quella di un'altra pagina/);
    expect(p.join()).toMatch(/solo nel file italiano/);
    expect(p.join()).toMatch(/nessuna collezione «club»/);
  });

  it("l'inglese della pagina d'uso è americano: «colour» è un avviso, «color» no", () => {
    const f = { ...parse(ok).file!, lang: "en", collections: undefined };
    const ctx = { faqQuestions: [], otherDescriptions: [], collectionSlugs: new Set<string>() };
    const avvisi = (t: string) =>
      checkUsePage({ ...f, intro: t }, ctx)
        .filter((p) => p.level === "warning")
        .map((p) => p.message)
        .join();
    expect(avvisi("A finish in any colour")).toMatch(/britannico «colour»/);
    expect(avvisi("A finish in any color")).not.toMatch(/britannico/);
  });

  it("le parole: fuori da 1.000-1.200 è un avviso, non un errore", () => {
    const f = parse(ok).file!;
    const p = checkUsePage(f, {
      faqQuestions: [],
      otherDescriptions: [],
      collectionSlugs: new Set(["club"]),
    });
    expect(p.find((x) => /parole fra introduzione e corpo/.test(x.message))?.level).toBe("warning");
  });
});

describe("pagina d'uso: i casi dei verificatori del 3/11", () => {
  const corpo = (t: string) => errors(ok.replace("- una voce", `- ${t}`)).join(" · ");

  it("la frase prescritta passa in cinque lingue, l'assoluto no", () => {
    for (const t of [
      "quasi tutto in AISI 316, alcune doccette e soffioni in ottone",
      "almost all stainless steel, some hand showers in brass",
      "fast komplett aus Edelstahl",
      "presque entièrement en inox",
      "casi todo de acero inoxidable",
    ])
      expect(corpo(t)).not.toMatch(/tutto inox/);
    for (const t of [
      "interamente in acciaio inox",
      "100% inox",
      "made entirely of stainless steel",
      "all-stainless",
      "komplett aus Edelstahl",
      "intégralement en inox",
      "íntegramente de acero inoxidable",
    ])
      expect(corpo(t)).toMatch(/tutto inox/);
  });

  it("le misure in parola e col segno; non «AISI 316 in», «2 in 1», «Edition 5 M»", () => {
    for (const t of ["a 3 metri", "10 m²", "40 gradi", "2 meters", "2 Meter", "2 mètres", "360°"])
      expect(corpo(t)).toMatch(/misura/);
    for (const t of ["AISI 316 in finitura lucida", "2 in 1", "la serie Edition 5 M"])
      expect(corpo(t)).not.toMatch(/misura/);
  });

  it("i prezzi in parola sì, la parola «prezzo» senza cifra accanto no", () => {
    for (const t of ["costa 1.200 euro", "1200 EUR", "1,200 dollars", "prezzo di 900"])
      expect(corpo(t)).toMatch(/prezzo/);
    expect(corpo("il prezzo riflette la qualità dell’acciaio AISI 316")).not.toMatch(/prezzo/);
    // «La costa» è il litorale (5/11/2026): con un numero vicino non è un prezzo; il verbo sì.
    expect(corpo("sulla costa la sigla 316 fa la differenza")).not.toMatch(/prezzo/);
    expect(corpo("en la costa la sigla 316 marca la diferencia")).not.toMatch(/prezzo/);
    expect(corpo("la colonna costa 900 euro")).toMatch(/prezzo/);
  });

  it("misure, prezzi e «tutto inox» anche negli alt", () => {
    const alt = (t: string) =>
      errors(ok.replace("Colonna doccia sul ponte di uno yacht", t)).join();
    expect(alt("Colonna alta 220 cm")).toMatch(/misura fuori dal corpo/);
    expect(alt("Colonna tutta in acciaio inox")).toMatch(/tutto inox/);
  });

  it("la forma non prevista a metà riga, nell'H1 e nell'intestazione", () => {
    for (const [t, atteso] of [
      ["un *corsivo*", /corsivo/],
      ["un `codice`", /codice/],
      ["a capo<br>", /HTML/],
      ["vedi https://example.com", /URL/],
      [`testo [[foto: ${H} | alt]] testo`, /segnaposto di foto/],
    ] as const)
      expect(corpo(t)).toMatch(atteso);
    expect(errors(ok.replace("# La doccia", "# La **doccia**")).join()).toMatch(/H1 è testo/);
    expect(
      errors(
        ok.replace(/seo\.title: .*/, "seo.title: Doccia da esterno TESTO in acciaio AISI"),
      ).join(),
    ).toMatch(/TESTO/);
    expect(errors(ok.replace("##", "##Idee"))).not.toEqual([]);
  });

  it("francese: lo spazio non separabile prima di ? : ; ! » e dopo «", () => {
    const f = { ...parse(ok).file!, lang: "fr", collections: undefined };
    const ctx = { faqQuestions: [], otherDescriptions: [], collectionSlugs: new Set<string>() };
    const e = (t: string) =>
      checkUsePage({ ...f, intro: t }, ctx)
        .map((p) => p.message)
        .join();
    // Il corpo della base è italiano («soluzioni:»): si guarda il solo segno dell'introduzione.
    expect(e("Pourquoi l’inox?")).toMatch(/spazio non separabile in «x\?»/);
    expect(e("Pourquoi l’inox\u00A0?")).not.toMatch(/«x\?»/);
  });

  it("collezioni doppie, foto sola verticale, || dentro foto, cella con | escapato", () => {
    expect(errors(ok.replace("collezioni: club", "collezioni: club, club")).join()).toMatch(
      /due volte/,
    );
    expect(errors(ok.replace(`[[foto: ${H}`, `[[foto: ${V}`)).join()).toMatch(/orizzontale/);
    expect(
      errors(
        ok.replace(
          `[[foto: ${H} | Colonna doccia sul ponte di uno yacht]]`,
          `[[foto: ${H} | a || ${H} | b]]`,
        ),
      ).join(),
    ).toMatch(/coppia/);
    expect(
      errors(
        ok.replace("| Colonna | in mezzo al prato |", "| Colonna \\| A | in mezzo al prato |"),
      ),
    ).toEqual([]);
  });

  it("le collezioni stanno nell'impronta della lingua italiana", () => {
    const f = parse(ok).file!;
    expect(pageFields(f, ["collection-club-it"]).hash).not.toBe(
      pageFields(f, ["collection-spring-it"]).hash,
    );
  });
});

describe("pagina d'uso: la struttura della sera del 3/11 (Q19)", () => {
  const box = "[[in sintesi]]\n- Una prima voce.\n- Una seconda voce.\n- Una terza voce.\n";
  const conBox = ok.replace("## Idee per", `${box}\n## Idee per`);

  it("il box «In sintesi» dopo l'introduzione diventa il primo blocco del corpo", () => {
    expect(errors(conBox)).toEqual([]);
    const f = parse(conBox).file!;
    expect(f.body[0]).toMatchObject({
      _type: "keyPoints",
      items: ["Una prima voce.", "Una seconda voce.", "Una terza voce."],
    });
    expect(f.intro).not.toContain("prima voce");
  });

  it("il box: da 3 a 4 voci, in testa, uno solo, testo semplice", () => {
    expect(errors(conBox.replace("- Una terza voce.\n", "")).join()).toMatch(/2 voci/);
    const dopoH2 = ok.replace("### Vicino alla piscina", `${box}\n### Vicino alla piscina`);
    expect(errors(dopoH2).join()).toMatch(/in testa/);
    expect(errors(conBox.replace("Una prima voce.", "Una **prima** voce.")).join()).toMatch(
      /testo semplice/,
    );
    expect(errors(conBox.replace("[[in sintesi]]", "[[In sintesi]]")).join()).toMatch(/minuscolo/);
  });

  it("gli elenchi numerati di un livello sono ammessi", () => {
    const s = ok.replace(
      "- una voce\n- un’altra voce",
      "1. se il giardino è piccolo, allora a parete\n2. se c’è la piscina, allora una colonna",
    );
    expect(errors(s)).toEqual([]);
    expect(
      parse(s).file!.body.filter((b) => (b as { listItem?: string }).listItem === "number"),
    ).toHaveLength(2);
  });

  it("senza box, con pochi H2 o pochi link: avvisi, non errori", () => {
    const f = parse(ok).file!;
    const avvisi = checkUsePage(f, {
      faqQuestions: [],
      otherDescriptions: [],
      collectionSlugs: new Set(["club"]),
    })
      .filter((p) => p.level === "warning")
      .map((p) => p.message)
      .join();
    expect(avvisi).toMatch(/In sintesi/);
    expect(avvisi).toMatch(/H2 \(la struttura ne ha 5/);
    expect(avvisi).toMatch(/1 link interni in uscita/);
  });
});

describe("pagina d'uso: impronta e codice di conferma", () => {
  it("l'impronta della lingua scritta coincide con quella riletta da Sanity", () => {
    const f = parse(ok).file!;
    const { fields, hash } = pageFields(f);
    // Sanity rende le chiavi in un altro ordine: l'impronta non ne dipende.
    const doc = JSON.parse(
      JSON.stringify({
        seo: { metaDescription: { it: fields.seoDescription }, metaTitle: { it: fields.seoTitle } },
        body: { it: fields.body },
        intro: { it: fields.intro },
        title: { it: fields.title },
      }),
    );
    expect(liveUseFields(doc, "it")).toEqual({ empty: false, hash });
    expect(liveUseFields(doc, "en").empty).toBe(true);
    // Una parola cambiata in Studio cambia l'impronta.
    doc.title.it = "Un altro titolo";
    expect(liveUseFields(doc, "it").hash).not.toBe(hash);
  });

  it("lo stesso diff dà lo stesso codice, un'altra revisione ne dà un altro", () => {
    const op = { id: "contentPage-outdoor-shower", rev: "r1", label: "x", set: { a: 1 } };
    expect(codiceConferma([op])).toBe(codiceConferma([{ ...op }]));
    expect(codiceConferma([op])).not.toBe(codiceConferma([{ ...op, rev: "r2" }]));
    expect(codiceConferma([op])).toMatch(/^[0-9a-f]{8}$/);
  });

  it("i controlli del corpo sono quelli dello Studio: un corpo vuoto non ha errori", () => {
    expect(checkUseBody([])).toEqual([]);
  });
});
