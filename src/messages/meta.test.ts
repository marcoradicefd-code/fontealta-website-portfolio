import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { ACTIVE_LOCALES } from "@/i18n/routing";
import { fitsTitle, modelHead } from "@/lib/meta-title";
import { titoloOg } from "@/lib/open-graph";

import de from "./de.json";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import itMessages from "./it.json";

/**
 * Guardie sui title e sulle description delle pagine.
 *
 * ⚠️ Le description sono l'unico copy del sito che **nessuno vede lavorando**:
 * non stanno in pagina, stanno in un tag. Un template che cresce oltre il
 * troncamento di Google, o che perde la parità fra le lingue, o che ripete il
 * codice del modello, non si nota guardando il sito: si nota in SERP, settimane
 * dopo. Questi test sono il posto in cui vengono guardati.
 *
 * ⚠️ Le stringhe si rendono con `createTranslator`, cioè con il **motore ICU
 * vero** di next-intl. Sostituire i segnaposto a mano vorrebbe dire riscrivere
 * la logica dei plurali nel banco di prova, e misurare quella invece di questa.
 */

/** Tutte le lingue accese, non «it ed en» scritte a mano: una lingua che si accende
 *  senza il suo copy deve rompere qui, non in SERP settimane dopo. */
const LINGUE = { it: itMessages, en, de, fr, es } as const;

/** Google tronca la description intorno ai 155-160 caratteri: oltre, la coda si
 *  perde. Il title si tronca molto prima, e il layout ci aggiunge «| Fontealta». */
const MAX_DESCRIPTION = 155;
const MAX_TITLE = 60;
const SUFFISSO_LAYOUT = " | Fontealta".length;

/** I valori peggiori misurati sul dataset il 9/09/2026: il nome modello più
 *  lungo è «Accessories RE12.AST.FS» (23 caratteri) e sta nella collezione col
 *  titolo più lungo, «Accessories». Non sono inventati: se il catalogo crescerà
 *  oltre, il test va rimisurato, non allentato. */
/**
 * I campioni per lingua, al posto dei ternari `locale === "it" ? … : …` che questo file
 * aveva: con tre lingue accese in più quei ternari servivano l'inglese a tedesco, francese
 * e spagnolo, e il test misurava la lingua sbagliata credendo di misurare la propria.
 * Le parole sono campioni, le stringhe attese sono l'oracolo: si scrivono a mano apposta,
 * perché comporle col template vorrebbe dire provare il template con sé stesso.
 */
/**
 * Le teste più lunghe del catalogo, una per lingua, misurate il 21/09/2026 sui
 * 595 modelli. Sono il caso peggiore vero: se il catalogo crescerà oltre,
 * queste righe si rimisurano, non si allentano.
 */
const TESTA_PIU_LUNGA = {
  it: "Rubinetto temporizzato a pressione acciaio inox Aisi 316 con soffione lavapiedi S03",
  en: "Wall-mounted shower panel with time-limited self-closing tap and concealed showerhead  220x110 mm",
  de: "Duschsäule für den Außenbereich mit 2 selbstschließendem Hahnen und 2 Kopfbrausen S02",
  fr: "Colonne douche d’extérieur avec 2 robinets temporisés et 2 pommes de douche S02",
  es: "Grifo con pulsador temporizado acero inoxidable Aisi 316 con ducha lava pies S03",
} satisfies Record<Lingua, string>;

const CAMPIONI = {
  it: {
    categoria: "doccia",
    subtype: "colonna",
    soloAmbiente: "per doccia",
    composto: "colonna per doccia",
    tipoTitolo: "Colonna per doccia",
  },
  en: {
    categoria: "shower",
    subtype: "column",
    soloAmbiente: "for the shower",
    composto: "shower column",
    tipoTitolo: "Shower column",
  },
  de: {
    categoria: "Dusche",
    subtype: "Säule",
    soloAmbiente: "für Dusche",
    composto: "Säule für Dusche",
    tipoTitolo: "Säule für Dusche",
  },
  fr: {
    categoria: "douche",
    subtype: "colonne",
    soloAmbiente: "pour douche",
    composto: "colonne pour douche",
    tipoTitolo: "Colonne pour douche",
  },
  es: {
    categoria: "ducha",
    subtype: "columna",
    soloAmbiente: "para ducha",
    composto: "columna para ducha",
    tipoTitolo: "Columna para ducha",
  },
} satisfies Record<(typeof ACTIVE_LOCALES)[number], Record<string, string>>;

