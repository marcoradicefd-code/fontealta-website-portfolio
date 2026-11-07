import { defineField } from "sanity";

import { FAQ_LINK_ROUTES, type FaqLinkRoute } from "../../lib/faq-rules";

const ROUTES = Object.keys(FAQ_LINK_ROUTES) as FaqLinkRoute[];
const needsReference = (route: unknown) =>
  typeof route === "string" && FAQ_LINK_ROUTES[route as FaqLinkRoute] !== null;

/**
 * L'annotazione del link interno, la stessa per le risposte FAQ (`faqBlocks`) e il corpo delle
 * pagine d'uso (`useBody`): una rotta di `routing.pathnames` più, per le rotte con slug, la
 * referenza al documento. A video la rotta diventa il percorso della lingua della pagina.
 *
 * Estratta da `faqBlocks.ts` il 3/11/2026 (c1a) senza cambiarne la forma: i link già su Sanity
 * restano validi.
 */
export const internalLinkAnnotation = {
  name: "internalLink",
  type: "object",
  title: "Link interno",
  fields: [
    defineField({
      name: "route",
      title: "Pagina",
      type: "string",
      options: { list: ROUTES },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "reference",
      title: "Documento",
      type: "reference",
      to: [
        { type: "collection" },
        { type: "concealedBody" },
        { type: "model" },
        { type: "post" },
        { type: "projectReference" },
      ],
      // Si sceglie solo fra i documenti del tipo che la pagina vuole: un modello per
      // `/modello/[slug]`, un post per `/blog/[slug]`.
      options: {
        filter: ({ parent }) => {
          const route = (parent as { route?: FaqLinkRoute } | undefined)?.route;
          const type = route ? FAQ_LINK_ROUTES[route] : null;
          return type ? { filter: "_type == $type", params: { type } } : {};
        },
      },
      hidden: ({ parent }) => !needsReference(parent?.route),
      validation: (Rule) =>
        Rule.custom((value: { _ref?: string } | undefined, context) => {
          const route = (context.parent as { route?: unknown } | undefined)?.route;
          return needsReference(route) && !value?._ref ? "Questa pagina vuole il documento" : true;
        }),
    }),
  ],
};
