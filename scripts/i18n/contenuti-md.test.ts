import { describe, expect, it } from "vitest";

import { aGruppi, stampaTag, tagDaInvalidare, tagMancanti, unisciPerDocumento } from "./carico-lib";
import { trovaPaginaFaq } from "./faq-md";
import {
  conTesto,
  controllaFile,
  correzioniMeccaniche,
  parseFile,
  rigaPerArticolo,
  specsDaRiga,
  testoSemplice,
  type RigaEstrazione,
} from "./contenuti-md";

const NB = " ";
const collezioni = (lang: string, voci: string) =>
  `---\nsezione: collezioni\nlang: ${lang}\n---\n\n<!-- nota -->\n${voci}`;
const voce = (slug: string, title: string, desc: string) =>
  `## ${slug}\n<!-- oggi: «Colonne doccia» -->\n\ntagline: Linee lunghe.\nmetaTitle: ${title}\nmetaDescription: ${desc}\n`;
const D140 = "a".repeat(140);

describe("parseFile: front matter, voci, commenti fuori", () => {
  it("collezioni: tre campi per voce, i commenti non entrano", () => {
    const f = parseFile(
      collezioni("it", voce("boss", "Boss, colonne doccia in acciaio inox AISI", D140)),
    );
    expect(f).toMatchObject({ sezione: "collezioni", lang: "it" });
    expect(f.voci[0]).toEqual({
      chiave: "boss",
      campi: {
        tagline: "Linee lunghe.",
        metaTitle: "Boss, colonne doccia in acciaio inox AISI",
        metaDescription: D140,
      },
    });
  });

  it("alt e descrizioni: il corpo della voce è il testo", () => {
    const f = parseFile(
      "---\nsezione: alt-blog\nlang: en\n---\n\n## post-a\n<!-- alt IT -->\n\nTwo columns in a garden\n",
    );
    expect(f.voci).toEqual([{ chiave: "post-a", campi: { testo: "Two columns in a garden" } }]);
  });

  it("una sezione sconosciuta ferma il file", () => {
    expect(() => parseFile("---\nsezione: misure\nlang: it\n---\n")).toThrow(/sezione sconosciuta/);
  });
});

describe("controllaFile: lunghezze, tipografia, segnaposto, doppioni", () => {
  it("un file giusto non ha problemi", () => {
    expect(
      controllaFile(
        parseFile(
          collezioni("it", voce("boss", "Boss, colonne doccia in acciaio inox AISI", D140)),
        ),
      ),
    ).toEqual([]);
  });

  it("una tagline vuota si accetta (si toglie da Sanity); title e description vuoti no", () => {
    const vuote = (title: string) =>
      `## boss\n\ntagline:\nmetaTitle: ${title}\nmetaDescription: ${D140}\n\n## club\n\ntagline:\nmetaTitle: Club, colonne doccia in acciaio inox AISI\nmetaDescription: ${"b".repeat(140)}\n`;
    const f = parseFile(collezioni("it", vuote("Boss, colonne doccia in acciaio inox AISI")));
    expect(f.voci[0].campi.tagline).toBe("");
    // Due tagline vuote non sono un doppione.
    expect(controllaFile(f)).toEqual([]);
    expect(controllaFile(parseFile(collezioni("it", vuote(""))))).toEqual([
      { livello: "errore", chiave: "boss", campo: "metaTitle", messaggio: "vuoto" },
    ]);
  });

  it("title e description fuori dai limiti, segnaposto, apostrofo dritto", () => {
    const p = controllaFile(
      parseFile(collezioni("it", voce("boss", "Boss d'acciaio", "DESCRIZIONE"))),
    );
    expect(p.map((x) => x.messaggio)).toEqual(
      expect.arrayContaining([
        "apostrofo dritto (va ’)",
        "14 caratteri, fuori da 38-48",
        "segnaposto non sostituito",
      ]),
    );
  });

  it("francese: lo spazio prima dei due punti è U+00A0", () => {
    const giusto = parseFile(
      `---\nsezione: alt-blog\nlang: fr\n---\n\n## a\n\nLe stand${NB}: colonnes\n`,
    );
    const sbagliato = parseFile(
      `---\nsezione: alt-blog\nlang: fr\n---\n\n## a\n\nLe stand : colonnes\n`,
    );
    expect(controllaFile(giusto)).toEqual([]);
    expect(controllaFile(sbagliato)[0].messaggio).toMatch(/U\+00A0/);
  });

  it("doppioni fra collezioni sì, fra descrizioni no (articoli diversi, stesso tipo)", () => {
    const due = collezioni(
      "it",
      voce("a", "Boss, colonne doccia in acciaio inox AISI", D140) +
        voce("b", "Boss, colonne doccia in acciaio inox AISI", D140),
    );
    expect(
      controllaFile(parseFile(due)).some((p) => /uguale a quello di «a»/.test(p.messaggio)),
    ).toBe(true);
    const descr =
      "---\nsezione: descrizioni\nlang: en\n---\n\n## B76\n\nShower column\n\n## C90\n\nShower column\n";
    expect(controllaFile(parseFile(descr))).toEqual([]);
  });
});

