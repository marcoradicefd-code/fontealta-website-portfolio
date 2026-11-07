import type { Locale } from "@/i18n/routing";
import { valoreAlt, type MisuraVisibile } from "@/lib/misure";

/**
 * L'alt delle immagini nella lingua della pagina (spec `docs/specs/contenuti-per-lingua.md` § A).
 *
 * L'ordine, deciso da Marco il 2/11/2026:
 *  1. `altI18n[lingua]`, scritto in Studio: vince sempre, anche su un prodotto;
 *  2. l'alt **composto** dai dati nella lingua della pagina, dove si può comporre;
 *  3. `alt`, che è italiano: nelle altre lingue esce con `lang="it"`.
 *
 * ⚠️ `alt` non cambia mai qui: `card-image.ts` lo usa come chiave per scegliere la composizione
 * della collezione.
 */

export interface ImmagineConAlt {
  alt?: string | null;
  altI18n?: Partial<Record<Locale, string | null>> | null;
}

export interface AltRisolto {
  alt: string;
  /** `"it"` quando l'alt è l'italiano salvato e la pagina è in un'altra lingua. */
  lang?: "it";
}

// ⚠️ [ \t\n\r] e non \s: \s comprende lo spazio non separabile, che i valori delle misure
// usano fra numero e unità (rule misure-e-test).
const pulito = (s: string | null | undefined) => (s ?? "").replace(/[ \t\n\r]+/g, " ").trim();

export function risolviAlt(
  immagine: ImmagineConAlt | null | undefined,
  locale: Locale,
  composto?: string | null,
): AltRisolto {
  const scritto = pulito(immagine?.altI18n?.[locale]);
  if (scritto) return { alt: scritto };
  const c = pulito(composto);
  if (c) return { alt: c };
  const it = pulito(immagine?.alt);
  if (!it) return { alt: "" };
  return locale === "it" ? { alt: it } : { alt: it, lang: "it" };
}

/** I messaggi del namespace `immagini` che servono alla composizione, già legati alla lingua. */
export interface MessaggiAlt {
  prodotto: (v: { descrizione: string; codice: string; collezione: string }) => string;
  prodottoConMisura: (v: {
    descrizione: string;
    codice: string;
    misura: string;
    collezione: string;
  }) => string;
  collezione: (v: { nome: string }) => string;
  misura: (v: { nome: string; valore: string }) => string;
  /** Il nome della misura principale come sta nella frase, dai messaggi `immagini.misure`. */
  nomeMisura: (chiave: MisuraVisibile["chiave"]) => string;
}

/** Maiuscola iniziale: la descrizione spagnola di due corpi comincia minuscola. */
function maiuscolaIniziale(s: string, locale: Locale): string {
  return s ? s.charAt(0).toLocaleUpperCase(locale) + s.slice(1) : s;
}

/**
 * Il separatore delle migliaia della lingua della descrizione: «2,300 mm» in inglese (la forma dell'alt
 * inglese), «2.300 mm» nelle altre, dove «1,500 mm» è un decimale (verificatore del 3/11). Lo spazio non
 * separabile e quello stretto del francese valgono ovunque; lo spazio normale no: «S06 200 mm» diventerebbe
 * 6.200.
 */
const SEPARATORE_MIGLIAIA: Record<Locale, string> = { it: ".", en: ",", de: ".", fr: ".", es: "." };
const FINE = String.raw`(?![\p{L}\p{N}])`;
const INIZIO = String.raw`(?<![\p{L}\p{N}])`;

function regole(locale: Locale) {
  const migliaia = String.raw`(?<![\p{L}\p{N}])\d{1,3}(?:[${SEPARATORE_MIGLIAIA[locale]}  ]\d{3})+(?!\d)`;
  const num = String.raw`${migliaia}|\d+(?:[.,]\d+)?`;
  const eMigliaia = new RegExp(String.raw`^(?:${migliaia})$`, "u");
  return {
    coppia: new RegExp(String.raw`(${num})\s*(?:mm|cm)?\s*[x×]\s*(${num})\s*(mm|cm)${FINE}`, "giu"),
    singole: new RegExp(
      String.raw`[Øø⌀∅]\s*(${num})\s*(mm|cm)?${FINE}|(${num})\s*(mm|cm)${FINE}|${INIZIO}(mm|cm)\s*(${num})`,
      "giu",
    ),
    inMm: (n: string, unita?: string) =>
      Number(eMigliaia.test(n) ? n.replace(/\D/g, "") : n.replace(",", ".")) *
      (unita?.toLowerCase() === "cm" ? 10 : 1),
  };
}
const REGOLE = Object.fromEntries(
  (Object.keys(SEPARATORE_MIGLIAIA) as Locale[]).map((l) => [l, regole(l)]),
) as Record<Locale, ReturnType<typeof regole>>;

