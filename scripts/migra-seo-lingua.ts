/**
 * scripts/migra-seo-lingua.ts
 *
 * Migrazione dei campi SEO dei post dalla forma **stringa** (italiano, con il
 * suffisso « | Fontealta» dentro al valore) alla forma **per lingua**
 * (`{ it: … }`), introdotta dalla PR C.
 *
 *   pnpm migra:seo-lingua              → DRY RUN, stampa prima → dopo e non scrive
 *   pnpm migra:seo-lingua -- --execute → scrive davvero
 *
 * ⚠️ **Va eseguito DOPO il deploy in produzione del codice**, mai prima. Il
 * codice sa leggere entrambe le forme; i dati no. Se i documenti diventassero
 * oggetti mentre in produzione gira ancora il codice vecchio, dodici pagine
 * servirebbero `[object Object]` come titolo.
 *
 * ⚠️ **Il suffisso « | Fontealta» si TOGLIE.** Nella forma stringa stava dentro
 * al valore, e per questo la pagina lo passava come `title.absolute`; nella
 * forma nuova lo aggiunge `title.template` del layout, come su ogni altra pagina
 * del sito. Il `<title>` servito resta identico al byte. L'`og:title` invece
 * cambia: non passa dal template, quindi sui dodici post italiani perde il
 * marchio. È la sola differenza attesa di questa migrazione, decisa il
 * 9/09/2026 con la regola «og:title è il titolo nudo, il marchio lo porta
 * og:site_name».
 *
 * Non tocca `title`, `excerpt`, `body`, `coverImage` né alcun campo `.en`: solo
 * `seo.metaTitle` e `seo.metaDescription`, e solo dove sono ancora stringhe.
 */

import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const ESEGUI = process.argv.includes("--execute");

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01";
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId || !dataset) {
  console.error("✖ Manca l'ambiente Sanity (NEXT_PUBLIC_SANITY_PROJECT_ID / _DATASET)");
  process.exit(1);
}
if (ESEGUI && !token) {
  console.error("✖ --execute richiede SANITY_WRITE_TOKEN");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion,
  token,
  useCdn: false,
  perspective: "published",
});

/** Il suffisso che il template del layout aggiunge da sé. */
const SUFFISSO = " | Fontealta";

/**
 * ⚠️ **Si toglie solo se sta in CODA.** Un `replace` globale colpirebbe un
 * titolo che nomina il marchio a metà frase, e non è quello che vogliamo
 * togliere.
 */
function senzaSuffisso(testo: string): string {
  return testo.endsWith(SUFFISSO) ? testo.slice(0, -SUFFISSO.length) : testo;
}

type Post = {
  _id: string;
  slug: string | null;
  metaTitle: unknown;
  metaDescription: unknown;
};

const QUERY = `*[_type == "post"] | order(slug.current asc) {
  _id,
  "slug": slug.current,
  "metaTitle": seo.metaTitle,
  "metaDescription": seo.metaDescription
}`;

async function main() {
  const posts: Post[] = await client.fetch(QUERY);

  let daMigrare = 0;
  let giaOggetto = 0;
  const patch: Array<{ id: string; set: Record<string, unknown> }> = [];

  console.log(`\n${ESEGUI ? "ESECUZIONE" : "DRY RUN"} · ${posts.length} post letti\n`);

  for (const p of posts) {
    const set: Record<string, unknown> = {};

    for (const [campo, valore] of [
      ["metaTitle", p.metaTitle],
      ["metaDescription", p.metaDescription],
    ] as const) {
      if (valore === null || valore === undefined) continue;
      if (typeof valore === "object") {
        giaOggetto += 1;
        continue;
      }
      if (typeof valore !== "string") continue;

      const prima = valore;
      const dopo = campo === "metaTitle" ? senzaSuffisso(prima) : prima;
      daMigrare += 1;
      set[`seo.${campo}`] = {
        _type: campo === "metaTitle" ? "localizedStringOptional" : "localizedTextOptional",
        it: dopo,
      };

      console.log(`${p.slug} · ${campo}`);
      console.log(`   prima (${prima.length}): ${prima}`);
      console.log(`   dopo  (${dopo.length}): ${dopo}`);
      if (prima !== dopo) console.log(`   → tolto il suffisso «${SUFFISSO}»`);
      console.log("");
    }

    if (Object.keys(set).length > 0) patch.push({ id: p._id, set });
  }

  console.log(`── valori da migrare: ${daMigrare} · già in forma oggetto: ${giaOggetto}`);
  console.log(`── documenti toccati: ${patch.length}`);
  console.log(
    "── differenza attesa nel servito: og:title dei post italiani perde « | Fontealta»;\n" +
      "   il <title> resta identico, perché il suffisso lo rimette title.template.",
  );

  if (!ESEGUI) {
    console.log("\nDRY RUN: niente è stato scritto. Rilancia con -- --execute dopo il GO.\n");
    return;
  }

  const tx = patch.reduce((t, p) => t.patch(p.id, { set: p.set }), client.transaction());
  await tx.commit({ visibility: "sync" });
  console.log(`\n✔ scritti ${patch.length} documenti.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
