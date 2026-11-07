import { describe, expect, it } from "vitest";

import { ALL_LOCALES, routing } from "@/i18n/routing";

/**
 * La mappa degli indirizzi, una forma per lingua.
 *
 * ⚠️ **Il difetto che questi test colgono è una 404 che nasce mesi dopo.** Le
 * rotte sono una **whitelist**: un percorso che non sta in `pathnames` non
 * esiste, punto. Quindi una chiave a cui manca la forma tedesca non rompe
 * niente oggi — il tedesco è spento — e il giorno dell'accensione produce una
 * pagina irraggiungibile, senza che nessun build fallisca.
 */

type Forme = Record<string, string>;

/** `pathnames` in forma normalizzata: ogni chiave con le sue cinque forme.
 *  Una voce in forma di stringa vale «uguale in tutte le lingue». */
function mappa(): Record<string, Forme> {
  const fuori: Record<string, Forme> = {};
  for (const [chiave, valore] of Object.entries(routing.pathnames)) {
    fuori[chiave] =
      typeof valore === "string"
        ? Object.fromEntries(ALL_LOCALES.map((l) => [l, valore]))
        : (valore as Forme);
  }
  return fuori;
}

describe("pathnames", () => {
  it("ogni chiave ha una forma per ogni lingua dichiarata", () => {
    const m = mappa();
    expect(Object.keys(m).length, "la mappa è vuota: la sonda non legge nulla").toBeGreaterThan(10);
    for (const [chiave, forme] of Object.entries(m)) {
      const mancanti = ALL_LOCALES.filter((l) => !forme[l]);
      expect(mancanti, `${chiave} non ha la forma per ${mancanti.join(", ")}`).toEqual([]);
    }
  });

  it("ogni forma comincia con / e non finisce con /", () => {
    for (const [chiave, forme] of Object.entries(mappa())) {
      for (const [lingua, path] of Object.entries(forme)) {
        expect(path.startsWith("/"), `${chiave} in ${lingua}: ${path}`).toBe(true);
        expect(path === "/" || !path.endsWith("/"), `${chiave} in ${lingua}: ${path}`).toBe(true);
      }
    }
  });

  it("i segmenti dinamici restano gli stessi in tutte le lingue", () => {
    // ⚠️ Gli SLUG dei documenti non si traducono: `[slug]` deve comparire nello
    // stesso numero e nella stessa posizione, o `getPathname` non sa più cosa
    // sostituire.
    for (const [chiave, forme] of Object.entries(mappa())) {
      const attesi = (chiave.match(/\[\w+\]/g) ?? []).join(",");
      for (const [lingua, path] of Object.entries(forme)) {
        expect((path.match(/\[\w+\]/g) ?? []).join(","), `${chiave} in ${lingua}`).toBe(attesi);
      }
    }
  });

  it("dentro una lingua, due chiavi non producono lo stesso indirizzo", () => {
    // Il difetto: due rotte diverse allo stesso URL. Una delle due diventa
    // irraggiungibile, e quale dipende dall'ordine della mappa.
    const m = mappa();
    for (const lingua of ALL_LOCALES) {
      const visti = new Map<string, string>();
      for (const [chiave, forme] of Object.entries(m)) {
        const path = forme[lingua];
        const gia = visti.get(path);
        expect(gia, `in ${lingua}, ${chiave} e ${gia} puntano entrambi a ${path}`).toBeUndefined();
        visti.set(path, chiave);
      }
    }
  });

  it("i segmenti sono ASCII: niente accenti né dieresi negli indirizzi", () => {
    // Un URL non ASCII funziona ma, copiato e incollato, arriva a pezzi.
    for (const [chiave, forme] of Object.entries(mappa())) {
      for (const [lingua, path] of Object.entries(forme)) {
        expect(/^[\x00-\x7F]*$/.test(path), `${chiave} in ${lingua} non è ASCII: ${path}`).toBe(
          true,
        );
        expect(path, `${chiave} in ${lingua} ha maiuscole o spazi: ${path}`).toMatch(
          /^\/?[a-z0-9\-/[\]]*$/,
        );
      }
    }
  });

  it("le rotte figlie stanno sotto la loro madre, in ogni lingua", () => {
    // `/collezioni/[slug]` deve stare sotto `/collezioni` anche in tedesco: se
    // il segmento madre fosse tradotto in un posto e non nell'altro, l'albero
    // si spezzerebbe solo in quella lingua.
    const m = mappa();
    const coppie: [string, string][] = [
      ["/collezioni/[slug]", "/collezioni"],
      ["/collezioni/corpi-a-incasso", "/collezioni"],
      ["/collezioni/corpi-a-incasso/[slug]", "/collezioni/corpi-a-incasso"],
      ["/blog/[slug]", "/blog"],
      ["/referenze/[slug]", "/referenze"],
    ];
    for (const [figlia, madre] of coppie) {
      for (const lingua of ALL_LOCALES) {
        expect(
          m[figlia][lingua].startsWith(`${m[madre][lingua]}/`),
          `in ${lingua}: ${m[figlia][lingua]} non sta sotto ${m[madre][lingua]}`,
        ).toBe(true);
      }
    }
  });

  /**
   * ⛔ **Gli indirizzi ritirati restano morti, in ogni lingua.**
   *
   * ⚠️ Misurato, non dedotto. Con `localePrefix: "as-needed"` next-intl accetta
   * OGNI forma dichiarata anche **senza prefisso** e la rimanda alla lingua di
   * default con un 307: in produzione `/collections` risponde già 307 verso
   * `/collezioni`. Quindi un segmento dato a una lingua spenta non resta
   * inerte — diventa un indirizzo vivo sul sito italiano.
   *
   * La conseguenza che ha fatto nascere questa guardia: `/area-pro` è il vecchio
   * indirizzo italiano dell'Area Riservata, ritirato quando la pagina è nata.
   * Assegnarlo allo spagnolo (che sarebbe la sua forma naturale) lo faceva
   * tornare a rispondere 307 invece di 404, e la suite di regressione è
   * diventata rossa. Qui il vincolo è scritto una volta per tutte le lingue.
   */
  const RITIRATI = ["/area-pro", "/reserved-area"];

  it("nessuna lingua riusa un indirizzo ritirato", () => {
    for (const [chiave, forme] of Object.entries(mappa())) {
      for (const [lingua, path] of Object.entries(forme)) {
        expect(
          RITIRATI.includes(path),
          `${chiave} in ${lingua} riusa ${path}, che è un indirizzo ritirato`,
        ).toBe(false);
      }
    }
  });

  it("il rilevamento della lingua e gli hreflang del middleware restano spenti", () => {
    // Due decisioni a registro: la lingua la porta l'URL, e gli `alternates` li
    // dichiara il nostro `localizedUrls`, non l'header `Link` del middleware.
    expect(routing.localeDetection).toBe(false);
    expect(routing.alternateLinks).toBe(false);
  });
});
