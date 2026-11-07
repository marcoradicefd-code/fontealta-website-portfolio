import type { Locale } from "@/i18n/routing";

/**
 * I termini UFFICIALI del catalogo per coppia (macro, sottotipo), dove la
 * composizione `{sottotipo} + preposizione + {macro}` non li sa produrre.
 *
 * Nascono da una decisione di Marco del 21/09/2026: il sito deve dire quello
 * che dice il listino. La verifica è un join fra l'Excel dei contenuti e i
 * documenti Sanity **per codice articolo**, non una lettura a campione:
 *
 *   coppia            articoli   il sito diceva        l'Excel dice        su
 *   doccia/colonna       114     Colonna per doccia    Colonna doccia     112
 *                                Säule für Dusche      Duschsäule         101
 *                                Columna para ducha    Columna de ducha   112
 *   vasca/colonna         44     Säule für Badewanne   Badewannensäule     36
 *                                Columna para bañera   Columna de bañera   44
 *   lavabo/colonna        22     Säule für Waschtisch  Waschtischsäule     22
 *                                Columna para lavabo   Columna de lavabo   22
 *
 * ⚠️ **Perché una tabella e non un dizionario**: in tedesco il termine è un
 * COMPOSTO — macro e sottotipo diventano una parola sola — e nessun valore di
 * `productSubtypes.colonna` può produrre `Duschsäule`, `Waschtischsäule` e
 * `Badewannensäule` a seconda della macro. In spagnolo cambia la preposizione
 * solo per le colonne («de» invece di «para»), e in italiano cade solo sulla
 * doccia.
 *
 * ⚠️ **Le coppie che l'Excel non distingue NON stanno qui.** `giardino/colonna`
 * (10 articoli) sull'Excel è «Colonna con…», «Säule mit…»: nessun termine di
 * tipo, e la composizione di oggi è già quella giusta. Le altre 29 coppie
 * hanno sull'Excel forme tecniche eterogenee (`AP-Ventil`, `UP-Brausemischer`)
 * che non sono nomi di tipo: metterle qui vorrebbe dire scambiare un nome di
 * categoria con il codice di una valvola.
 *
 * ⚠️ **Italiano: manca lavabo e vasca apposta.** Lì l'Excel dice «Colonna per
 * lavabo» e «Colonna per vasca», cioè **esattamente** quello che il sito già
 * compone: aggiungerle sarebbe scrivere una deroga che non deroga niente.
 */
const TERMINI_UFFICIALI: Record<string, Partial<Record<Locale, string>>> = {
  "doccia/colonna": {
    it: "Colonna doccia",
    de: "Duschsäule",
    es: "Columna de ducha",
  },
  "lavabo/colonna": {
    de: "Waschtischsäule",
    es: "Columna de lavabo",
  },
  "vasca/colonna": {
    de: "Badewannensäule",
    es: "Columna de bañera",
  },
};

/**
 * Il termine ufficiale per una coppia, o `null` se per quella coppia e quella
 * lingua il catalogo non dice niente di diverso dalla composizione.
 *
 * ⚠️ Le chiavi sono quelle CRUDE di Sanity (`productMacro`, `productSubtype`),
 * non le etichette tradotte: un'etichetta cambia con la lingua e con il copy,
 * una chiave no.
 */
export function officialTypeTerm(
  macro: string | null | undefined,
  subtype: string | null | undefined,
  locale: Locale,
): string | null {
  if (!macro || !subtype) return null;
  return TERMINI_UFFICIALI[`${macro}/${subtype}`]?.[locale] ?? null;
}