describe("correzioni meccaniche e Portable Text", () => {
  it("AISI, apostrofo tipografico, maiuscola iniziale; le misure restano", () => {
    expect(correzioniMeccaniche("cuerpo empotrado acero inox Aisi 316, Ø200 mm", "es")).toBe(
      "Cuerpo empotrado acero inox AISI 316, Ø200 mm",
    );
    expect(correzioniMeccaniche("Batteria d'arresto", "it")).toBe("Batteria d’arresto");
  });

  it("riscrive solo la forma semplice, con le chiavi invariate", () => {
    const b = [
      {
        _key: "k1",
        _type: "block",
        style: "normal",
        markDefs: [],
        children: [{ _key: "s1", _type: "span", marks: [], text: "vecchio" }],
      },
    ];
    expect(testoSemplice(b)).toBe("vecchio");
    expect(conTesto(b, "nuovo")).toEqual([
      { ...b[0], children: [{ ...b[0].children[0], text: "nuovo" }] },
    ]);
    expect(testoSemplice([...b, ...b])).toBeNull();
    expect(
      testoSemplice([{ ...b[0], children: [{ ...b[0].children[0], marks: ["strong"] }] }]),
    ).toBeNull();
  });
});

const riga = (r: Partial<RigaEstrazione>): RigaEstrazione => ({
  code: "B76",
  collezione: "boss",
  fonte: "06-002",
  stampata: 128,
  tipo: "colonna",
  misure: [],
  attacchi: [],
  ...r,
});

describe("specsDaRiga: dall'estrazione a specs", () => {
  it("solo le misure con nome, le quote senza nome restano fuori; fonte e stato", () => {
    const { specs, problemi } = specsDaRiga(
      riga({
        misure: [
          { nome: "altezza totale", valore: 2300 },
          { nome: "quota (83)", valore: 83 },
          { nome: "sporgenza", valore: 360, tolleranza: 10 },
        ],
        attacchi: ['G1/2"'],
      }),
    );
    expect(problemi).toEqual([]);
    expect(specs).toEqual({
      _type: "specsMisure",
      famiglia: "colonna",
      misure: [
        { _key: "altezzaTotale", _type: "misura", chiave: "altezzaTotale", valore: 2300 },
        { _key: "sporgenza", _type: "misura", chiave: "sporgenza", valore: 360, tolleranza: 10 },
      ],
      attacchi: ['G1/2"'],
      fonte: { documento: "listinoEditionV-06-002", pagina: 128 },
      stato: "daVerificare",
    });
  });

  it("intervallo (regolabile solo coi due valori del disegno), lati, «(lato)» come quadrato, ILLE", () => {
    const { specs } = specsDaRiga(
      riga({
        fonte: "ille",
        misure: [
          {
            nome: "altezza soffione",
            min: 900,
            max: 1300,
            nota: "due valori nel disegno: 900/1300",
          },
          { nome: "sporgenza bocca", min: 170, max: 200 },
          { nome: "soffione (lato)", valore: 200 },
          { nome: "placca", lati: [120, 80] },
        ],
      }),
    );
    expect(specs?.fonte.documento).toBe("listinoIlle-REV07-001");
    expect(specs?.misure).toEqual([
      expect.objectContaining({ chiave: "altezzaSoffione", min: 900, max: 1300, regolabile: true }),
      expect.objectContaining({ chiave: "sporgenzaBocca", min: 170, max: 200 }),
      expect.objectContaining({ chiave: "soffione", lati: [200, 200] }),
      expect.objectContaining({ chiave: "placca", lati: [120, 80] }),
    ]);
    expect(specs?.misure[1]).not.toHaveProperty("regolabile");
  });

  it("chiave doppia: non si scrive, avviso; «N°2» sono due attacchi; «altro» senza famiglia", () => {
    const { specs, problemi } = specsDaRiga(
      riga({
        tipo: "altro",
        misure: [
          { nome: "Ø", valore: 60 },
          { nome: "Ø", valore: 34 },
          { nome: "altezza totale", valore: 950 },
        ],
        attacchi: ['N°2 G1/2"'],
      }),
    );
    expect(specs?.misure.map((m) => m.chiave)).toEqual(["altezzaTotale"]);
    expect(specs?.attacchi).toEqual(['G1/2"', 'G1/2"']);
    expect(specs && "famiglia" in specs).toBe(false);
    expect(problemi.map((p) => `${p.livello} ${p.campo}`)).toEqual([
      "avviso diametro",
      "avviso famiglia",
    ]);
  });

  it("solo quote senza nome: niente specs; nome o attacco sconosciuto: errore", () => {
    expect(specsDaRiga(riga({ misure: [{ nome: "quota (60)", valore: 60 }] })).specs).toBeNull();
    const { problemi } = specsDaRiga(
      riga({
        misure: [
          { nome: "altezza", valore: 1 },
          { nome: "spessore", valore: 2 },
        ],
        attacchi: ["G1"],
      }),
    );
    expect(problemi.filter((p) => p.livello === "errore").map((p) => p.campo)).toEqual([
      "spessore",
      "attacchi",
    ]);
  });
});

