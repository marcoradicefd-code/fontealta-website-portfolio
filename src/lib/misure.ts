import type { Locale } from "@/i18n/routing";
import {
  CHIAVI_MISURA,
  type ChiaveMisura,
  type FamigliaMisure,
  formaDellaRiga,
} from "@/sanity/schemas/objects/misure-chiavi";

/**
 * La misura principale di un prodotto, per l'alt composto (spec `docs/specs/contenuti-per-lingua.md` § B).
 *
 * ⚠️ **Le misure NON si mostrano nella scheda e NON vanno nel JSON-LD** (Marco, 2/11/2026): stanno su
 * Sanity (`specs`), con la fonte e lo stato, e a video entra solo la principale, dentro l'alt della
 * foto. Resta il principio del 10/09/2026: niente markup di contenuto non visibile.
 */

export interface RigaMisuraInput {
  chiave?: string | null;
  valore?: number | null;
  min?: number | null;
  max?: number | null;
  regolabile?: boolean | null;
  tolleranza?: number | null;
  lati?: (number | null)[] | null;
}

export interface SpecsInput {
  famiglia?: string | null;
  misure?: RigaMisuraInput[] | null;
}

export type MisuraVisibile =
  | { chiave: ChiaveMisura; forma: "valore"; valore: number; tolleranza: number | null }
  | { chiave: ChiaveMisura; forma: "intervallo"; min: number; max: number; regolabile: boolean }
  | { chiave: ChiaveMisura; forma: "lati"; lati: [number, number] };

/**
 * La misura principale per famiglia (approvata da Marco il 2/11/2026): la prima chiave della lista
 * che la scheda ha. Il kit doccia non ne ha (decisione 2): l'interasse sta solo nella sezione.
 */
export const PRINCIPALE: Record<FamigliaMisure, readonly ChiaveMisura[]> = {
  colonna: ["altezzaTotale"],
  piano: ["altezzaTotale"],
  gruppoParete: ["altezzaTotale"],
  incasso: ["diametroPlacca", "placca", "sporgenzaBocca"],
  soffione: ["diametroSoffione", "soffione"],
  accessorio: ["lunghezza", "diametro", "base"],
  corpoIncasso: ["profondita"],
  kitDoccia: [],
};

const numero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const eChiave = (c: unknown): c is ChiaveMisura =>
  typeof c === "string" && (CHIAVI_MISURA as readonly string[]).includes(c);

function riga(input: RigaMisuraInput): MisuraVisibile | null {
  if (!eChiave(input.chiave)) return null;
  const pulita = {
    ...(numero(input.valore) ? { valore: input.valore } : {}),
    ...(numero(input.min) ? { min: input.min } : {}),
    ...(numero(input.max) ? { max: input.max } : {}),
    ...(numero(input.tolleranza) ? { tolleranza: input.tolleranza } : {}),
    ...(Array.isArray(input.lati) ? { lati: input.lati.filter(numero) } : {}),
  };
  if (formaDellaRiga(pulita) !== true) return null;
  if (pulita.valore !== undefined)
    return {
      chiave: input.chiave,
      forma: "valore",
      valore: pulita.valore,
      tolleranza: pulita.tolleranza ?? null,
    };
  if (pulita.min !== undefined && pulita.max !== undefined)
    return {
      chiave: input.chiave,
      forma: "intervallo",
      min: pulita.min,
      max: pulita.max,
      regolabile: input.regolabile === true,
    };
  const [a, b] = pulita.lati ?? [];
  return numero(a) && numero(b) ? { chiave: input.chiave, forma: "lati", lati: [a, b] } : null;
}

/** La misura principale della famiglia, se il prodotto ce l'ha; `null` altrimenti (kit doccia compresi). */
export function misuraPrincipale(specs: SpecsInput | null | undefined): MisuraVisibile | null {
  const famiglia = specs?.famiglia as FamigliaMisure | undefined;
  if (!famiglia || !(famiglia in PRINCIPALE)) return null;
  const tutte = (specs?.misure ?? []).map(riga).filter((m): m is MisuraVisibile => m !== null);
  for (const chiave of PRINCIPALE[famiglia]) {
    const m = tutte.find((x) => x.chiave === chiave);
    if (m) return m;
  }
  return null;
}

// ─── Formati ─────────────────────────────────────────────────────────────────

const TAG: Record<Locale, string> = {
  it: "it-IT",
  en: "en-GB",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
};
const NBSP = " ";

/** Il separatore delle migliaia anche a quattro cifre («1.300», come nella decisione di Marco). */
function cifre(n: number, locale: Locale, decimali = 0, minimoDecimali = 0): string {
  return new Intl.NumberFormat(TAG[locale], {
    minimumFractionDigits: minimoDecimali,
    maximumFractionDigits: decimali,
    useGrouping: "always",
  }).format(n);
}

/** Pollici con una cifra decimale, sempre: «50 mm (2.0 in)» (decisione 1). */
const pollici = (mm: number) => cifre(mm / 25.4, "en", 1, 1);

/**
 * Il valore per l'alt composto: cm esatti (`2300 mm` → «230 cm», `1217 mm` → «121,7 cm»); in
 * inglese mm con i pollici. Di un intervallo solo il minimo, mai l'intervallo; di una tolleranza
 * solo il valore (decisione 3).
 */
export function valoreAlt(m: MisuraVisibile, locale: Locale): string {
  const en = locale === "en";
  const mm = (v: number) =>
    en
      ? `${cifre(v, locale)}${NBSP}mm (${pollici(v)}${NBSP}in)`
      : `${cifre(v / 10, locale, 1)}${NBSP}cm`;
  if (m.forma === "valore") return mm(m.valore);
  if (m.forma === "intervallo") return mm(m.min);
  // Il lato lungo prima, come nel listino e nelle descrizioni («250x140 mm», «220x110 mm»):
  // l'estrazione dai disegni li ha salvati in ordini diversi (S09 [140, 250], SA53.09 [250, 140]).
  const [a, b] = [...m.lati].sort((x, y) => y - x);
  return en
    ? `${cifre(a, locale)}${NBSP}×${NBSP}${cifre(b, locale)}${NBSP}mm (${pollici(a)}${NBSP}×${NBSP}${pollici(b)}${NBSP}in)`
    : `${cifre(a / 10, locale, 1)}${NBSP}×${NBSP}${cifre(b / 10, locale, 1)}${NBSP}cm`;
}
