import type { StructureBuilder, StructureResolver } from "sanity/structure";

import { contentPageId, MAIN_PAGES } from "./lib/faq-rules";

const SINGLETON_TYPES = new Set(["siteSettings"]);

export const structure: StructureResolver = (S: StructureBuilder) =>
  S.list()
    .title("Content")
    .items([
      S.listItem()
        .title("Site settings")
        .id("siteSettings")
        .child(S.document().schemaType("siteSettings").documentId("siteSettings")),
      // Le cinque pagine principali, un documento fisso ciascuna (spec FAQ § 1.1).
      S.listItem()
        .title("Pagine principali")
        .id("contentPage")
        .child(
          S.list()
            .title("Pagine principali")
            .items(
              MAIN_PAGES.map((page) =>
                S.listItem()
                  .title(page.title)
                  .id(contentPageId(page.code))
                  .child(
                    S.document()
                      .schemaType("contentPage")
                      .documentId(contentPageId(page.code))
                      .initialValueTemplate(contentPageId(page.code)),
                  ),
              ),
            ),
        ),
      // Le pagine d'uso: solo quelle che il caricatore ha creato, e nessun «crea» (grill del
      // 3/11/2026, Q16): una pagina d'uso nasce dai file di `docs/content/pagine-uso/`.
      S.listItem()
        .title("Pagine d'uso")
        .id("contentPage-use")
        .child(
          S.documentList()
            .title("Pagine d'uso")
            .schemaType("contentPage")
            .filter('_type == "contentPage" && kind == "use"')
            .initialValueTemplates([]),
        ),
      S.divider(),
      S.documentTypeListItem("collection").title("Collections"),
      S.documentTypeListItem("model").title("Models"),
      S.documentTypeListItem("projectReference").title("References"),
      S.divider(),
      S.documentTypeListItem("finish").title("Finishes"),
      S.documentTypeListItem("concealedBody").title("Concealed bodies"),
      S.divider(),
      ...S.documentTypeListItems().filter(
        (item) =>
          item.getId() !== undefined &&
          ![
            "siteSettings",
            "contentPage",
            "collection",
            "model",
            "projectReference",
            "finish",
            "concealedBody",
          ].includes(item.getId() as string),
      ),
    ]);

export { SINGLETON_TYPES };
