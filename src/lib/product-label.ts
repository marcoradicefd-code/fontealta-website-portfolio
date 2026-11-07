/**
 * FRONT 2 — etichetta prodotto («pill»), composta da macro + sottotipo.
 *
 *   productCategories[macro] + " — " + productSubtypes[subtype]
 *   es. «Doccia — Colonna», EN «Shower — Column»
 *
 * Sorgente unica per i tre punti che la mostrano: card modello, riga «Tipologia»
 * delle specifiche, riga meta dell'hero scheda. Piano: `docs/front2-design.md`.
 *
 * Il separatore è ` — ` (em dash spaziata), lo stesso che usavano le label
 * `productTypes` legacy → a schermo la forma non è cambiata alla migrazione.
 */

import type { Locale } from "@/i18n/routing";

import { officialTypeTerm } from "./official-type-term";

/**
 * Forma minima di un traduttore `useTranslations(namespace)` di next-intl: la
 * chiamata con chiave più `has()` per il degrado. Tipo STRUTTURALE e non un
 * import da next-intl, così l'helper resta indipendente dalla libreria e
 * testabile passando un oggetto finto.
 */
export type LabelLookup = {
  (key: string): string;
  has: (key: string) => boolean;
};

type ProductModel = {
  productMacro?: string | null;
  productSubtype?: string | null;
};

/**
 * Le due etichette, risolte e separate, **prima** di essere unite da qualcuno.
 *
 * Estratta perché la pill non è più l'unico consumatore: la `description` delle
 * schede compone le stesse due parole in una frase, e con un'altra
 * punteggiatura. Unire in due posti diversi vorrebbe dire due degradi diversi
 * il giorno che una chiave i18n manca.
 *
 * `macro` esce sempre se il campo c'è; `subtype` può essere `null` da solo. La
 * PILL invece vuole la coppia completa — mezza etichetta è peggio di nessuna —
 * e quel vincolo resta dove serve, in `productLabel`.
 *
 * Con la chiave presente ma la traduzione mancante si degrada allo **slug
 * grezzo**, che è brutto ma VISIBILE: il buco di traduzione deve saltare
 * all'occhio, non essere mascherato da una resa plausibile.
 */
export function productLabelParts(
  model: ProductModel,
  t: { macro: LabelLookup; subtype: LabelLookup },
): { macro: string; subtype: string | null } | null {
  if (!model.productMacro) return null;
  const macro = t.macro.has(model.productMacro) ? t.macro(model.productMacro) : model.productMacro;
  const subtype = model.productSubtype
    ? t.subtype.has(model.productSubtype)
      ? t.subtype(model.productSubtype)
      : model.productSubtype
    : null;
  return { macro, subtype };
}

/**
 * ⚠️ **Il TERMINE UFFICIALE vince sulla composizione** (21/09/2026), e dove
 * vince la pill perde l'em dash — perché quel termine è **una parola sola**:
 * «Duschsäule», non «Dusche — Säule». Non è la bonifica tipografica che il LOCK
 * di `CLAUDE.md` vieta: l'em dash resta il separatore delle altre 30 coppie, e
 * qui sparisce solo perché non c'è più niente da separare. Le coppie sono tre —
 * le colonne di doccia, lavabo e vasca — e il perché, col join sull'Excel, sta
 * in `official-type-term.ts`.
 */
export function productLabel(
  model: ProductModel,
  t: { macro: LabelLookup; subtype: LabelLookup },
  locale: Locale,
): string | null {
  const ufficiale = officialTypeTerm(model.productMacro, model.productSubtype, locale);
  if (ufficiale) return ufficiale;
  // Serve la coppia COMPLETA: mezza etichetta («Doccia — ») è peggio di nessuna.
  const parti = productLabelParts(model, t);
  if (!parti?.subtype) return null;
  return `${parti.macro} — ${parti.subtype}`;
}
