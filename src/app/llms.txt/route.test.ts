import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ⚠️ **`noIndex` si prova con un mock, non pubblicando niente.** Il filtro vive
 * in GROQ e da qui non si esegue: quello che si può provare è che la rotta
 * stampi ciò che la query le passa e nient'altro. Che il filtro ci sia, e su
 * tutti e due i gruppi, lo asserisce il test strutturale in fondo al file.
 */
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/sanity/lib/client", () => ({ client: { fetch: fetchMock } }));

import { ACTIVE_LOCALES, type Locale } from "@/i18n/routing";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import itMsg from "@/messages/it.json";
import { absoluteUrl } from "@/lib/urls";
import { LLMS_TXT_QUERY } from "@/sanity/lib/queries";

import * as rotta from "./route";

const MESSAGGI: Record<Locale, { nav: { collezioni: string; blog: string } }> = {
  it: itMsg,
  en,
  de,
  fr,
  es,
};

/** Il file diviso per lingua: le sezioni sono separate da `---`, nell'ordine di `ACTIVE_LOCALES`. */
const sezioniDi = (t: string) => t.split("\n---\n");

/** Le righe di elenco sotto un'intestazione `##`, dentro un pezzo di file. */
function elenco(pezzo: string, intestazione: string): string[] {
  const inizio = pezzo.indexOf(`## ${intestazione}\n`);
  if (inizio === -1) return [];
  const dopo = pezzo.slice(inizio + intestazione.length + 4).split("\n");
  const fine = dopo.findIndex((r) => !r.startsWith("- "));
  return dopo.slice(0, fine === -1 ? dopo.length : fine);
}

const COLLEZIONI = Array.from({ length: 22 }, (_, i) => ({
  title: `Collezione ${i + 1}`,
  slug: `collezione-${i + 1}`,
  tagline: null,
}));

const POST = Array.from({ length: 12 }, (_, i) => ({
  titolo: { it: `Post ${i + 1}`, en: `Post ${i + 1} EN` },
  slug: `post-${i + 1}`,
  publishedAt: "2026-07-09T00:00:00Z",
  autore: "Andrea Farnocchia",
}));

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ collections: COLLEZIONI, posts: POST });
});

async function testo() {
  const r = await rotta.GET();
  return { r, t: await r.text() };
}

