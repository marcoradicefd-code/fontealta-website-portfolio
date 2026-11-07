import type { Locale } from "@/i18n/routing";

import { labelInSentence } from "./label-in-sentence";

/**
 * sentenceCase — sentence-case a string while preserving acronyms.
 *
 * Per whitespace-separated token: if the token is entirely uppercase in the
 * source (has cased letters, all uppercase — e.g. "PVD"), keep it verbatim;
 * otherwise it enters the sentence by the locale's rule (`labelInSentence`).
 * Then capitalize the first character of the whole result. Whitespace runs are
 * preserved as-is.
 *
 * ⚠️ La regola del token è della LINGUA: in italiano, inglese, francese e
 * spagnolo si abbassa, in tedesco resta com'è perché i sostantivi sono maiuscoli.
 * Senza la lingua l'hero tedesco della scheda diceva «Waschtisch — säule» e
 * «4 oberflächen» (misurato in produzione il 16/09/2026).
 *
 * RENDER-TIME ONLY — the Sanity source data is never mutated.
 *
 *   sentenceCase("Doccia — Colonna", "it")             → "Doccia — colonna"
 *   sentenceCase("PVD Nero Assoluto Spazzolato", "it") → "PVD nero assoluto spazzolato"
 *   sentenceCase("Waschtisch — Säule", "de")           → "Waschtisch — Säule"
 */
export function sentenceCase(input: string, locale: Locale): string {
  const lowered = input
    .split(/(\s+)/)
    .map((tok) => {
      if (tok === "" || /^\s+$/.test(tok)) return tok;
      // "entirely uppercase" = has cased letters and none are lowercase.
      const isAcronym = tok === tok.toUpperCase() && tok !== tok.toLowerCase();
      return isAcronym ? tok : labelInSentence(tok, locale);
    })
    .join("");
  return lowered.charAt(0).toLocaleUpperCase(locale) + lowered.slice(1);
}
