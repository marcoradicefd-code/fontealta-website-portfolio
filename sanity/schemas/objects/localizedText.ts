import { defineField, defineType } from "sanity";

/** Cinque lingue dichiarate, due accese: la spiegazione per intero sta in
 *  `localizedString.ts`. `required` solo sull'italiano, nessuna migrazione. */
export const localizedText = defineType({
  name: "localizedText",
  title: "Localized text",
  type: "object",
  fields: [
    defineField({
      name: "it",
      title: "Italiano",
      type: "text",
      rows: 3,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "en",
      title: "English",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "de",
      title: "Deutsch",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "fr",
      title: "Français",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "es",
      title: "Español",
      type: "text",
      rows: 3,
    }),
  ],
});
