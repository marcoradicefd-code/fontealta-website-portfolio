import { describe, expect, it } from "vitest";

import {
  campiLocalizzati,
  BANDA,
  blocking,
  LENGTH_WARNING_LOCALES,
  rapportoAccettabile,
  SCARTO_ASSOLUTO_AMMESSO,
  sembraNonTradotto,
  SOGLIA_PAROLE,
  SPIE_ITALIANE,
  SPY_WORD_EXCLUSIONS,
  controlla,
  daTradurre,
  firmaBlocco,
  foglieMessaggi,
  parole,
  perIlTraduttore,
  spyWordsFor,
  testoBlocco,
  wordsIdenticalToSource,
} from "./lib";

/**
 * ⚠️ **Dati finti, e nessuna riga che parli con Sanity.** `lib.ts` non importa
 * `@sanity/client`, quindi questi test girano senza rete, senza token e senza
 * dataset — e non possono scrivere niente nemmeno per sbaglio. È la ragione per
 * cui la parte che decide se una traduzione si può scrivere sta separata dai
 * comandi invece che dentro.
 */

const blocco = (key: string, testo: string, extra: Record<string, unknown> = {}) => ({
  _key: key,
  _type: "block",
  style: "normal",
  markDefs: [],
  children: [{ _key: `${key}s`, _type: "span", marks: [], text: testo }],
  ...extra,
});

describe("campiLocalizzati", () => {
  it("trova i campi localizzati a qualsiasi profondità", () => {
    const doc = {
      _id: "x",
      _type: "post",
      code: "B40L",
      title: { _type: "localizedString", it: "Titolo", en: "Title" },
      seo: { metaTitle: { it: "T", en: "T2" }, ogImage: { asset: { _ref: "image-x" } } },
    };
    expect(
      campiLocalizzati(doc)
        .map((c) => c.path)
        .sort(),
    ).toEqual(["seo.metaTitle", "title"]);
  });

  it("NON scambia per localizzato un oggetto che ha anche altre chiavi", () => {
    // Il difetto: `{ it: ..., href: ... }` verrebbe esportato come traduzione, e
    // l'import ci scriverebbe sopra.
    const doc = { link: { it: "/chi-siamo", href: "/about" } };
    expect(campiLocalizzati(doc)).toEqual([]);
  });

  it("scende negli array di oggetti", () => {
    const doc = { sezioni: [{ titolo: { it: "Uno", en: "One" } }, { titolo: { it: "Due" } }] };
    expect(campiLocalizzati(doc).map((c) => c.path)).toEqual([
      "sezioni.0.titolo",
      "sezioni.1.titolo",
    ]);
  });

  it("ignora i campi di sistema", () => {
    expect(
      campiLocalizzati({ _updatedAt: { it: "x" }, nome: { it: "y" } }).map((c) => c.path),
    ).toEqual(["nome"]);
  });
});

describe("controlla · stringhe", () => {
  it("una traduzione buona non dà problemi", () => {
    expect(controlla("name", "Colonna doccia", "Shower column")).toEqual([]);
  });

  it("coglie la traduzione vuota", () => {
    expect(controlla("name", "Colonna", "  ")[0].messaggio).toContain("vuota");
  });

  it("coglie una parola italiana residua", () => {
    const p = controlla("name", "Il corpo della doccia", "The body della shower");
    expect(p.map((x) => x.messaggio).join(" ")).toContain("della");
  });

  it("coglie la description SEO oltre il limite", () => {
    const p = controlla("seo.metaDescription", "corto", "x".repeat(171));
    expect(p[0].messaggio).toContain("171 caratteri");
    expect(controlla("seo.metaDescription", "corto", "x".repeat(170))).toEqual([]);
  });

  it("non applica il limite SEO a un campo che non è SEO", () => {
    expect(controlla("description", "corto", "x".repeat(300))).toEqual([]);
  });
});