/**
 * Le deroghe al limite, oggi **nessuna**.
 *
 * Il 21/09/2026 ce n'erano tre — `fr.collezioni.metaDescription` a 165, `es.collezioni` a 156,
 * `es.home.metaTitle` a 70 — trovate proprio allargando questa guardia da due lingue a cinque,
 * e **tolte lo stesso giorno** quando Marco ha accorciato il copy (152, 135, 59). La lista ha
 * funzionato come doveva: al cambio del copy i tre test sono diventati rossi dicendo di
 * togliere la riga, invece di restare verdi su una deroga ormai falsa.
 *
 * Se ne serve una nuova, si scrive qui col numero MISURATO: il test pretende che la deroga sia
 * ancora necessaria e che il numero combaci, così non può sopravvivere alla cosa che deroga.
 */
const ECCEZIONI_DA_ACCORCIARE: Record<string, number> = {};

/**
 * Il tipo di prodotto più lungo che quella lingua sa comporre, MISURATO sui dizionari
 * invece che scritto a mano: prima erano due stringhe italiane e inglesi fisse, e per le
 * altre tre lingue avrebbero misurato l'inglese. Se un sottotipo nuovo allunga il peggiore,
 * il test lo prende da solo.
 */
function tipoPiuLungo(locale: Lingua): string {
  const d = LINGUE[locale] as unknown as {
    productCategories: Record<string, string>;
    productSubtypes: Record<string, string>;
    modello: { tipo: string };
  };
  const componi = (subtype: string, categoria: string) =>
    d.modello.tipo.replace("{subtype}", subtype).replace("{categoria}", categoria);
  const tutte = Object.values(d.productSubtypes).flatMap((sub) =>
    Object.values(d.productCategories).map((cat) => componi(sub, cat)),
  );
  return tutte.reduce((a, b) => (b.length > a.length ? b : a));
}

/**
 * Il limite, con le tre eccezioni misurate.
 *
 * ⚠️ L'eccezione deve restare NECESSARIA: se la stringa viene accorciata, o allungata
 * ancora, il numero non combacia più e il test fallisce lo stesso. Una lista di deroghe
 * che sopravvive alla cosa che deroga è il modo in cui un difetto diventa permanente.
 */
function entroIlLimite(chiave: string, lunghezza: number, massimo: number): void {
  const deroga = ECCEZIONI_DA_ACCORCIARE[chiave];
  if (deroga === undefined) {
    expect(lunghezza, `${chiave} supera ${massimo}`).toBeLessThanOrEqual(massimo);
    return;
  }
  expect(
    lunghezza,
    `${chiave} è in ECCEZIONI_DA_ACCORCIARE a ${deroga}: se il copy è cambiato, aggiorna o togli la riga`,
  ).toBe(deroga);
  expect(deroga, `${chiave} non supera più ${massimo}: togli l'eccezione`).toBeGreaterThan(massimo);
}

const NOME_PEGGIORE = "Accessories RE12.AST.FS";
const COLLEZIONE_PEGGIORE = "Accessories";
const CODICE_PEGGIORE = "RE12.AST.FS";

type Lingua = keyof typeof LINGUE;

/**
 * Un helper per namespace, e non uno solo con il namespace come parametro: il
 * tipo `NamespaceKeys` di next-intl vuole un LETTERALE, e con `string` il
 * typecheck cade. Vitest non se ne accorgerebbe (non typecheck-a), `tsc` sì.
 */
const tModello = (locale: Lingua) =>
  createTranslator({ locale, messages: LINGUE[locale], namespace: "modello" });
const tDettaglio = (locale: Lingua) =>
  createTranslator({ locale, messages: LINGUE[locale], namespace: "dettaglio" });
const tCorpi = (locale: Lingua) =>
  createTranslator({ locale, messages: LINGUE[locale], namespace: "corpiIncasso" });
const tHome = (locale: Lingua) =>
  createTranslator({ locale, messages: LINGUE[locale], namespace: "home" });
const tCollezioni = (locale: Lingua) =>
  createTranslator({ locale, messages: LINGUE[locale], namespace: "collezioni" });
const tOfficina = (locale: Lingua) =>
  createTranslator({ locale, messages: LINGUE[locale], namespace: "officina" });

