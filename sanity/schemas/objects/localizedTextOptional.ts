import { defineField, defineType } from "sanity";

/**
 * `localizedText` senza il `required` sull'italiano. Stessa ragione, stessa
 * forma e stesse lingue di `localizedStringOptional`: la spiegazione per intero
 * sta lì.
 */
/** Cinque lingue dichiarate, due accese: la spiegazione per intero sta in
 *  `localizedString.ts`. `required` solo sull'italiano, nessuna migrazione. */
export const localizedTextOptional = defineType({
  name: "localizedTextOptional",
  title: "Localized text (optional)",
  type: "object",
  fields: [
    defineField({ name: "it", title: "Italiano", type: "text", rows: 3 }),
    defineField({ name: "en", title: "English", type: "text", rows: 3 }),
    defineField({ name: "de", title: "Deutsch", type: "text", rows: 3 }),
    defineField({ name: "fr", title: "Français", type: "text", rows: 3 }),
    defineField({ name: "es", title: "Español", type: "text", rows: 3 }),
  ],
});
