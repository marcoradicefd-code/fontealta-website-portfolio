import { defineField, defineType } from "sanity";

export const imageWithMeta = defineType({
  name: "imageWithMeta",
  title: "Image with metadata",
  type: "image",
  options: {
    hotspot: true,
    metadata: ["lqip", "palette", "blurhash", "exif"],
  },
  fields: [
    defineField({
      name: "alt",
      title: "Alt text",
      type: "string",
      description: "Required for accessibility and SEO. Describe the image content.",
      validation: (Rule) => Rule.required().min(3),
    }),
    defineField({
      /**
       * L'alt per lingua, facoltativo, letto per PRIMO su ogni immagine (Marco, 2/11/2026; spec
       * `contenuti-per-lingua.md` § A). Vuoto in una lingua = il sito compone l'alt dai dati o, se
       * non può, usa `alt` con `lang="it"`. `alt` resta: `card-image.ts` lo usa come chiave.
       */
      name: "altI18n",
      title: "Alt per lingua",
      type: "localizedStringOptional",
      description:
        "Facoltativo. Vince sull'alt composto dal sito in quella lingua. Vuoto = il sito lo compone.",
    }),
    defineField({
      name: "caption",
      title: "Caption",
      type: "string",
      description: "Optional caption shown under the image.",
    }),
    defineField({
      name: "credit",
      title: "Photographer / credit",
      type: "string",
    }),
  ],
});
