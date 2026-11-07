import { describe, expect, it } from "vitest";

import { ACTIVE_LOCALES, ALL_LOCALES } from "@/i18n/routing";
import {
  OG_DEFAULT_IMAGE,
  OG_LOCALE,
  ogImageProdotto,
  conAltOg,
  ogImageScena,
  ogImageScenaNellaLingua,
  openGraphBase,
} from "@/lib/open-graph";

/**
 * ⚠️ Le anteprime social sono l'unica parte del sito che **non si vede
 * navigandolo**: si vedono in una chat o in un feed, dopo che qualcuno ha
 * condiviso. Un og:image sbagliato non rompe nessuna pagina e nessuno se ne
 * accorge finché non è in giro.
 */

/** Una composizione prodotto vera: quadrata, con l'articolo che riempie il quadro
 *  in verticale. Il `_ref` porta le dimensioni native, che è da lì che si leggono. */
const PRODOTTO = { asset: { _ref: "image-abc123-3072x3072-jpg" } };
/** Una cover di collezione: ritratto 896×1200. */
const SCENA = { asset: { _ref: "image-def456-896x1200-jpg" } };

describe("OG_LOCALE", () => {
  it("copre tutte e cinque le lingue, non solo le attive", () => {
    // È una tabella di conversione, non un elenco di ciò che è acceso: il giorno
    // che DE entra in ACTIVE_LOCALES non deve esserci niente da aggiungere.
    expect(Object.keys(OG_LOCALE).sort()).toEqual([...ALL_LOCALES].sort());
  });

  it("usa la forma lingua_PAESE, che è quella che og:locale vuole", () => {
    for (const [chiave, valore] of Object.entries(OG_LOCALE)) {
      expect(valore, `${chiave} deve essere nella forma xx_XX`).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
    }
  });
});

describe("openGraphBase", () => {
  it.each([...ACTIVE_LOCALES])("su %s dichiara la propria lingua e solo le altre attive", (l) => {
    const base = openGraphBase(l);
    expect(base.locale).toBe(OG_LOCALE[l]);
    expect(base.siteName).toBe("Fontealta");
    expect(base.type).toBe("website");
    const attese = ACTIVE_LOCALES.filter((x) => x !== l).map((x) => OG_LOCALE[x]);
    expect([...base.alternateLocale]).toEqual(attese);
    // Mai la propria lingua fra gli alternati, e mai una lingua non attiva:
    // dichiarare una traduzione che non esiste manda le anteprime su pagine
    // che non ci sono, come per gli hreflang.
    expect(base.alternateLocale).not.toContain(base.locale);
    expect(base.alternateLocale.length).toBe(ACTIVE_LOCALES.length - 1);
  });

  it("porta già l'immagine di riserva: chi non ne ha una propria non resta senza", () => {
    // ⚠️ Senza questa riga `/produzione` e `/blog` uscivano senza `og:image` in
    // tutte e due le lingue: dichiarando un `openGraph` proprio avevano già
    // sostituito quello del layout, immagine compresa. Quattro rotte su
    // trentadue, trovate dalla guardia e non a occhio.
    for (const l of ACTIVE_LOCALES) {
      expect(openGraphBase(l).images).toEqual([{ ...OG_DEFAULT_IMAGE }]);
    }
  });

  /**
   * ⚠️ **`og:url` non è «la pagina»: è il canonical, passato dal chiamante.**
   * La funzione non lo calcola e non può: `open-graph.ts` è puro e non conosce
   * le rotte. Questi due casi fissano il contratto — arriva una stringa, esce
   * `url`; non arriva niente, la chiave **non c'è**. La chiave assente e non
   * vuota è la stessa regola di `sameAs` e di `description` sull'azienda.
   */
  it("con un canonical emette og:url, e con quella stessa stringa", () => {
    const c = "https://fontealta.it/collezioni/boss";
    expect(openGraphBase("it", c)).toMatchObject({ url: c });
  });

  it.each([undefined, null, ""])("senza canonical (%p) la chiave url non esiste", (c) => {
    expect("url" in openGraphBase("it", c)).toBe(false);
  });

  it("un'immagine di pagina sovrascrive quella di riserva, non si somma", () => {
    const conProdotto = { ...openGraphBase("it"), images: ogImageProdotto(PRODOTTO) };
    expect(conProdotto.images).toHaveLength(1);
    expect(conProdotto.images[0].url).not.toBe(OG_DEFAULT_IMAGE.url);
  });
});

