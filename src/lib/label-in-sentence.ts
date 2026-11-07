import type { Locale } from "@/i18n/routing";

/**
 * Come entra dentro una frase un'etichetta nata per stare da sola.
 *
 * `productCategories`, `productSubtypes` e `finishesTitle` sono capitalizzate
 * perché nascono per le pill e per i titoli. Dentro una frase la maiuscola in
 * mezzo è un errore in italiano, inglese, francese e spagnolo («Colonna per
 * Lavabo», «4 Finiture»), e lì l'etichetta si abbassa.
 *
 * ⚠️ **In tedesco no: i sostantivi sono maiuscoli per regola di lingua.**
 * Abbassarli dava «Säule für waschtisch» nella description, «Waschtisch —
 * säule» e «4 oberflächen» nell'hero della scheda: misurati in produzione il
 * 16/09/2026, il giorno dell'accensione.
 *
 * ⚠️ **Una mappa per lingua e non un `if (locale === "de")`.** La regola è una
 * proprietà della lingua, e la mappa obbliga a dichiararla per ognuna: con
 * `satisfies Record<Locale, …>` una lingua nuova in `ALL_LOCALES` senza la sua
 * riga è un errore di typecheck, mentre un `if` la tratterebbe in silenzio come
 * l'italiano.
 *
 * Due consumatori, ed è la ragione per cui la regola sta qui e non in uno dei
 * due: la frase di tipo della description (`product-type-phrase.ts`) e
 * `sentenceCase`, che rende la riga meta dell'hero (`model-hero.tsx`).
 */
const lowercase = (label: string, locale: Locale) => label.toLocaleLowerCase(locale);
const unchanged = (label: string) => label;

export const LABEL_IN_SENTENCE = {
  it: lowercase,
  en: lowercase,
  de: unchanged,
  fr: lowercase,
  es: lowercase,
} as const satisfies Record<Locale, (label: string, locale: Locale) => string>;

export function labelInSentence(label: string, locale: Locale): string {
  return LABEL_IN_SENTENCE[locale](label, locale);
}
