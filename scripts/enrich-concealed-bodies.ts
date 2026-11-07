/**
 * enrich-concealed-bodies.ts — cantiere INCASSI (one-shot): valorizza i campi nuovi
 * sui 17 `concealedBody` e corregge i refusi vivi nelle descrizioni.
 *
 * Sorgente: `scripts/data/incassi-data-2026-07-28.json` (contenuto v3), committato
 * come dato immutabile. Piano completo: `docs/incassi-design.md`.
 *
 * COSA SCRIVE:
 *   set  slug          ← { _type: "slug", current: row.slug }
 *   set  servesMacros  ← row.serves_macros   (array, 1-3 macro)
 *   set  waterSupply   ← row.water_supply    (cold | hot-cold)
 *   patch chirurgica del TESTO delle descrizioni dove diverge dal JSON (i 4 refusi)
 *
 * COSA NON SCRIVE, e perché:
 *   `image`  — i render arrivano dalla pipeline Magnific, non da qui.
 *   `order`  — IL JSON NON LO CONTIENE. Le sue righe sono in ordine alfabetico per
 *              codice e `in_summary_pag214` è un booleano, non una posizione: l'ordine
 *              del riepilogo pag. 214 non è nel dato. Scrivere 10,20,…170 dall'indice
 *              di riga significherebbe spacciare l'alfabetico per ordine di catalogo —
 *              un campo che mente. Resta vuoto: l'indice (PR 3) ordinerà con
 *              `coalesce(order, 9999) asc, code asc`, lo stesso idiom già usato per
 *              `catalogOrder` nelle query collezione, così il campo resta un gancio
 *              che Andrea può valorizzare in Studio quando avrà l'ordine vero.
 *
 * ⚠️ LA PATCH DELLE DESCRIZIONI NON È UN `set` SULL'OGGETTO. `description` è
 * `localizedPortableText` vero: array di block, ciascuno con `children` di span, ognuno
 * con la propria `_key`. Un `set` sull'oggetto rigenererebbe le chiavi e riscriverebbe
 * la struttura. Si patcha il SOLO testo, con path filtrati per `_key`
 * (`description.it[_key=="…"].children[_key=="…"].text`), così le chiavi non si toccano
 * per costruzione. NON per indice `[0]`: la doc Sanity dice «avoid array indices».
 *
 * `diffMatchPatch` VALUTATO E SCARTATO (motivazione estesa in docs/incassi-design.md §8):
 * sull'API HTTP vuole una stringa unidiff, non il testo nuovo, quindi servirebbe la
 * libreria diff-match-patch — una dipendenza nuova per un one-shot; i suoi due vantaggi
 * dichiarati (stringhe enormi, concorrenza fra editor) non si applicano a 90 caratteri in
 * una finestra controllata; e l'applicazione fuzzy qui è un rischio, non un pregio —
 * meglio fallire sulla verifica che fondersi in un testo che non ha scritto nessuno.
 *
 * GUARDIE, tutte PRIMA di qualunque scrittura (abort con report):
 *   I1  il checkout dichiara i campi nuovi nello schema → rifiuta di girare prima di PR 1
 *   I2  il dataset ha esattamente 17 concealedBody
 *   I3  zero draft di concealedBody
 *   I4  i 17 codici del JSON sono 1:1 coi documenti vivi, zero orfani per lato
 *   I5  ogni macro di serves_macros è in PRODUCT_MACROS — validata a RUNTIME, perché
 *       typegen NON restringe gli array con options.list: `servesMacros` è
 *       `Array<string>` nei tipi e il compilatore non ci protegge
 *   I6  ogni water_supply è in WATER_SUPPLY_VALUES (lista condivisa con `model`)
 *   I7  sanity_doc_id == "concealedBody-" + slug su tutte e 17 le righe
 *   I8  STRUTTURALE: ogni descrizione ha ESATTAMENTE 1 block e 1 span per lingua.
 *       È il tripwire anti-modifica-concorrente nello spirito di U3b: verificato che
 *       oggi la condizione vale 17/17 × 2 lingue, quindi non scatterà mai su dati
 *       integri. Se scatta, qualcuno ha editato una descrizione in Studio e la patch
 *       per indice/chiave va ripensata — mai scrivere alla cieca su Portable Text.
 *
 * DRY-RUN di default (read token). `--execute` scrive (write token).
 *   pnpm tsx scripts/enrich-concealed-bodies.ts             # DRY-RUN
 *   pnpm tsx scripts/enrich-concealed-bodies.ts --execute   # SCRIVE
 *
 * TRANSAZIONE SINGOLA, `visibility: "sync"`. IDEMPOTENTE: patcha solo ciò che diverge
 * dal target, quindi una seconda esecuzione trova 0 modifiche.
 *
 * ⚠️ DOPO: Redeploy SENZA build cache. Qui è NECESSARIO, non assicurazione: queste
 * scritture cambiano contenuto renderizzabile, e uno script che scrive diretto sul
 * Content Lake non fa scattare il webhook Sanity.
 */
