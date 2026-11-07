import { defineField, defineType } from "sanity";

import { checkDeepDiveLabel } from "../../lib/faq-rules";
import { internalLinkAnnotation } from "./internalLink";

/**
 * Una domanda con la sua risposta (spec § 1.3). La risposta vuota non è un errore: la domanda
 * aspetta in Studio e il sito non la mostra (§ 2). I controlli della risposta e dei doppioni stanno
 * nell'elenco (`localizedFaq`), che sa la lingua e la pagina.
 */
export const faqItem = defineType({
  name: "faqItem",
  title: "Domanda",
  type: "object",
  fields: [
    defineField({
      name: "question",
      title: "Domanda",
      type: "string",
      description: "Sentence case, senza em dash.",
      validation: (Rule) =>
        Rule.required().custom((q?: string) => (q?.includes("—") ? "Niente em dash" : true)),
    }),
    defineField({
      name: "answer",
      title: "Risposta",
      type: "faqBlocks",
      description:
        "Circa 90 parole. Le prime 40-50 rispondono da sole, col nome e la keyword in grassetto; poi un codice, una finitura o un dato del listino, e un link interno. Mai misure, mai prezzi.",
    }),
    defineField({
      name: "keyword",
      title: "Keyword",
      type: "string",
      description: "La keyword principale, dalla mappa. Non compare a video.",
    }),
    // «Approfondisci» (Marco, 4/11/2026; spec FAQ § 8): un link interno sotto la risposta, solo
    // verso una pagina che tratta per intero la domanda (pagina d'uso, post, futura pagina di
    // approfondimento). Stessa rotta e stesso documento del link nel testo, più il testo del link,
    // scritto lingua per lingua. Non entra nel JSON-LD.
    defineField({
      name: "deepDive",
      title: "Approfondisci",
      type: "object",
      description:
        "Facoltativo. Solo se la pagina di arrivo tratta per intero la domanda; per collezioni e modelli si usano i link nel testo.",
      fields: [
        ...internalLinkAnnotation.fields,
        defineField({
          name: "label",
          title: "Testo del link",
          type: "string",
          description:
            "Descrittivo, da 3 a 12 parole, mai «leggi di più». Es.: «Approfondisci: la guida alla doccia da esterno».",
          validation: (Rule) =>
            Rule.custom((value: string | undefined, context) => {
              // Il percorso è faq.<lingua>[_key].deepDive.label.
              const lang = String(context.path?.[1] ?? "");
              const errori = checkDeepDiveLabel(value, lang).map((p) => p.message);
              return errori.length ? errori.join(" · ") : true;
            }),
        }),
      ],
    }),
    // L'impronta dell'ultimo caricamento da file: se la risposta in Studio non la combacia più,
    // `faq:carica` non la sovrascrive (spec § 11).
    defineField({ name: "loadedHash", type: "string", hidden: true, readOnly: true }),
  ],
  preview: { select: { title: "question", subtitle: "keyword" } },
});