describe("controlla · portable text", () => {
  const originale = [blocco("a", "Una doccia in acciaio inox"), blocco("b", "Resiste al mare")];

  it("una traduzione fedele non dà problemi", () => {
    const tradotto = [blocco("a", "A stainless steel shower"), blocco("b", "It resists the sea")];
    expect(controlla("body", originale, tradotto)).toEqual([]);
  });

  /**
   * ⚠️ **Il caso per cui questo controllo esiste, e quello che ha smontato il
   * primo disegno.** «Resiste al mare» non contiene NESSUNA parola funzionale
   * italiana, quindi le parole-spia non lo vedono; e un blocco lasciato in
   * italiano ha rapporto parole esattamente 1,00, che il controllo del rapporto
   * approva. Passava entrambi i filtri. Lo coglie solo il confronto col testo
   * originale.
   */
  it("coglie il blocco SALTATO, che è il difetto tipico", () => {
    const tradotto = [blocco("a", "A stainless steel shower"), blocco("b", "Resiste al mare")];
    const p = controlla("body", originale, tradotto);
    expect(p.some((x) => x.blocco === 1 && x.messaggio.includes("saltato"))).toBe(true);
  });

  it("coglie anche un blocco saltato che contiene parole-spia", () => {
    const orig = [blocco("a", "Il corpo della doccia resiste anche dopo dieci inverni")];
    const p = controlla("body", orig, [
      blocco("a", "Il corpo della doccia resiste anche dopo dieci inverni"),
    ]);
    expect(p.length).toBeGreaterThan(0);
  });

  it("NON grida su un blocco che è un codice, identico per forza", () => {
    // «B40L · AISI 316» è uguale in ogni lingua: non c'è niente da tradurre.
    expect(
      controlla("body", [blocco("a", "B40L · AISI 316")], [blocco("a", "B40L · AISI 316")]),
    ).toEqual([]);
  });

  it("coglie il numero di blocchi diverso", () => {
    expect(controlla("body", originale, [blocco("a", "One")])[0].messaggio).toContain("blocchi");
  });

  it("coglie la `_key` cambiata: la struttura non si tocca", () => {
    const tradotto = [blocco("ZZZ", "A shower"), blocco("b", "It resists the sea")];
    const p = controlla("body", originale, tradotto);
    expect(p.some((x) => x.messaggio.includes("struttura diversa"))).toBe(true);
  });

  it("coglie un `mark` perso: un grassetto resta un grassetto", () => {
    const conMark = [
      {
        ...blocco("a", "Una doccia"),
        children: [{ _key: "as", _type: "span", marks: ["strong"], text: "Una doccia" }],
      },
    ];
    const senzaMark = [
      {
        ...blocco("a", "A shower"),
        children: [{ _key: "as", _type: "span", marks: [], text: "A shower" }],
      },
    ];
    expect(
      controlla("body", conMark, senzaMark).some((x) => x.messaggio.includes("struttura")),
    ).toBe(true);
  });

  it("coglie le `_key` ripetute", () => {
    const p = controlla("body", originale, [blocco("a", "One"), blocco("a", "Two")]);
    expect(p.some((x) => x.messaggio.includes("_key ripetute"))).toBe(true);
  });

  it("coglie il blocco troppo corto", () => {
    // 5 parole che diventano 1: oltre le 3 di scarto ammesse sui blocchi corti.
    const corto = [blocco("a", "Shower"), blocco("b", "It resists the sea")];
    const p = controlla("body", originale, corto);
    expect(p.some((x) => x.blocco === 0 && x.messaggio.includes("scarto"))).toBe(true);
  });

  /**
   * ⚠️ **La banda 0,85-1,15 su un blocco corto respinge le traduzioni GIUSTE.**
   * Misurato: «Una doccia in acciaio inox» (5) → «A stainless steel shower» (4)
   * dà 0,80; «Resiste al mare» (3) → «It resists the sea» (4) dà 1,33. Con la
   * banda applicata a tutto, lo strumento avrebbe bloccato due traduzioni
   * corrette su due. Sotto le 12 parole si guarda lo scarto assoluto.
   */
  it("le traduzioni corte e corrette passano", () => {
    const tradotto = [blocco("a", "A stainless steel shower"), blocco("b", "It resists the sea")];
    expect(controlla("body", originale, tradotto)).toEqual([]);
  });

  it("sui blocchi lunghi il rapporto torna a valere", () => {
    const lungo = "parola ".repeat(40).trim();
    const meta = "word ".repeat(20).trim();
    const p = controlla("body", [blocco("a", lungo)], [blocco("a", meta)]);
    expect(p.some((x) => x.messaggio.includes("banda"))).toBe(true);
  });

  it("un blocco senza testo nell'originale non pretende parole nella traduzione", () => {
    // Un blocco vuoto esiste: un separatore, un'immagine. Dividere per zero
    // darebbe `Infinity` e un falso allarme su ogni documento che ne ha uno.
    const vuoti = [blocco("a", "")];
    expect(controlla("body", vuoti, [blocco("a", "")])).toEqual([]);
  });
});

