import { defineField, defineType } from "sanity";

/**
 * Category — blog taxonomy (FASE 1 blog foundations).
 * Drives the category filter pills and category URLs. Field-level localized
 * (`localizedString` title) like the rest of the blog model. Lo slug NON e' localizzato: la lingua la porta il prefisso di rotta, non lo slug.
 * `order` controls the pill order in the filter bar.
 */
export const category = defineType({
  name: "category",
  title: "Category",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "localizedString",
      description: 'e.g. "Materia e Acciaio" / "Materials & Steel".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      // Single, non-localized slug auto-generated from the IT title — same
      // pattern as model/collection. Language is carried by the route prefix
      // (/it vs /en), not the slug. "Generate" works out of the box.
      options: { source: "title.it", maxLength: 96 },
      description: "Used for category filters and URLs. Generated from the IT title.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "order",
      title: "Order",
      type: "number",
      initialValue: 100,
      description: "Lower numbers come first in the category filter pills.",
    }),
  ],
  preview: {
    select: { title: "title.it" },
    prepare: ({ title }) => ({
      title: title || "(untitled category)",
    }),
  },
  orderings: [
    {
      title: "Manual order",
      name: "manualOrder",
      by: [{ field: "order", direction: "asc" }],
    },
  ],
});
