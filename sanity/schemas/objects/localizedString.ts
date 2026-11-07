import { defineField, defineType } from "sanity";

/**
 * ⚠️ **Cinque lingue dichiarate, due accese, e la differenza è deliberata.**
 * `de`, `fr` ed `es` esistono qui perché **si possa scrivere** il contenuto
 * prima di accendere la lingua: senza queste schede non c'è dove mettere una
 * traduzione, e una lingua si accende solo quando è **intera**. L'accensione
 * resta una riga in `ACTIVE_LOCALES`, non un giro su questo file.
 *
 * ⚠️ **Il `required` resta SOLO sull'italiano.** Metterlo anche sulle lingue
 * nuove renderebbe non ripubblicabile ogni documento esistente — cioè tutti —
 * il giorno stesso di questa modifica. L'italiano è la lingua sorgente: è
 * l'unica che deve esserci sempre.
 *
 * ⚠️ **Nessuna migrazione, e non serve.** I documenti che non hanno le chiavi
 * nuove restano validi: un campo assente dentro un oggetto non è un errore di
 * validazione, è un campo vuoto. Lo stesso vale per le query, che dopo la PR
 * i18n leggono `coalesce(campo[$locale], campo.it)` dove il ripiego è la regola.
 */
export const localizedString = defineType({
  name: "localizedString",
  title: "Localized string",
  type: "object",
  fields: [
    defineField({
      name: "it",
      title: "Italiano",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "en",
      title: "English",
      type: "string",
    }),
    defineField({
      name: "de",
      title: "Deutsch",
      type: "string",
    }),
    defineField({
      name: "fr",
      title: "Français",
      type: "string",
    }),
    defineField({
      name: "es",
      title: "Español",
      type: "string",
    }),
  ],
});
