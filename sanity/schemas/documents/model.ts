import { defineArrayMember, defineField, defineType } from "sanity";

import { MACRO_SUBTYPES, PRODUCT_MACROS, PRODUCT_SUBTYPES } from "./model-taxonomy";
import { WATER_SUPPLY } from "./water-supply";

/**
 * Sprint 2 schema: extended for the full 591-article catalogue.
 *
 * Breaking changes vs Sprint 1:
 *  - `name` string → `name` localizedString (aligned with TAXONOMY.md examples
 *    and the seed payload that was already shipping `{ it, en }` objects)
 *  - `collection` (single reference) → `collections` (array of references)
 *    to support the 23 cross-section articles that belong to multiple
 *    collections (catalog-reference R4 §note metodologiche)
 *  - `finishes` → `availableFinishes` with min(1).max(8) validation
 *
 * New fields (TAXONOMY.md v1.0 — locked):
 *  - `tags`                open string array, parsed from technical suffixes
 *  - `includesConcealedBody` boolean, encodes the 🔒 marker from the catalogue
 *
 * FRONT 2 (lug 2026) — ri-tassonomia CHIUSA:
 *  - `productMacro`   enum 6 valori  ┐ la classificazione del prodotto. Hanno
 *  - `productSubtype` enum 24 valori ┘ sostituito `productType` (enum piatto a
 *    14 valori), rimosso da questo schema in PR-B dopo il rodaggio in produzione.
 *    Piano completo, numeri e sequenza: `docs/front2-design.md`.
 *    ⚠️ I valori `productType` restano nei documenti finché non gira lo script di
 *    unset one-shot: fino ad allora Studio segnala «unknown field».
 */

// ─── FRONT 2: macro-categoria + sottotipo ────────────────────────────────────
// Tabelle in `./model-taxonomy` — sorgente UNICA, condivisa con lo script di
// migrazione one-shot che scrive via @sanity/client bypassando questa validazione.
// Perché DUE enum e non uno piatto da 33 valori: i sottotipi sono CONDIVISI fra
// macro (COLONNA ricorre sotto 4 macro, MISCELATORE sotto 5), quindi un elenco
// unico li duplicherebbe e la crescita futura sarebbe moltiplicativa.

const TAGS_PREDEFINED = [
  "community",
  "yacht",
  "auto-stop",
  "cold-water",
  "hot-water",
  "pull-out",
  "pull-down",
  "concealed-body",
  "high-flow",
  "waterline",
  "multi-way",
  "external",
  "with-shower",
  "remote-control",
  "with-mixer",
  "pvd-finish",
  "painted-finish",
] as const;

// Block 2 — alimentation variants for freestanding columns (not yet populated).
const ALIMENTATION_TYPES = [
  { title: "Standard", value: "standard" },
  { title: "Standard+ (XT / XQ / XQ.A)", value: "standard-plus" },
  { title: "CW — alimentazione idrica a incasso", value: "cw" },
  { title: "EW — alimentazione idrica esterna", value: "ew" },
  { title: "4S — antigelo 230V (no-frost)", value: "4s" },
] as const;

