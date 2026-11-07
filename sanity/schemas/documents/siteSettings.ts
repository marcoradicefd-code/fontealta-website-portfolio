import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * siteSettings — singleton (1 document with id="siteSettings").
 * FIELD-LEVEL i18n via custom localized* objects.
 */
export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site settings",
  type: "document",
  fieldsets: [
    { name: "homeHero", title: "Home hero", options: { collapsible: true, collapsed: true } },
    {
      name: "chiSiamoHero",
      title: "Chi siamo hero",
      options: { collapsible: true, collapsed: true },
    },
  ],
  fields: [
    defineField({
      name: "companyName",
      title: "Company name",
      type: "string",
      initialValue: "Fontealta S.r.l.",
    }),
    defineField({
      name: "tagline",
      title: "Brand tagline",
      type: "localizedString",
      description: "e.g. 'The outdoor steel atelier'",
    }),
    defineField({
      name: "address",
      title: "Address",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "phone",
      title: "Phone",
      type: "string",
    }),
    defineField({
      name: "email",
      title: "Email",
      type: "string",
      validation: (Rule) => Rule.email(),
    }),
    defineField({
      name: "socialLinks",
      title: "Social links",
      type: "object",
      options: { collapsible: true, collapsed: true },
      fields: [
        defineField({ name: "instagram", title: "Instagram", type: "url" }),
        defineField({ name: "linkedin", title: "LinkedIn", type: "url" }),
        defineField({ name: "pinterest", title: "Pinterest", type: "url" }),
        defineField({ name: "youtube", title: "YouTube", type: "url" }),
      ],
    }),
    defineField({
      name: "homeHeroVideoUrl",
      title: "Home hero video URL (R2 webm/mp4)",
      type: "url",
      fieldset: "homeHero",
      description:
        "Background video for the homepage hero, hosted on Cloudflare R2. Works on its own or paired with the MP4 fallback. When set, this R2 URL overrides the local fallback video bundled in the app.",
    }),
    defineField({
      name: "homeHeroVideoMp4Url",
      title: "Home hero video — MP4 fallback URL",
      type: "url",
      fieldset: "homeHero",
      description: "Optional MP4 fallback (R2). Either video field alone is sufficient.",
    }),
    defineField({
      name: "homeHeroPoster",
      title: "Home hero poster image",
      type: "imageWithMeta",
      fieldset: "homeHero",
      description:
        "Still image used as the video poster, while the video loads, and when prefers-reduced-motion is on.",
    }),
    defineField({
      name: "chiSiamoHeroVideoUrl",
      title: "Chi siamo hero video URL (R2 webm/mp4)",
      type: "url",
      fieldset: "chiSiamoHero",
      description:
        "Background video for the Chi siamo hero, hosted on Cloudflare R2. Works on its own or paired with the MP4 fallback. When set, this R2 URL overrides the local fallback video bundled in the app.",
    }),
    defineField({
      name: "chiSiamoHeroVideoMp4Url",
      title: "Chi siamo hero video — MP4 fallback URL",
      type: "url",
      fieldset: "chiSiamoHero",
      description: "Optional MP4 fallback (R2). Either video field alone is sufficient.",
    }),
    defineField({
      name: "chiSiamoHeroPoster",
      title: "Chi siamo hero poster image",
      type: "imageWithMeta",
      fieldset: "chiSiamoHero",
      description:
        "Still image used as poster — while the video loads, when no video is set, and when prefers-reduced-motion is on.",
    }),
    defineField({
      name: "footerColumns",
      title: "Footer columns",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "footerColumn",
          fields: [
            defineField({
              name: "title",
              title: "Column title",
              type: "localizedString",
            }),
            defineField({
              name: "links",
              title: "Links",
              type: "array",
              of: [
                defineArrayMember({
                  type: "object",
                  name: "footerLink",
                  fields: [
                    defineField({
                      name: "label",
                      title: "Label",
                      type: "localizedString",
                    }),
                    defineField({
                      name: "href",
                      title: "URL or path",
                      type: "string",
                    }),
                  ],
                  preview: {
                    select: { title: "label.it", subtitle: "href" },
                  },
                }),
              ],
            }),
          ],
          preview: {
            select: { title: "title.it" },
          },
        }),
      ],
    }),
    /**
     * ⚠️ **Solo l'immagine, e non `seoFields` per intero** (decisione del
     * 9/09/2026). Il blocco portava anche `metaTitle` e `metaDescription`, che
     * sarebbero finiti in `title.default` e nella `description` del layout: due
     * valori che **nessuna pagina usa**. Misurato sui 102 file HTML del build,
     * zero hanno il titolo di default e zero quella description, perché dal #162
     * ogni rotta dichiara i propri. Un campo che non muove niente non si offre in
     * Studio: chi lo compila si aspetta un effetto, e non ne otterrebbe.
     *
     * L'immagine invece è una leva vera: raggiunge le 58 pagine su 102 che non
     * dichiarano un `openGraph` proprio e oggi servono `og-default.jpg`.
     */
    defineField({
      name: "defaultSeo",
      title: "Default SEO",
      type: "object",
      options: { collapsible: true, collapsed: true },
      fields: [
        defineField({
          name: "ogImage",
          title: "Open Graph image",
          type: "imageWithMeta",
          description:
            "Immagine dell'anteprima social per le pagine che non ne hanno una propria, 1200×630. Vuoto = il file /og-default.jpg.",
        }),
      ],
    }),
    defineField({
      name: "ogImage",
      title: "Default Open Graph image",
      type: "imageWithMeta",
    }),
  ],
  preview: {
    prepare: () => ({ title: "Site settings" }),
  },
});
