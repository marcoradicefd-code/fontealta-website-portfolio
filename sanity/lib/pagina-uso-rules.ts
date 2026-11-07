/**
 * Le regole del corpo di una pagina d'uso, **pure**: le usano lo Studio (validazioni), il caricatore
 * (`contenuti:carica --sezione=pagine-uso`) e i test. Spec `docs/specs/seo-pagine-contenuto.md`.
 *
 * Il corpo ammette (Marco, grill del 3/11/2026, Q15): H2, H3 solo dentro un H2, paragrafi, elenchi
 * puntati di un livello, link interni, foto (`figure`, `figurePair`), il grassetto al massimo una
 * volta per sezione, una tabella di confronto. Tutto il resto è un errore.
 *
 * ⚠️ Importa solo `faq-rules.ts`, che non importa niente: entra nel bundle dello Studio e nei
 * comandi `tsx`.
 */

import { words, type FaqProblem } from "./faq-rules";

export interface UseImage {
  _type?: string;
  asset?: { _ref?: string };
  alt?: string;
}

export interface UseSpan {
  _type?: string;
  text?: string;
  marks?: string[];
}

export type UseBlock =
  | {
      _type: "block";
      _key: string;
      style?: string;
      listItem?: string;
      level?: number;
      children?: UseSpan[];
      markDefs?: Array<{ _key: string; _type: string }>;
    }
  | { _type: "figure"; _key: string; image?: UseImage }
  | { _type: "figurePair"; _key: string; left?: UseImage; right?: UseImage }
  | { _type: "keyPoints"; _key: string; items?: string[] }
  | {
      _type: "comparisonTable";
      _key: string;
      header?: string[];
      rows?: Array<{ _key?: string; cells?: string[] }>;
    }
  | { _type: string; _key: string };

/** Un problema col blocco a cui si riferisce, per il percorso in Studio. */
export interface UseProblem extends FaqProblem {
  key?: string;
}

/** Le voci del box «In sintesi», in testa al corpo (Marco, 3/11 sera, struttura della pagina). */
export const KEY_POINTS = { min: 3, max: 4 } as const;

/** I limiti della tabella di confronto (Q15). */
export const TABLE_LIMITS = { minColumns: 2, maxColumns: 4, maxRows: 8, perPage: 1 } as const;
/** Il grassetto più lungo prima dell'avviso: oltre è una frase, non la frase chiave. */
export const BOLD_MAX_WORDS = 8;
/** L'alt più lungo consigliato (checklist § Testi). */
export const ALT_MAX_CHARS = 125;
/** Le parole del corpo, introduzione compresa e FAQ escluse (Q5). */
export const BODY_WORDS = { min: 1000, max: 1200 } as const;

/**
 * Le unità di misura in simbolo, scritte minuscole come si scrivono («5 M» in un nome di serie non è
 * una misura), e in parola nelle cinque lingue, senza badare alle maiuscole. Niente «in»: in italiano
 * è una preposizione («AISI 316 in finitura lucida»).
 */
const SYMBOLS = "mm|cm|m|km|mq|m²|m2|sqm|sq\\s?ft|kg|lbs?|bar|psi|gpm|ft|l\\/min";
const WORDS = [
  "metr[oi]|centimetr[oi]|millimetr[oi]|pollic[ei]|piedi|litri|gradi|chili",
  "meters?|metres?|centimeters?|centimetres?|millimeters?|inch(?:es)?|feet|foot|liters?|litres?|degrees?|pounds?",
  "meter[ns]?|zentimeter[ns]?|millimeter[ns]?|zoll|fuß|liter[ns]?|grad",
  "mètres?|centimètres?|millimètres?|pouces?|pieds?|degrés?",
  "metros?|centímetros?|milímetros?|pulgadas?|pies|litros?|grados?",
].join("|");

/**
 * Una misura scritta: una cifra con un'unità, in simbolo o in parola (Q4, nessuna misura nella
 * pagina d'uso), e i gradi e i pollici col segno («40 °C», «360°», «2″»). «AISI 316», «316L»,
 * «24h», «2 persone», «dal 1990», «AISI 316 in finitura lucida» non lo sono (verificatori del 3/11).
 */
const NUM = "\\d+(?:[.,]\\d+)?\\s?";
const MEASURE_SYMBOL = new RegExp(
  `${NUM}(?:${SYMBOLS})(?![\\p{L}\\p{N}])|\\d+\\s?(?:°|["″′])`,
  "u",
);
const MEASURE_WORD = new RegExp(`${NUM}(?:${WORDS})(?![\\p{L}\\p{N}])`, "iu");

export const mentionsMeasure = (text: string) =>
  MEASURE_SYMBOL.test(text) || MEASURE_WORD.test(text);