describe("strumenti di supporto", () => {
  it("testoBlocco concatena gli span in ordine", () => {
    expect(
      testoBlocco({
        children: [{ text: "Acciaio " }, { text: "inox" }],
      }),
    ).toBe("Acciaio inox");
  });

  it("firmaBlocco ignora il testo e guarda la struttura", () => {
    expect(firmaBlocco(blocco("a", "uno"))).toBe(firmaBlocco(blocco("a", "one")));
    expect(firmaBlocco(blocco("a", "uno"))).not.toBe(firmaBlocco(blocco("b", "uno")));
  });

  it("parole conta zero su una stringa vuota", () => {
    expect(parole("   ")).toBe(0);
    expect(parole("una doccia in acciaio")).toBe(4);
  });
});

describe("daTradurre", () => {
  const en = { nav: { home: "Home", blog: "Blog" }, hero: { titolo: "Steel and Colour" } };

  it("elenca le chiavi ancora identiche all'inglese, fuori dalle ammesse", () => {
    const de = { nav: { home: "Home", blog: "Blog" }, hero: { titolo: "Steel and Colour" } };
    expect(daTradurre(en, de, new Set(["nav.home", "nav.blog"]))).toEqual(["hero.titolo"]);
  });

  it("una lingua tradotta non ha niente da tradurre", () => {
    const de = { nav: { home: "Start", blog: "Blog" }, hero: { titolo: "Stahl und Farbe" } };
    expect(daTradurre(en, de, new Set(["nav.blog"]))).toEqual([]);
  });

  it("foglieMessaggi scende negli array", () => {
    const m = foglieMessaggi({ privacy: { sections: [{ heading: "Uno", body: "Testo" }] } });
    expect([...m.keys()]).toEqual(["privacy.sections.0.heading", "privacy.sections.0.body"]);
  });
});

describe("le due regole che il primo disegno aveva sbagliato", () => {
  it("rapportoAccettabile: passa lo scarto entro tre parole OPPURE la banda", () => {
    expect(rapportoAccettabile(5, 4), "5 → 4 è una traduzione normale").toBe(true);
    expect(rapportoAccettabile(3, 4), "3 → 4 è una traduzione normale").toBe(true);
    // ⚠️ Il caso che ha fatto cambiare la regola: 11/13 vale 0,846, cioè fuori
    // dalla banda per cinque centesimi di parola. È una traduzione normale.
    expect(rapportoAccettabile(13, 11), "13 → 11 è una traduzione normale").toBe(true);
    expect(rapportoAccettabile(5, 1), "5 → 1 è un blocco perso").toBe(false);
    expect(rapportoAccettabile(40, 20), "metà parole su un blocco lungo").toBe(false);
    expect(rapportoAccettabile(100, 80), "20 parole in meno su 100").toBe(false);
    expect(rapportoAccettabile(40, 38), "40 → 38 è normale").toBe(true);
    expect(rapportoAccettabile(0, 0), "un blocco vuoto non pretende parole").toBe(true);
  });

  it("sembraNonTradotto: vede l'italiano lasciato, non i codici", () => {
    expect(sembraNonTradotto("Resiste al mare", "Resiste al mare")).toBe(true);
    expect(sembraNonTradotto("Resiste al mare", "It resists the sea")).toBe(false);
    expect(sembraNonTradotto("B40L", "B40L"), "un codice").toBe(false);
    expect(sembraNonTradotto("AISI 316", "AISI 316"), "una sigla").toBe(false);
    expect(sembraNonTradotto("Fontealta", "Fontealta"), "un nome proprio").toBe(false);
    expect(sembraNonTradotto("", ""), "il vuoto non è un difetto").toBe(false);
  });
});

