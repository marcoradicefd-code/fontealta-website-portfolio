import { defineArrayMember, defineField, defineType } from "sanity";

import { FAQ_LANGUAGES, type FaqLanguage, type FaqProblemLevel } from "../../lib/faq-rules";
import { checkUseBody, type UseBlock } from "../../lib/pagina-uso-rules";
import { internalLinkAnnotation } from "./internalLink";

/**
 * Il corpo di una pagina d'uso (spec `seo-pagine-contenuto.md`; Marco, grill del 3/11/2026, Q15,
 * e struttura della sera, Q19): il box «In sintesi» in testa, H2, H3 dentro un H2, paragrafi,
 * elenchi puntati o numerati di un livello, un grassetto per sezione, link interni, foto e una
 * tabella di confronto. I controlli stanno in `pagina-uso-rules.ts`, gli stessi
 * del caricatore.
 *
 * ⚠️ **Le foto stanno nel corpo di ogni lingua, con l'alt in quella lingua.** La spec FAQ § 6
 * pensava a un `useImage` con l'alt per lingua; con il corpo per lingua (scelta A del 30/10) la
 * stessa foto compare nelle cinque liste, e ciascuna porta il suo alt: l'alt nella lingua della
 * pagina c'è sempre, senza un oggetto a cinque lingue dentro ogni lista (c1a, 3/11/2026).
 */

/** Una foto del corpo: ambientazione, ritaglio dal punto caldo, alt nella lingua del corpo. */
export const useImage = defineType({
  name: "useImage",
  title: "Foto",
  type: "image",
  options: { hotspot: true },
  fields: [
    defineField({
      name: "alt",
      title: "Alt",
      type: "string",
      description:
        "Nella lingua di questo corpo: cosa mostra la foto, al massimo 125 caratteri. Mai vuoto.",
      validation: (Rule) => Rule.required().min(3),
    }),
  ],
});

