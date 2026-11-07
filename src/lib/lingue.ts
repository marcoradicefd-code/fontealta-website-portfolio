/**
 * Il nome di ogni lingua **nella lingua stessa**.
 *
 * ⚠️ **Stava in `navigation.tsx` e serviva anche a `/llms.txt`**: due copie della
 * stessa tabella sono due occasioni di divergere, e questa in particolare
 * cresce ogni volta che si accende una lingua. Chi la scrive in due posti se ne
 * accorge la seconda volta, quando una delle due è già vecchia.
 *
 * ⚠️ **Copre tutte e cinque le lingue di `ALL_LOCALES`, non solo le attive**: è
 * una tabella di conversione, non un elenco di ciò che è acceso, ed è la stessa
 * scelta già fatta per `OG_LOCALE`. Il giorno che il tedesco entra in
 * `ACTIVE_LOCALES` non c'è niente da aggiungere qui.
 */
import type { Locale } from "@/i18n/routing";

export const NOMI_LINGUA: Record<Locale, string> = {
  it: "Italiano",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
};

/**
 * ⚠️ **`Record<Locale, string>` e non `as const satisfies`.** La seconda forma
 * dà lo stesso controllo di copertura ma restringe le chiavi ai cinque letterali,
 * e il nav indicizza con una `string` che gli arriva dal router: `TS7053`. Il
 * tipo esplicito tiene la copertura — una lingua nuova senza il suo nome è un
 * errore di compilazione — e lascia passare l'indicizzazione.
 */
export const nomeLingua = (locale: string): string => NOMI_LINGUA[locale as Locale] ?? locale;

/**
 * Il locale per `Intl`, che vuole la forma con il paese.
 *
 * ⚠️ **`en-GB` e non `en-US`**: il copy inglese del sito è britannico, e una data americana in
 * mezzo a un testo britannico è una svista che si nota.
 *
 * ⚠️ **Stava scritto in tre posti, e due erano un ternario** (`locale === "it" ? "it-IT" :
 * "en-GB"`) nelle pagine del blog: acceso il tedesco, il blog tedesco avrebbe datato i post
 * all'inglese, «15 September 2026», senza un errore da nessuna parte. Qui è una tabella su tutte
 * le lingue, e il typecheck vuole la riga di ognuna.
 */
export const LOCALE_INTL: Record<Locale, string> = {
  it: "it-IT",
  en: "en-GB",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
};
