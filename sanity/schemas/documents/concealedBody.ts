import { defineArrayMember, defineField, defineType } from "sanity";

import { PRODUCT_MACROS } from "./model-taxonomy";
import { WATER_SUPPLY } from "./water-supply";

/**
 * Corpo a incasso — il pezzo che resta nel muro, venduto a parte dai 92 articoli
 * che lo richiedono (`model.requiredConcealedBody`).
 *
 * Cantiere INCASSI (lug 2026): da record tecnico senza pagina a oggetto con scheda
 * propria dentro `/collezioni/corpi-a-incasso`. Piano completo, decisioni e spec
 * differenziale della scheda: `docs/incassi-design.md`.
 *
 * NB `servesMacros` usa `PRODUCT_MACROS` ma NON `MACRO_SUBTYPES`: un corpo non è un
 * `model`, non ha sottotipo, e la validazione della coppia macro↔sottotipo non si
 * applica. `waterSupply` condivide la lista con `model` via `./water-supply`.
 */
export const concealedBody = defineType({
  name: "concealedBody",
  title: "Concealed body",
  type: "document",
  fields: [
    defineField({
      name: "code",
      title: "Code",
      type: "string",
      description:
        "Catalogue code of the in-wall body (e.g. CW.1, ST.INC, W2MP.INC). Sold separately.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "code",
        slugify: (input) => input.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      },
      description: "URL della scheda: /collezioni/corpi-a-incasso/<slug>. Derivato dal codice.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "name",
      title: "Name",
      type: "localizedString",
      description:
        "Etichetta breve. Oggi coincide col codice su tutti e 17 i documenti e NON viene " +
        "renderizzata (l'H1 della scheda è il codice): è lo slot per un eventuale nome " +
        "parlante futuro. Serve però come titolo nello Studio.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "localizedPortableText",
      description: "Full description of the concealed body (AISI 316 spec, water type).",
    }),
    defineField({
      name: "servesMacros",
      title: "Ambienti serviti",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: { list: [...PRODUCT_MACROS], layout: "grid" },
      description:
        "Macro-categorie che questo corpo serve. Un corpo può servirne più di una e in quel " +
        "caso compare sotto OGNI ambiente nel filtro dell'indice. Conoscenza editoriale, non " +
        "derivabile dagli articoli: CW.1 e CW.2 non sono richiesti da nessun articolo eppure " +
        "servono lavabo, doccia e vasca.",
      validation: (Rule) => Rule.min(1),
    }),
    defineField({
      name: "waterSupply",
      title: "Water supply (drops 💧)",
      type: "string",
      options: { list: [...WATER_SUPPLY], layout: "radio" },
      description:
        "Marcatore gocce del catalogo. Stessa lista di `model` (sorgente unica in " +
        "./water-supply): sui 17 corpi valgono solo cold e hot-cold.",
    }),
    defineField({
      name: "image",
      title: "Image",
      type: "imageWithMeta",
      description:
        "Render del corpo. Finché è vuoto la scheda mostra il monogramma placeholder, come " +
        "le card modello senza foto — la sezione non aspetta le immagini per esistere.",
    }),
    defineField({
      name: "order",
      title: "Order",
      type: "number",
      validation: (Rule) => Rule.integer().positive(),
      description: "Posizione nell'indice. Ordine del riepilogo di catalogo (pag. 214).",
    }),
    defineField({
      name: "specs",
      title: "Misure",
      type: "specsMisure",
      description: "Le misure dal listino (spec contenuti-per-lingua § B), come sui modelli.",
    }),
    defineField({
      name: "seo",
      title: "SEO",
      type: "seoFields",
    }),
  ],
  orderings: [
    {
      title: "Order (catalogo)",
      name: "orderAsc",
      by: [
        { field: "order", direction: "asc" },
        { field: "code", direction: "asc" },
      ],
    },
    {
      title: "Code (asc)",
      name: "codeAsc",
      by: [{ field: "code", direction: "asc" }],
    },
  ],
  preview: {
    select: { title: "name.it", code: "code", media: "image" },
    prepare: ({ title, code, media }) => ({
      title: title || code || "(untitled)",
      subtitle: code,
      media,
    }),
  },
});