/** Un'orizzontale a tutta larghezza della colonna, nella sua proporzione (la pagina non la ritaglia). */
export const figure = defineType({
  name: "figure",
  title: "Foto",
  type: "object",
  fields: [
    defineField({
      name: "image",
      title: "Foto",
      type: "useImage",
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: { select: { media: "image", title: "image.alt" } },
});

/** Due verticali sulla stessa riga (ritaglio 2:3, stessa altezza), affiancate anche sul telefono (provini del 4/11). */
export const figurePair = defineType({
  name: "figurePair",
  title: "Coppia di foto verticali",
  type: "object",
  fields: [
    defineField({
      name: "left",
      title: "Sinistra",
      type: "useImage",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "right",
      title: "Destra",
      type: "useImage",
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: { media: "left", a: "left.alt", b: "right.alt" },
    prepare: ({ media, a, b }: { media?: unknown; a?: string; b?: string }) => ({
      media: media as never,
      title: [a, b].filter(Boolean).join(" · ") || "Coppia di foto",
    }),
  },
});

/** Il box «In sintesi», in testa al corpo: da 3 a 4 voci di una frase, testo semplice. */
export const keyPoints = defineType({
  name: "keyPoints",
  title: "In sintesi",
  type: "object",
  fields: [
    defineField({
      name: "items",
      title: "Voci",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      validation: (Rule) => Rule.required().min(3).max(4),
    }),
  ],
  preview: {
    select: { items: "items" },
    prepare: ({ items }: { items?: string[] }) => ({
      title: "In sintesi",
      subtitle: (items ?? []).join(" · "),
    }),
  },
});

/**
 * La tabella di confronto (Q15): riga di intestazione, da 2 a 4 colonne, al più 8 righe, criteri
 * uguali in ogni riga, una frase che la introduce, niente misure né prezzi, una per pagina.
 */
export const comparisonTable = defineType({
  name: "comparisonTable",
  title: "Tabella di confronto",
  type: "object",
  fields: [
    defineField({
      name: "header",
      title: "Intestazione",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      validation: (Rule) => Rule.required().min(2).max(4),
    }),
    defineField({
      name: "rows",
      title: "Righe",
      type: "array",
      of: [
        defineArrayMember({
          name: "tableRow",
          title: "Riga",
          type: "object",
          fields: [
            defineField({
              name: "cells",
              title: "Celle",
              type: "array",
              of: [defineArrayMember({ type: "string" })],
            }),
          ],
          preview: {
            select: { cells: "cells" },
            prepare: ({ cells }: { cells?: string[] }) => ({ title: (cells ?? []).join(" · ") }),
          },
        }),
      ],
      validation: (Rule) => Rule.required().min(1).max(8),
    }),
  ],
  preview: {
    select: { header: "header" },
    prepare: ({ header }: { header?: string[] }) => ({
      title: `Tabella: ${(header ?? []).join(" · ")}`,
    }),
  },
});

/** Un indirizzo di YouTube, e nient'altro: il link apre il video sul sito di YouTube. */
const YOUTUBE = /^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{6,}/;

/**
 * Un video di YouTube nel corpo di un articolo (Marco, grill del 5/11/2026, Q30 a): una copertina
 * nostra e il titolo, che aprono il video su YouTube in un'altra scheda. Nessun iframe e nessuna
 * richiesta a YouTube dalla pagina: niente cookie di terze parti, quindi niente banner (rule
 * `legali-contatti`).
 */
export const videoLink = defineType({
  name: "videoLink",
  title: "Video su YouTube",
  type: "object",
  fields: [
    defineField({
      name: "url",
      title: "Indirizzo del video",
      type: "url",
      description: "https://www.youtube.com/watch?v=… oppure https://youtu.be/…",
      validation: (Rule) =>
        Rule.required().custom((v: string | undefined) =>
          !v || YOUTUBE.test(v) ? true : "Solo un indirizzo di YouTube",
        ),
    }),
    defineField({
      name: "title",
      title: "Titolo",
      type: "string",
      description: "Nella lingua di questo corpo: cosa mostra il video.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "poster",
      title: "Copertina",
      type: "useImage",
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: { select: { title: "title", media: "poster" } },
});

export const useBody = defineType({
  name: "useBody",
  title: "Corpo",
  type: "array",
  of: [
    defineArrayMember({
      type: "block",
      styles: [
        { title: "Normale", value: "normal" },
        { title: "H2", value: "h2" },
        { title: "H3", value: "h3" },
      ],
      lists: [
        { title: "Elenco puntato", value: "bullet" },
        { title: "Elenco numerato", value: "number" },
      ],
      marks: {
        decorators: [{ title: "Grassetto", value: "strong" }],
        annotations: [internalLinkAnnotation],
      },
    }),
    defineArrayMember({ type: "keyPoints" }),
    defineArrayMember({ type: "figure" }),
    defineArrayMember({ type: "figurePair" }),
    defineArrayMember({ type: "comparisonTable" }),
  ],
});

const TITLES: Record<FaqLanguage, string> = {
  it: "Italiano",
  en: "English (US)",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
};

const problems = (body: UseBlock[] | undefined, level: FaqProblemLevel) => {
  const out = checkUseBody(body)
    .filter((p) => p.level === level)
    .map((p) => (p.key ? { message: p.message, path: [{ _key: p.key }] } : { message: p.message }));
  return out.length ? out : true;
};

/** Il corpo per lingua (campi per lingua, scelta A del 30/10): ogni mercato ha il suo testo. */
export const localizedUseBody = defineType({
  name: "localizedUseBody",
  title: "Corpo",
  type: "object",
  fields: FAQ_LANGUAGES.map((language) =>
    defineField({
      name: language,
      title: TITLES[language],
      type: "useBody",
      validation: (Rule) => [
        Rule.custom((body: UseBlock[] | undefined) => problems(body, "error")),
        Rule.custom((body: UseBlock[] | undefined) => problems(body, "warning")).warning(),
      ],
    }),
  ),
});