describe("llms.txt · la risposta", () => {
  it("200 e `text/plain; charset=utf-8`", async () => {
    const { r } = await testo();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });

  it("non si fa mettere in cache, come la sitemap", async () => {
    const { r } = await testo();
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("la rotta è dinamica", () => {
    expect(rotta.dynamic).toBe("force-dynamic");
  });

  it("la query salta la cache dei dati e il CDN di Sanity", async () => {
    await testo();
    const [, , opzioni] = fetchMock.mock.calls[0];
    expect(opzioni).toMatchObject({
      perspective: "published",
      stega: false,
      useCdn: false,
      cache: "no-store",
    });
  });
});

describe("llms.txt · il contenuto", () => {
  it("un solo `# Fontealta`, come vuole la convenzione", async () => {
    const { t } = await testo();
    expect(t.match(/^# /gm)).toHaveLength(1);
    expect(t.startsWith("# Fontealta")).toBe(true);
  });

  /**
   * ⚠️ **Per lingua ATTIVA, con l'intestazione presa dai suoi messaggi**: scritto «Collezioni» e
   * «Collections» a mano, il test passava con due lingue e non diceva niente sulla terza. E si
   * cerca DENTRO la sezione di ogni lingua, perché inglese e francese hanno la stessa parola.
   */
  it("le 22 collezioni compaiono in ogni lingua attiva", async () => {
    const { t } = await testo();
    const sezioni = sezioniDi(t);
    expect(sezioni).toHaveLength(ACTIVE_LOCALES.length);
    ACTIVE_LOCALES.forEach((lingua, i) => {
      expect(elenco(sezioni[i]!, MESSAGGI[lingua].nav.collezioni)).toHaveLength(22);
    });
  });

  it("i 12 post compaiono in ogni lingua attiva", async () => {
    const { t } = await testo();
    const sezioni = sezioniDi(t);
    ACTIVE_LOCALES.forEach((lingua, i) => {
      expect(elenco(sezioni[i]!, MESSAGGI[lingua].nav.blog)).toHaveLength(12);
    });
  });

  /**
   * ⚠️ **Ogni URL, non solo quelli dentro un link markdown.** La prima stesura
   * cercava `](…)` e la controprova rossa non scattava: la sezione «Lingue» e il
   * blocco dei contatti scrivono gli indirizzi **in chiaro**, e un host estraneo
   * lì sarebbe passato inosservato. Una guardia che guarda metà del file dice di
   * aver controllato tutto.
   */
  it("ZERO URL con un host diverso dal nostro, ovunque nel file", async () => {
    const { t } = await testo();
    const host = new Set([...t.matchAll(/https?:\/\/[^\s)\]]+/g)].map((m) => new URL(m[0]).host));
    expect([...host]).toEqual([new URL("https://fontealta.it").host]);
  });

  it("la sezione italiana sta SOPRA quella inglese", async () => {
    const { t } = await testo();
    expect(t.indexOf("## Collezioni")).toBeLessThan(t.indexOf("## Collections"));
  });

  it("l'inglese punta a `/en`, l'italiano no", async () => {
    const { t } = await testo();
    expect(t).toContain("https://fontealta.it/collezioni/collezione-1");
    expect(t).toContain("https://fontealta.it/en/collections/collezione-1");
  });

  it("porta la ragione sociale e la P.IVA, non solo il marchio", async () => {
    const { t } = await testo();
    expect(t).toContain("Rubinetteria F & F L’Artigiana S.r.l.");
    expect(t).toContain("P.IVA IT01718720467");
  });

  it("nessuna misura e nessun prezzo, per decisione", async () => {
    const { t } = await testo();
    expect(t).not.toMatch(/\b\d+\s?(mm|cm)\b/);
    // ⚠️ Parole intere: «EUR» senza confini prende «européen», «europea», «europäisch», e con
    // le lingue accese il test fallirebbe su un aggettivo. Le parole sono quelle delle cinque lingue.
    expect(t).not.toMatch(
      /€|\bEUR\b|\bprezz[oi]\b|\bprices?\b|\bprix\b|\bpreis(e|en)?\b|\bprecios?\b/i,
    );
  });

  it("se la query non torna, restano le pagine ferme e nessun link inventato", async () => {
    fetchMock.mockResolvedValue(null);
    const { r, t } = await testo();
    expect(r.status).toBe(200);
    expect(t).toContain("## Pagine");
    expect(t.match(/^## Collezioni\n((?:- .*\n)+)/m)).toBeNull();
  });

  it("un documento senza slug non produce un link rotto", async () => {
    fetchMock.mockResolvedValue({
      collections: [{ title: "Senza slug", slug: null, tagline: null }],
      posts: [],
    });
    const { t } = await testo();
    expect(t).not.toContain("Senza slug");
  });

  // Le pagine d'uso (c1b): fra le pagine, col titolo della lingua, solo dove c'è.
  it("la pagina d'uso sta fra le pagine delle sole lingue col titolo", async () => {
    fetchMock.mockResolvedValue({
      collections: [],
      posts: [],
      usePages: [
        { code: "outdoor-shower", titoli: { it: "Doccia da esterno", en: "Outdoor shower" } },
      ],
    });
    const { t } = await testo();
    const [it_, en, de] = sezioniDi(t);
    expect(elenco(it_, "Pagine")).toContain(
      `- [Doccia da esterno](${absoluteUrl("it", "/doccia-da-esterno")})`,
    );
    expect(elenco(en, "Pages")).toContain(
      `- [Outdoor shower](${absoluteUrl("en", "/doccia-da-esterno")})`,
    );
    expect(de).not.toMatch(/gartendusche|Doccia da esterno|Outdoor shower/);
  });
});

/**
 * ⚠️ Strutturale, come per la sitemap: il filtro `noIndex` vive in GROQ e da un
 * test unitario non si esegue. Qui si custodisce che ci sia, su tutti e due i
 * gruppi, e che sia la forma esplicita.
 */
describe("llms.txt · noIndex esclude", () => {
  it("il filtro c'è su collezioni, post e pagine d'uso", () => {
    expect(LLMS_TXT_QUERY.split("!(seo.noIndex == true)").length - 1).toBe(3);
  });

  it("la forma è quella esplicita, non `!seo.noIndex`", () => {
    expect(LLMS_TXT_QUERY).not.toContain("!seo.noIndex");
  });
});

/**
 * ⚠️ **Le asserzioni sopra NON provano la derivazione**: con due lingue attive,
 * «it» ed «en» scritti a mano darebbero lo stesso file. Comincerebbero a
 * proteggere il giorno che se ne accende una terza, cioè troppo tardi per
 * accorgersene. L'unico modo di provarlo adesso è cambiare `ACTIVE_LOCALES`
 * sotto il modulo e guardare se il file segue. Stessa forma del test di
 * `availableLanguage` nel JSON-LD.
 *
 * ⚠️ La lingua senza messaggi è **`xx`, inventata**. Era il tedesco, finché il tedesco non
 * ha avuto i suoi (#190): da lì il test sarebbe passato per la ragione sbagliata, cioè
 * per la sola tabella `DIZIONARIO` incompleta. Una lingua senza i suoi testi non si
 * accende, e qui si asserisce proprio quello: la sezione non nasce dal nulla, e il
 * fallimento è rumoroso invece che silenzioso.
 */
describe("llms.txt · le sezioni SEGUONO ACTIVE_LOCALES", () => {
  it("con una lingua sola, il file ha una sezione sola e nessun separatore", async () => {
    vi.resetModules();
    vi.doMock("@/i18n/routing", async (originale) => ({
      ...(await originale<typeof import("@/i18n/routing")>()),
      ACTIVE_LOCALES: ["it"] as const,
    }));
    const { GET } = await import("./route");
    const t = await (await GET()).text();
    expect(t).toContain("## Collezioni");
    expect(t).not.toContain("## Collections");
    expect(t).not.toContain("\n---\n");
    // Il blocco delle lingue segue lo stesso elenco: una riga, non due.
    const blocco =
      t
        .match(/^## Lingue · Languages\n((?:- .*\n)+)/m)?.[1]
        .trim()
        .split("\n") ?? [];
    expect(blocco).toEqual([`- Italiano: https://fontealta.it`]);
    vi.doUnmock("@/i18n/routing");
    vi.resetModules();
  });

  it("con una terza lingua senza messaggi, la rotta fallisce invece di servire a metà", async () => {
    vi.resetModules();
    vi.doMock("@/i18n/routing", async (originale) => ({
      ...(await originale<typeof import("@/i18n/routing")>()),
      ACTIVE_LOCALES: ["it", "en", "xx"] as const,
    }));
    const { GET } = await import("./route");
    await expect(GET()).rejects.toThrow();
    vi.doUnmock("@/i18n/routing");
    vi.resetModules();
  });

  /**
   * ⚠️ Il caso che la query a due campi sbagliava: con le cinque lingue accese, ogni sezione
   * che non fosse l'italiano prendeva il titolo INGLESE. Qui il tedesco ha il suo, francese e
   * spagnolo no, e devono ricadere sull'italiano. E la data e l'autore nella lingua.
   */
  it("con cinque lingue, ogni sezione ha il titolo e la data della sua lingua, e ricade sull'italiano", async () => {
    vi.resetModules();
    vi.doMock("@/i18n/routing", async (originale) => {
      const o = await originale<typeof import("@/i18n/routing")>();
      return { ...o, ACTIVE_LOCALES: o.ALL_LOCALES };
    });
    fetchMock.mockResolvedValue({
      collections: [],
      posts: [
        {
          titolo: { it: "Titolo", en: "Title", de: "Titel" },
          slug: "p",
          publishedAt: "2026-07-09T00:00:00Z",
          autore: "Andrea Farnocchia",
        },
      ],
    });
    const { GET } = await import("./route");
    const sezioni = sezioniDi(await (await GET()).text());
    expect(sezioni).toHaveLength(5);
    expect(sezioni.map((s) => elenco(s, "Blog"))).toEqual([
      ["- [Titolo](https://fontealta.it/blog/p): 9 luglio 2026 · di Andrea Farnocchia"],
      ["- [Title](https://fontealta.it/en/blog/p): 9 July 2026 · by Andrea Farnocchia"],
      ["- [Titel](https://fontealta.it/de/blog/p): 9. Juli 2026 · von Andrea Farnocchia"],
      ["- [Titolo](https://fontealta.it/fr/blog/p): 9 juillet 2026 · par Andrea Farnocchia"],
      ["- [Titolo](https://fontealta.it/es/blog/p): 9 de julio de 2026 · de Andrea Farnocchia"],
    ]);
    vi.doUnmock("@/i18n/routing");
    vi.resetModules();
  });
});
