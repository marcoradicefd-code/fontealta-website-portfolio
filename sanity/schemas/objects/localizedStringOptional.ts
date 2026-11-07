import { defineField, defineType } from "sanity";

/**
 * `localizedString` senza il `required` sull'italiano.
 *
 * ⚠️ **Esiste per una ragione sola, e non è la voglia di un tipo in più.**
 * `localizedString` ha `Rule.required()` su `it` (riga 12), giusto per i dieci
 * campi che lo usano: titoli, excerpt, label, cose che devono esserci. Nei campi
 * SEO il vuoto è il caso NORMALE, perché vuoto significa «esce il titolo
 * automatico»; e «scritto solo in inglese» è un caso legittimo, che un required
 * su `it` bloccherebbe al publish.
 *
 * Togliere il required da `localizedString` avrebbe spento quella guardia sui
 * dieci campi dove serve. Due tipi in più costano una riga nel registro degli
 * schemi; un titolo obbligatorio dove non deve esserlo costa un publish rifiutato
 * in Studio.
 *
 * Le lingue restano `it` ed `en`: `de/fr/es` arrivano con la PR i18n, che tocca
 * questi file e non altri.
 */
/** Cinque lingue dichiarate, due accese: la spiegazione per intero sta in
 *  `localizedString.ts`. `required` solo sull'italiano, nessuna migrazione. */
export const localizedStringOptional = defineType({
  name: "localizedStringOptional",
  title: "Localized string (optional)",
  type: "object",
  fields: [
    defineField({ name: "it", title: "Italiano", type: "string" }),
    defineField({ name: "en", title: "English", type: "string" }),
    defineField({ name: "de", title: "Deutsch", type: "string" }),
    defineField({ name: "fr", title: "Français", type: "string" }),
    defineField({ name: "es", title: "Español", type: "string" }),
  ],
});
