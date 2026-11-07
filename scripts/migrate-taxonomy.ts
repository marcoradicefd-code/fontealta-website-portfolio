/**
 * migrate-taxonomy.ts — FRONT 2 (one-shot): popola `productMacro` + `productSubtype`
 * sui 595 modelli, dalla tassonomia v2 approvata dal cliente.
 *
 * Sorgente di verità: `scripts/data/taxonomy-v2-2026-07-25.json`
 *   ({generated, source, note, rows[595]}), generato da Cowork il 25/07/2026 da
 *   Contenuti_Sito-002.xlsx + email Andrea 24/07. Committato per riproducibilità.
 *
 * Piano completo, numeri e rischi: `docs/front2-design.md` §4.
 *
 * COSA SCRIVE, e cosa NON tocca:
 *   set  productMacro   ← row.macro   in minuscolo   (enum 6 valori)
 *   set  productSubtype ← slug(row.subtype)          (enum 24 valori)
 *   productType NON viene toccato: resta la rete di sicurezza del fallback
 *   (`resolveMacro`) per tutto il periodo di rodaggio, e si rimuove in PR-B.
 *
 * TRANSAZIONE SINGOLA, `visibility: "sync"`. Non è una preferenza stilistica:
 * l'atomicità garantisce che lo stato misto (alcuni modelli migrati, altri no)
 * NON esista mai. `collection-card.tsx` preferisce `productMacros` quando l'array
 * è non vuoto e ignora il legacy: con una migrazione a lotti una collezione
 * mezza-migrata mostrerebbe MENO macro del vero. Con una transazione unica quel
 * caso è impossibile per costruzione. Se l'API rifiutasse la transazione per
 * dimensione, lo script ABORTISCE senza scrivere nulla (atomico) e la decisione
 * di passare a lotti va presa esplicitamente, non subita.
 *
 * LE 4 RIGHE FLAGGATE (`flag_andrea: true` — COL90.AST, COL90.AST.L, W12.AST,
 * W12.AST.FS) VENGONO MIGRATE col default di famiglia, come da raccomandazione del
 * piano §5.1. Il ragionamento: saltarle le lascerebbe sul fallback, che per tutte
 * e quattro deriva una macro SBAGLIATA (doccia/lavabo invece di giardino). Saltarle
 * non è prudenza, è conservare un errore noto in produzione. Migrandole l'unico
 * dubbio residuo è il SOTTOTIPO, errore molto più piccolo: la macro guida filtri,
 * hero e card collezione, il sottotipo solo la seconda metà del testo della pill.
 * Sono elencate esplicitamente nel report a ogni esecuzione.
 *
 * GUARDIE, tutte PRIMA di qualunque scrittura (abort con report completo):
 *   G1  il dataset ha esattamente 595 model
 *   G2  ogni codice del JSON esiste come UN SOLO model (nessun mancante, nessun doppio)
 *   G3  zero draft di model (un draft renderebbe stantia la patch sul published)
 *   G4  ogni coppia (macro, sottotipo) è ammessa da MACRO_SUBTYPES, e i valori
 *       esistono negli enum — la stessa tabella che valida lo Studio, importata
 *       dallo stesso modulo, così script e Studio non possono divergere
 *   G5  coerenza interna del JSON: label === macro + "-" + subtype
 *   G6  il JSON ha 595 righe e nessun codice duplicato
 *   G7  il `productType` vivo coincide con `productType_attuale` del JSON — se
 *       differisce il JSON è STALE (è una fotografia del 25/07) e si abortisce
 *
 * DRY-RUN di default (read token). `--execute` scrive (write token).
 *   pnpm tsx scripts/migrate-taxonomy.ts             # DRY-RUN
 *   pnpm tsx scripts/migrate-taxonomy.ts --execute   # SCRIVE
 *
 * IDEMPOTENTE: patcha solo i modelli il cui stato differisce dal target, quindi una
 * seconda esecuzione trova 0 modifiche. REVERSIBILE: rollback = `unset` dei due
 * campi sui 595 (erano entrambi vuoti prima di questa migrazione, quindi non c'è
 * nessuno stato precedente da ricostruire).
 *
 * VERIFICA post-scrittura: query GROQ FRESCHE, non il valore di ritorno della
 * transazione (che riflette ciò che ho chiesto, non ciò che c'è).
 *
 * ⚠️ DOPO l'esecuzione serve un REDEPLOY SENZA BUILD CACHE. Questo script scrive
 * DIRETTO sul Content Lake: il webhook Sanity non scatta (parte solo dai publish
 * di Studio) e Vercel ristora la fetch-cache dal build precedente. Un deploy
 * normale NON basta per le pagine SSG con revalidate:false. Lezione registrata
 * in docs/history.md, confermata due volte.
 */
