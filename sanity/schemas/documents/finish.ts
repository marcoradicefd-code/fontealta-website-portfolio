import { defineField, defineType } from "sanity";

export const finish = defineType({
  name: "finish",
  title: "Finish",
  type: "document",
  fields: [
    defineField({
      name: "code",
      title: "Code",
      type: "string",
      description:
        "Catalog code (e.g. MX, BX, MB, BB, BC, AB, DB). Verify with Andrea before publishing.",
      validation: (Rule) => Rule.required().uppercase(),
    }),
    defineField({
      name: "name",
      title: "Name",
      type: "localizedString",
      description: "e.g. 'Naturale spazzolato' / 'Brushed natural'",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "category",
      title: "Category",
      type: "string",
      options: {
        list: [
          { title: "Natural", value: "natural" },
          { title: "Mirror", value: "mirror" },
          { title: "Painted", value: "painted" },
          { title: "PVD", value: "pvd" },
        ],
        layout: "radio",
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "swatchImage",
      title: "Swatch image",
      type: "imageWithMeta",
    }),
    defineField({
      name: "colorHex",
      title: "Color hex (for painted RAL/Pantone)",
      type: "string",
      description: "e.g. #c4a35a — used as fallback swatch when no image.",
      validation: (Rule) =>
        Rule.regex(/^#[0-9a-fA-F]{6}$/, {
          name: "hex",
          invert: false,
        }).custom((v) => (v && v.length !== 7 ? "Use #RRGGBB" : true)),
    }),
    defineField({
      name: "order",
      title: "Order",
      type: "number",
      initialValue: 100,
    }),
  ],
  preview: {
    select: { title: "name.it", code: "code", media: "swatchImage" },
    prepare: ({ title, code, media }) => ({
      title: title || "(untitled)",
      subtitle: code,
      media,
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