export const model = defineType({
  name: "model",
  title: "Model",
  type: "document",
  groups: [
    { name: "identity", title: "Identity", default: true },
    { name: "taxonomy", title: "Taxonomy" },
    { name: "media", title: "Media" },
    { name: "specs", title: "Specs" },
    { name: "links", title: "Links" },
    // In coda e non sparso fra gli altri: la SEO si tocca di rado, e per i 595
    // modelli il template resta la norma. Il campo serve per i pochi di punta.
    { name: "seo", title: "SEO" },
  ],
  fields: [
    defineField({
      name: "code",
      title: "Code",
      type: "string",
      group: "identity",
      description: "Product code (e.g. C90.M, B76.M). Universal across languages.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "name",
      title: "Name",
      type: "localizedString",
      group: "identity",
      description: "Full product name. IT mandatory; EN to be translated post-launch.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      group: "identity",
      options: {
        source: "code",
        slugify: (input) => input.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "localizedPortableText",
      group: "identity",
      description: "IT description from catalog R4. EN to translate.",
    }),

    // ─── Taxonomy (TAXONOMY.md v1.0 + FRONT 2) ───────────────────────────────
    defineField({
      name: "productMacro",
      title: "Macro-categoria",
      type: "string",
      group: "taxonomy",
      description:
        "Famiglia del prodotto. Compone la PRIMA metà dell'etichetta che si vede sul sito: " +
        "«Doccia — Colonna». Insieme a «Sottotipo» sostituisce il vecchio «Product type».",
      options: { list: [...PRODUCT_MACROS], layout: "dropdown" },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "productSubtype",
      title: "Sottotipo",
      type: "string",
      group: "taxonomy",
      description:
        "Seconda metà dell'etichetta. Attenzione: non tutte le combinazioni esistono — " +
        "«Batteria 3 fori» vale solo per Lavabo, «Pannello» solo per Doccia. Se la coppia " +
        "non è prevista compare un errore che elenca i valori ammessi.",
      options: { list: [...PRODUCT_SUBTYPES], layout: "dropdown" },
      validation: (Rule) => [
        Rule.required(),
        Rule.custom((subtype, context) => {
          const macro = (context.document as { productMacro?: string } | undefined)?.productMacro;
          // Coppia incompleta: non si valida qui (l'ordine di compilazione è libero,
          // e il campo mancante lo segnala già `required` sul campo suo).
          if (!subtype || !macro) return true;
          const allowed = MACRO_SUBTYPES[macro] ?? [];
          return allowed.includes(subtype as string)
            ? true
            : `«${subtype}» non esiste per la macro «${macro}». Ammessi: ${allowed.join(", ")}.`;
        }),
      ],
    }),
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      group: "taxonomy",
      of: [defineArrayMember({ type: "string" })],
      options: {
        layout: "tags",
        list: [...TAGS_PREDEFINED],
      },
      description: "Predefined tags suggested in the dropdown; arbitrary strings also allowed.",
    }),
    defineField({
      name: "includesConcealedBody",
      title: "Includes concealed body 🔒",
      type: "boolean",
      group: "taxonomy",
      initialValue: false,
      description:
        "Marker from the printed catalogue indicating the article ships with the in-wall body.",
    }),
    defineField({
      name: "requiredConcealedBody",
      title: "Required concealed body",
      type: "reference",
      group: "taxonomy",
      to: [{ type: "concealedBody" }],
      description:
        "The in-wall body this article REQUIRES (sold separately). Distinct from includesConcealedBody; drives the concealed-body card tag.",
    }),
    defineField({
      name: "availableFinishes",
      title: "Available finishes",
      type: "array",
      group: "taxonomy",
      of: [defineArrayMember({ type: "reference", to: [{ type: "finish" }] })],
      validation: (Rule) => [
        Rule.max(8).error("Maximum 8 finishes available"),
        Rule.min(1).warning(
          "Most products have at least 1 finish — leave empty only for natural materials like ORIGO RAME",
        ),
      ],
      description: "Whitelist of compatible finishes — constraint, not free array.",
    }),
    defineField({
      name: "waterSupply",
      title: "Water supply (drops 💧)",
      type: "string",
      group: "taxonomy",
      options: { list: [...WATER_SUPPLY], layout: "radio" },
      description:
        "Catalogue hot/cold drop marker (Block 2). Shown on the model detail page only. Absent = unknown → renders nothing.",
    }),
    defineField({
      name: "alimentationTypes",
      title: "Alimentation types (freestanding)",
      type: "array",
      group: "taxonomy",
      of: [defineArrayMember({ type: "string" })],
      options: { list: [...ALIMENTATION_TYPES] },
      description:
        "Supply variants a freestanding column supports (Block 2). Not yet populated — per-column mapping pending.",
    }),

    // ─── Links (collections N-to-N) ──────────────────────────────────────────
    defineField({
      name: "collections",
      title: "Collections",
      type: "array",
      group: "links",
      of: [defineArrayMember({ type: "reference", to: [{ type: "collection" }] })],
      validation: (Rule) => Rule.min(1),
      description:
        "Parent collections (link the IT version of each). Cross-section articles can belong to 2+ collections.",
    }),
    defineField({
      name: "relatedModels",
      title: "Related models (manual)",
      type: "array",
      group: "links",
      of: [defineArrayMember({ type: "reference", to: [{ type: "model" }] })],
      validation: (Rule) => Rule.max(4).error("Maximum 4 related models"),
      description:
        "Modelli correlati scelti a mano per questa scheda (max 4, mostrati nell’ordine). Se LASCI VUOTO, i correlati sono automatici (stessa collezione → stesso tipo prodotto). Se valorizzi, mostri SOLO questi.",
    }),

    // ─── Media ───────────────────────────────────────────────────────────────
    defineField({
      name: "primaryImage",
      title: "Primary image",
      type: "imageWithMeta",
      group: "media",
      description: "Used in cards and listings.",
    }),
    defineField({
      name: "images",
      title: "Gallery",
      type: "array",
      group: "media",
      of: [defineArrayMember({ type: "imageWithMeta" })],
    }),

    // ─── Specs ───────────────────────────────────────────────────────────────
    // Le misure dal listino (spec contenuti-per-lingua § B). Sostituisce i campi di prima
    // (altezza, larghezza, profondità, peso, materiali), che nessun documento usava.
    defineField({
      name: "specs",
      title: "Misure",
      type: "specsMisure",
      group: "specs",
    }),
    defineField({
      name: "isCustomizable",
      title: "Customizable",
      type: "boolean",
      group: "specs",
      initialValue: true,
    }),
    defineField({
      name: "isOutdoor",
      title: "Outdoor-rated (legacy quick filter)",
      type: "boolean",
      group: "specs",
      initialValue: false,
      description:
        "Kept for backwards compatibility with Sprint 1 docs. Legacy field, unused by the site — candidate for removal alongside the ambient purge (M19).",
    }),
    defineField({
      name: "notes",
      title: "Editor notes",
      type: "localizedPortableText",
      group: "specs",
    }),
    defineField({
      name: "catalogOrder",
      title: "Catalog order",
      type: "number",
      group: "specs",
      readOnly: true,
      validation: (Rule) => Rule.integer().positive(),
      description:
        "Posizione nel listino (1..N) — gestito dallo script di import, non editare a mano.",
    }),
    defineField({
      name: "collectionOrders",
      title: "Collection orders (per-collection position)",
      type: "array",
      group: "specs",
      readOnly: true,
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "collection",
              title: "Collection",
              type: "reference",
              to: [{ type: "collection" }],
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "position",
              title: "Position",
              type: "number",
              validation: (Rule) => Rule.required().positive(),
            }),
          ],
        }),
      ],
      description:
        "Posizione per-collezione per articoli condivisi (float tra le posizioni globali dei vicini) — gestito dallo script di import.",
    }),
    defineField({
      name: "seo",
      title: "SEO",
      type: "seoFields",
      group: "seo",
    }),
  ],
  preview: {
    select: { title: "name.it", code: "code", productMacro: "productMacro", media: "primaryImage" },
    prepare: ({ title, code, productMacro, media }) => ({
      title: title || code || "(untitled)",
      subtitle: [code, productMacro].filter(Boolean).join(" · "),
      media,
    }),
  },
  orderings: [
    {
      title: "Code (asc)",
      name: "codeAsc",
      by: [{ field: "code", direction: "asc" }],
    },
    {
      title: "Macro-categoria",
      name: "byProductMacro",
      by: [
        { field: "productMacro", direction: "asc" },
        { field: "code", direction: "asc" },
      ],
    },
  ],
});