import { createClient, type SanityClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MACRO_SUBTYPES,
  MACRO_VALUES,
  SUBTYPE_VALUES,
  toSlug,
} from "../sanity/schemas/documents/model-taxonomy";

loadEnv({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const DATA_PATH = resolve(REPO_ROOT, "scripts/data/taxonomy-v2-2026-07-25.json");
const LOG_PATH = resolve(REPO_ROOT, "scripts/migration/taxonomy-dryrun-log.json");

const EXECUTE = process.argv.includes("--execute");
const MODE = EXECUTE ? "EXECUTE (scrive)" : "DRY-RUN (sola lettura)";
const SETTLE_MS = 1500;

/** Atteso dal piano §2.5, confrontato col vivo dal report. */
const EXPECTED_MACRO_DIST: Record<string, number> = {
  doccia: 392,
  vasca: 86,
  lavabo: 76,
  giardino: 18,
  cucina: 17,
  bidet: 6,
};
const EXPECTED_ROWS = 595;
const EXPECTED_MACRO_CHANGES = 45; // 41 delle 3 macro nuove + 4 spostamenti fra esistenti
const FLAGGED_CODES = ["COL90.AST", "COL90.AST.L", "W12.AST", "W12.AST.FS"] as const;

// ─── env ──────────────────────────────────────────────────────────────────────
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
/** Serve per contare i draft: la perspective published per definizione non li vede. */
const rawClient = client.withConfig({ perspective: "raw" });

// ─── shapes ───────────────────────────────────────────────────────────────────
interface TaxRow {
  code: string;
  label: string;
  macro: string;
  subtype: string;
  source: string;
  flag_andrea: boolean;
  productType_attuale: string;
}
interface TaxFile {
  generated: string;
  source: string;
  note: string;
  rows: TaxRow[];
}
interface LiveModel {
  _id: string;
  code: string | null;
  productType: string | null;
  productMacro: string | null;
  productSubtype: string | null;
}
interface Target {
  code: string;
  id: string;
  macro: string;
  subtype: string;
  legacyMacro: string;
  flagged: boolean;
  needsWrite: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const abort = (msg: string, detail?: unknown): never => {
  console.error(`\n✖ ABORT — ${msg}`);
  if (detail !== undefined) console.error(JSON.stringify(detail, null, 2));
  process.exit(1);
};

/** Derivazione legacy, copia esatta di `categoryKey` in src/lib/product-category.ts. */
const legacyMacroOf = (productType: string): string =>
  productType.startsWith("lavabo")
    ? "lavabo"
    : productType.startsWith("vasca")
      ? "vasca"
      : "doccia";

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n═══ migrate-taxonomy — ${MODE} ═══`);
  console.log(`    dataset: ${projectId}/${dataset}\n`);

  const file = JSON.parse(readFileSync(DATA_PATH, "utf8")) as TaxFile;
  console.log(`▸ sorgente: ${file.source}`);
  console.log(`  generato: ${file.generated}`);
  console.log(`  nota:     ${file.note}\n`);

  // ─── G6: forma del JSON ─────────────────────────────────────────────────────
  const rows = file.rows;
  if (rows.length !== EXPECTED_ROWS) {
    abort(`G6: il JSON ha ${rows.length} righe, attese ${EXPECTED_ROWS}.`);
  }
  const dupJson = [
    ...new Map<string, number>(
      rows.map((r) => [r.code, rows.filter((x) => x.code === r.code).length]),
    ),
  ].filter(([, n]) => n > 1);
  if (dupJson.length) abort("G6: codici duplicati nel JSON.", dupJson);
  console.log(`✓ G6  JSON: ${rows.length} righe, nessun codice duplicato`);

  // ─── G5 + G4: coerenza interna e validità delle coppie ──────────────────────
  const badLabel: string[] = [];
  const badPair: { code: string; macro: string; subtype: string; motivo: string }[] = [];
  for (const r of rows) {
    if (r.label !== `${r.macro}-${r.subtype}`) badLabel.push(`${r.code}: "${r.label}"`);
    const macro = r.macro.toLowerCase();
    const slug = toSlug(r.subtype);
    if (!MACRO_VALUES.includes(macro))
      badPair.push({ code: r.code, macro, subtype: slug, motivo: "macro fuori enum" });
    else if (!SUBTYPE_VALUES.includes(slug))
      badPair.push({ code: r.code, macro, subtype: slug, motivo: "sottotipo fuori enum" });
    else if (!(MACRO_SUBTYPES[macro] ?? []).includes(slug))
      badPair.push({ code: r.code, macro, subtype: slug, motivo: "coppia non ammessa" });
  }
  if (badLabel.length)
    abort(`G5: ${badLabel.length} label incoerenti con macro+"-"+subtype.`, badLabel.slice(0, 20));
  console.log(`✓ G5  label coerenti con macro + "-" + subtype su tutte le righe`);
  if (badPair.length)
    abort(`G4: ${badPair.length} coppie (macro, sottotipo) non valide.`, badPair.slice(0, 20));
  console.log(`✓ G4  coppie valide per MACRO_SUBTYPES (stessa tabella dello Studio)`);

  // ─── G1 / G3: forma del dataset ─────────────────────────────────────────────
  const [liveCount, draftCount] = await Promise.all([
    client.fetch<number>(`count(*[_type=="model"])`),
    rawClient.fetch<number>(`count(*[_type=="model" && _id in path("drafts.**")])`),
  ]);
  if (liveCount !== EXPECTED_ROWS)
    abort(`G1: il dataset ha ${liveCount} model, attesi ${EXPECTED_ROWS}.`);
  console.log(`✓ G1  dataset: ${liveCount} model`);
  if (draftCount !== 0)
    abort(
      `G3: ci sono ${draftCount} draft di model. Un draft renderebbe stantia la patch sul published: pubblicare o scartare prima di migrare.`,
    );
  console.log(`✓ G3  zero draft di model`);

  // ─── G2: match codice → un solo model ───────────────────────────────────────
  const live = await client.fetch<LiveModel[]>(
    `*[_type=="model"]{ _id, code, productType, productMacro, productSubtype }`,
  );
  const byCode = new Map<string, LiveModel[]>();
  for (const m of live) {
    if (!m.code) continue;
    byCode.set(m.code, [...(byCode.get(m.code) ?? []), m]);
  }
  const missing = rows.filter((r) => !byCode.has(r.code)).map((r) => r.code);
  const ambiguous = [...byCode.entries()]
    .filter(([, ms]) => ms.length > 1)
    .map(([c, ms]) => `${c} ×${ms.length}`);
  const orphanLive = live
    .filter((m) => m.code && !rows.some((r) => r.code === m.code))
    .map((m) => m.code);
  if (missing.length)
    abort(`G2: ${missing.length} codici del JSON non esistono in Sanity.`, missing);
  if (ambiguous.length) abort(`G2: ${ambiguous.length} codici con più di un model.`, ambiguous);
  if (orphanLive.length)
    abort(`G2: ${orphanLive.length} model in Sanity non presenti nel JSON.`, orphanLive);
  console.log(`✓ G2  ${rows.length} codici → 1:1 con i model, zero orfani su entrambi i lati`);

  // ─── G7: il JSON non è stale ────────────────────────────────────────────────
  const stale = rows
    .map((r) => ({ r, m: byCode.get(r.code)![0] }))
    .filter(({ r, m }) => (m.productType ?? "") !== r.productType_attuale)
    .map(
      ({ r, m }) =>
        `${r.code}: JSON="${r.productType_attuale}" vivo="${m.productType ?? "(vuoto)"}"`,
    );
  if (stale.length)
    abort(
      `G7: ${stale.length} model hanno un productType diverso da quello registrato nel JSON. Il JSON è una fotografia del ${file.generated}: se il catalogo è cambiato va rigenerato.`,
      stale.slice(0, 20),
    );
  console.log(`✓ G7  productType vivo coincide col JSON su tutte le righe (JSON non stale)`);

  // ─── piano ──────────────────────────────────────────────────────────────────
  const targets: Target[] = rows.map((r) => {
    const m = byCode.get(r.code)![0];
    const macro = r.macro.toLowerCase();
    const subtype = toSlug(r.subtype);
    return {
      code: r.code,
      id: m._id,
      macro,
      subtype,
      legacyMacro: legacyMacroOf(r.productType_attuale),
      flagged: r.flag_andrea === true,
      needsWrite: m.productMacro !== macro || m.productSubtype !== subtype,
    };
  });

  const toWrite = targets.filter((t) => t.needsWrite);
  const alreadyOk = targets.length - toWrite.length;

  const dist = targets.reduce<Record<string, number>>(
    (a, t) => ((a[t.macro] = (a[t.macro] ?? 0) + 1), a),
    {},
  );
  const macroChanges = targets.filter((t) => t.macro !== t.legacyMacro);
  const newMacroRows = macroChanges.filter((t) => !["lavabo", "doccia", "vasca"].includes(t.macro));
  const movesRows = macroChanges.filter((t) => ["lavabo", "doccia", "vasca"].includes(t.macro));
  const flagged = targets.filter((t) => t.flagged);

  // ─── report ─────────────────────────────────────────────────────────────────
  console.log(`\n── PIANO ──────────────────────────────────────────────`);
  console.log(`  da scrivere: ${toWrite.length}   già a target: ${alreadyOk}`);

  console.log(`\n  distribuzione per macro (target vs atteso dal piano):`);
  let distOk = true;
  for (const k of Object.keys(EXPECTED_MACRO_DIST)) {
    const got = dist[k] ?? 0;
    const exp = EXPECTED_MACRO_DIST[k];
    if (got !== exp) distOk = false;
    console.log(
      `    ${got === exp ? "✓" : "✗"} ${k.padEnd(9)} ${String(got).padStart(3)}  (atteso ${exp})`,
    );
  }
  const extraMacros = Object.keys(dist).filter((k) => !(k in EXPECTED_MACRO_DIST));
  if (extraMacros.length) {
    distOk = false;
    console.log(`    ✗ macro inattese: ${extraMacros.join(", ")}`);
  }

  console.log(
    `\n  cambi di macro rispetto alla derivazione legacy: ${macroChanges.length} (atteso ${EXPECTED_MACRO_CHANGES})`,
  );
  const byTransition = macroChanges.reduce<Record<string, string[]>>((a, t) => {
    const k = `${t.legacyMacro} → ${t.macro}`;
    (a[k] = a[k] ?? []).push(t.code);
    return a;
  }, {});
  for (const [k, codes] of Object.entries(byTransition).sort((x, y) => y[1].length - x[1].length)) {
    console.log(
      `    ${String(codes.length).padStart(3)}  ${k.padEnd(22)} es: ${codes.slice(0, 4).join(", ")}`,
    );
  }
  console.log(`    di cui macro NUOVE (invisibili al fallback): ${newMacroRows.length}`);
  console.log(`    di cui spostamenti fra macro esistenti:      ${movesRows.length}`);

  console.log(
    `\n  righe FLAGGATE (default di famiglia, da confermare con Andrea): ${flagged.length}`,
  );
  for (const f of flagged) {
    console.log(
      `    · ${f.code.padEnd(14)} → ${f.macro}-${f.subtype}   (legacy derivava "${f.legacyMacro}")`,
    );
  }
  const flaggedMismatch = FLAGGED_CODES.filter((c) => !flagged.some((f) => f.code === c));
  if (flaggedMismatch.length)
    console.log(
      `    ⚠️  attesi anche: ${flaggedMismatch.join(", ")} — non risultano flaggati nel JSON`,
    );

  // dimensione della transazione singola
  const mutations = toWrite.map((t) => ({
    patch: { id: t.id, set: { productMacro: t.macro, productSubtype: t.subtype } },
  }));
  const payloadKb = (JSON.stringify(mutations).length / 1024).toFixed(1);
  console.log(`\n  transazione singola: ${mutations.length} patch, payload ~${payloadKb} kB`);

  const anomalies: string[] = [];
  if (!distOk) anomalies.push("distribuzione per macro diversa dall'attesa");
  if (macroChanges.length !== EXPECTED_MACRO_CHANGES)
    anomalies.push(`cambi di macro ${macroChanges.length} invece di ${EXPECTED_MACRO_CHANGES}`);
  if (flagged.length !== FLAGGED_CODES.length)
    anomalies.push(`righe flaggate ${flagged.length} invece di ${FLAGGED_CODES.length}`);
  console.log(`\n  anomalie: ${anomalies.length ? anomalies.join(" · ") : "nessuna"}`);

  writeFileSync(
    LOG_PATH,
    JSON.stringify(
      {
        mode: MODE,
        generated: file.generated,
        toWrite: toWrite.length,
        alreadyOk,
        dist,
        macroChanges: byTransition,
        flagged: flagged.map((f) => ({
          code: f.code,
          target: `${f.macro}-${f.subtype}`,
          legacy: f.legacyMacro,
        })),
        payloadKb,
        anomalies,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`\n  log: ${LOG_PATH.replace(REPO_ROOT + "/", "")}`);

  if (!EXECUTE) {
    console.log(`\n═══ DRY-RUN: nessuna scrittura. Rilanciare con --execute per applicare. ═══\n`);
    return;
  }
  if (!toWrite.length) {
    console.log(`\n═══ Niente da fare: tutti i ${targets.length} model sono già a target. ═══\n`);
    return;
  }

  // ─── execute ────────────────────────────────────────────────────────────────
  console.log(`\n── SCRITTURA (transazione singola, visibility:sync) ────`);
  const tx = client.transaction();
  for (const t of toWrite)
    tx.patch(t.id, { set: { productMacro: t.macro, productSubtype: t.subtype } });
  await tx.commit({ visibility: "sync" });
  console.log(`  committate ${toWrite.length} patch in UNA transazione`);
  await sleep(SETTLE_MS);

  // ─── verifica su query FRESCHE ──────────────────────────────────────────────
  console.log(`\n── VERIFICA (GROQ fresche, non il ritorno della transazione) ──`);
  const check = await client.fetch<{
    withMacro: number;
    withSubtype: number;
    total: number;
    invalidPairs: {
      code: string | null;
      productMacro: string | null;
      productSubtype: string | null;
    }[];
  }>(`{
    "withMacro": count(*[_type=="model" && defined(productMacro)]),
    "withSubtype": count(*[_type=="model" && defined(productSubtype)]),
    "total": count(*[_type=="model"]),
    "invalidPairs": *[_type=="model" && (!defined(productMacro) || !defined(productSubtype))]{ code, productMacro, productSubtype }
  }`);
  const freshDist = await client.fetch<Record<string, number>>(
    `{${MACRO_VALUES.map((m) => `"${m}": count(*[_type=="model" && productMacro=="${m}"])`).join(",")}}`,
  );

  const fails: string[] = [];
  if (check.withMacro !== EXPECTED_ROWS)
    fails.push(`defined(productMacro)=${check.withMacro}, atteso ${EXPECTED_ROWS}`);
  if (check.withSubtype !== EXPECTED_ROWS)
    fails.push(`defined(productSubtype)=${check.withSubtype}, atteso ${EXPECTED_ROWS}`);
  if (check.invalidPairs.length)
    fails.push(`${check.invalidPairs.length} model con un campo mancante`);
  for (const k of Object.keys(EXPECTED_MACRO_DIST)) {
    if (freshDist[k] !== EXPECTED_MACRO_DIST[k])
      fails.push(`${k}=${freshDist[k]}, atteso ${EXPECTED_MACRO_DIST[k]}`);
  }
  console.log(`  productMacro definito:   ${check.withMacro}/${check.total}`);
  console.log(`  productSubtype definito: ${check.withSubtype}/${check.total}`);
  console.log(
    `  distribuzione viva:      ${MACRO_VALUES.map((m) => `${m}=${freshDist[m]}`).join(" · ")}`,
  );
  if (check.invalidPairs.length)
    console.log(
      `  ✗ campi mancanti su: ${check.invalidPairs
        .slice(0, 10)
        .map((x) => x.code)
        .join(", ")}`,
    );

  if (fails.length) {
    abort(`verifica FALLITA dopo la scrittura:\n    - ${fails.join("\n    - ")}`);
  }

  console.log(`\n✓ verifica superata su query fresche.`);
  console.log(`\n── ROLLBACK, se servisse ───────────────────────────────`);
  console.log(`  I due campi erano ENTRAMBI vuoti prima di questa migrazione: non c'è`);
  console.log(`  nessuno stato precedente da ricostruire. Annullare = unset dei due campi`);
  console.log(`  sui 595 model. productType non è stato toccato, quindi il fallback`);
  console.log(`  riprenderebbe a funzionare da solo, esattamente come prima di oggi.`);
  console.log(`\n⚠️  ORA SERVE UN REDEPLOY SENZA BUILD CACHE: questa scrittura è diretta sul`);
  console.log(`   Content Lake, il webhook Sanity NON scatta e Vercel ristora la fetch-cache`);
  console.log(`   dal build precedente. Un deploy normale non basta.\n`);
}

main().catch((e) => {
  console.error("\n✖ errore non gestito:", e);
  process.exit(1);
});
