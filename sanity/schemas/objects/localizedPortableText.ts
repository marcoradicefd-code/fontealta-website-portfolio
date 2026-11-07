import { defineArrayMember, defineField, defineType } from "sanity";

import { internalLinkAnnotation } from "./internalLink";

/**
 * ⚠️ **Il corpo dei post ha anche i blocchi della pagina d'uso** (Marco, grill del 5/11/2026, Q7, Q8,
 * Q29, Q30): il box «In sintesi», la foto, la tabella di confronto, il video, e il link interno che
 * il caricatore scrive (`pnpm post:carica`). Stanno qui e non in un tipo nuovo del corpo dei post
 * perché i 28 post salvati portano `_type: "localizedPortableText"`: un tipo diverso nello schema
 * avrebbe voluto una migrazione di tutti i post, e con lei un `_updatedAt` nuovo, cioè una
 * `dateModified` falsa su ognuno. Lo stesso tipo serve le descrizioni dei modelli (due campi) e dei
 * corpi a incasso: lì i blocchi in più compaiono nel menu di Studio ma la pagina non li rende, e non
 * vanno usati. Toglierli dal menu di quei campi vorrebbe un tipo a parte, cioè la stessa migrazione
 * di `_type` (Marco, 5/11: annotato, non fatto).
 */
const portableBlocks = [
  defineArrayMember({
    type: "block",
    styles: [
      { title: "Normal", value: "normal" },
      { title: "H2", value: "h2" },
      { title: "H3", value: "h3" },
      { title: "Quote", value: "blockquote" },
    ],
    lists: [
      { title: "Bullet", value: "bullet" },
      { title: "Number", value: "number" },
    ],
    marks: {
      decorators: [
        { title: "Strong", value: "strong" },
        { title: "Emphasis", value: "em" },
      ],
      annotations: [
        {
          name: "link",
          type: "object",
          title: "Link",
          fields: [
            {
              name: "href",
              type: "url",
              title: "URL",
              description:
                "Un indirizzo completo (https://…), oppure un percorso del sito nella lingua del testo: /doccia-da-esterno, /en/outdoor-shower.",
              // I percorsi relativi del sito (Marco, 4/11/2026): il link degli ingressi verso la
              // pagina d'uso si scrive col percorso della lingua (`post:link`). La regola sostituisce
              // quella predefinita del tipo `url`, quindi gli schemi ammessi si elencano tutti.
              // ⚠️ Con `allowRelative` Studio mostra il campo come testo e il browser non lo valida
              // più come URL: il controllo resta questo, e a video la guardia di `article-body`.
              validation: (Rule) =>
                Rule.uri({ allowRelative: true, scheme: ["http", "https", "mailto", "tel"] }),
            },
          ],
        },
        internalLinkAnnotation,
      ],
    },
  }),
  defineArrayMember({ type: "keyPoints" }),
  defineArrayMember({ type: "figure" }),
  defineArrayMember({ type: "comparisonTable" }),
  defineArrayMember({ type: "videoLink" }),
];

/** Cinque lingue dichiarate, due accese: la spiegazione per intero sta in
 *  `localizedString.ts`. `required` solo sull'italiano, nessuna migrazione. */
export const localizedPortableText = defineType({
  name: "localizedPortableText",
  title: "Localized rich text",
  type: "object",
  fields: [
    defineField({
      name: "it",
      title: "Italiano",
      type: "array",
      of: portableBlocks,
    }),
    defineField({
      name: "en",
      title: "English",
      type: "array",
      of: portableBlocks,
    }),
    defineField({
      name: "de",
      title: "Deutsch",
      type: "array",
      of: portableBlocks,
    }),
    defineField({
      name: "fr",
      title: "Français",
      type: "array",
      of: portableBlocks,
    }),
    defineField({
      name: "es",
      title: "Español",
      type: "array",
      of: portableBlocks,
    }),
  ],
});
