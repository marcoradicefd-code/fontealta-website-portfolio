import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * Reference (project) — DOCUMENT-LEVEL i18n.
 * Internal type name `projectReference` because `reference` is a Sanity
 * reserved name (used as the primitive ref field type). The Studio still
 * presents this as "Reference" to editors; URL-facing slug stays `/referenze`.
 */
export const projectReference = defineType({
  name: "projectReference",
  title: "Reference",
  type: "document",
  fields: [
    defineField({
      name: "language",
      title: "Language",
      type: "string",
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title" },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "architect",
      title: "Architect / studio",
      type: "string",
    }),
    defineField({
      name: "location",
      title: "Location",
      type: "string",
      description: "City, region.",
    }),
    defineField({
      name: "country",
      title: "Country",
      type: "string",
    }),
    defineField({
      name: "category",
      title: "Category",
      type: "string",
      options: {
        list: [
          { title: "Hospitality", value: "hospitality" },
          { title: "Residenziale", value: "residenziale" },
          { title: "Yacht", value: "yacht" },
          { title: "Beach club", value: "beach-club" },
          { title: "Spa / Wellness", value: "spa-wellness" },
        ],
        layout: "radio",
      },
    }),
    defineField({
      name: "year",
      title: "Year",
      type: "number",
      validation: (Rule) => Rule.min(1990).max(new Date().getFullYear() + 1),
    }),
    defineField({
      name: "coverImage",
      title: "Cover image",
      type: "imageWithMeta",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "gallery",
      title: "Gallery",
      type: "array",
      of: [defineArrayMember({ type: "imageWithMeta" })],
    }),
    defineField({
      name: "story",
      title: "Story",
      type: "array",
      of: [defineArrayMember({ type: "block" })],
    }),
    defineField({
      name: "collectionsUsed",
      title: "Collections used",
      type: "array",
      of: [defineArrayMember({ type: "reference", to: [{ type: "collection" }] })],
    }),
    defineField({
      name: "seo",
      title: "SEO",
      type: "seoFields",
    }),
    defineField({
      name: "publishedAt",
      title: "Published at",
      type: "datetime",
    }),
    defineField({
      name: "order",
      title: "Order",
      type: "number",
      initialValue: 100,
    }),
  ],
  preview: {
    select: {
      title: "title",
      location: "location",
      year: "year",
      lang: "language",
      media: "coverImage",
    },
    prepare: ({ title, location, year, lang, media }) => ({
      title: title || "(untitled)",
      subtitle: [location, year, lang].filter(Boolean).join(" · "),
      media,
    }),
  },
  orderings: [
    {
      title: "Manual order",
      name: "manualOrder",
      by: [{ field: "order", direction: "asc" }],
    },
    {
      title: "Year (newest)",
      name: "yearDesc",
      by: [{ field: "year", direction: "desc" }],
    },
  ],
});
