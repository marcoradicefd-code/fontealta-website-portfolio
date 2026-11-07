import type { SchemaTypeDefinition } from "sanity";

import { author } from "./documents/author";
import { category } from "./documents/category";
import { collection } from "./documents/collection";
import { concealedBody } from "./documents/concealedBody";
import { contentPage } from "./documents/contentPage";
import { finish } from "./documents/finish";
import { model } from "./documents/model";
import { post } from "./documents/post";
import { projectReference } from "./documents/reference";
import { siteSettings } from "./documents/siteSettings";

import { faqBlocks } from "./objects/faqBlocks";
import { faqItem } from "./objects/faqItem";
import { imageWithMeta } from "./objects/imageWithMeta";
import { localizedFaq } from "./objects/localizedFaq";
import { localizedPortableText } from "./objects/localizedPortableText";
import { localizedString } from "./objects/localizedString";
import { localizedStringOptional } from "./objects/localizedStringOptional";
import { localizedText } from "./objects/localizedText";
import { localizedTextOptional } from "./objects/localizedTextOptional";
import { seoFields } from "./objects/seoFields";
import { specsMisure } from "./objects/specsMisure";
import {
  comparisonTable,
  figure,
  figurePair,
  keyPoints,
  localizedUseBody,
  useBody,
  useImage,
  videoLink,
} from "./objects/useBody";

export const schemaTypes: SchemaTypeDefinition[] = [
  // Objects (primitives) — must come before documents that reference them
  localizedString,
  localizedText,
  // Le due varianti senza `required` sull'italiano stanno PRIMA di `seoFields` e di
  // `imageWithMeta` (il suo `altI18n`), che le usano: stessa regola del commento sopra.
  localizedStringOptional,
  localizedTextOptional,
  imageWithMeta,
  seoFields,
  // Le misure di modelli e corpi (spec contenuti-per-lingua § B).
  specsMisure,
  // Le FAQ: i blocchi della risposta, la domanda, l'elenco per lingua (spec FAQ § 1.3).
  faqBlocks,
  faqItem,
  localizedFaq,
  // Il corpo delle pagine d'uso: la foto, i due blocchi di foto, la tabella, il corpo e il corpo
  // per lingua (c1a, spec seo-pagine-contenuto.md); il video del corpo dei post (5/11/2026).
  useImage,
  figure,
  figurePair,
  keyPoints,
  comparisonTable,
  videoLink,
  useBody,
  localizedUseBody,
  // Il corpo dei post e delle descrizioni: dopo i blocchi della pagina d'uso, che usa (5/11/2026).
  localizedPortableText,
  // Documents
  finish,
  concealedBody,
  model,
  collection,
  projectReference,
  // Blog (FASE 1) — author & category before post (post references them)
  author,
  category,
  post,
  siteSettings,
  contentPage,
];
