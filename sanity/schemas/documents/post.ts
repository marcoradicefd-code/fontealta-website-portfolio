import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * Post — blog article (FASE 1 blog foundations).
 *
 * Field-level i18n (like `model`): localized field types carry IT + EN, no
 * per-locale document. IT mandatory, EN best-effort during Sprint 2.
 *
 * NOTE: reading time is NOT a stored field — it is computed from `body` at
 * runtime (FASE 3). Do not add a `readingTime` field here.
 */
export const post = defineType({
  name: "post",
  title: "Post",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "localizedString",
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
      description: "Generated from the IT title. Used for the article URL.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "excerpt",
      title: "Excerpt",
      type: "localizedText",
      description: "Short summary shown in cards (2–3 lines).",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "coverImage",
      title: "Cover image",
      type: "imageWithMeta",
      description: "Used in the article card and at the top of the article page.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "localizedPortableText",
      description: "The full rich-text article body.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "categories",
      title: "Categories",
      type: "array",
      of: [defineArrayMember({ type: "reference", to: [{ type: "category" }] })],
      description: "One or more categories. Drives the category filters.",
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: "author",
      title: "Author",
      type: "reference",
      to: [{ type: "author" }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "publishedAt",
      title: "Published at",
      type: "datetime",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      // Marco, grill del 5/11/2026, Q10: la data di revisione EDITORIALE. Vale per `dateModified` e
      // per «Aggiornato il» in pagina; senza, `dateModified` è la data di pubblicazione, mai
      // `_updatedAt` (Marco, 5/11/2026 sera). La scrive `pnpm post:carica` il giorno del carico.
      name: "revisedAt",
      title: "Data di revisione",
      type: "date",
      description:
        "Compilala quando modifichi davvero il testo: diventa «Aggiornato il» e la data di modifica per Google.",
    }),
    defineField({
      name: "featured",
      title: "Featured",
      type: "boolean",
      initialValue: false,
      description: "When true, this article is shown large at the top of the blog.",
    }),
    defineField({
      name: "seo",
      title: "SEO",
      type: "seoFields",
    }),
  ],
  preview: {
    select: {
      title: "title.it",
      media: "coverImage",
      publishedAt: "publishedAt",
      featured: "featured",
    },
    prepare: ({ title, media, publishedAt, featured }) => ({
      title: title || "(untitled post)",
      subtitle: [
        publishedAt ? String(publishedAt).slice(0, 10) : null,
        featured ? "★ featured" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      media,
    }),
  },
  orderings: [
    {
      title: "Published (newest)",
      name: "publishedDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
  ],
});
