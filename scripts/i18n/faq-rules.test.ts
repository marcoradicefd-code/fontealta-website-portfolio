// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  boldHasKeyword,
  checkAnswer,
  containsKeyword,
  duplicateIndexes,
  duplicateKey,
  FAQ_LANGUAGES,
  FAQ_LINK_ROUTES,
  matchLinkRoute,
  mentionsName,
  mentionsPrice,
  normalizeQuestion,
  words,
  type FaqBlock,
} from "../../sanity/lib/faq-rules";
import { ALL_LOCALES, routing } from "../../src/i18n/routing";

const block = (...spans: Array<[string, string[]?]>): FaqBlock => ({
  _type: "block",
  children: spans.map(([text, marks]) => ({ _type: "span", text, marks: marks ?? [] })),
  markDefs: [{ _key: "l1", _type: "internalLink" }],
});

const filler = (n: number) => Array.from({ length: n }, (_, i) => `parola${i}`).join(" ");

describe("le regole delle FAQ", () => {
  it("le lingue sono quelle di routing.ts, nello stesso ordine", () => {
    expect([...FAQ_LANGUAGES]).toEqual([...ALL_LOCALES]);
  });

  it("ogni rotta dei link interni è una chiave di routing.pathnames", () => {
    const chiavi = Object.keys(routing.pathnames);
    for (const route of Object.keys(FAQ_LINK_ROUTES)) expect(chiavi).toContain(route);
  });

  it("riconosce le rotte, la letterale prima della dinamica", () => {
    expect(matchLinkRoute("/modello/b40l")).toEqual({ route: "/modello/[slug]", slug: "b40l" });
    expect(matchLinkRoute("/collezioni/corpi-a-incasso")).toEqual({
      route: "/collezioni/corpi-a-incasso",
    });
    expect(matchLinkRoute("/collezioni/corpi-a-incasso/cw-1")).toEqual({
      route: "/collezioni/corpi-a-incasso/[slug]",
      slug: "cw-1",
    });
    expect(matchLinkRoute("/finiture")).toEqual({ route: "/finiture" });
    expect(matchLinkRoute("/en/model/b40l")).toBeNull();
    expect(matchLinkRoute("/area-riservata")).toBeNull();
  });

  it("i doppioni si confrontano senza il nome della collezione e con le lettere di ogni lingua", () => {
    const names = ["Boss", "Club", "Club Large"];
    expect(normalizeQuestion("Boss si usa all’aperto?", names)).toBe(
      normalizeQuestion("Club si usa all'aperto?", names),
    );
    expect(normalizeQuestion("Club Large: quale finitura?", names)).toBe("quale finitura");
    expect(normalizeQuestion("Ist Edelstahl für Außenduschen geeignet?", [])).toBe(
      "ist edelstahl für außenduschen geeignet",
    );
    expect(duplicateIndexes(["Una?", "Due?", "una"], undefined, [])).toEqual([2]);
  });

  it("una domanda che nomina la sua collezione è di prodotto: si confronta solo per intero", () => {
    const names = ["Arko", "Onda", "Club", "Club Large"];
    expect(duplicateKey("In quali finiture si fa Arko?", "Arko", names)).toEqual({
      scope: "page",
      key: "in quali finiture si fa arko",
    });
    expect(duplicateKey("In quali finiture si fa Onda?", "Arko", names)).toEqual({
      scope: "site",
      key: "in quali finiture si fa",
    });
    expect(
      duplicateKey("Che differenza c’è tra Club e Club Large?", "Club Large", names).scope,
    ).toBe("page");
    expect(mentionsName("Arkolino si usa fuori?", "Arko")).toBe(false);
    expect(
      duplicateIndexes(
        ["Arko si usa fuori?", "Onda si usa fuori?", "arko si usa fuori"],
        "Arko",
        names,
      ),
    ).toEqual([2]);
  });

  it("conta le parole, non i caratteri, e i codici sono una parola", () => {
    expect(words("La B40L.M è — in AISI 316")).toHaveLength(6);
  });

  it("la keyword vale anche con parole in mezzo", () => {
    expect(
      containsKeyword(
        "colonna doccia in acciaio inox con miscelatore",
        "colonna doccia acciaio inox con miscelatore",
      ),
    ).toBe(true);
    expect(
      containsKeyword("colonna in acciaio inox con miscelatore", "colonna doccia acciaio inox"),
    ).toBe(false);
  });

  it("il grassetto porta la keyword: declinazioni, ordine, accenti e parole vuote", () => {
    // I casi di Origo e Kitchen in tedesco che il 2/11 erano avvisi.
    expect(boldHasKeyword("polierte Armatur aus Edelstahl", "armatur edelstahl poliert")).toBe(
      true,
    );
    expect(boldHasKeyword("Armatur aus poliertem Edelstahl", "armatur edelstahl poliert")).toBe(
      true,
    );
    expect(
      boldHasKeyword(
        "Küchenarmatur aus Edelstahl mit ausziehbarer Brause",
        "küchenarmatur edelstahl ausziehbar",
      ),
    ).toBe(true);
    expect(
      boldHasKeyword("Kuchenarmatur aus gebürstetem Edelstahl", "küchenarmatur gebürstet"),
    ).toBe(true);
    expect(boldHasKeyword("robinet de cuisine en inox", "robinet cuisine inox")).toBe(true);
    // Le parole corte vanno intere, e una parola che manca resta un avviso.
    expect(boldHasKeyword("acciaio AISI 31", "acciaio aisi 316")).toBe(false);
    expect(boldHasKeyword("Armatur aus Edelstahl", "armatur edelstahl poliert")).toBe(false);
    // Una radice di 5 lettere non è una sottostringa qualunque: deve aprire la parola.
    expect(boldHasKeyword("Hochglanzarmatur", "armatur")).toBe(false);
    // Il plurale italiano che cambia vocale (4/11/2026): la radice è al più la parola meno 2.
    expect(boldHasKeyword("docce da esterno di design", "doccia da esterno design")).toBe(true);
    expect(boldHasKeyword("camicie su misura", "camicia misura")).toBe(true);
    // Le altre parole restano a 5 lettere: «esterni» combacia con «esterno», «estetica» no.
    expect(boldHasKeyword("doccia estetica", "doccia da esterno")).toBe(false);
    // Attraverso checkAnswer, come in Studio e in faq:carica: il grassetto declinato non è un avviso.
    const origo = checkAnswer(
      {
        question: "Wie ist ein Wasserhahn aufgebaut?",
        keyword: "armatur edelstahl poliert",
        answer: [
          block(
            ["Auch eine "],
            ["polierte Armatur aus Edelstahl", ["strong"]],
            [" von Fontealta."],
          ),
        ],
      },
      ["Fontealta"],
    );
    expect(origo.some((p) => p.message.startsWith("il grassetto non contiene la keyword"))).toBe(
      false,
    );
    // La keyword spezzata fra due grassetti delle prime 50 parole vale: il grassetto è il loro insieme.
    const due = checkAnswer(
      {
        question: "Domanda?",
        keyword: "stainless steel bathroom faucet",
        answer: [
          block(["316 stainless steel", ["strong"]], [" e "], ["bathroom faucet", ["strong"]]),
        ],
      },
      ["Fontealta"],
    );
    expect(due.some((p) => p.message.startsWith("il grassetto non contiene la keyword"))).toBe(
      false,
    );
    // Elisioni, «ß» e parole vuote che il revisore ha trovato mancanti.
    expect(boldHasKeyword("rubinetto per l’acqua", "rubinetto dell'acqua")).toBe(true);
    expect(boldHasKeyword("Aussendusche aus Edelstahl", "außendusche edelstahl")).toBe(true);
    expect(boldHasKeyword("robinet de cuisine", "robinet sur une cuisine")).toBe(true);
  });

  it("i prezzi: una cifra con la valuta, o con «prezzo» nella stessa frase", () => {
    expect(mentionsPrice("Costa 1.200 € più IVA.")).toBe(true);
    expect(mentionsPrice("From $450.")).toBe(true);
    expect(mentionsPrice("Il prezzo parte da 900 euro.")).toBe(true);
    expect(mentionsPrice("In AISI 316 dal 1999. Il prezzo si chiede al rivenditore.")).toBe(false);
  });

  it("una risposta in regola non ha problemi", () => {
    const answer = [
      block(
        ["Sì. "],
        ["colonna doccia in acciaio inox", ["strong"]],
        [` di Boss ${filler(40)} `],
        ["la B40L", ["l1"]],
        [` ${filler(40)}.`],
      ),
    ];
    expect(
      checkAnswer(
        { question: "Boss ha la colonna?", keyword: "colonna doccia acciaio inox", answer },
        ["Fontealta", "Boss"],
      ),
    ).toEqual([]);
  });

  it("segnala lunghezza, grassetto tardivo, nome assente, link mancante, prezzo ed em dash", () => {
    const answer: FaqBlock[] = [
      {
        _type: "block",
        children: [
          { text: `${filler(60)} ` },
          { text: "keyword giusta", marks: ["strong"] },
          { text: " 300 €" },
        ],
        markDefs: [],
      },
    ];
    const msgs = checkAnswer({ question: "Una — domanda?", keyword: "keyword giusta", answer }, [
      "Fontealta",
    ]).map((p) => `${p.level}:${p.message}`);
    expect(msgs).toEqual([
      "error:em dash nella domanda",
      "warning:63 parole (attese 75-105)",
      "warning:né Fontealta nelle prime 50 parole",
      "warning:nessun grassetto nelle prime 50 parole",
      "warning:nessun link interno",
      "error:un prezzo nella risposta",
    ]);
  });

  it("una risposta vuota è solo un avviso: la domanda aspetta in Studio", () => {
    expect(checkAnswer({ question: "Domanda?", answer: [] }, ["Fontealta"])).toEqual([
      { level: "warning", message: "domanda senza risposta: non compare sul sito" },
    ]);
  });
});