/**
 * Un prezzo: una cifra accanto a una valuta, in simbolo o in parola, o una parola del prezzo seguita
 * da vicino da una cifra («prezzo di 900»). Più stretto di `mentionsPrice` delle FAQ: «Il prezzo
 * riflette la qualità dell’acciaio AISI 316» e «the price depends on the 8 finishes» non lo sono.
 */
const CURRENCY = "€|\\$|£|euro|eur|dollar[io]?s?|dólares|usd|chf|pounds sterling|sterline|franchi";
// ⚠️ «costa» dopo un articolo è il litorale, non il verbo (5/11/2026, post «inox al mare»: «sulla costa
// la sigla 316» dava un prezzo): in spagnolo il verbo è «cuesta», in italiano «la costa» non costa.
const PRICE_NEAR =
  /(?<![\p{L}])(?:prezz[oi]|(?<!\b(?:la|sulla|alla|della|dalla|nella|lungo la|en la|de la|a la|por la)\s)cost[aoi]|price[sd]?|costs?|preise?s?|kostet|prix|co[uû]te|precios?|cuesta)\s+(?:\S+\s+){0,2}?\d/iu;
const PRICE = new RegExp(`\\d[\\d.,]*\\s?(?:${CURRENCY})(?![\\p{L}])|(?:€|\\$|£)\\s?\\d`, "iu");

export const mentionsUsePrice = (text: string) => PRICE.test(text) || PRICE_NEAR.test(text);

/** «Quasi tutto…» è la forma giusta: un qualificatore subito prima toglie l'assoluto. */
const NOT_AFTER_QUALIFIER = "(?<!(?:quasi|almost|nearly|fast|presque|casi|praticamente)\\s)";
const START = "(?<![\\p{L}\\p{N}])";

/**
 * «Tutto inox» e simili, nelle cinque lingue (Marco, 3/11/2026): alcune doccette e soffioni sono in
 * ottone, Origo Rame è rame e ottone. Si scrive «quasi tutto in AISI 316, alcune doccette e soffioni
 * in ottone», e quella frase passa. Un falso positivo resta possibile su una frase vera detta di un
 * modello solo («la colonna è tutta in acciaio inox»): si riscrive col nome del materiale.
 */
const ALL_STAINLESS = [
  `(?:tutt[oaie]|interamente|completamente|integralmente|totalmente|100\\s?%)\\s+(?:in\\s+|di\\s+|d['’])?(?:acciaio\\s+)?(?:inox|inossidabile|aisi\\s*316)`,
  `tutt[ie]\\s+i\\s+(?:modelli|prodotti|pezzi|rubinetti)\\s+sono\\s+(?:in\\s+)?(?:acciaio|inox)`,
  `(?:all|entirely|completely|fully|wholly|100\\s?%)[\\s-]+(?:made\\s+)?(?:in\\s+|of\\s+|from\\s+)?(?:stainless|aisi\\s*316)(?!\\s+steel\\s+(?:parts|components|elements|surfaces))`,
  `made\\s+entirely\\s+(?:of|from|in)\\s+stainless`,
  `every\\s+(?:model|product|piece|fixture)\\s+is\\s+(?:made\\s+(?:of|from|in)\\s+)?stainless`,
  `(?:komplett|vollständig|durchgehend|100\\s?%)\\s+(?:aus\\s+|in\\s+)?(?:edelstahl|rostfreiem\\s+stahl|v4a|aisi\\s*316)`,
  `(?:tout|toute|tous|toutes|entièrement|totalement|intégralement|100\\s?%)\\s+(?:en\\s+|d['’]|de\\s+)?(?:inox|acier\\s+inox(?:ydable)?|aisi\\s*316)`,
  `(?:todo|toda|todos|todas|totalmente|completamente|íntegramente|100\\s?%)\\s+(?:de\\s+|en\\s+)?(?:acero\\s+inox(?:idable)?|inox|aisi\\s*316)`,
].map((r) => new RegExp(`${START}${NOT_AFTER_QUALIFIER}${r}`, "iu"));

export const claimsAllStainless = (text: string) => ALL_STAINLESS.some((r) => r.test(text));

/** Larghezza e altezza dall'id dell'asset di Sanity (`image-<hash>-1520x2280-jpg`). */
export function assetSize(ref: string | undefined): { width: number; height: number } | undefined {
  const m = /^image-[a-f0-9]+-(\d+)x(\d+)-[a-z]+$/.exec(ref ?? "");
  return m ? { width: Number(m[1]), height: Number(m[2]) } : undefined;
}

