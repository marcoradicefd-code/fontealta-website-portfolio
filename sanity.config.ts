import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { documentInternationalization } from "@sanity/document-internationalization";

import { apiVersion, dataset, projectId, SUPPORTED_LANGUAGES } from "./sanity/env";
import { schemaTypes } from "./sanity/schemas";
import { contentPageId, MAIN_PAGES } from "./sanity/lib/faq-rules";
import { structure } from "./sanity/structure";

export default defineConfig({
  name: "fontealta-studio",
  title: "Fontealta Website",
  basePath: "/studio",
  projectId,
  dataset,
  schema: {
    types: schemaTypes,
    // Le pagine principali nascono solo dalla loro voce in «Pagine principali», col codice già
    // scritto: un modello per pagina, e nessun «nuova pagina di contenuto» generico.
    templates: (prev) => [
      ...prev.filter((t) => t.schemaType !== "contentPage"),
      ...MAIN_PAGES.map((page) => ({
        id: contentPageId(page.code),
        title: page.title,
        schemaType: "contentPage",
        value: { code: page.code, kind: "main" },
      })),
    ],
  },
  document: {
    newDocumentOptions: (prev) => prev.filter((item) => !item.templateId.startsWith("contentPage")),
  },
  plugins: [
    structureTool({ structure }),
    documentInternationalization({
      supportedLanguages: SUPPORTED_LANGUAGES.map(({ id, title }) => ({
        id,
        title,
      })),
      // Document-level i18n for entities whose slug + copy diverge by locale.
      // Other types (siteSettings, model, finish, ambient) use field-level
      // localized* objects — see sanity/schemas/objects/.
      schemaTypes: ["collection", "projectReference"],
    }),
    // Vision is dev-only: lets editors run live GROQ queries against the dataset.
    ...(process.env.NODE_ENV === "development"
      ? [visionTool({ defaultApiVersion: apiVersion })]
      : []),
  ],
});
