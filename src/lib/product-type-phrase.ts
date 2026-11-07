import type { Locale } from "@/i18n/routing";

import { labelInSentence } from "./label-in-sentence";
import { officialTypeTerm } from "./official-type-term";

/**
 * Le due frasi dei messaggi `modello.tipo` e `modello.tipoSoloAmbiente`, già
 * legate al traduttore della pagina. Funzioni e non il traduttore intero: il tipo
 * di `t` di next-intl vuole chiavi letterali, e qui servono solo queste due.
 */
export type TypePhraseMessages = {
  withSubtype: (values: { subtype: string; categoria: string }) => string;
  macroOnly: (values: { categoria: string }) => string;
};

/**
 * Il tipo di prodotto in forma di frase, con l'iniziale maiuscola: «Colonna per
 * lavabo», EN «Basin column», DE «Säule für Waschtisch».
 *
 * L'ordine delle due parole lo decide il messaggio della lingua, non questo
 * codice; qui si decide solo come entrano le etichette (`labelInSentence`) e che
 * la frase cominci con la maiuscola.
 */
export function productTypePhrase(
  parts: { macro: string; subtype: string | null } | null,
  locale: Locale,
  messages: TypePhraseMessages,
  /**
   * Le chiavi CRUDE del documento. Servono al termine ufficiale, che si guarda
   * per coppia (macro, sottotipo) e non per etichetta: un'etichetta cambia con
   * la lingua e con il copy, una chiave no. Chi non le passa ha la sola
   * composizione, che è il comportamento di prima del 21/09/2026.
   */
  keys?: { macro: string | null | undefined; subtype: string | null | undefined },
): string | null {
  const ufficiale = officialTypeTerm(keys?.macro, keys?.subtype, locale);
  if (ufficiale) return ufficiale;
  if (!parts) return null;
  const categoria = labelInSentence(parts.macro, locale);
  const phrase = parts.subtype
    ? messages.withSubtype({ subtype: labelInSentence(parts.subtype, locale), categoria })
    : // Senza sottotipo resta il solo ambiente, e SEMPRE in forma
      // preposizionale: «per doccia», mai «Doccia» come soggetto, che
      // direbbe che il prodotto È una doccia invece che un pezzo per la
      // doccia. Oggi non capita: 0 modelli su 595 sono senza sottotipo.
      messages.macroOnly({ categoria });
  return phrase.charAt(0).toLocaleUpperCase(locale) + phrase.slice(1);
}