const fold = (s: string) =>
  s
    .toLocaleLowerCase("it")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const spanText = (b: { children?: UseSpan[] }) =>
  (b.children ?? []).map((c) => c.text ?? "").join("");

/** Il testo di un corpo, blocco per blocco, tabelle comprese: per contare le parole. */
export function bodyText(body: readonly UseBlock[] | undefined): string {
  return (body ?? [])
    .map((b) => {
      if (b._type === "block") return spanText(b as { children?: UseSpan[] });
      if (b._type === "keyPoints") return ((b as { items?: string[] }).items ?? []).join("\n");
      if (b._type === "comparisonTable") {
        const t = b as { header?: string[]; rows?: Array<{ cells?: string[] }> };
        return [...(t.header ?? []), ...(t.rows ?? []).flatMap((r) => r.cells ?? [])].join(" ");
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

/** I titoli H2 del corpo, nell'ordine. */
export const bodyHeadings = (body: readonly UseBlock[] | undefined, style = "h2"): string[] =>
  (body ?? [])
    .filter((b) => b._type === "block" && (b as { style?: string }).style === style)
    .map((b) => spanText(b as { children?: UseSpan[] }));

function checkImage(image: UseImage | undefined, where: string, key: string): UseProblem[] {
  const out: UseProblem[] = [];
  if (!image?.asset?._ref) out.push({ level: "error", message: `${where}: manca la foto`, key });
  const alt = image?.alt?.trim() ?? "";
  if (alt.length < 3) out.push({ level: "error", message: `${where}: manca l'alt`, key });
  else if (alt.length > ALT_MAX_CHARS)
    out.push({
      level: "warning",
      message: `${where}: alt di ${alt.length} caratteri (al massimo ${ALT_MAX_CHARS})`,
      key,
    });
  if (alt.includes("—")) out.push({ level: "error", message: `${where}: em dash nell'alt`, key });
  return out;
}

/**
 * I controlli del corpo (Q15): forma dei blocchi, gerarchia, grassetti, link, foto, tabella, e nel
 * testo prezzi, misure, em dash e «tutto inox». Errori e avvisi insieme; il livello lo dice.
 */
export function checkUseBody(body: readonly UseBlock[] | undefined): UseProblem[] {
  const out: UseProblem[] = [];
  const blocks = body ?? [];
  let inH2 = false;
  let boldInSection = 0;
  let tables = 0;
  let boxes = 0;
  const boldSeen = new Set<string>();

  blocks.forEach((b, i) => {
    const key = b._key;
    if (b._type === "block") {
      const block = b as Extract<UseBlock, { _type: "block" }>;
      const style = block.style ?? "normal";
      const text = spanText(block);
      if (!["normal", "h2", "h3"].includes(style))
        out.push({ level: "error", message: `stile «${style}» non ammesso`, key });
      if (
        block.listItem &&
        (!["bullet", "number"].includes(block.listItem) || (block.level ?? 1) !== 1)
      )
        out.push({ level: "error", message: "solo elenchi puntati o numerati di un livello", key });
      if (!text.trim()) out.push({ level: "error", message: "blocco vuoto", key });
      if (style === "h2") {
        inH2 = true;
        boldInSection = 0;
      } else if (!inH2) {
        out.push({
          level: "error",
          message:
            style === "h3" ? "H3 prima di un H2: salto di livello" : "testo prima del primo H2",
          key,
        });
      }
      const marks = (block.children ?? []).flatMap((c) => c.marks ?? []);
      if (style !== "normal" && marks.length)
        out.push({ level: "error", message: "grassetto o link in un titolo", key });
      for (const d of block.markDefs ?? [])
        if (d._type !== "internalLink")
          out.push({ level: "error", message: "solo link interni, niente link esterni", key });
      let before = "";
      for (const c of block.children ?? []) {
        const raw = c.text ?? "";
        const prima = before;
        before += raw;
        if (!c.marks?.includes("strong")) continue;
        const bold = raw.trim();
        const dopo = text.slice(before.length);
        boldInSection++;
        if (boldInSection === 2)
          out.push({ level: "error", message: "più di un grassetto nella sezione", key });
        // Una frase intera: comincia dove comincia una frase e finisce dove finisce (il punto dentro
        // o subito fuori dal grassetto), da 4 parole in su: «- **Club**» o «**perché AISI 316?**» no.
        const inizia = /(^|[.!?:]\s+)$/.test(prima);
        const finisce = /[.!?]$/.test(bold) || /^[.!?](\s|$)/.test(dopo);
        if (inizia && finisce && words(bold).length >= 4)
          out.push({
            level: "error",
            message: `grassetto su una frase intera: «${bold}»`,
            key,
          });
        else if (words(bold).length > BOLD_MAX_WORDS)
          out.push({
            level: "warning",
            message: `grassetto di ${words(bold).length} parole: è la frase chiave?`,
            key,
          });
        if (boldSeen.has(fold(bold)))
          out.push({ level: "error", message: `«${bold}» in grassetto due volte`, key });
        boldSeen.add(fold(bold));
      }
    } else if (b._type === "keyPoints") {
      boxes++;
      const items = (b as { items?: string[] }).items ?? [];
      if (boxes > 1) out.push({ level: "error", message: "un solo box «In sintesi»", key });
      if (i !== 0)
        out.push({
          level: "error",
          message: "il box «In sintesi» sta in testa, prima del primo H2",
          key,
        });
      if (items.length < KEY_POINTS.min || items.length > KEY_POINTS.max)
        out.push({
          level: "error",
          message: `box «In sintesi» di ${items.length} voci (da ${KEY_POINTS.min} a ${KEY_POINTS.max})`,
          key,
        });
      if (items.some((t) => !t?.trim()))
        out.push({ level: "error", message: "box «In sintesi» con una voce vuota", key });
    } else if (b._type === "figure") {
      const img = (b as { image?: UseImage }).image;
      out.push(...checkImage(img, "foto", key));
      const size = assetSize(img?.asset?._ref);
      if (size && size.height > size.width)
        out.push({
          level: "error",
          message: "una foto sola vuole un'orizzontale; due verticali vanno in coppia",
          key,
        });
      if (!inH2) out.push({ level: "error", message: "foto prima del primo H2", key });
    } else if (b._type === "figurePair") {
      const pair = b as { left?: UseImage; right?: UseImage };
      out.push(...checkImage(pair.left, "coppia, sinistra", key));
      out.push(...checkImage(pair.right, "coppia, destra", key));
      for (const img of [pair.left, pair.right]) {
        const size = assetSize(img?.asset?._ref);
        if (size && size.height <= size.width)
          out.push({ level: "error", message: "una coppia vuole due foto verticali", key });
      }
      if (!inH2) out.push({ level: "error", message: "foto prima del primo H2", key });
    } else if (b._type === "comparisonTable") {
      tables++;
      const t = b as { header?: string[]; rows?: Array<{ cells?: string[] }> };
      const header = t.header ?? [];
      const rows = t.rows ?? [];
      if (tables > TABLE_LIMITS.perPage)
        out.push({ level: "error", message: "al massimo una tabella per pagina", key });
      if (header.length < TABLE_LIMITS.minColumns || header.length > TABLE_LIMITS.maxColumns)
        out.push({
          level: "error",
          message: `tabella di ${header.length} colonne (da ${TABLE_LIMITS.minColumns} a ${TABLE_LIMITS.maxColumns})`,
          key,
        });
      if (rows.length === 0 || rows.length > TABLE_LIMITS.maxRows)
        out.push({
          level: "error",
          message: `tabella di ${rows.length} righe (da 1 a ${TABLE_LIMITS.maxRows})`,
          key,
        });
      if (header.some((h) => !h?.trim()))
        out.push({
          level: "error",
          message: "intestazione della tabella con una cella vuota",
          key,
        });
      rows.forEach((r, ri) => {
        const cells = r.cells ?? [];
        if (cells.length !== header.length)
          out.push({
            level: "error",
            message: `riga ${ri + 1} della tabella: ${cells.length} celle su ${header.length} colonne`,
            key,
          });
        if (cells.some((c) => !c?.trim()))
          out.push({
            level: "error",
            message: `riga ${ri + 1} della tabella: criteri uguali in ogni riga, nessuna cella vuota`,
            key,
          });
      });
      const prev = blocks[i - 1] as { _type?: string; style?: string; listItem?: string };
      if (prev?._type !== "block" || (prev.style ?? "normal") !== "normal" || prev.listItem)
        out.push({
          level: "error",
          message: "la tabella vuole una frase che la introduce, subito prima",
          key,
        });
      if (!inH2) out.push({ level: "error", message: "tabella prima del primo H2", key });
    } else {
      out.push({ level: "error", message: `blocco «${b._type}» non ammesso`, key });
    }
  });

  const text = bodyText(blocks);
  if (mentionsUsePrice(text)) out.push({ level: "error", message: "un prezzo nel corpo" });
  if (mentionsMeasure(text)) out.push({ level: "error", message: "una misura nel corpo" });
  if (text.includes("—")) out.push({ level: "error", message: "em dash nel corpo" });
  if (claimsAllStainless(text))
    out.push({
      level: "error",
      message:
        "«tutto inox»: si scrive «quasi tutto in AISI 316, alcune doccette e soffioni in ottone»",
    });
  return out;
}