/**
 * ⚠️ **Le 20 parole non sono un numero scelto a occhio.** ±3 parole e ±15%
 * coincidono esattamente a `3 / 0,15 = 20`: sopra, ±3 è già dentro la banda;
 * sotto, la banda è più stretta di ±3. Questo test lo dimostra per forza bruta,
 * confrontando la regola a soglia con la forma «±3 OPPURE banda» su ogni coppia
 * fino a 300 parole. Se un giorno qualcuno cambia uno dei tre numeri senza
 * cambiare gli altri due, la soglia smette di essere il punto d'incontro e
 * questo test lo dice.
 */
describe("la soglia delle 20 parole è il punto in cui i due criteri si incontrano", () => {
  const oppure = (o: number, t: number) =>
    o === 0 ||
    Math.abs(t - o) <= SCARTO_ASSOLUTO_AMMESSO ||
    (t / o >= BANDA.min && t / o <= BANDA.max);

  it("soglia e forma «±3 oppure banda» danno lo stesso verdetto, sempre", () => {
    const diverse: Array<[number, number]> = [];
    for (let o = 0; o <= 300; o++)
      for (let t = 0; t <= 300; t++)
        if (rapportoAccettabile(o, t) !== oppure(o, t)) diverse.push([o, t]);
    expect(
      diverse,
      `coppie in cui i due criteri divergono: ${diverse.slice(0, 5).join(" · ")}`,
    ).toEqual([]);
  });

  it("la soglia vale davvero `scarto / (1 - banda.min)`", () => {
    // ⚠️ `toBeCloseTo` e non `toBe`: `1 - 0.85` in virgola mobile fa
    // `0.15000000000000002`, quindi il rapporto esce `19.999999999999996`. Una
    // uguaglianza esatta fra numeri derivati è un'asserzione fragile che
    // fallisce per una ragione che non c'entra con quello che si vuole provare.
    expect(SCARTO_ASSOLUTO_AMMESSO / (1 - BANDA.min)).toBeCloseTo(SOGLIA_PAROLE, 9);
    expect(SCARTO_ASSOLUTO_AMMESSO / (BANDA.max - 1)).toBeCloseTo(SOGLIA_PAROLE, 9);
  });
});

/**
 * ⚠️ **I controlli per lingua del 14/09/2026, sui casi veri che li hanno fatti nascere.**
 * Le frasi dei test sono quelle delle traduzioni T2, non esempi inventati: se un giorno un
 * controllo torna a bloccarle, il test dice quale caso reale si è rotto.
 */
