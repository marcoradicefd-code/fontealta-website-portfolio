import { defineArrayMember, defineField, defineType } from "sanity";

import { FAQ_LANGUAGES, MAIN_PAGES, USE_PAGES } from "../../lib/faq-rules";
import { claimsAllStainless, mentionsMeasure, mentionsUsePrice } from "../../lib/pagina-uso-rules";

const PAGES = [...MAIN_PAGES, ...USE_PAGES];

/** I campi della pagina d'uso si vedono solo su una pagina d'uso. */
const notUse = ({ document }: { document?: Record<string, unknown> }) => document?.kind !== "use";

type PerLanguage = Partial<Record<string, unknown>> | undefined;
const filled = (v: unknown) =>
  (typeof v === "string" && v.trim() !== "") || (Array.isArray(v) && v.length > 0);

/** Misure, prezzi e «tutto inox» in un campo per lingua (spec `seo-pagine-contenuto.md` § 4). */
function contentRules(value: PerLanguage): true | string {
  const out: string[] = [];
  for (const l of FAQ_LANGUAGES) {
    const t = value?.[l];
    if (typeof t !== "string") continue;
    if (mentionsMeasure(t)) out.push(`${l}: una misura`);
    if (mentionsUsePrice(t)) out.push(`${l}: un prezzo`);
    if (claimsAllStainless(t)) out.push(`${l}: «tutto inox», si scrive «quasi tutto in AISI 316»`);
  }
  return out.length ? out.join(" · ") : true;
}

/**
 * Pagina di contenuto (spec FAQ § 1.1). Le cinque pagine principali portano solo codice, tipo e
 * FAQ. Le pagine d'uso (`kind: "use"`, dalla c1a del 3/11/2026, spec `seo-pagine-contenuto.md`)
 * portano anche titolo, introduzione e corpo per lingua, i campi SEO e le collezioni in evidenza
 * (dal 4/11/2026 le card sono automatiche: le collezioni in evidenza vengono prima).
 *
 * ⚠️ Una pagina d'uso nasce dal caricatore (`contenuti:carica --sezione=pagine-uso`) e non da
 * Studio (Marco, grill del 3/11, Q16): codice e tipo restano in sola lettura. I testi arrivano dai
 * file in `docs/content/pagine-uso/`; `loadedHashes` è l'impronta di ogni lingua al caricamento,
 * e dice al caricatore se in Studio qualcuno l'ha cambiata.
 *
 * ⚠️ Le pagine principali restano senza `seo`: i loro metadati li scrivono i messaggi i18n e
 * `route-metadata.ts` (rule `seo-meta`), e il campo si vede solo sulle pagine d'uso.
 */
export const contentPage = defineType({
  name: "contentPage",
  title: "Pagina di contenuto",
  type: "document",
  fields: [
    defineField({
      name: "code",
      title: "Codice",
      type: "string",
      readOnly: true,
      options: { list: PAGES.map((p) => ({ title: p.title, value: p.code })) },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "kind",
      title: "Tipo",
      type: "string",
      readOnly: true,
      initialValue: "main",
      options: {
        list: [
          { title: "Principale", value: "main" },
          { title: "Uso", value: "use" },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "title",
      title: "Titolo (H1)",
      type: "localizedStringOptional",
      description:
        "L'H1 della pagina, con la keyword, diverso dal meta title. Una lingua senza titolo non è pubblicata (404).",
      hidden: notUse,
      validation: (Rule) => [
        Rule.custom((value: PerLanguage, context) =>
          notUse(context) ? true : contentRules(value),
        ),
        Rule.custom((value: PerLanguage, context) => {
          if (notUse(context)) return true;
          const missing = FAQ_LANGUAGES.filter((l) => !filled(value?.[l]));
          return missing.length
            ? `Senza titolo in ${missing.join(", ")}: in quelle lingue la pagina dà 404`
            : true;
        }).warning(),
      ],
    }),
    defineField({
      name: "intro",
      title: "Introduzione",
      type: "localizedTextOptional",
      description:
        "Testo semplice: le prime 40-60 parole rispondono alla domanda e nominano Fontealta.",
      hidden: notUse,
      validation: (Rule) => [
        Rule.custom((value: PerLanguage, context) =>
          notUse(context) ? true : contentRules(value),
        ),
        Rule.custom((value: PerLanguage, context) => {
          if (notUse(context)) return true;
          const title = (context.document as { title?: PerLanguage } | undefined)?.title;
          const missing = FAQ_LANGUAGES.filter((l) => filled(title?.[l]) && !filled(value?.[l]));
          return missing.length ? `Titolo senza introduzione in ${missing.join(", ")}` : true;
        }),
      ],
    }),
    defineField({
      name: "body",
      title: "Corpo",
      type: "localizedUseBody",
      hidden: notUse,
      validation: (Rule) =>
        Rule.custom((value: PerLanguage, context) => {
          if (notUse(context)) return true;
          const title = (context.document as { title?: PerLanguage } | undefined)?.title;
          const missing = FAQ_LANGUAGES.filter((l) => filled(title?.[l]) && !filled(value?.[l]));
          return missing.length ? `Titolo senza corpo in ${missing.join(", ")}` : true;
        }),
    }),
    defineField({ name: "seo", title: "SEO", type: "seoFields", hidden: notUse }),
    defineField({
      name: "collections",
      title: "Collezioni in evidenza",
      type: "array",
      description:
        "Facoltativo. Le card prima delle FAQ mostrano da sole ogni collezione con una colonna doccia; queste vengono prima, in quest'ordine, anche senza colonne, e poi le altre nell'ordine del catalogo.",
      of: [
        defineArrayMember({
          type: "reference",
          to: [{ type: "collection" }],
          options: { filter: '!defined(language) || language == "it"' },
        }),
      ],
      hidden: notUse,
      validation: (Rule) => Rule.unique(),
    }),
    defineField({ name: "faq", title: "Domande frequenti", type: "localizedFaq" }),
    defineField({
      name: "loadedHashes",
      title: "Impronte del caricamento",
      type: "array",
      readOnly: true,
      hidden: true,
      of: [
        defineArrayMember({
          name: "loadedHash",
          type: "object",
          fields: [
            defineField({ name: "lang", type: "string" }),
            defineField({ name: "hash", type: "string" }),
          ],
        }),
      ],
    }),
  ],
  preview: {
    select: { code: "code", kind: "kind" },
    prepare: ({ code, kind }: { code?: string; kind?: string }) => ({
      title: PAGES.find((p) => p.code === code)?.title ?? code ?? "Pagina",
      subtitle: kind === "use" ? "Pagina d'uso" : "Pagina principale",
    }),
  },
});