/**
 * Le misure scritte nel testo, in mm: «250x140 mm» è una coppia di lati (e i due valori), «Ø300 mm»,
 * «Ø 200», «80cm», «1,5 cm», «cm 30», «2,300 mm» sono valori. Il Ø senza unità vale in mm. Due numeri uniti
 * da «x» senza unità NON sono una coppia: sono anche i codici come «W1X7» (verificatore del 2/11).
 * ⚠️ Non si leggono (3/11, nessun caso nei dati): tre lati, unità miste o solo sul primo lato, intervalli
 * («90-130 cm»), tolleranze, metri e pollici. Un numero conta qualunque cosa misuri.
 */
export function misureNelTesto(
  testo: string,
  locale: Locale,
): { valori: number[]; coppie: [number, number][] } {
  const { coppia, singole, inMm } = REGOLE[locale];
  const coppie = [...testo.matchAll(coppia)].map(
    (m) => [inMm(m[1], m[3]), inMm(m[2], m[3])] as [number, number],
  );
  const valori = [...testo.matchAll(singole)].map((m) =>
    m[1] ? inMm(m[1], m[2]) : m[3] ? inMm(m[3], m[4]) : inMm(m[6], m[5]),
  );
  return { valori: [...new Set([...valori, ...coppie.flat()])], coppie };
}

const uguale = (a: number, b: number) => Math.abs(a - b) < 0.5;

/**
 * La descrizione dice già il valore che l'alt aggiungerebbe (Marco, 3/11/2026): lo stesso numero in mm
 * o in cm, o per i lati la stessa coppia in qualsiasi ordine. Una misura diversa (il Ø del soffione
 * nella descrizione di una colonna) non toglie la principale.
 */
export function misuraGiaNelTesto(m: MisuraVisibile, testo: string, locale: Locale): boolean {
  const { valori, coppie } = misureNelTesto(testo, locale);
  if (m.forma === "lati") {
    const [a, b] = m.lati;
    return coppie.some(
      ([x, y]) => (uguale(x, a) && uguale(y, b)) || (uguale(x, b) && uguale(y, a)),
    );
  }
  // Di un intervallo l'alt dice il minimo (`valoreAlt`): è quello che non va ripetuto.
  const v = m.forma === "valore" ? m.valore : m.min;
  return valori.some((x) => uguale(x, v));
}

/**
 * «‹descrizione› ‹codice›, ‹misura principale›, ‹collezione›», nella lingua della pagina.
 * `null` se manca la descrizione o il codice: allora si ripiega sull'alt salvato.
 * Se la descrizione porta già lo stesso valore, la principale non si aggiunge (Marco, 2/11 e 3/11/2026):
 * «… 250x140 mm, … S09, soffione 25 × 14 cm» la direbbe due volte.
 */
export function componiAltProdotto(
  dati: {
    descrizione: string | null | undefined;
    codice: string | null | undefined;
    collezione: string | null | undefined;
    misura?: MisuraVisibile | null;
  },
  locale: Locale,
  m: MessaggiAlt,
): string | null {
  const descrizione = pulito(dati.descrizione).replace(/\.$/, "");
  const codice = pulito(dati.codice);
  if (!descrizione || !codice) return null;
  const nomeCollezione = pulito(dati.collezione);
  const collezione = nomeCollezione ? m.collezione({ nome: nomeCollezione }) : "";
  const desc = maiuscolaIniziale(descrizione, locale);
  const misura =
    dati.misura && !misuraGiaNelTesto(dati.misura, descrizione, locale)
      ? m.misura({
          nome: m.nomeMisura(dati.misura.chiave),
          valore: valoreAlt(dati.misura, locale),
        })
      : null;
  const frase = misura
    ? m.prodottoConMisura({ descrizione: desc, codice, misura, collezione })
    : m.prodotto({ descrizione: desc, codice, collezione });
  // Senza collezione la frase finirebbe con «, »: si toglie la coda vuota.
  return pulito(frase.replace(/,\s*$/, ""));
}