describe("controlli per lingua", () => {
  // ⚠️ Elenco scritto QUI e non letto da `LENGTH_WARNING_LOCALES`: un ciclo sulla costante
  // passava a vuoto con la costante svuotata (provato il 14/09: un solo test rosso su due).
  const IN_AVVISO = ["de", "fr", "es"] as const;
  const lungo = "parola ".repeat(40).trim();
  const meta = "word ".repeat(20).trim();

  it("la lunghezza fuori banda BLOCCA senza lingua e per l'inglese", () => {
    for (const lingua of [undefined, "en"] as const) {
      const p = controlla("body", [blocco("a", lungo)], [blocco("a", meta)], lingua);
      expect(
        blocking(p).some((x) => x.messaggio.includes("banda")),
        String(lingua),
      ).toBe(true);
    }
  });

  it("per DE/FR/ES la lunghezza è un AVVISO, e porta i numeri", () => {
    expect([...LENGTH_WARNING_LOCALES].sort()).toEqual([...IN_AVVISO].sort());
    for (const lingua of IN_AVVISO) {
      const p = controlla("body", [blocco("a", lungo)], [blocco("a", meta)], lingua);
      expect(blocking(p), lingua).toEqual([]);
      expect(p.find((x) => x.severity === "warning")?.messaggio, lingua).toContain(
        "40 parole diventano 20",
      );
    }
  });

  it("il corpo a incasso tedesco accorciato dai composti passa, con l'avviso", () => {
    // W3P.INC: 8 parole italiane, 4 tedesche. Fedele, e fuori dallo scarto di 3.
    const it = [blocco("a", "Corpo incasso per batteria lavabo a 3 fori")];
    const de = [blocco("a", "UP-Teil für 3-Loch Waschtischbatterie")];
    expect(blocking(controlla("description", it, de, "de"))).toEqual([]);
    expect(blocking(controlla("description", it, de, "en")).length).toBeGreaterThan(0);
  });

  it("struttura e blocco saltato bloccano anche in DE/FR/ES", () => {
    const orig = [blocco("a", "Resiste al mare")];
    for (const lingua of IN_AVVISO) {
      expect(
        blocking(controlla("body", orig, [blocco("a", "Resiste al mare")], lingua)).length,
      ).toBe(1);
      expect(
        blocking(controlla("body", orig, [blocco("ZZZ", "Résiste à la mer")], lingua)).some((x) =>
          x.messaggio.includes("struttura"),
        ),
      ).toBe(true);
    }
  });

  it("«viene» è spagnolo: non blocca in ES, blocca in FR", () => {
    const it = [blocco("a", "Il cliente viene a Viareggio per vedere la produzione")];
    const es = [blocco("a", "El cliente viene a Viareggio para ver la producción")];
    expect(blocking(controlla("body", it, es, "es"))).toEqual([]);
    expect(
      blocking(controlla("body", it, es, "fr")).some((x) => x.messaggio.includes("«viene»")),
    ).toBe(true);
  });

  it("spyWordsFor toglie solo le esclusioni della lingua", () => {
    expect(spyWordsFor("es")).not.toContain("viene");
    expect(spyWordsFor("de")).toEqual(SPIE_ITALIANE);
    expect(spyWordsFor()).toEqual(SPIE_ITALIANE);
  });

  it("le esclusioni sono parole-spia vere, e l'inglese non è fra le lingue in avviso", () => {
    // Un'esclusione che non sta fra le spie non esclude niente: è una voce morta.
    for (const [lingua, escluse] of Object.entries(SPY_WORD_EXCLUSIONS))
      for (const w of escluse ?? []) expect(SPIE_ITALIANE, `${lingua} · ${w}`).toContain(w);
    expect(LENGTH_WARNING_LOCALES).not.toContain("en");
    expect(LENGTH_WARNING_LOCALES).not.toContain("it");
  });

  it("vede la parola italiana lasciata che le spie non vedono: «premiscelata»", () => {
    const it = [
      blocco(
        "a",
        "Corpo incasso acciaio inox Aisi 316 per articoli freestanding, acqua fredda o premiscelata",
      ),
    ];
    const fr = [
      blocco(
        "a",
        "Corps encastré acier inox Aisi 316 pour articles freestanding, eau froide ou premiscelata",
      ),
    ];
    const p = controlla("description", it, fr, "fr");
    expect(blocking(p)).toEqual([]);
    expect(p.find((x) => x.severity === "warning")?.messaggio).toBe(
      "parole identiche all'italiano: premiscelata",
    );
  });

  it("wordsIdenticalToSource: prestiti, nomi propri e parole corte non contano", () => {
    expect(wordsIdenticalToSource("mit 1 uscita", "mit 1 uscita")).toEqual(["uscita"]);
    expect(wordsIdenticalToSource("per articoli freestanding", "für freestanding Artikel")).toEqual(
      [],
    );
    expect(wordsIdenticalToSource("a Viareggio dal 1999", "à Viareggio depuis 1999")).toEqual([]);
    expect(wordsIdenticalToSource("il mare", "the mare")).toEqual([]);
  });

  it("wordsIdenticalToSource ordina in ordine alfabetico italiano, accenti compresi", () => {
    // ⚠️ Segnalato da Sonar su #187 (lib.ts, affidabilità). Il `sort()` senza confronto
    // ordina per codice UTF-16 e mette «à» dopo la «z»: dava «cittadino, città». Sulle
    // traduzioni T2 del 14/09 non si vedeva, perché nessuna parola in comune era accentata.
    expect(wordsIdenticalToSource("la città e il cittadino", "la città et le cittadino")).toEqual([
      "città",
      "cittadino",
    ]);
  });
});

describe("perIlTraduttore", () => {
  it("lascia fuori le FAQ, in cima e dentro un oggetto, e tiene il resto", () => {
    const doc = {
      tagline: { it: "Uno" },
      faq: { it: [{ _key: "a", question: "Domanda?" }] },
      seo: { metaTitle: { it: "Titolo" } },
      pagina: { faq: { it: [] } },
    };
    expect(perIlTraduttore(campiLocalizzati(doc)).map((c) => c.path)).toEqual([
      "tagline",
      "seo.metaTitle",
    ]);
  });
});