describe("ogImageProdotto", () => {
  const [img] = ogImageProdotto(PRODOTTO);

  it("riempie invece di ritagliare, sul fondo del brand", () => {
    expect(img.url).toContain("fit=fill");
    expect(img.url).toContain("bg=0b1215");
    expect(img.url).toContain("w=1200");
    expect(img.url).toContain("h=630");
  });

  it("NON restringe il rettangolo: è ciò che decapitava il prodotto", () => {
    // `@sanity/image-url` calcola da sé un `rect` per soddisfare le proporzioni
    // richieste, e `fit=fill` si limita a riempire quello. Sull'HTML servito
    // usciva `rect=0,730,3072,1613`, cioè la fascia centrale di un quadrato:
    // una colonna d'acciaio senza bocca, base e comando. Imponendo il
    // rettangolo pieno il builder lo omette del tutto, perché coincide con
    // l'immagine.
    expect(img.url).not.toContain("rect=");
  });

  it("dichiara la taglia che serve alle anteprime", () => {
    expect(img.width).toBe(1200);
    expect(img.height).toBe(630);
  });

  it("torna sempre almeno un'immagine, anche senza sorgente", () => {
    // Un array vuoto o `undefined` non eredita l'immagine del layout: la pagina
    // dichiara un openGraph proprio, che lo sostituisce per intero.
    expect(ogImageProdotto(null)).toEqual([{ ...OG_DEFAULT_IMAGE }]);
    expect(ogImageProdotto(undefined)).toEqual([{ ...OG_DEFAULT_IMAGE }]);
  });

  it("senza dimensioni leggibili preferisce l'immagine di riserva a un ritaglio", () => {
    // Meglio l'immagine del sito che un prodotto decapitato.
    expect(ogImageProdotto({ asset: { _ref: "image-senza-dimensioni" } })).toEqual([
      { ...OG_DEFAULT_IMAGE },
    ]);
  });
});

describe("ogImageScena", () => {
  it("ritaglia, e qui è la scelta giusta", () => {
    // Le cover sono sfondi in formato ritratto: non hanno testa e base da
    // salvare, e letterboxarle intere le ridurrebbe a una striscia dentro un
    // riquadro quasi tutto fondo.
    const [img] = ogImageScena(SCENA);
    expect(img.url).toContain("fit=crop");
    expect(img.url).not.toContain("bg=");
    expect(img.width).toBe(1200);
    expect(img.height).toBe(630);
  });

  it("torna l'immagine di riserva senza sorgente", () => {
    expect(ogImageScena(null)).toEqual([{ ...OG_DEFAULT_IMAGE }]);
  });
});

describe("ogImageScenaNellaLingua", () => {
  const OG = {
    asset: { _ref: "image-aaa111-1200x630-jpg" },
    alt: "Colonne doccia da esterno a bordo piscina",
    altI18n: { it: "Colonne doccia da esterno", en: "Outdoor shower columns", de: "" },
  };

  it("l'alt della lingua vince in ogni lingua, anche dopo conAltOg", () => {
    const [en] = conAltOg(ogImageScenaNellaLingua(OG, "en"), "Titolo", "en");
    expect(en.alt).toBe("Outdoor shower columns");
    expect(en.url).toContain("w=1200");
  });

  it("senza l'alt della lingua: l'alt italiano in italiano, il titolo nelle altre", () => {
    const [de] = conAltOg(ogImageScenaNellaLingua(OG, "de"), "Gartendusche", "de");
    expect(de.alt).toBe("Gartendusche");
    const [fr] = conAltOg(ogImageScenaNellaLingua({ ...OG, altI18n: null }, "fr"), "Douche", "fr");
    expect(fr.alt).toBe("Douche");
    const [it] = conAltOg(ogImageScenaNellaLingua({ ...OG, altI18n: null }, "it"), "Doccia", "it");
    expect(it.alt).toBe("Colonne doccia da esterno a bordo piscina");
  });
});