import { createClient, type SanityClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PRODUCT_MACROS } from "../sanity/schemas/documents/model-taxonomy";
import { WATER_SUPPLY_VALUES } from "../sanity/schemas/documents/water-supply";

loadEnv({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const DATA_PATH = resolve(REPO_ROOT, "scripts/data/incassi-data-2026-07-28.json");
const SCHEMA_PATH = resolve(REPO_ROOT, "sanity/schemas/documents/concealedBody.ts");
const BACKUP_PATH = resolve(REPO_ROOT, "scripts/data/concealed-bodies-backup-2026-07-28.json");
const LOG_PATH = resolve(REPO_ROOT, "scripts/migration/incassi-dryrun-log.json");

const EXECUTE = process.argv.includes("--execute");
const MODE = EXECUTE ? "EXECUTE (scrive)" : "DRY-RUN (sola lettura)";
const SETTLE_MS = 1500;
const EXPECTED_DOCS = 17;

const MACRO_VALUES: readonly string[] = PRODUCT_MACROS.map((m) => m.value);

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01";
const token = EXECUTE ? process.env.SANITY_WRITE_TOKEN : process.env.SANITY_API_READ_TOKEN;

if (!projectId || !dataset || !token) {
  console.error(
    `✖ Env Sanity mancante (NEXT_PUBLIC_SANITY_PROJECT_ID, _DATASET, o ${
      EXECUTE ? "SANITY_WRITE_TOKEN" : "SANITY_API_READ_TOKEN"
    }).`,
  );
  process.exit(1);
}

const client: SanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  token,
  useCdn: false,
  perspective: "published",
});
const rawClient = client.withConfig({ perspective: "raw" });

