import { describe, expect, it } from "vitest";

import { OG_DEFAULT_IMAGE } from "@/lib/open-graph";
import {
  indicizzazione,
  risolviSeo,
  type ImmagineOg,
  type SeoDocumento,
} from "@/lib/seo-editoriale";

const TEMPLATE = { titolo: "Titolo automatico", description: "Descrizione automatica" };

const IMG = (nome: string): ImmagineOg[] => [{ url: `/${nome}.jpg`, width: 1200, height: 630 }];

function risolvi(seo: SeoDocumento, locale: "it" | "en" = "it", immagini = {}) {
  return risolviSeo({ seo, locale, template: TEMPLATE, immagini });
}

describe("risolviSeo · campo vuoto = template", () => {
  it.each([
    ["seo assente", null],
    ["seo undefined", undefined],
    ["oggetto vuoto", {}],
    ["campi nulli", { metaTitle: null, metaDescription: null }],
    ["oggetto con lingue vuote", { metaTitle: { it: "", en: "" } }],
    ["oggetto con lingue nulle", { metaTitle: { it: null, en: null } }],
  ])("%s → template", (_nome, seo) => {
    const esito = risolviSeo({
      seo: seo as SeoDocumento,
      locale: "it",
      template: TEMPLATE,
    });
    expect(esito.titolo).toBe("Titolo automatico");
    expect(esito.description).toBe("Descrizione automatica");
  });
});

describe("risolviSeo · forma per lingua", () => {
  const seo: SeoDocumento = {
    metaTitle: { it: "Titolo scritto", en: "Written title" },
    metaDescription: { it: "Descrizione scritta", en: "Written description" },
  };

  it("italiano prende l'italiano", () => {
    const e = risolvi(seo, "it");
    expect(e.titolo).toBe("Titolo scritto");
    expect(e.description).toBe("Descrizione scritta");
  });

  it("inglese prende l'inglese", () => {
    const e = risolvi(seo, "en");
    expect(e.titolo).toBe("Written title");
    expect(e.description).toBe("Written description");
  });

  it("scritto solo in italiano: l'inglese va a template, non ripiega", () => {
    const e = risolvi({ metaTitle: { it: "Solo italiano" } }, "en");
    expect(e.titolo).toBe("Titolo automatico");
  });

  it("scritto solo in inglese: l'italiano va a template", () => {
    const e = risolvi({ metaTitle: { en: "English only" } }, "it");
    expect(e.titolo).toBe("Titolo automatico");
  });

  it("titolo compilato e description vuota: uno vince, l'altra va a template", () => {
    const e = risolvi({ metaTitle: { it: "Solo il titolo" } }, "it");
    expect(e.titolo).toBe("Solo il titolo");
    expect(e.description).toBe("Descrizione automatica");
  });

  it("i testi vengono ripuliti dagli spazi ai bordi", () => {
    const e = risolvi({ metaTitle: { it: "  Con spazi  " } }, "it");
    expect(e.titolo).toBe("Con spazi");
  });
});

describe("risolviSeo · catena dell'immagine", () => {
  it("seo.ogImage vince su tutto", () => {
    const e = risolvi(null, "it", { seo: IMG("seo"), entita: IMG("entita"), sito: IMG("sito") });
    expect(e.immagini).toEqual(IMG("seo"));
  });

  it("senza seo.ogImage vince quella dell'entità", () => {
    const e = risolvi(null, "it", { entita: IMG("entita"), sito: IMG("sito") });
    expect(e.immagini).toEqual(IMG("entita"));
  });

  it("senza entità vince la riserva del sito, PRIMA del file", () => {
    const e = risolvi(null, "it", { sito: IMG("sito") });
    expect(e.immagini).toEqual(IMG("sito"));
  });

  it("senza niente resta il file di riserva", () => {
    const e = risolvi(null, "it", {});
    expect(e.immagini).toEqual([{ ...OG_DEFAULT_IMAGE }]);
  });

  it("un array vuoto non conta come immagine e si passa all'anello dopo", () => {
    const e = risolvi(null, "it", { seo: [], entita: IMG("entita") });
    expect(e.immagini).toEqual(IMG("entita"));
  });

  it("senza il parametro immagini resta il file di riserva", () => {
    const e = risolviSeo({ seo: null, locale: "it", template: TEMPLATE });
    expect(e.immagini).toEqual([{ ...OG_DEFAULT_IMAGE }]);
  });
});

describe("risolviSeo · noIndex", () => {
  it("assente vuol dire indicizzabile", () => {
    expect(risolvi(null, "it").noIndex).toBe(false);
    expect(risolvi({}, "it").noIndex).toBe(false);
  });

  it("false resta false", () => {
    expect(risolvi({ noIndex: false }, "it").noIndex).toBe(false);
  });

  it("true accende l'esclusione", () => {
    expect(risolvi({ noIndex: true }, "it").noIndex).toBe(true);
  });

  it("null vale come assente", () => {
    expect(risolvi({ noIndex: null }, "it").noIndex).toBe(false);
  });

  it("noIndex non tocca titolo e description", () => {
    const e = risolvi({ noIndex: true, metaTitle: { it: "Titolo" } }, "it");
    expect(e.titolo).toBe("Titolo");
    expect(e.description).toBe("Descrizione automatica");
  });
});