describe("rigaPerArticolo: un codice in più collezioni", () => {
  it("vale la riga del 06-002 con la pagina più bassa, e dice chi è diverso", () => {
    const m = rigaPerArticolo([
      riga({
        code: "WX75.SK",
        collezione: "ille",
        fonte: "ille",
        stampata: 18,
        misure: [{ nome: "Ø placca", valore: 60 }],
      }),
      riga({
        code: "WX75.SK",
        collezione: "twiggy",
        stampata: 66,
        misure: [{ nome: "quota (60)", valore: 60 }],
      }),
      riga({
        code: "WX75.SK",
        collezione: "classy",
        stampata: 47,
        misure: [{ nome: "quota (60)", valore: 60 }],
      }),
    ]);
    expect(m.get("WX75.SK")?.riga.collezione).toBe("classy");
    expect(m.get("WX75.SK")?.diverse).toEqual(["ille"]);
  });
});

describe("unisciPerDocumento: una scrittura per documento", () => {
  it("unisce i campi delle lingue e gli oggetti da creare, tiene la revisione letta", () => {
    const [op, ...resto] = unisciPerDocumento([
      {
        id: "c",
        rev: "r1",
        label: "boss (it)",
        set: { "tagline.it": "a" },
        setIfMissing: { seo: { _type: "seoFields", metaTitle: { _type: "x" } } },
      },
      {
        id: "c",
        rev: "r1",
        label: "boss (en)",
        set: { "tagline.en": "b" },
        setIfMissing: { seo: { _type: "seoFields", metaDescription: { _type: "y" } } },
      },
      { id: "d", rev: "r9", label: "altro", set: { specs: 1 } },
    ]);
    expect(resto).toHaveLength(1);
    expect(op).toEqual({
      id: "c",
      rev: "r1",
      label: "boss (it) + boss (en)",
      set: { "tagline.it": "a", "tagline.en": "b" },
      setIfMissing: {
        seo: { _type: "seoFields", metaTitle: { _type: "x" }, metaDescription: { _type: "y" } },
      },
    });
  });
});

describe("i tag da invalidare dopo una scrittura (rule cache-isr)", () => {
  const scritti = [
    { _type: "collection", slug: "boss" },
    { _type: "collection", slug: "origo" },
    { _type: "post", slug: "aisi-316-contro-304-parte-1" },
    { _type: "contentPage", slug: null },
  ];
  it("per ogni documento scritto il tipo e <tipo>:<slug>, come il webhook, senza doppioni", () => {
    expect(tagDaInvalidare(scritti)).toEqual([
      "collection",
      "collection:boss",
      "collection:origo",
      "post",
      "post:aisi-316-contro-304-parte-1",
      "contentPage",
    ]);
  });
  it("un documento scritto senza il suo tag nell'elenco è un errore", () => {
    const tags = tagDaInvalidare(scritti);
    for (const d of scritti) {
      expect(tags).toContain(d._type);
      if (d.slug) expect(tags).toContain(`${d._type}:${d.slug}`);
    }
    expect(tagMancanti(scritti, tags)).toEqual([]);
    expect(
      tagMancanti(
        scritti,
        tags.filter((t) => t !== "collection:origo"),
      ),
    ).toEqual(["collection:origo"]);
  });
  it("a gruppi da 16, come vuole l'API di Vercel", () => {
    const tanti = Array.from({ length: 37 }, (_, i) => `post:${i}`);
    expect(aGruppi(tanti).map((g) => g.length)).toEqual([16, 16, 5]);
  });
});

describe("stampaTag risolve gli id scritti coi resolver veri dei caricatori", () => {
  const pages = [
    { _id: "collection-origo-it", _type: "collection" },
    { _id: "contentPage-home", _type: "contentPage" },
  ];
  const slugs = [{ _id: "collection-origo-it", slug: "origo" }];
  const trova = trovaPaginaFaq(pages, slugs);
  it("faq:carica: collezione col suo slug, pagina principale (anche nuova) col solo tipo", () => {
    expect(trova("collection-origo-it")).toEqual({ _type: "collection", slug: "origo" });
    expect(trova("contentPage-home")).toEqual({ _type: "contentPage", slug: null });
    expect(trova("contentPage-about")).toEqual({ _type: "contentPage", slug: null });
    expect(trova("model-b76")).toBeUndefined();
    expect(stampaTag(["collection-origo-it", "contentPage-about"], trova)).toEqual([
      "collection",
      "collection:origo",
      "contentPage",
    ]);
  });
  it("un id scritto che non si risolve, o senza tipo, ferma la stampa: un tag perso non si vede", () => {
    expect(() => stampaTag(["collection-origo-it", "model-b76"], trova)).toThrow(/model-b76/);
    expect(() => stampaTag(["x"], () => ({ _type: "", slug: "x" }))).toThrow(/senza tipo/);
  });
});
