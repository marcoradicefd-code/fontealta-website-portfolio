import { defineArrayMember, defineType } from "sanity";

import { internalLinkAnnotation } from "./internalLink";

/**
 * I blocchi di una risposta FAQ (spec § 4, § 5): paragrafi, grassetto e corsivo, due link.
 * `internalLink` (in `internalLink.ts`, condiviso col corpo delle pagine d'uso) è una rotta di
 * `routing.pathnames` più, per le rotte con slug, la referenza al documento: a video la rotta
 * diventa il percorso della lingua della pagina, senza scriverlo. `link` è quello di
 * `localizedPortableText`, a URL assoluto. Niente titoli né citazioni dentro una risposta.
 */
export const faqBlocks = defineType({
  name: "faqBlocks",
  title: "Risposta",
  type: "array",
  of: [
    defineArrayMember({
      type: "block",
      styles: [{ title: "Normale", value: "normal" }],
      lists: [],
      marks: {
        decorators: [
          { title: "Grassetto", value: "strong" },
          { title: "Corsivo", value: "em" },
        ],
        annotations: [
          internalLinkAnnotation,
          {
            name: "link",
            type: "object",
            title: "Link esterno",
            fields: [{ name: "href", type: "url", title: "URL" }],
          },
        ],
      },
    }),
  ],
});