describe("copy dei metadata · parità e tipografia", () => {
  it("ogni namespace ha lo stesso insieme di chiavi meta in IT e EN", () => {
    // Una chiave presente da un lato solo non rompe il build: rompe il tag in
    // una lingua sola, e solo a runtime.
    const chiaviMeta = (m: Record<string, unknown>) =>
      Object.entries(m)
        .filter(([, v]) => v && typeof v === "object")
        .flatMap(([ns, v]) =>
          Object.keys(v as Record<string, unknown>)
            .filter((k) => k.startsWith("meta"))
            .map((k) => `${ns}.${k}`),
        )
        .sort();
    expect(chiaviMeta(itMessages)).toEqual(chiaviMeta(en));
  });

  it("nessuna em dash e nessun apostrofo ASCII nel copy dei metadata", () => {
    // L'em dash è vietata nel copy (il LOCK di CLAUDE.md copre `product-label.ts`
    // e `model-hero.tsx`, non questo), e l'apostrofo è quello tipografico.
    for (const [locale, messaggi] of Object.entries(LINGUE)) {
      for (const [ns, valori] of Object.entries(messaggi)) {
        if (!valori || typeof valori !== "object") continue;
        for (const [chiave, testo] of Object.entries(valori as Record<string, unknown>)) {
          if (!chiave.startsWith("meta") || typeof testo !== "string") continue;
          expect(testo, `${locale}.${ns}.${chiave} contiene una em dash`).not.toMatch(/[—–]/);
          expect(testo, `${locale}.${ns}.${chiave} usa l'apostrofo ASCII`).not.toContain("'");
        }
      }
    }
  });
});