interface Row {
  code: string;
  slug: string;
  sanity_doc_id: string;
  serves_macros: string[];
  water_supply: string;
  desc_it: string;
  desc_en: string;
}
interface Span {
  _key: string;
  text?: string;
}
interface Block {
  _key: string;
  children?: Span[];
}
interface LiveDoc {
  _id: string;
  code: string | null;
  slug: { current?: string } | null;
  servesMacros: string[] | null;
  waterSupply: string | null;
  description: { it?: Block[]; en?: Block[] } | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const abort = (msg: string, detail?: unknown): never => {
  console.error(`\n✖ ABORT — ${msg}`);
  if (detail !== undefined) console.error(JSON.stringify(detail, null, 2));
  process.exit(1);
};

async function main() {
  console.log(`\n═══ enrich-concealed-bodies — ${MODE} ═══`);
  console.log(`    dataset: ${projectId}/${dataset}\n`);

  const file = JSON.parse(readFileSync(DATA_PATH, "utf8")) as { rows: Row[]; note: string };
  const rows = file.rows;

  // ─── I1: PR 1 è nel checkout? ───────────────────────────────────────────────
  const schemaSrc = readFileSync(SCHEMA_PATH, "utf8");
  const missingFields = ["slug", "servesMacros", "waterSupply"].filter(
    (f) => !new RegExp(`name:\\s*["']${f}["']`).test(schemaSrc),
  );
  if (missingFields.length)
    abort(
      `I1: lo schema concealedBody non dichiara ancora ${missingFields.join(", ")}. Questo script va lanciato su un checkout con PR 1 applicata: scrivere campi che lo schema non conosce farebbe comparire «unknown fields» in Studio.`,
    );
  console.log(`✓ I1  lo schema dichiara slug, servesMacros, waterSupply (PR 1 applicata)`);

  // ─── I2 / I3: forma del dataset ─────────────────────────────────────────────
  const [liveCount, draftCount] = await Promise.all([
    client.fetch<number>(`count(*[_type=="concealedBody"])`),
    rawClient.fetch<number>(`count(*[_type=="concealedBody" && _id in path("drafts.**")])`),
  ]);
  if (liveCount !== EXPECTED_DOCS)
    abort(`I2: il dataset ha ${liveCount} concealedBody, attesi ${EXPECTED_DOCS}.`);
  console.log(`✓ I2  dataset: ${liveCount} concealedBody`);
  if (draftCount !== 0)
    abort(
      `I3: ci sono ${draftCount} draft di concealedBody. Un draft renderebbe stantia la patch sul published: pubblicare o scartare prima.`,
    );
  console.log(`✓ I3  zero draft di concealedBody`);

  const live = await client.fetch<LiveDoc[]>(
    `*[_type=="concealedBody"]| order(code asc){ _id, code, slug, servesMacros, waterSupply, description }`,
  );

  // ─── I4: match 1:1 sui codici ───────────────────────────────────────────────
  const byCode = new Map(live.filter((d) => d.code).map((d) => [d.code as string, d]));
  const missing = rows.filter((r) => !byCode.has(r.code)).map((r) => r.code);
  const orphans = live
    .filter((d) => d.code && !rows.some((r) => r.code === d.code))
    .map((d) => d.code);
  if (missing.length)
    abort(`I4: ${missing.length} codici del JSON non esistono in Sanity.`, missing);
  if (orphans.length)
    abort(`I4: ${orphans.length} documenti in Sanity non presenti nel JSON.`, orphans);
  console.log(`✓ I4  ${rows.length} codici 1:1 coi documenti, zero orfani per lato`);

  // ─── I5 / I6 / I7: validità dei valori (a RUNTIME, i tipi non bastano) ──────
  const badMacro = rows.flatMap((r) =>
    r.serves_macros.filter((m) => !MACRO_VALUES.includes(m)).map((m) => `${r.code}: "${m}"`),
  );
  if (badMacro.length) abort(`I5: macro fuori da PRODUCT_MACROS.`, badMacro);
  console.log(`✓ I5  tutte le macro sono in PRODUCT_MACROS (validate a runtime)`);

  const badWater = rows
    .filter((r) => !WATER_SUPPLY_VALUES.includes(r.water_supply))
    .map((r) => `${r.code}: "${r.water_supply}"`);
  if (badWater.length) abort(`I6: water_supply fuori dalla lista condivisa.`, badWater);
  console.log(`✓ I6  tutti i water_supply sono in WATER_SUPPLY_VALUES`);

  const badId = rows
    .filter((r) => r.sanity_doc_id !== `concealedBody-${r.slug}`)
    .map((r) => `${r.code}: ${r.sanity_doc_id}`);
  if (badId.length) abort(`I7: sanity_doc_id non conforme a concealedBody-<slug>.`, badId);
  console.log(`✓ I7  sanity_doc_id conformi su tutte e ${rows.length} le righe`);

  // ─── I8: struttura del Portable Text ────────────────────────────────────────
  const badShape: string[] = [];
  for (const d of live) {
    for (const lang of ["it", "en"] as const) {
      const blocks = d.description?.[lang];
      if (!Array.isArray(blocks) || blocks.length !== 1) {
        badShape.push(`${d.code} [${lang}]: ${blocks?.length ?? "assente"} block, atteso 1`);
        continue;
      }
      const spans = blocks[0].children;
      if (!Array.isArray(spans) || spans.length !== 1)
        badShape.push(`${d.code} [${lang}]: ${spans?.length ?? "assenti"} span, atteso 1`);
    }
  }
  if (badShape.length)
    abort(
      `I8: struttura Portable Text inattesa su ${badShape.length} descrizioni. La patch per chiave presuppone 1 block / 1 span: qui va ripensata, MAI scritta alla cieca.`,
      badShape,
    );
  console.log(`✓ I8  1 block / 1 span su tutte e ${live.length} le descrizioni × 2 lingue`);

  // ─── piano ──────────────────────────────────────────────────────────────────
  const flat = (blocks?: Block[]) =>
    (blocks ?? [])
      .flatMap((b) => (b.children ?? []).map((c) => c.text ?? ""))
      .join("")
      .trim();

  interface Plan {
    id: string;
    code: string;
    set: Record<string, unknown>;
    fieldChanges: string[];
    textFixes: { lang: string; from: string; to: string }[];
  }
  const plans: Plan[] = [];

  for (const r of rows) {
    const d = byCode.get(r.code)!;
    const set: Record<string, unknown> = {};
    const fieldChanges: string[] = [];
    const textFixes: Plan["textFixes"] = [];

    if (d.slug?.current !== r.slug) {
      set.slug = { _type: "slug", current: r.slug };
      fieldChanges.push(`slug → ${r.slug}`);
    }
    if (JSON.stringify(d.servesMacros ?? []) !== JSON.stringify(r.serves_macros)) {
      set.servesMacros = r.serves_macros;
      fieldChanges.push(`servesMacros → [${r.serves_macros.join(", ")}]`);
    }
    if (d.waterSupply !== r.water_supply) {
      set.waterSupply = r.water_supply;
      fieldChanges.push(`waterSupply → ${r.water_supply}`);
    }

    for (const [lang, target] of [
      ["it", r.desc_it],
      ["en", r.desc_en],
    ] as const) {
      const blocks = d.description?.[lang];
      const current = flat(blocks);
      if (current === target) continue;
      const blockKey = blocks![0]._key;
      const spanKey = blocks![0].children![0]._key;
      // Path filtrato per _key: le chiavi non si toccano per costruzione.
      set[`description.${lang}[_key=="${blockKey}"].children[_key=="${spanKey}"].text`] = target;
      textFixes.push({ lang, from: current, to: target });
    }

    if (Object.keys(set).length)
      plans.push({ id: d._id, code: r.code, set, fieldChanges, textFixes });
  }

  console.log(`\n── PIANO ──────────────────────────────────────────────`);
  console.log(`  documenti da patchare: ${plans.length} / ${rows.length}`);
  const allFixes = plans.flatMap((p) => p.textFixes.map((f) => ({ code: p.code, ...f })));
  console.log(`  correzioni di TESTO: ${allFixes.length}`);
  for (const f of allFixes) {
    console.log(`    · ${f.code} [${f.lang}]`);
    console.log(`        da:  ${f.from}`);
    console.log(`        a:   ${f.to}`);
  }
  console.log(`\n  campi valorizzati (primi 5 documenti):`);
  for (const p of plans.slice(0, 5))
    console.log(`    ${p.code.padEnd(10)} ${p.fieldChanges.join(" · ")}`);
  if (plans.length > 5) console.log(`    … e altri ${plans.length - 5}`);

  const mutations = plans.map((p) => ({ patch: { id: p.id, set: p.set } }));
  console.log(
    `\n  transazione singola: ${mutations.length} patch, payload ~${(JSON.stringify(mutations).length / 1024).toFixed(1)} kB`,
  );
  console.log(
    `  NON scritti: image (pipeline Magnific) e order (assente dal JSON — vedi docblock)`,
  );

  // ─── BACKUP prima di qualunque scrittura ────────────────────────────────────
  writeFileSync(
    BACKUP_PATH,
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        note: "Stato dei 17 concealedBody PRIMA di enrich-concealed-bodies.ts. Rollback: description torna qui, i campi nuovi si unset.",
        rows: live,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`\n  backup: ${BACKUP_PATH.replace(REPO_ROOT + "/", "")} (${live.length} documenti)`);
  writeFileSync(
    LOG_PATH,
    JSON.stringify({ mode: MODE, toPatch: plans.length, textFixes: allFixes }, null, 2) + "\n",
  );
  console.log(`  log:    ${LOG_PATH.replace(REPO_ROOT + "/", "")}`);

  if (!EXECUTE) {
    console.log(`\n═══ DRY-RUN: nessuna scrittura. Rilanciare con --execute per applicare. ═══\n`);
    return;
  }
  if (!plans.length) {
    console.log(`\n═══ Niente da fare: tutti i documenti sono già a target. ═══\n`);
    return;
  }

  // ─── execute ────────────────────────────────────────────────────────────────
  console.log(`\n── SCRITTURA (transazione singola, visibility:sync) ────`);
  const tx = client.transaction();
  for (const p of plans) tx.patch(p.id, { set: p.set });
  await tx.commit({ visibility: "sync" });
  console.log(`  committate ${plans.length} patch in UNA transazione`);
  await sleep(SETTLE_MS);

  // ─── verifica su query FRESCHE ──────────────────────────────────────────────
  console.log(`\n── VERIFICA (GROQ fresche, non il ritorno della transazione) ──`);
  const after = await client.fetch<LiveDoc[]>(
    `*[_type=="concealedBody"]| order(code asc){ _id, code, slug, servesMacros, waterSupply, description }`,
  );
  const fails: string[] = [];
  for (const r of rows) {
    const d = after.find((x) => x.code === r.code);
    if (!d) {
      fails.push(`${r.code}: documento sparito`);
      continue;
    }
    if (d.slug?.current !== r.slug) fails.push(`${r.code}: slug ${d.slug?.current}`);
    if (JSON.stringify(d.servesMacros ?? []) !== JSON.stringify(r.serves_macros))
      fails.push(`${r.code}: servesMacros ${JSON.stringify(d.servesMacros)}`);
    if (d.waterSupply !== r.water_supply) fails.push(`${r.code}: waterSupply ${d.waterSupply}`);
    if (flat(d.description?.it) !== r.desc_it) fails.push(`${r.code}: desc it`);
    if (flat(d.description?.en) !== r.desc_en) fails.push(`${r.code}: desc en`);
    // le _key devono essere sopravvissute alla patch
    const before = byCode.get(r.code)!;
    for (const lang of ["it", "en"] as const) {
      const kb = before.description?.[lang]?.[0]?._key;
      const ka = d.description?.[lang]?.[0]?._key;
      if (kb !== ka) fails.push(`${r.code} [${lang}]: _key del block cambiata (${kb} → ${ka})`);
    }
  }
  const withAll = after.filter(
    (d) => d.slug?.current && d.servesMacros?.length && d.waterSupply,
  ).length;
  console.log(`  documenti con slug + servesMacros + waterSupply: ${withAll}/${after.length}`);
  console.log(
    `  _key dei block preservate: ${fails.some((f) => f.includes("_key")) ? "NO ✗" : "sì ✓"}`,
  );

  if (fails.length) abort(`verifica FALLITA dopo la scrittura:\n    - ${fails.join("\n    - ")}`);

  console.log(`\n✓ verifica superata su query fresche.`);
  console.log(`\n⚠️  ORA SERVE UN REDEPLOY SENZA BUILD CACHE. Questa scrittura è diretta sul`);
  console.log(`   Content Lake: il webhook Sanity NON scatta e Vercel ristora la fetch-cache`);
  console.log(`   dal build precedente. Qui NON è assicurazione — cambia contenuto`);
  console.log(`   renderizzabile, a differenza dell'unset di PR-B.\n`);
}

main().catch((e) => {
  console.error("\n✖ errore non gestito:", e);
  process.exit(1);
});
