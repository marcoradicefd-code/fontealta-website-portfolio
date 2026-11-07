import { defineArrayMember, defineField, defineType } from "sanity";

import {
  ATTACCHI,
  CHIAVI_MISURA,
  DOCUMENTI_FONTE,
  FAMIGLIE_MISURE,
  formaDellaRiga,
  type RigaMisura,
  STATI_MISURE,
} from "./misure-chiavi";

/**
 * Le misure di un modello o di un corpo a incasso (spec `docs/specs/contenuti-per-lingua.md` § B).
 *
 * Sostituisce `heightMm`, `widthMm`, `depthMm`, `weightKg` e `materials`, che nessun documento
 * usava (0 su 595 il 2/11/2026). Tutto in millimetri, come il listino; i formati per lingua li fa
 * il sito.
 */

const misura = defineArrayMember({
  type: "object",
  name: "misura",
  title: "Misura",
  fields: [
    defineField({
      name: "chiave",
      title: "Misura",
      type: "string",
      options: { list: [...CHIAVI_MISURA] },
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: "valore", title: "Valore (mm)", type: "number" }),
    defineField({ name: "min", title: "Min (mm)", type: "number" }),
    defineField({ name: "max", title: "Max (mm)", type: "number" }),
    defineField({
      name: "regolabile",
      title: "Regolabile",
      type: "boolean",
      description: "Solo per un intervallo: «900–1.300 mm (regolabile)».",
    }),
    defineField({ name: "tolleranza", title: "Tolleranza ± (mm)", type: "number" }),
    defineField({
      name: "lati",
      title: "Lati (mm)",
      type: "array",
      of: [defineArrayMember({ type: "number" })],
    }),
  ],
  validation: (Rule) => Rule.custom((riga: RigaMisura | undefined) => formaDellaRiga(riga)),
  preview: {
    select: { chiave: "chiave", valore: "valore", min: "min", max: "max", lati: "lati" },
    prepare: ({ chiave, valore, min, max, lati }) => ({
      title: chiave,
      subtitle:
        typeof valore === "number"
          ? `${valore} mm`
          : typeof min === "number"
            ? `${min}–${max} mm`
            : Array.isArray(lati)
              ? `${lati.join(" × ")} mm`
              : "",
    }),
  },
});

export const specsMisure = defineType({
  name: "specsMisure",
  title: "Misure",
  type: "object",
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({
      name: "famiglia",
      title: "Famiglia",
      type: "string",
      options: { list: [...FAMIGLIE_MISURE] },
      description: "Decide la misura principale, quella dell'alt e della prima riga.",
    }),
    defineField({
      name: "misure",
      title: "Misure",
      type: "array",
      of: [misura],
      description: "In millimetri. L'ordine è quello della scheda, dopo la principale.",
    }),
    defineField({
      name: "attacchi",
      title: "Attacchi",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: { list: [...ATTACCHI], layout: "tags" },
    }),
    defineField({
      name: "fonte",
      title: "Fonte (interna, non si mostra)",
      type: "object",
      fields: [
        defineField({
          name: "documento",
          title: "Documento",
          type: "string",
          options: { list: [...DOCUMENTI_FONTE] },
        }),
        defineField({ name: "pagina", title: "Pagina stampata", type: "number" }),
      ],
    }),
    defineField({
      name: "stato",
      title: "Stato",
      type: "string",
      options: { list: [...STATI_MISURE], layout: "radio" },
      initialValue: "daVerificare",
    }),
    defineField({
      name: "verificataCon",
      title: "Verificata con",
      type: "string",
      description: "Scheda tecnica con cui la misura è stata verificata.",
    }),
  ],
});
