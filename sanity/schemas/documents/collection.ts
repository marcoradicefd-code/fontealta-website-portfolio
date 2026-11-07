import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * Collection — DOCUMENT-LEVEL i18n
 * One document per locale, linked by `documentInternationalization` plugin.
 * The `language` field is added & maintained by the plugin.
 * Slug, title and copy can diverge between IT and EN versions.
 */
export const collection = defineType({
  name: "collection",
  title: "Collection",
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
      name: "code",
      title: "Code",
      type: "string",
      description: "Stable identifier across locales (e.g. 'boss', 'club', 'ille').",
      validation: (Rule) => Rule.required().lowercase(),
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
      name: "tagline",
      title: "Tagline",
      /**
       * ⚠️ **Per lingua, e senza ripiego sull'italiano.** Era una stringa sola:
       * compilarla faceva tre cose insieme — diventava la description, compariva
       * a video come paragrafo dell'hero, entrava in `llms.txt` — e sulle 22
       * pagine EN la description sarebbe passata dall'inglese all'italiano. Per
       * questo il campo era rimasto vuoto su 22 collezioni su 22 in attesa di
       * questa modifica.
       *
       * `localizedTextOptional` e non `localizedText`: qui il vuoto è il caso
       * normale, e un `Rule.required()` sull'italiano renderebbe non
       * ripubblicabile ogni collezione che non l'ha.
       */
      type: "localizedTextOptional",
      description:
        "Sottotitolo breve sotto il titolo. Vuoto in una lingua = in quella lingua non compare, e la description torna al testo automatico. Non si traduce da sola.",
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "array",
      of: [defineArrayMember({ type: "block" })],
    }),
    defineField({
      name: "isCustomizable",
      title: "Customizable",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "coverImage",
      title: "Cover image",
      type: "imageWithMeta",
    }),
    defineField({
      name: "heroImage",
      title: "Immagine hero (sfondo sezione)",
      type: "imageWithMeta",
      description:
        "Foto ORIZZONTALE ad alta risoluzione (min 2000px largh.) per lo sfondo dell’hero di collezione. Diversa dalla cover (ritratto della card). Se vuota, viene usata la cover come fallback (a risoluzione inferiore).",
    }),
    defineField({
      name: "heroVideo",
      title: "Hero video URL (R2 webm/mp4)",
      type: "url",
      description: "Main video. Hosted on Cloudflare R2.",
    }),
    defineField({
      name: "heroVideoMp4",
      title: "Hero video MP4 fallback URL",
      type: "url",
    }),
    defineField({
      name: "models",
      title: "Models",
      type: "array",
      of: [defineArrayMember({ type: "reference", to: [{ type: "model" }] })],
    }),
    defineField({
      name: "relatedCollections",
      title: "Collezioni affini",
      type: "array",
      description:
        "Collezioni che il brand consiglia ACCANTO a questa. Editoriale e UNIDIREZIONALE: NON è reciproca (se A → B, non implica B → A) e NON ha alcun fallback automatico. L’ordine conta: appare così, nell’ordine impostato qui. Se vuoto, la sezione «Collezioni affini» non viene mostrata. i18n document-level: imposta gli affini sul documento della lingua corrente (quando esisterà la versione EN, vanno impostati anche su quel documento — il plugin non li copia).",
      of: [
        defineArrayMember({
          type: "reference",
          to: [{ type: "collection" }],
          options: {
            // Escludi la collezione stessa (published + draft) e limita alle
            // collezioni della STESSA lingua (i18n document-level: reference
            // same-language). `document.language` è mantenuto dal plugin.
            filter: ({ document }) => {
              const publishedId = (document._id as string).replace(/^drafts\./, "");
              const language = (document as { language?: string }).language ?? null;
              return {
                filter: 'language == $language && !(_id in [$id, "drafts." + $id])',
                params: { language, id: publishedId },
              };
            },
          },
        }),
      ],
    }),
    defineField({
      name: "faq",
      title: "Domande frequenti",
      type: "localizedFaq",
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
    defineField({
      name: "featured",
      title: "Featured on homepage",
      type: "boolean",
      initialValue: false,
      description: "When true, this collection is included in the 6 cards on the homepage grid.",
    }),
  ],
  preview: {
    select: {
      title: "title",
      code: "code",
      lang: "language",
      media: "coverImage",
    },
    prepare: ({ title, code, lang, media }) => ({
      title: title || "(untitled)",
      subtitle: `${code ?? "?"} · ${lang ?? "?"}`,
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
