/**
 * scripts/i18n/faq-doppie.ts [--dir <cartella>]
 *
 * Nessuna domanda in due pagine (spec FAQ § 1.3): per ogni lingua, le domande dei file
 * (`<cartella>/<lingua>/*.md`, di default `docs/content/faq`) e quelle già su Sanity, normalizzate
 * come nella validazione dello Studio: le domande che nominano la propria collezione sono di
 * prodotto e non si confrontano fra pagine (`duplicateKey`); il file di una pagina e la stessa pagina
 * su Sanity non si confrontano fra loro. Esce con 1 se trova un doppione. Solo lettura.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

import { contentPageId } from "../../sanity/lib/faq-rules";
import { crossDuplicates, pagesForRun, parseFaqFile } from "./faq-md";
import { LINGUE } from "./lib";

loadEnv({ path: ".env.local" });

const dirArg = process.argv.indexOf("--dir");
const cartella =
  dirArg > 0 && process.argv[dirArg + 1] ? process.argv[dirArg + 1] : "docs/content/faq";

const token = process.env.SANITY_API_READ_TOKEN;
const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01",
  useCdn: false,
  ...(token ? { token, perspective: "raw" as const } : { perspective: "published" as const }),
});

async function main() {
  const data = await client.fetch<{
    collections: Array<{ _id: string; code: string; title: string }>;
    pages: Array<{
      _id: string;
      own: string | null;
      faq?: Record<string, Array<{ question: string }>>;
    }>;
  }>(`{
    "collections": *[_type == "collection" && defined(title) && !(_id in path("drafts.**")) && !(_id in path("versions.**"))]{ _id, code, title },
    "pages": *[_type in ["collection", "contentPage"] && defined(faq)]{
      _id, "own": select(_type == "collection" => title), faq
    }
  }`);
  const names = data.collections.map((c) => c.title);
  const byCode = new Map(data.collections.map((c) => [c.code, c]));
  let totale = 0;
  for (const lang of LINGUE) {
    const dir = join(cartella, lang);
    const files = existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith(".md"))
          .sort()
      : [];
    const suSanity = data.pages
      .filter((p) => (p.faq?.[lang]?.length ?? 0) > 0)
      .map((p) => ({
        label: `Sanity ${p._id}`,
        page: p._id.replace(/^(drafts|versions\.[^.]+)\./, ""),
        own: p.own ?? undefined,
        questions: p.faq![lang].map((i) => i.question),
      }));
    const daiFile = files.map((f) => {
      const file = parseFaqFile(readFileSync(join(dir, f), "utf-8")).file;
      const collection = file?.kind === "collection" ? byCode.get(file.code) : undefined;
      return {
        label: `${lang}/${f}`,
        // La pagina vera, così il file e la stessa pagina su Sanity non si confrontano fra loro.
        page:
          collection?._id ??
          (file?.kind === "main" || file?.kind === "use"
            ? contentPageId(file.code)
            : `${lang}/${f}`),
        own: collection?.title,
        questions: file?.items.map((i) => i.question) ?? [],
      };
    });
    // Questo controllo non scrive: nessuna pagina sostituisce le sue FAQ su Sanity, restano tutte.
    const pages = pagesForRun(suSanity, daiFile, new Set());
    const doppie = crossDuplicates(pages, names);
    const domande = pages.reduce((s, p) => s + p.questions.length, 0);
    console.log(
      `${lang}: ${domande} domande su ${pages.length} pagine, doppioni ${doppie.length || "nessuno"}`,
    );
    for (const d of doppie) console.log(`  ✖ «${d.question}»: ${d.first} e ${d.second}`);
    totale += doppie.length;
  }
  return totale;
}

main()
  .then((n) => process.exit(n ? 1 : 0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
