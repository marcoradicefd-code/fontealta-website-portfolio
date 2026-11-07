// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ANSWER_MIN_LOADABLE,
  buildFaqFile,
  compareFaq,
  contentHash,
  crossDuplicates,
  decideFaqWrite,
  faqComparisonFails,
  pagesForRun,
  paragraphToBlock,
  parseFaqFile,
  restoreOp,
  textHash,
} from "./faq-md";
import { writePath } from "./publish";

// Un file di prova nel formato della spec (§ 11): due domande, grassetto, link interni ed esterni.
const FILE = `---
code: boss
kind: collection
lang: it
---

## Boss ha una colonna per lavabo?
keyword: colonna lavabo acciaio inox

Sì. Boss ha la **colonna lavabo in acciaio inox** B40L.
Si posa a pavimento. Vedi la [colonna B40L](/modello/b40l).

Un secondo paragrafo con il [sito del produttore](https://example.com).

## Boss si usa al mare?
keyword: doccia da esterno

Vedi le [finiture](/finiture) e la [scheda che non esiste](/modello/nessuno).
`;

const resolve = (type: string, slug: string) =>
  type === "model" && slug === "b40l" ? "model-b40l" : undefined;

describe("i file delle FAQ", () => {
  it("legge intestazione, domande, keyword e paragrafi", () => {
    const { file, errors } = parseFaqFile(FILE);
    expect(errors).toEqual([]);
    expect(file).toMatchObject({ code: "boss", kind: "collection", lang: "it" });
    expect(file!.items.map((i) => i.question)).toEqual([
      "Boss ha una colonna per lavabo?",
      "Boss si usa al mare?",
    ]);
    expect(file!.items[0].keyword).toBe("colonna lavabo acciaio inox");
    // Le righe di un paragrafo si uniscono, la riga vuota apre un paragrafo nuovo.
    expect(file!.items[0].paragraphs).toHaveLength(2);
  });

  it("una risposta che comincia con «Yes:» resta una risposta", () => {
    const { file } = parseFaqFile(
      "---\ncode: x\nkind: main\nlang: en\n---\n## Q?\nkeyword: k\n\nYes: it is.\n",
    );
    expect(file!.items[0]).toMatchObject({
      keyword: "k",
      paragraphs: ["Yes: it is."],
      approfondisci: [],
    });
  });

  it("un formato sbagliato è un errore, non un'eccezione", () => {
    expect(parseFaqFile("## Domanda?\nRisposta").errors).toEqual([
      "manca l'intestazione fra due righe ---",
    ]);
    expect(parseFaqFile("---\ncode: x\n---\nTesto senza domanda\n").errors).toEqual([
      "manca «kind» nell'intestazione",
      "manca «lang» nell'intestazione",
      "riga 4: testo prima della prima domanda",
      "nessuna domanda",
    ]);
  });

  it("converte grassetto e link nel Portable Text, con la referenza risolta", () => {
    const { block, problems } = paragraphToBlock(
      "La **B40L** e la [scheda](/modello/b40l).",
      "s",
      resolve,
    );
    expect(problems).toEqual([]);
    expect(block.children!.map((c) => [c.text, c.marks])).toEqual([
      ["La ", []],
      ["B40L", ["strong"]],
      [" e la ", []],
      ["scheda", [block.markDefs![0]._key]],
      [".", []],
    ]);
    expect(block.markDefs![0]).toMatchObject({
      _type: "internalLink",
      route: "/modello/[slug]",
      reference: { _type: "reference", _ref: "model-b40l" },
    });
  });

  it("un percorso fuori dai pathnames o uno slug che non c'è sono errori", () => {
    expect(paragraphToBlock("[x](/en/model/b40l)", "s", resolve).problems[0].message).toMatch(
      /non riconosciuto/,
    );
    expect(paragraphToBlock("[x](/modello/nessuno)", "s", resolve).problems[0].message).toMatch(
      /nessun model/,
    );
  });

  it("le chiavi nascono dal contenuto: due giri danno lo stesso documento", () => {
    const { file } = parseFaqFile(FILE);
    const a = buildFaqFile(file!, ["Fontealta", "Boss"], resolve);
    const b = buildFaqFile(file!, ["Fontealta", "Boss"], resolve);
    expect(a.built).toEqual(b.built);
    expect(a.items[1].problems.some((p) => /nessun model con slug «nessuno»/.test(p.message))).toBe(
      true,
    );
  });

  it("l'impronta ignora le chiavi e cambia col testo", () => {
    const { file } = parseFaqFile(FILE);
    const [item] = buildFaqFile(file!, ["Boss"], resolve).built;
    const rinominato = JSON.parse(
      JSON.stringify(item).replaceAll(/"_key":"[0-9a-f]+"/g, '"_key":"altro"'),
    );
    expect(contentHash(rinominato)).toBe(item.loadedHash);
    expect(contentHash({ ...item, question: "Un'altra domanda?" })).not.toBe(item.loadedHash);
  });

  it("i doppioni fra pagine: solo le domande generiche, non quelle sulla propria collezione", () => {
    const pagine = [
      {
        label: "it/arko.md",
        page: "collection-arko-it",
        own: "Arko",
        questions: ["In quali finiture si fa Arko?", "Si usa al mare?"],
      },
      {
        label: "it/onda.md",
        page: "collection-onda-it",
        own: "Onda",
        questions: ["In quali finiture si fa Onda?"],
      },
      {
        label: "it/boss.md",
        page: "collection-boss-it",
        own: "Boss",
        questions: ["Club si usa al mare?"],
      },
      { label: "it/home.md", page: "contentPage-home", questions: ["Che cos’è l’AISI 316?"] },
      {
        label: "it/club.md",
        page: "collection-club-it",
        own: "Club",
        questions: ["Che cos'è l'AISI 316?"],
      },
    ];
    expect(crossDuplicates(pagine, ["Arko", "Onda", "Boss", "Club"])).toEqual([
      { question: "Club si usa al mare?", first: "it/arko.md", second: "it/boss.md" },
      { question: "Che cos'è l'AISI 316?", first: "it/home.md", second: "it/club.md" },
    ]);
  });

  // Le FAQ di boss già su Sanity e il file di boss: il caso del dry-run del 30/10 (passo d1).
  const names = ["Boss", "Club"];
  const bossSanity = {
    label: "Sanity collection-boss-it",
    page: "collection-boss-it",
    own: "Boss",
    questions: ["Boss ha la doccetta?", "Che differenza c’è tra inox e acciaio?"],
  };
  const bossFile = { ...bossSanity, label: "it/boss.md" };

  it("il caso boss: il file e la stessa pagina su Sanity non sono doppioni, scritta o saltata", () => {
    // Scritta: le FAQ di Sanity si tolgono, il file le sostituisce.
    expect(pagesForRun([bossSanity], [bossFile], new Set(["collection-boss-it"]))).toEqual([
      bossFile,
    ]);
    expect(
      crossDuplicates(
        pagesForRun([bossSanity], [bossFile], new Set(["collection-boss-it"])),
        names,
      ),
    ).toEqual([]);
    // Saltata perché già uguale: restano tutte e due, ma sono la stessa pagina.
    expect(crossDuplicates(pagesForRun([bossSanity], [bossFile], new Set()), names)).toEqual([]);
  });

  it("una pagina saltata tiene le sue FAQ di Sanity nel confronto", () => {
    // Club ha una bozza aperta e il giro la salta: la sua domanda su Sanity resta.
    const clubSanity = {
      label: "Sanity collection-club-it",
      page: "collection-club-it",
      own: "Club",
      questions: ["Che differenza c’è tra inox e acciaio?"],
    };
    const pagine = pagesForRun([clubSanity], [bossFile], new Set(["collection-boss-it"]));
    expect(pagine).toContain(clubSanity);
    expect(crossDuplicates(pagine, names)).toEqual([
      {
        question: "Che differenza c’è tra inox e acciaio?",
        first: "Sanity collection-club-it",
        second: "it/boss.md",
      },
    ]);
  });

  it("un doppione vero fra due pagine diverse resta, e ferma il giro", () => {
    const clubFile = {
      label: "it/club.md",
      page: "collection-club-it",
      own: "Club",
      questions: ["Che differenza c'è tra inox e acciaio?"],
    };
    const scritte = new Set(["collection-boss-it", "collection-club-it"]);
    expect(
      crossDuplicates(pagesForRun([bossSanity], [bossFile, clubFile], scritte), names),
    ).toEqual([
      {
        question: "Che differenza c'è tra inox e acciaio?",
        first: "it/boss.md",
        second: "it/club.md",
      },
    ]);
  });

  it("i commenti si tolgono prima di contare e di convertire, e non arrivano su Sanity", () => {
    const sorgente = FILE.replace(
      "Si posa a pavimento.",
      "Si posa <!-- nota breve --> a pavimento.\n<!-- una nota\nsu due righe -->\nAncora.",
    );
    const { file, errors } = parseFaqFile(sorgente);
    expect(errors).toEqual([]);
    expect(file!.items[0].notes).toEqual(["nota breve", "una nota su due righe"]);
    expect(file!.items[0].paragraphs[0]).toContain("Si posa a pavimento. Ancora. Vedi la");
    const report = buildFaqFile(file!, ["Fontealta", "Boss"], resolve);
    expect(JSON.stringify(report.built)).not.toMatch(/nota|<!--/);
    expect(parseFaqFile(`${FILE}\n<!-- aperto`).errors).toContain(
      "un commento <!-- non si chiude con -->",
    );
  });

  it("«DA VERIFICARE» ferma la sua domanda, le altre del file passano", () => {
    const sorgente = FILE.replace(
      "keyword: doccia da esterno",
      "keyword: doccia da esterno\n<!-- DA VERIFICARE: al mare? -->",
    );
    const report = buildFaqFile(parseFaqFile(sorgente).file!, ["Fontealta", "Boss"], resolve);
    expect(report.items.map((i) => i.blocked)).toEqual([false, true]);
    expect(report.items[1].problems).toContainEqual({
      level: "error",
      message: "DA VERIFICARE: al mare?: la domanda non si carica",
    });
    expect(report.built.map((b) => b.question)).toEqual(["Boss ha una colonna per lavabo?"]);
  });

  it("la scrittura: si salta con un errore, una bozza, una pagina d'uso o niente di nuovo", () => {
    const built = buildFaqFile(parseFaqFile(FILE).file!, ["Fontealta", "Boss"], resolve).built;
    const target = { _id: "collection-boss-it", _rev: "r1" };
    const base = {
      kind: "collection",
      code: "boss",
      lang: "it",
      target,
      hasDraft: false,
      errors: 0,
      built,
    };
    expect(decideFaqWrite(base)).toEqual({
      action: "patch",
      id: "collection-boss-it",
      rev: "r1",
      before: undefined,
      hasFaq: false,
    });
    expect(decideFaqWrite({ ...base, errors: 2 })).toMatchObject({ action: "skip" });
    expect(decideFaqWrite({ ...base, hasDraft: true })).toMatchObject({ action: "skip" });
    expect(decideFaqWrite({ ...base, built: [] })).toMatchObject({ action: "skip" });
    // Già scritto: lo stesso contenuto, anche con le chiavi in un altro ordine, non si riscrive.
    const riletto = JSON.parse(
      JSON.stringify(built.map((b) => Object.fromEntries(Object.entries(b).reverse()))),
    );
    expect(decideFaqWrite({ ...base, target: { ...target, faq: { it: riletto } } })).toMatchObject({
      action: "skip",
      reason: "già uguale su Sanity",
    });
  });

  it("una pagina principale che non c'è si crea coi soli code, kind e faq", () => {
    const built = buildFaqFile(parseFaqFile(FILE).file!, ["Fontealta"], resolve).built;
    const w = decideFaqWrite({
      kind: "main",
      code: "home",
      lang: "en",
      id: "contentPage-home",
      hasDraft: false,
      errors: 0,
      built,
    });
    expect(w).toEqual({
      action: "create",
      doc: {
        _id: "contentPage-home",
        _type: "contentPage",
        code: "home",
        kind: "main",
        faq: { en: built },
      },
    });
    // La pagina d'uso nasce allo stesso modo, col suo kind (c1a, 3/11/2026).
    expect(
      decideFaqWrite({
        kind: "use",
        code: "outdoor-shower",
        lang: "en",
        id: "contentPage-outdoor-shower",
        hasDraft: false,
        errors: 0,
        built,
      }),
    ).toMatchObject({
      action: "create",
      doc: { _id: "contentPage-outdoor-shower", kind: "use", code: "outdoor-shower" },
    });
    expect(
      decideFaqWrite({
        kind: "collection",
        code: "x",
        lang: "it",
        hasDraft: false,
        errors: 0,
        built,
      }),
    ).toMatchObject({
      action: "skip",
      reason: "pagina assente",
    });
  });

  it("la verifica trova le FAQ sparite, cambiate o in più sul pubblicato", () => {
    const built = buildFaqFile(parseFaqFile(FILE).file!, ["Fontealta", "Boss"], resolve).built;
    const nulla = { missing: [], extra: [], changed: [], order: null };
    expect(compareFaq(built, built)).toEqual(nulla);
    expect(compareFaq(built, undefined)).toEqual({
      ...nulla,
      missing: ["Boss ha una colonna per lavabo?", "Boss si usa al mare?"],
    });
    const cambiata = [{ ...built[0], keyword: "altro" }, built[1], { question: "Vecchia?" }];
    expect(compareFaq(built, cambiata)).toEqual({
      ...nulla,
      changed: ["Boss ha una colonna per lavabo?"],
      extra: ["Vecchia?"],
    });
    expect(faqComparisonFails(compareFaq(built, cambiata))).toBe(true);
  });

  describe("la verifica separa testo e ordine (2/11/2026)", () => {
    // Il pubblicato si costruisce col caricatore vero: le chiavi dei link nascono dalla posizione.
    const carica = (file: string) =>
      buildFaqFile(parseFaqFile(file).file!, ["Fontealta", "Boss"], resolve).built;
    const [prima, seconda] = FILE.split(/\n(?=## )/).slice(1);
    const testa = FILE.split(/\n(?=## )/)[0];
    const file = carica(FILE);

    it("una domanda spostata: 0 testi diversi e un avviso d'ordine", () => {
      const spostato = carica(`${testa}\n${seconda}\n${prima}`);
      // Con l'impronta di prima la stessa domanda spostata era «diversa»: le chiavi dei link cambiano.
      expect(contentHash(spostato[1])).not.toBe(file[0].loadedHash);
      const c = compareFaq(file, spostato);
      expect(c).toEqual({ missing: [], extra: [], changed: [], order: [2, 1] });
      expect(faqComparisonFails(c)).toBe(false);
    });

    it("una parola cambiata è un testo diverso", () => {
      const c = compareFaq(file, carica(FILE.replace("Si posa a pavimento", "Si posa a parete")));
      expect(c.changed).toEqual(["Boss ha una colonna per lavabo?"]);
      expect(faqComparisonFails(c)).toBe(true);
    });

    it("un link con l'indirizzo diverso è un testo diverso", () => {
      const c = compareFaq(
        file,
        carica(FILE.replace("https://example.com", "https://example.org")),
      );
      expect(c.changed).toEqual(["Boss ha una colonna per lavabo?"]);
      expect(c.order).toBeNull();
    });

    it("un grassetto tolto è un testo diverso", () => {
      const c = compareFaq(
        file,
        carica(
          FILE.replace("**colonna lavabo in acciaio inox**", "colonna lavabo in acciaio inox"),
        ),
      );
      expect(c.changed).toEqual(["Boss ha una colonna per lavabo?"]);
    });

    it("l'impronta salvata su Sanity (loadedHash) non cambia", () => {
      // Le 204 domande caricate il 30/10 portano contentHash: se cambiasse, sembrerebbero tutte
      // cambiate in Studio e faq:carica non scriverebbe più.
      for (const b of file) expect(contentHash(b)).toBe(b.loadedHash);
      expect(textHash(file[0])).not.toBe(file[0].loadedHash);
    });
  });

  it("faq a null, come lo dà la proiezione GROQ quando il campo manca, non è un campo che c'è", () => {
    const built = buildFaqFile(parseFaqFile(FILE).file!, ["Fontealta", "Boss"], resolve).built;
    const w = decideFaqWrite({
      kind: "collection",
      code: "boss",
      lang: "it",
      target: { _id: "collection-boss-it", _rev: "r1", faq: null },
      hasDraft: false,
      errors: 0,
      built,
    });
    expect(w).toMatchObject({ action: "patch", before: undefined, hasFaq: false });
  });

  it("il ripristino toglie faq intero solo se prima non c'era e non restano altre lingue", () => {
    const scritto = { it: [{ question: "Q?" }] };
    // Prima il campo non c'era, su Sanity c'è solo questa lingua: via `faq`, il documento torna com'era.
    expect(restoreOp({ hasFaq: false }, "it", scritto)).toEqual({ unset: ["faq"] });
    // Prima c'era un'altra lingua: si toglie solo la nostra.
    expect(restoreOp({ hasFaq: true }, "it", { ...scritto, en: [{ question: "Q?" }] })).toEqual({
      unset: ["faq.it"],
    });
    // Il verbale dice che non c'era, ma su Sanity ora c'è un'altra lingua: si toglie solo la nostra.
    expect(restoreOp({ hasFaq: false }, "it", { ...scritto, en: [] })).toEqual({
      unset: ["faq.it"],
    });
    // Prima c'erano FAQ in questa lingua: si rimettono.
    expect(restoreOp({ hasFaq: true, before: [{ question: "Vecchia?" }] }, "it", scritto)).toEqual({
      set: { "faq.it": [{ question: "Vecchia?" }] },
    });
  });

  // Un file da quattro domande, come boss: le due di FILE più due.
  const FILE_4 = `${FILE}
## Boss ha la doccetta?
keyword: doccetta acciaio inox

Sì, la **doccetta in acciaio inox** di Boss. Vedi la [colonna B40L](/modello/b40l).

## Boss si fa in nero?
keyword: colonna nera

Sì, la **colonna nera** di Boss. Vedi le [finiture](/finiture).
`;

  it("lo stesso giro due volte lascia 4 domande, non 8, e il secondo salta la pagina", () => {
    const costruisci = (sorgente: string) =>
      buildFaqFile(parseFaqFile(sorgente).file!, ["Fontealta", "Boss"], resolve).built;
    const doc: { _id: string; _rev: string; faq?: Record<string, unknown> | null } = {
      _id: "collection-boss-it",
      _rev: "r0",
    };
    let giri = 0;
    // Un giro: la decisione, e la scrittura come la fa Sanity (`setIfMissing`, poi `set` che sostituisce).
    const giro = (sorgente: string) => {
      const built = costruisci(sorgente);
      const w = decideFaqWrite({
        kind: "collection",
        code: "boss",
        lang: "it",
        target: doc,
        hasDraft: false,
        errors: 0,
        built,
      });
      if (w.action === "patch") {
        doc.faq ??= {};
        writePath(doc as Record<string, unknown>, "faq.it", structuredClone(built));
        doc._rev = `r${++giri}`;
      }
      return w;
    };
    expect(giro(FILE_4).action).toBe("patch");
    expect((doc.faq!.it as unknown[]).length).toBe(4);
    expect(giro(FILE_4)).toEqual({ action: "skip", reason: "già uguale su Sanity" });
    expect((doc.faq!.it as unknown[]).length).toBe(4);
    // Un file cambiato riscrive, e sostituisce: ancora 4.
    expect(giro(FILE_4.replace("di Boss.", "della collezione Boss.")).action).toBe("patch");
    expect((doc.faq!.it as unknown[]).length).toBe(4);
  });

  it("la scrittura sostituisce faq.<lingua> e non accoda mai", () => {
    const sorgente = readFileSync(join(process.cwd(), "scripts/i18n/faq-carica.ts"), "utf-8");
    expect(sorgente).not.toMatch(/\.(insert|append|prepend)\(/);
    expect(sorgente).toContain(".set({ [`faq.${lang}`]: built })");
  });
});

describe("segnaposto e risposte monche sono errori (2/11/2026)", () => {
  /** Un file di una domanda con questa risposta, convertito e controllato. */
  const controlla = (risposta: string) => {
    const sorgente = `---\ncode: boss-wide\nkind: collection\nlang: de\n---\n\n## Gibt es Boss Wide?\nkeyword: soffione a pioggia\n<!-- fonte: trad. -->\n\n${risposta}\n`;
    const { file, errors } = parseFaqFile(sorgente);
    expect(errors).toEqual([]);
    const report = buildFaqFile(file!, ["Fontealta", "Boss Wide"], (type, slug) =>
      type === "model" && slug === "bw76-m" ? "model-bw76-m" : undefined,
    );
    return {
      words: report.items[0].words,
      errors: report.items[0].problems.filter((p) => p.level === "error").map((p) => p.message),
      warnings: report.items[0].problems.filter((p) => p.level === "warning").map((p) => p.message),
    };
  };
  const parole = (n: number) => `Fontealta${" parola".repeat(n - 1)}`;
  const SEGNAPOSTO = "il segnaposto RISPOSTA è ancora nel testo";

  it("il segnaposto è un errore: da solo, fra spazi e in mezzo a un testo lungo", () => {
    expect(controlla("RISPOSTA").errors).toContain(SEGNAPOSTO);
    expect(controlla("   RISPOSTA   ").errors).toContain(SEGNAPOSTO);
    expect(controlla(`${parole(40)} RISPOSTA ${parole(40)}`).errors).toEqual([SEGNAPOSTO]);
  });

  it("«risposta» minuscola o dentro un'altra parola non è il segnaposto", () => {
    expect(controlla(`${parole(80)} la risposta`).errors).toEqual([]);
    expect(controlla(`${parole(80)} RISPOSTAX`).errors).toEqual([]);
  });

  it("sotto le 40 parole è un errore, da 40 a 74 un avviso", () => {
    expect(ANSWER_MIN_LOADABLE).toBe(40);
    const a39 = controlla(parole(39));
    expect(a39.words).toBe(39);
    expect(a39.errors).toEqual(["39 parole: sotto le 40 la risposta è vuota o tagliata"]);
    const a40 = controlla(parole(40));
    expect(a40.words).toBe(40);
    expect(a40.errors).toEqual([]);
    expect(a40.warnings).toContain("40 parole (attese 75-105)");
    expect(controlla("").errors).toEqual(["0 parole: sotto le 40 la risposta è vuota o tagliata"]);
  });

  it("una risposta vera della v5 non ha errori", () => {
    const v5 =
      "No, nella collezione Boss Wide di Fontealta l’ampio **soffione a pioggia** S12 sta solo sulle sette colonne BW76 con corpo a incasso. Le colonne BW76 vanno dalla versione con rubinetto d’arresto alla colonna BW76.RC per comando remoto, con o senza doccetta. Le versioni W4 con il comando a vista montano invece il soffione S10. Due esempi sono la colonna W444 con gruppo e la colonna W44A6.E con termostatico. I soffioni S12 e S10 sono anticalcare, in acciaio inox AISI 316. Per avere il soffione ampio si sceglie una colonna BW76, come la [colonna doccia BW76.M con miscelatore](/modello/bw76-m).";
    expect(controlla(v5)).toMatchObject({ errors: [], warnings: [] });
  });
});

describe("«Approfondisci» (4/11/2026)", () => {
  const conRiga = (riga: string, lang = "it") =>
    FILE.replace("lang: it", `lang: ${lang}`).replace(
      "keyword: colonna lavabo acciaio inox\n",
      `keyword: colonna lavabo acciaio inox\n${riga}\n`,
    );
  const risolvi = (type: string, slug: string) =>
    type === "post" && slug === "inox-al-mare"
      ? "post-inox"
      : type === "collection" && slug === "boss"
        ? "collection-boss-it"
        : resolve(type, slug);
  const costruisci = (riga: string, lang = "it") =>
    buildFaqFile(parseFaqFile(conRiga(riga, lang)).file!, ["Fontealta", "Boss"], risolvi, {
      route: "/collezioni/[slug]",
      ref: "collection-boss-it",
    });
  const problemi = (r: ReturnType<typeof costruisci>) => r.items[0].problems.map((p) => p.message);

  it("percorso e testo diventano il campo, con la referenza quando la rotta ha uno slug", () => {
    const r = costruisci(
      "approfondisci: /doccia-da-esterno | Approfondisci: la guida alla doccia da esterno",
    );
    expect(r.built[0].deepDive).toEqual({
      route: "/doccia-da-esterno",
      label: "Approfondisci: la guida alla doccia da esterno",
    });
    const p = costruisci("approfondisci: /blog/inox-al-mare | Perché l’acciaio inox dura al mare");
    expect(p.built[0].deepDive).toEqual({
      route: "/blog/[slug]",
      reference: { _type: "reference", _ref: "post-inox" },
      label: "Perché l’acciaio inox dura al mare",
    });
    expect(problemi(p).filter((m) => m.includes("Approfondisci"))).toEqual([]);
  });

  it("errori: due righe, testo assente, percorso ignoto, slug che non c'è, la pagina stessa", () => {
    const due = costruisci(
      "approfondisci: /doccia-da-esterno | La guida alla doccia\napprofondisci: /finiture | Le finiture del catalogo",
    );
    expect(problemi(due)).toContain("2 righe «approfondisci:», al più una");
    expect(problemi(costruisci("approfondisci: /doccia-da-esterno"))).toContain(
      "«Approfondisci» senza testo del link",
    );
    expect(
      problemi(costruisci("approfondisci: /en/outdoor-shower | The outdoor shower guide")).join(),
    ).toMatch(/percorso non riconosciuto/);
    expect(
      problemi(costruisci("approfondisci: /blog/nessuno | Un post che non esiste")).join(),
    ).toMatch(/nessun post con slug «nessuno»/);
    expect(
      problemi(costruisci("approfondisci: /collezioni/boss | La collezione Boss intera")),
    ).toContain("«Approfondisci» punta alla pagina stessa");
    // Una domanda con un errore non blocca, ma il file non si scrive (decideFaqWrite conta gli errori).
    expect(
      costruisci("approfondisci: /doccia-da-esterno").items[0].problems.some(
        (p) => p.level === "error",
      ),
    ).toBe(true);
  });

  it("avviso se la stessa pagina è già linkata nel testo della risposta", () => {
    const r = costruisci("approfondisci: /modello/b40l | La scheda della colonna B40L");
    const p = r.items[0].problems.find((x) => /già linkata nel testo/.test(x.message));
    expect(p?.level).toBe("warning");
  });

  it("il testo: da 3 a 12 parole, niente em dash, apostrofo tipografico, NBSP in francese", () => {
    const msg = (riga: string, lang?: string) => problemi(costruisci(riga, lang)).join(" | ");
    expect(msg("approfondisci: /doccia-da-esterno | Leggi qui")).toMatch(/2 parole/);
    expect(
      msg(
        "approfondisci: /doccia-da-esterno | una due tre quattro cinque sei sette otto nove dieci undici dodici tredici",
      ),
    ).toMatch(/13 parole/);
    expect(msg("approfondisci: /doccia-da-esterno | La guida — doccia da esterno")).toMatch(
      /em dash/,
    );
    expect(msg("approfondisci: /doccia-da-esterno | Tutto sull'acqua all'aperto")).toMatch(
      /apostrofo dritto/,
    );
    expect(
      msg("approfondisci: /doccia-da-esterno | Le guide : la douche extérieure", "fr"),
    ).toMatch(/spazio unificatore/);
    expect(
      msg("approfondisci: /doccia-da-esterno | Le guide : la douche extérieure", "fr"),
    ).not.toMatch(/spazio unificatore/);
  });

  it("l'impronta di una domanda senza «Approfondisci» non cambia, e con il campo sì", () => {
    const senza = buildFaqFile(parseFaqFile(FILE).file!, ["Fontealta", "Boss"], risolvi).built[0];
    // Il campo assente (com'è su Sanity per ogni domanda di oggi) dà l'impronta di prima.
    expect(contentHash({ ...senza, deepDive: undefined })).toBe(senza.loadedHash);
    expect(
      contentHash({ question: senza.question, keyword: senza.keyword, answer: senza.answer }),
    ).toBe(senza.loadedHash);
    const con = costruisci("approfondisci: /doccia-da-esterno | La guida alla doccia da esterno")
      .built[0];
    expect(con.loadedHash).not.toBe(senza.loadedHash);
    expect(textHash(con)).not.toBe(textHash(senza));
  });
});