describe("risolviSeo · contenutoNellaLingua, la SEO segue il contenuto", () => {
  it("post senza title.en su /en: la SEO resta quella italiana", () => {
    const e = risolviSeo({
      seo: {
        metaTitle: { it: "Titolo curato in italiano" },
        metaDescription: { it: "Description curata in italiano, dentro la finestra utile." },
      },
      locale: "en",
      contenutoNellaLingua: false,
      template: TEMPLATE,
    });
    expect(e.titolo).toBe("Titolo curato in italiano");
    expect(e.description).toBe("Description curata in italiano, dentro la finestra utile.");
  });

  it("stessa regola sulla forma per lingua: senza contenuto EN si legge seo.it", () => {
    const e = risolviSeo({
      seo: { metaTitle: { it: "Italiano", en: "English" } },
      locale: "en",
      contenutoNellaLingua: false,
      template: TEMPLATE,
    });
    expect(e.titolo).toBe("Italiano");
  });

  it("post CON title.en: torna a seo.en", () => {
    const e = risolviSeo({
      seo: { metaTitle: { it: "Italiano", en: "English" } },
      locale: "en",
      contenutoNellaLingua: true,
      template: TEMPLATE,
    });
    expect(e.titolo).toBe("English");
  });

  it("post CON title.en ma senza seo.en: template inglese, non l'italiano", () => {
    const e = risolviSeo({
      seo: { metaTitle: { it: "Italiano" } },
      locale: "en",
      contenutoNellaLingua: true,
      template: TEMPLATE,
    });
    expect(e.titolo).toBe("Titolo automatico");
  });

  it("modello, che l'inglese ce l'ha su 595 su 595: identico a prima", () => {
    const seo: SeoDocumento = { metaTitle: { it: "IT", en: "EN" } };
    const conFlag = risolviSeo({
      seo,
      locale: "en",
      contenutoNellaLingua: true,
      template: TEMPLATE,
    });
    const senzaFlag = risolviSeo({ seo, locale: "en", template: TEMPLATE });
    expect(conFlag).toEqual(senzaFlag);
    expect(conFlag.titolo).toBe("EN");
  });

  it("sull'italiano il flag non cambia niente: la lingua è già quella", () => {
    const seo: SeoDocumento = { metaTitle: { it: "IT", en: "EN" } };
    const a = risolviSeo({ seo, locale: "it", contenutoNellaLingua: false, template: TEMPLATE });
    const b = risolviSeo({ seo, locale: "it", contenutoNellaLingua: true, template: TEMPLATE });
    expect(a).toEqual(b);
    expect(a.titolo).toBe("IT");
  });

  it("omesso vale true: chi non lo passa dichiara che la pagina è nella lingua chiesta", () => {
    const e = risolviSeo({
      seo: { metaTitle: { it: "Italiano" } },
      locale: "en",
      template: TEMPLATE,
    });
    expect(e.titolo).toBe("Titolo automatico");
  });
});

describe("indicizzazione · noIndex toglie canonical e hreflang", () => {
  const ALTERNATES = {
    canonical: "https://fontealta.it/modello/b40l",
    languages: {
      it: "https://fontealta.it/modello/b40l",
      en: "https://fontealta.it/en/model/b40l",
    },
  };

  it("indicizzabile: escono le alternates, e NESSUN robots", () => {
    const m = indicizzazione(false, ALTERNATES);
    expect(m).toEqual({ alternates: ALTERNATES });
    expect("robots" in m).toBe(false);
  });

  it("noIndex: esce il robots, e NESSUNA chiave alternates", () => {
    const m = indicizzazione(true, ALTERNATES);
    expect(m).toEqual({ robots: { index: false, follow: true } });
    // La chiave non deve esserci affatto, non valere `undefined`: è la forma di
    // `/area-riservata`, l'unica pagina del sito già fuori dall'indice.
    expect("alternates" in m).toBe(false);
  });

  it("noIndex NON è nofollow: i link in uscita restano legittimi", () => {
    const m = indicizzazione(true, ALTERNATES) as { robots: { index: boolean; follow: boolean } };
    expect(m.robots.follow).toBe(true);
  });

  it("il risultato si spande in un oggetto metadata senza lasciare chiavi vuote", () => {
    const escluso = { title: "T", ...indicizzazione(true, ALTERNATES) };
    const incluso = { title: "T", ...indicizzazione(false, ALTERNATES) };
    expect(Object.keys(escluso).sort()).toEqual(["robots", "title"]);
    expect(Object.keys(incluso).sort()).toEqual(["alternates", "title"]);
  });
});