describe("scheda modello", () => {
  for (const locale of ACTIVE_LOCALES) {
    describe(locale, () => {
      const t = tModello(locale);

      it("non ripete il codice: compare una volta sola", () => {
        // È la regressione da cui nasce questo template. Il precedente componeva
        // `${nome} — ${codice}`, e `nome` è già «collezione + codice» sul dato
        // vivo: «Boss B40L — B40L».
        const testo = t("metaDescription", {
          nome: "Boss B40L",
          collezione: "Boss",
          finiture: 4,
        });
        expect(testo.match(/B40L/g)).toHaveLength(1);
      });

      it.each([0, 1, 4, 8])("sta sotto i 155 caratteri con %i finiture", (finiture) => {
        const testo = t("metaDescription", {
          nome: NOME_PEGGIORE,
          collezione: COLLEZIONE_PEGGIORE,
          finiture,
        });
        expect(testo.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
      });

      it("con zero finiture non scrive «0 finiture», chiude la frase", () => {
        // 15 modelli su 595 non hanno finiture associate: non è un ramo teorico.
        const testo = t("metaDescription", {
          nome: "Origo Rame C50R",
          collezione: "Origo Rame",
          finiture: 0,
        });
        expect(testo).not.toMatch(/\b0\b/);
        expect(testo.trimEnd().endsWith(".")).toBe(true);
      });

      it("con una finitura usa il singolare", () => {
        // 36 modelli su 595.
        const testo = t("metaDescription", {
          nome: "Yacht BW50.YCWS.M",
          collezione: "Yacht",
          finiture: 1,
        });
        expect(testo).not.toMatch(/\b1 fin/);
      });

      /** La frase di tipo, composta come la compone la pagina: etichette in
       *  minuscolo e iniziale maiuscola — tranne in tedesco, dove i sostantivi
       *  restano maiuscoli (`label-in-sentence.ts`). */
      const tipo = CAMPIONI[locale].tipoTitolo;

      it("la variante col tipo non nomina la collezione", () => {
        // Su 553 modelli su 595 il nome comincia col nome della collezione, e
        // ripeterla era il difetto: «Boss B40L, dalla collezione Boss». Al suo
        // posto entra il tipo di prodotto, che è informazione nuova.
        const testo = t("metaDescriptionTipo", { nome: "Boss B40L", tipo, finiture: 4 });
        expect(testo.match(/Boss/g)).toHaveLength(1);
        expect(testo.match(/B40L/g)).toHaveLength(1);
      });

      it.each([0, 1, 4, 8])(
        "la variante col tipo sta sotto i 155 caratteri con %i finiture",
        (finiture) => {
          const testo = t("metaDescriptionTipo", {
            nome: NOME_PEGGIORE,
            // Il tipo più lungo del catalogo, composto: «Accessori colonna per
            // doccia», EN «Shower column accessories».
            tipo: tipoPiuLungo(locale),
            finiture,
          });
          expect(testo.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
        },
      );

      it("il tipo apre la frase e non c'è nessuna em dash", () => {
        // ⚠️ La pill unisce le stesse due etichette con ` — `, e quel separatore
        // è LOCKED. Qui è copy, e l'em dash non ci deve entrare.
        const testo = t("metaDescriptionTipo", { nome: "Club C90.M", tipo, finiture: 4 });
        expect(testo.startsWith(`Club C90.M. ${tipo} `)).toBe(true);
        expect(testo).not.toMatch(/[—–]/);
      });

      it("l'ambiente da solo resta preposizionale, mai soggetto", () => {
        // Senza sottotipo la frase deve dire «per doccia», non «Doccia»: la
        // seconda direbbe che il prodotto È una doccia invece che un pezzo per
        // la doccia. Oggi non capita, 0 modelli su 595, ma la forma è quella.
        const solo = t("tipoSoloAmbiente", { categoria: CAMPIONI[locale].categoria });
        expect(solo).toBe(CAMPIONI[locale].soloAmbiente);
        // La forma sbagliata è l'etichetta nuda: «Doccia», «Dusche», che direbbe che il
        // prodotto È una doccia invece che un pezzo per la doccia.
        expect(solo).not.toBe(CAMPIONI[locale].categoria);
      });

      it("l'ordine delle due etichette dipende dalla lingua", () => {
        // È la ragione per cui la frase sta in `messages` e non si concatena nel
        // codice: l'italiano mette prima il sottotipo, l'inglese la macro.
        const composto = t("tipo", {
          subtype: CAMPIONI[locale].subtype,
          categoria: CAMPIONI[locale].categoria,
        });
        expect(composto).toBe(CAMPIONI[locale].composto);
      });

      /**
       * ⚠️ **Il caso peggiore vero del catalogo**, non uno inventato: il nome più
       * lungo dei 595 modelli insieme alla testa più lunga della sua lingua,
       * misurate il 21/09/2026. Con il tetto fisso a 38 caratteri che il prompt
       * proponeva, questo test sarebbe nato rosso in quattro lingue su cinque —
       * 76 caratteri in tedesco — ed è la ragione per cui il budget è adattivo.
       */
      it("il title del modello sta nei 60 col nome e la testa più lunghi del catalogo", () => {
        const testa = modelHead(
          NOME_PEGGIORE,
          [{ children: [{ text: TESTA_PIU_LUNGA[locale] }] }],
          locale,
        );
        const titolo = testa ? t("metaTitle", { nome: NOME_PEGGIORE, testa }) : NOME_PEGGIORE;
        expect(titolo.length + SUFFISSO_LAYOUT, `${locale}: «${titolo}»`).toBeLessThanOrEqual(
          MAX_TITLE,
        );
      });

      /**
       * La testa o **non c'è**, o è un pezzo che sta in piedi da solo.
       *
       * ⚠️ La testa vuota è un esito LEGITTIMO dal 21/09/2026, non un difetto:
       * quando nessun taglio ammesso — davanti a una preposizione — ci sta nel
       * budget, il titolo torna al solo nome. Succede col nome più lungo del
       * catalogo in inglese e in francese, ed è esattamente il caso che ha
       * fatto nascere la regola: meglio «Accessories RE12.AST.FS» che
       * «Accessories RE12.AST.FS · Selbstschließender».
       */
      it("la testa del modello o non c'è, o finisce su una parola intera", () => {
        const testa = modelHead(
          NOME_PEGGIORE,
          [{ children: [{ text: TESTA_PIU_LUNGA[locale] }] }],
          locale,
        );
        if (!testa) return;
        expect(TESTA_PIU_LUNGA[locale].startsWith(testa)).toBe(true);
        const dopo = TESTA_PIU_LUNGA[locale][testa.length];
        expect([" ", undefined], `${locale}: taglio a metà parola in «${testa}|${dopo}»`).toContain(
          dopo,
        );
      });

      /**
       * ⛔ E soprattutto: il titolo non finisce mai con una parola che ne regge
       * un'altra. È la regola vera, e si misura sul risultato — l'ultima parola
       * della testa non può essere una preposizione.
       */
      it("il title del modello non finisce con una preposizione appesa", () => {
        const testa = modelHead(
          NOME_PEGGIORE,
          [{ children: [{ text: TESTA_PIU_LUNGA[locale] }] }],
          locale,
        );
        if (!testa) return;
        const ultima = testa.split(/\s+/).at(-1)?.toLowerCase() ?? "";
        const REGGENTI = [
          "con",
          "per",
          "da",
          "di",
          "a",
          "in",
          "su",
          "e",
          "with",
          "for",
          "of",
          "and",
          "to",
          "mit",
          "für",
          "aus",
          "und",
          "avec",
          "pour",
          "de",
          "du",
          "des",
          "et",
          "en",
          "para",
          "y",
        ];
        expect(REGGENTI, `${locale}: «${testa}» finisce appesa`).not.toContain(ultima);
      });
    });
  }
});

describe("scheda collezione e scheda corpo", () => {
  for (const locale of ACTIVE_LOCALES) {
    describe(locale, () => {
      it("la description della collezione sta sotto i 155 caratteri", () => {
        const t = tDettaglio(locale);
        // ILLE è la collezione più grande: 65 articoli, 8 finiture.
        expect(
          t("metaDescription", { collezione: "Origo Rame", articoli: 65, finiture: 8 }).length,
        ).toBeLessThanOrEqual(MAX_DESCRIPTION);
      });

      it("la collezione senza finiture non scrive la coda delle finiture", () => {
        // 2 collezioni su 22 (Origo Rame e il contenitore dei corpi).
        const t = tDettaglio(locale);
        const testo = t("metaDescription", { collezione: "Origo Rame", articoli: 5, finiture: 0 });
        expect(testo).not.toMatch(/0 fin/i);
        expect(testo.trimEnd().endsWith(".")).toBe(true);
      });

      it("la description del corpo sta sotto i 155 caratteri ed è localizzata", () => {
        const t = tCorpi(locale);
        const testo = t("metaDescriptionCorpo", { codice: CODICE_PEGGIORE });
        expect(testo.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
        expect(testo).toContain(CODICE_PEGGIORE);
      });
    });
  }

  it("il corpo non serve più copy italiano sulla pagina inglese", () => {
    // Prima title e description erano composti in italiano nel codice e serviti
    // anche su `/en`: «CW.1 · corpo a incasso Fontealta, acciaio AISI 316.»
    const t = tCorpi("en");
    expect(t("metaDescriptionCorpo", { codice: "CW.1" })).not.toMatch(/corpo a incasso/i);
    expect(t("metaTitleCorpo", { codice: "CW.1" })).not.toMatch(/corpi a incasso/i);
  });
});

describe("il title della scheda collezione", () => {
  /**
   * La forma è INVERTITA — «Colonne doccia Boss» — perché mette davanti la
   * parola che si cerca (decisione di Marco, 21/09/2026). La forma di prima,
   * «{Titolo} · {tipi} in acciaio AISI 316», sforava i 60 su tutte e 22 le
   * collezioni: al tipo restavano fra 7 e 21 caratteri e le frasi ne chiedevano
   * 25-29.
   *
   * ⚠️ «Club Large» è il titolo più lungo fra le collezioni che ricevono il
   * tipo: «Corpi a incasso» e «Accessories» dicono già il tipo nel nome e
   * restano soli, per decisione di Marco.
   */
  const TITOLO_PIU_LUNGO = "Club Large";
  /**
   * I PROFILI, non le macro: dal 21/09/2026 la frase distingue anche la
   * collezione che ha colonne doccia *e* rubinetteria da bagno, perché in
   * tedesco il mercato la chiama «Duschsäulen und Standarmaturen».
   */
  const MACRO = ["doccia", "docciaEBagno", "bagno", "cucina", "giardino", "bidet"] as const;

  for (const locale of ACTIVE_LOCALES) {
    describe(locale, () => {
      it("ogni profilo compone un title che sta nei 60, col titolo più lungo", () => {
        const t = tCollezioni(locale);
        for (const macro of MACRO) {
          const tipo = t(`tipoBreve.${macro}` as "tipoBreve.doccia");
          const composto = t("titoloConTipo", { tipo, titolo: TITOLO_PIU_LUNGO });
          expect(fitsTitle(composto), `${locale}/${macro}: «${composto}»`).toBe(true);
          expect(composto.length + SUFFISSO_LAYOUT).toBeLessThanOrEqual(MAX_TITLE);
        }
      });

      it("le frasi brevi ci sono per tutti e sei i profili e non sono vuote", () => {
        // Una macro senza frase darebbe «undefined Boss» in SERP: la parità fra
        // le lingue la tiene `parita.test.ts`, la presenza la tiene questa.
        const t = tCollezioni(locale);
        for (const macro of MACRO) {
          const tipo = t(`tipoBreve.${macro}` as "tipoBreve.doccia");
          expect(tipo.trim().length, `${locale}/${macro}`).toBeGreaterThan(0);
          expect(tipo).not.toMatch(/tipoBreve/);
        }
      });
    });
  }
});

describe("home, archivio collezioni e officina", () => {
  const NAMESPACE = { home: tHome, collezioni: tCollezioni, officina: tOfficina } as const;
  for (const locale of ACTIVE_LOCALES) {
    for (const ns of ["home", "collezioni", "officina"] as const) {
      it(`${locale}.${ns} ha title e description propri, entro i limiti`, () => {
        const t = NAMESPACE[ns](locale);
        const titolo = t("metaTitle");
        const descrizione = t("metaDescription");
        // ⚠️ La HOME porta il marchio DENTRO la stringa, le altre lo ricevono dal
        // `title.template` del layout: quel template non si applica alla pagina
        // dello stesso segmento, ed è documentato da Next. Quindi il budget si
        // conta in due modi diversi, e non è una svista.
        const lunghezza = ns === "home" ? titolo.length : titolo.length + SUFFISSO_LAYOUT;
        if (ns === "home") expect(titolo).toContain("Fontealta");
        entroIlLimite(`${locale}.${ns}.metaTitle`, lunghezza, MAX_TITLE);
        entroIlLimite(`${locale}.${ns}.metaDescription`, descrizione.length, MAX_DESCRIPTION);
        // Non devono essere il default del layout, che è il difetto che chiudono.
        expect(descrizione).not.toBe(
          "Specialisti dell'acciaio. Colonne doccia outdoor. Personalizzazione illimitata. Made in Italy.",
        );
      });
    }
  }

  it("la home inglese non serve la description italiana", () => {
    const it = tHome("it")("metaDescription");
    const enTesto = tHome("en")("metaDescription");
    expect(enTesto).not.toBe(it);
    expect(enTesto).not.toMatch(/acciaio/i);
  });
});

/**
 * `og:title` è il titolo NUDO: LOCK del 10/09/2026, confermato da Marco il 7/10.
 *
 * Il marchio lo porta `og:site_name`, e la fonte è la guida webmaster di
 * Facebook: «og:title: The title of your article without any branding such as
 * your site name». Qui si prova la sola funzione pura che decide il titolo OG
 * delle rotte statiche; quello SERVITO, su cinque pagine per lingua, lo guarda
 * `tests/regression/metadata-indicizzabili.spec.ts`.
 */
describe("og:title è il titolo nudo", () => {
  /** Le rotte statiche che passano da `staticRouteMetadata`, home esclusa. */
  const NAMESPACE_STATICI = [
    "chiSiamo",
    "collezioni",
    "corpiIncasso",
    "contatti",
    "finiture",
    "produzione",
    "referenze",
    "blog",
    "legale",
  ] as const;

  it("una stringa resta com'è: il template del layout non entra", () => {
    expect(titoloOg("Chi siamo")).toBe("Chi siamo");
  });

  it("`{ absolute }` è la home, che porta il marchio apposta e lo tiene", () => {
    const home = "Rubinetteria e colonne doccia inox AISI 316 · Fontealta";
    expect(titoloOg({ absolute: home })).toBe(home);
  });

  it("una forma che non è un titolo non inventa niente", () => {
    expect(titoloOg(undefined)).toBeUndefined();
    expect(titoloOg({ template: "%s | Fontealta" })).toBeUndefined();
  });

  it.each(ACTIVE_LOCALES)("%s: nessun metaTitle statico porta « | Fontealta»", (locale) => {
    for (const namespace of NAMESPACE_STATICI) {
      const t = createTranslator({ locale, messages: LINGUE[locale], namespace });
      expect(titoloOg(t("metaTitle")), `${locale}.${namespace}`).not.toMatch(/\|\s*Fontealta\s*$/);
    }
  });
});
