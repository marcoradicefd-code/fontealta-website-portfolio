import { describe, expect, it } from "vitest";

import type { Locale } from "@/i18n/routing";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import it_ from "@/messages/it.json";

import {
  componiAltProdotto,
  misuraGiaNelTesto,
  misureNelTesto,
  risolviAlt,
  type MessaggiAlt,
} from "./alt-composto";
import type { MisuraVisibile } from "./misure";

const NB = " ";
type Msg = typeof it_;
const riempi = (s: string, v: Record<string, string>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");
/** I messaggi veri dei file JSON, senza next-intl: le frasi sono quelle servite. */
const messaggi = (j: Msg): MessaggiAlt => ({
  prodotto: (v) => riempi(j.immagini.prodotto, v),
  prodottoConMisura: (v) => riempi(j.immagini.prodottoConMisura, v),
  collezione: (v) => riempi(j.immagini.collezione, v),
  misura: (v) => riempi(j.immagini.misura, v),
  nomeMisura: (k) => j.immagini.misure[k as keyof typeof j.immagini.misure],
});
const altezza: MisuraVisibile = {
  chiave: "altezzaTotale",
  forma: "valore",
  valore: 2300,
  tolleranza: null,
};

describe("risolviAlt: altI18n, poi composto, poi l'italiano con lang", () => {
  const img = {
    alt: "Colonna doccia B76, collezione Boss",
    altI18n: { de: "Duschsäule B76 im Garten" },
  };
  it("l'alt scritto in Studio vince anche sul composto", () => {
    expect(risolviAlt(img, "de", "composto")).toEqual({ alt: "Duschsäule B76 im Garten" });
  });
  it("senza altI18n nella lingua, il composto", () => {
    expect(risolviAlt(img, "en", "Shower column B76, Boss collection")).toEqual({
      alt: "Shower column B76, Boss collection",
    });
  });
  it("senza composto, l'italiano: fuori dall'italiano con lang", () => {
    expect(risolviAlt(img, "fr")).toEqual({ alt: img.alt, lang: "it" });
    expect(risolviAlt(img, "it")).toEqual({ alt: img.alt });
    expect(risolviAlt(null, "fr")).toEqual({ alt: "" });
  });
});

describe("componiAltProdotto: la frase nella lingua della pagina", () => {
  const dati = {
    descrizione: "Colonna doccia con rubinetto d’arresto e soffione incassato",
    codice: "B76",
    collezione: "Boss",
  };

  it("italiano, con e senza la misura principale", () => {
    expect(componiAltProdotto(dati, "it", messaggi(it_))).toBe(
      "Colonna doccia con rubinetto d’arresto e soffione incassato B76, collezione Boss",
    );
    expect(componiAltProdotto({ ...dati, misura: altezza }, "it", messaggi(it_))).toBe(
      `Colonna doccia con rubinetto d’arresto e soffione incassato B76, altezza totale 230${NB}cm, collezione Boss`,
    );
  });

  it("inglese: «Boss collection» e mm coi pollici", () => {
    expect(
      componiAltProdotto(
        {
          descrizione: "Shower column with stop tap",
          codice: "B76",
          collezione: "Boss",
          misura: altezza,
        },
        "en",
        messaggi(en as Msg),
      ),
    ).toBe(
      `Shower column with stop tap B76, overall height 2,300${NB}mm (90.6${NB}in), Boss collection`,
    );
  });

  it("tedesco: il sostantivo della misura resta maiuscolo", () => {
    expect(
      componiAltProdotto(
        {
          descrizione: "Duschsäule mit Wasserhahn",
          codice: "B76",
          collezione: "Boss",
          misura: altezza,
        },
        "de",
        messaggi(de as Msg),
      ),
    ).toBe(`Duschsäule mit Wasserhahn B76, Gesamthöhe 230${NB}cm, Kollektion Boss`);
  });

  it("maiuscola iniziale, «Ø» com'è, punto finale tolto", () => {
    const placca: MisuraVisibile = {
      chiave: "diametroPlacca",
      forma: "valore",
      valore: 70,
      tolleranza: null,
    };
    expect(
      componiAltProdotto(
        {
          descrizione: "cuerpo empotrado.",
          codice: "CW.1",
          collezione: "Cuerpos empotrados",
          misura: placca,
        },
        "es",
        messaggi(es as Msg),
      ),
    ).toBe(`Cuerpo empotrado CW.1, Ø de la placa 7${NB}cm, colección Cuerpos empotrados`);
  });

  it("senza descrizione o codice non si compone; senza collezione niente coda vuota", () => {
    expect(componiAltProdotto({ ...dati, descrizione: "  " }, "it", messaggi(it_))).toBeNull();
    expect(componiAltProdotto({ ...dati, codice: null }, "it", messaggi(it_))).toBeNull();
    expect(componiAltProdotto({ ...dati, collezione: "" }, "it", messaggi(it_))).toBe(
      "Colonna doccia con rubinetto d’arresto e soffione incassato B76",
    );
  });
});

describe("misureNelTesto: le misure della descrizione, in mm", () => {
  it("lati, diametri e centimetri, con o senza spazi, con «x» o «×»", () => {
    const casi: Array<[Locale, string, number[], [number, number][]]> = [
      ["it", "Soffione anticalcare 250x140 mm, acciaio inox AISI 316", [140, 250], [[250, 140]]],
      ["en", "Antiscale 250 × 140 mm showerhead", [140, 250], [[250, 140]]],
      ["en", "Wall-mounted shower mixer, with column and showerhead S10 Ø300 mm", [300], []],
      ["fr", "Pomme de douche Ø 200 mm", [200], []],
      ["it", "Colonna altezza 80cm", [800], []],
      ["it", "Flessibile 150 cm doppia aggraffatura", [1500], []],
      ["de", "Brausekopf 1,5 cm", [15], []],
      ["it", "soffione ø250", [250], []],
      ["en", "Ceiling-mounted cm 30 shower arm", [300], []],
      ["fr", "Pomme de douche ⌀200", [200], []],
      ["it", "Pannello doccia murale 220x110 mm", [110, 220], [[220, 110]]],
      // Le migliaia secondo la lingua: la virgola in inglese (la forma dell'alt inglese), il punto nelle
      // altre, lo spazio stretto del francese ovunque. «1,500» in italiano è un decimale.
      ["en", "Shower column 2,300 mm high", [2300], []],
      ["it", "Colonna alta 2.300 mm", [2300], []],
      ["fr", "Colonne de 2\u202f300 mm", [2300], []],
      ["de", "Säule 2\u00a0300 mm", [2300], []],
      // Uno spazio non separabile fra codice e numero non li unisce: «S06» resta un codice.
      ["fr", "Pomme de douche S06\u00a0200 mm", [200], []],
      ["it", "Flessibile 1,500 mm", [1.5], []],
      ["en", "Flexible hose 1,500 mm", [1500], []],
      ["en", "Hose 2.300 mm", [2.3], []],
      // Lo spazio normale non è un separatore: il codice e la misura restano due cose.
      ["it", "Gruppo con soffione S06 200 mm", [200], []],
    ];
    for (const [l, t, valori, coppie] of casi) {
      const r = misureNelTesto(t, l);
      expect(
        [...r.valori].sort((a, b) => a - b),
        t,
      ).toEqual(valori);
      expect(r.coppie, t).toEqual(coppie);
    }
  });
  it("codici, AISI e parole che cominciano con «cm» o «mm» non sono misure", () => {
    for (const t of [
      "Colonna doccia con rubinetto d’arresto e soffione incassato",
      "Wall-mounted shower mixer, with column and showerhead S10",
      "acciaio inox AISI 316",
      "Duschsäule mit 2 Wasserhähnen",
      "Kit 3 mmisture",
      "Miscelatore W1X7 con rubinetto W6X1.E",
      "Set 2x3",
    ])
      expect(misureNelTesto(t, "it"), t).toEqual({ valori: [], coppie: [] });
  });
});

describe("misuraGiaNelTesto: lo stesso valore, non una misura qualsiasi (Marco, 3/11)", () => {
  it("lati: la stessa coppia in qualsiasi ordine, e non un lato solo", () => {
    const s09: MisuraVisibile = { chiave: "soffione", forma: "lati", lati: [140, 250] };
    expect(misuraGiaNelTesto(s09, "Antiscale 250x140 mm showerhead", "en")).toBe(true);
    expect(misuraGiaNelTesto(s09, "Soffione 14 × 25 cm", "it")).toBe(true);
    expect(misuraGiaNelTesto(s09, "Soffione 250x200 mm", "it")).toBe(false);
    expect(misuraGiaNelTesto(s09, "Soffione Ø250 mm", "it")).toBe(false);
  });
  it("valore: lo stesso numero in mm o in cm; di un intervallo il minimo", () => {
    expect(misuraGiaNelTesto(altezza, "Colonna doccia alta 230 cm", "it")).toBe(true);
    expect(misuraGiaNelTesto(altezza, "Shower column 2,300 mm high", "en")).toBe(true);
    expect(misuraGiaNelTesto(altezza, "Colonna doccia con soffione Ø300 mm", "it")).toBe(false);
    const flex: MisuraVisibile = {
      chiave: "lunghezza",
      forma: "valore",
      valore: 1500,
      tolleranza: null,
    };
    expect(misuraGiaNelTesto(flex, "Flexible hose 150 cm, double hemming", "en")).toBe(true);
    const regolabile: MisuraVisibile = {
      chiave: "altezzaTotale",
      forma: "intervallo",
      min: 900,
      max: 1300,
      regolabile: true,
    };
    expect(misuraGiaNelTesto(regolabile, "Colonna da 90 cm", "it")).toBe(true);
    expect(misuraGiaNelTesto(regolabile, "Colonna fino a 130 cm", "it")).toBe(false);
  });
});

describe("componiAltProdotto: nessuna misura doppia", () => {
  const soffione: MisuraVisibile = { chiave: "soffione", forma: "lati", lati: [140, 250] };
  it("S09: la descrizione ha già «250x140 mm», la misura principale non si aggiunge", () => {
    expect(
      componiAltProdotto(
        {
          descrizione: "Antiscale 250x140 mm showerhead, inox steel AISI 316",
          codice: "S09",
          collezione: "Accessories",
          misura: soffione,
        },
        "en",
        messaggi(en as Msg),
      ),
    ).toBe("Antiscale 250x140 mm showerhead, inox steel AISI 316 S09, Accessories collection");
  });
  it("senza misura nella descrizione, la principale resta (B76)", () => {
    expect(
      componiAltProdotto(
        { descrizione: "Colonna doccia", codice: "B76", collezione: "Boss", misura: altezza },
        "it",
        messaggi(it_),
      ),
    ).toBe(`Colonna doccia B76, altezza totale 230${NB}cm, collezione Boss`);
  });
  it("una misura diversa nella descrizione non toglie la principale (colonna EN col Ø del soffione)", () => {
    expect(
      componiAltProdotto(
        {
          descrizione: "Wall-mounted shower mixer, with column and showerhead S10 Ø300 mm",
          codice: "W344",
          collezione: "Community",
          misura: altezza,
        },
        "en",
        messaggi(en as Msg),
      ),
    ).toBe(
      `Wall-mounted shower mixer, with column and showerhead S10 Ø300 mm W344, overall height 2,300${NB}mm (90.6${NB}in), Community collection`,
    );
  });
  it("la lingua della pagina decide le migliaia: «2,300 mm» è l'altezza in inglese, «2.300 mm» in italiano", () => {
    expect(
      componiAltProdotto(
        {
          descrizione: "Shower column 2,300 mm high",
          codice: "B76",
          collezione: "Boss",
          misura: altezza,
        },
        "en",
        messaggi(en as Msg),
      ),
    ).toBe("Shower column 2,300 mm high B76, Boss collection");
    expect(
      componiAltProdotto(
        {
          descrizione: "Colonna doccia alta 2.300 mm",
          codice: "B76",
          collezione: "Boss",
          misura: altezza,
        },
        "it",
        messaggi(it_),
      ),
    ).toBe("Colonna doccia alta 2.300 mm B76, collezione Boss");
  });
  it("W010 in italiano: «soffione 200 mm» non è l'altezza, che torna (minimo dell'intervallo)", () => {
    const w010: MisuraVisibile = {
      chiave: "altezzaTotale",
      forma: "intervallo",
      min: 1060,
      max: 1460,
      regolabile: false,
    };
    expect(
      componiAltProdotto(
        {
          descrizione: "Gruppo esterno con colonna doccia e soffione 200 mm S06",
          codice: "W010",
          collezione: "Waterline",
          misura: w010,
        },
        "it",
        messaggi(it_),
      ),
    ).toBe(
      `Gruppo esterno con colonna doccia e soffione 200 mm S06 W010, altezza totale 106${NB}cm, collezione Waterline`,
    );
  });
});
