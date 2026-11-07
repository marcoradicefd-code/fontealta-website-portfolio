/**
 * unset-product-type.ts — PR-B (one-shot): rimuove il campo `productType` dai 595
 * documenti `model`, dopo che PR-B lo ha tolto dallo schema e dal codice.
 *
 * PERCHÉ SERVE, e perché subito dopo il merge:
 *   Rimuovere il campo dallo SCHEMA non rimuove i VALORI dai documenti. Finché
 *   restano, ogni model aperto in Studio mostra «Found 1 unknown fields:
 *   productType» con l'azione Remove-value, e gli attributi orfani contano verso
 *   il limite di attributi del dataset. È una conseguenza nota, non una scoperta:
 *   merge e unset stanno nella stessa sessione così Andrea non vede mai il banner.
 *
 * ⚠️ QUESTO SCRIPT NON È AUTO-REVERSIBILE. La migrazione #61 lo era (i due campi
 * nuovi erano vuoti prima, quindi annullarla = un unset). Qui i valori spariscono
 * e non c'è nessuno stato da cui ricostruirli. Per questo lo script scrive un
 * BACKUP di {_id, code, productType} × 595 PRIMA di toccare qualunque cosa: quel
 * file È il rollback, e va committato insieme allo script.
 *
 * GUARDIE, tutte PRIMA di qualunque scrittura (abort con report completo):
 *   U1  il dataset ha esattamente 595 model
 *   U2  zero draft di model (un draft renderebbe stantia la patch sul published)
 *   U3  tutti e 595 hanno productMacro E productSubtype definiti, e ogni coppia
 *       VIVA è ammessa da MACRO_SUBTYPES — importata dalla stessa fonte LOCK dello
 *       Studio. È LA guardia: non si toglie la rete vecchia se la nuova non è
 *       completa e valida. Un `count(campo) == 0` qui non basterebbe: su un campo
 *       assente GROQ ritorna null e `null == 0` è falso, quindi si usa `defined()`.
 *   U3b la distribuzione per macro coincide con quella verificata dopo la migrazione
 *       #61 (doccia 392 · vasca 86 · lavabo 76 · giardino 18 · cucina 17 · bidet 6).
 *       Non serve alla correttezza dell'unset — quella la garantisce U3 — è un
 *       TRIPWIRE: dice «il catalogo non è cambiato da quando la tassonomia nuova è
 *       stata verificata». Davanti a una cancellazione irreversibile, uno scostamento
 *       inatteso merita un occhio umano prima della scrittura.
 *       ⚠️ FALSO POSITIVO PREVISTO: se Andrea corregge in Studio uno dei 4 codici
 *       flaggati (COL90.AST, COL90.AST.L, W12.AST, W12.AST.FS) spostandone la macro,
 *       questa guardia ABORTISCE pur essendo tutto in ordine. Non è un bug da
 *       aggirare disattivandola: si verifica che il cambiamento sia voluto e si
 *       aggiorna EXPECTED_MACRO_DIST con i numeri nuovi, in un commit che lo dica.
 *   U4  `sanity/schemas/documents/model.ts` non dichiara più `productType` → lo
 *       script si rifiuta di girare su un checkout in cui PR-B non c'è. Il dry-run
 *       gira sul BRANCH prima del merge (lì la guardia passa già), così il report
 *       è validato in anticipo e dopo il deploy resta solo la scrittura.
 *   U5  il perimetro è esattamente 595 model con productType definito
 *
 * DRY-RUN di default (read token). `--execute` scrive (write token).
 *   pnpm tsx scripts/unset-product-type.ts             # DRY-RUN
 *   pnpm tsx scripts/unset-product-type.ts --execute   # SCRIVE
 *
 * TRANSAZIONE SINGOLA, `visibility: "sync"`, come la migrazione: l'atomicità
 * rende impossibile lo stato misto. IDEMPOTENTE: patcha solo i documenti che hanno
 * ancora il campo, quindi una seconda esecuzione trova 0 modifiche.
 *
 * VERIFICA post-scrittura su query GROQ FRESCHE, non sul valore di ritorno della
 * transazione (che riflette ciò che ho chiesto, non ciò che c'è).
 *
 * ⚠️ DOPO l'esecuzione: Redeploy SENZA build cache. Nota onesta sul perché è
 * assicurazione e non correttezza, a differenza della migrazione: dopo PR-B nessuna
 * query proietta `productType`, quindi nessuna pagina in cache può contenerlo e non
 * esiste il dato stantio che quella regola serve a evitare.
 */
import { createClient, type SanityClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { MACRO_SUBTYPES, MACRO_VALUES } from "../sanity/schemas/documents/model-taxonomy";

loadEnv({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const SCHEMA_PATH = resolve(REPO_ROOT, "sanity/schemas/documents/model.ts");
const BACKUP_PATH = resolve(REPO_ROOT, "scripts/data/product-type-backup-2026-07-28.json");
const LOG_PATH = resolve(REPO_ROOT, "scripts/migration/unset-product-type-dryrun-log.json");

const EXECUTE = process.argv.includes("--execute");
const MODE = EXECUTE ? "EXECUTE (scrive)" : "DRY-RUN (sola lettura)";
const SETTLE_MS = 1500;

const EXPECTED_ROWS = 595;
/** Distribuzione verificata dopo la migrazione #61 — deve restare identica. */
const EXPECTED_MACRO_DIST: Record<string, number> = {
  doccia: 392,
  vasca: 86,
  lavabo: 76,
  giardino: 18,
  cucina: 17,
  bidet: 6,
};

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
/** La perspective published per definizione non vede i draft. */
const rawClient = client.withConfig({ perspective: "raw" });

interface LiveModel {
  _id: string;
  code: string | null;
  productType: string | null;
  productMacro: string | null;
  productSubtype: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const abort = (msg: string, detail?: unknown): never => {
  console.error(`\n✖ ABORT — ${msg}`);
  if (detail !== undefined) console.error(JSON.stringify(detail, null, 2));
  process.exit(1);
};

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n═══ unset-product-type — ${MODE} ═══`);
  console.log(`    dataset: ${projectId}/${dataset}\n`);

  // ─── U4: PR-B è nel checkout? ───────────────────────────────────────────────
  const schemaSrc = readFileSync(SCHEMA_PATH, "utf8");
  // Si cerca la DICHIARAZIONE del campo, non la parola: il docblock cita ancora
  // `productType` per spiegare perché i valori sopravvivono allo schema.
  if (/name:\s*["']productType["']/.test(schemaSrc)) {
    abort(
      `U4: ${SCHEMA_PATH.replace(REPO_ROOT + "/", "")} dichiara ancora il campo productType. Questo script va lanciato su un checkout in cui PR-B è applicata: cancellare i dati mentre lo schema li richiede lascerebbe 595 documenti invalidi in Studio.`,
    );
  }
  console.log(`✓ U4  lo schema non dichiara più productType (PR-B applicata)`);

  // ─── U1 / U2: forma del dataset ─────────────────────────────────────────────
  const [liveCount, draftCount] = await Promise.all([
    client.fetch<number>(`count(*[_type=="model"])`),
    rawClient.fetch<number>(`count(*[_type=="model" && _id in path("drafts.**")])`),
  ]);
  if (liveCount !== EXPECTED_ROWS)
    abort(`U1: il dataset ha ${liveCount} model, attesi ${EXPECTED_ROWS}.`);
  console.log(`✓ U1  dataset: ${liveCount} model`);
  if (draftCount !== 0)
    abort(
      `U2: ci sono ${draftCount} draft di model. Un draft renderebbe stantia la patch sul published: pubblicare o scartare prima di procedere.`,
    );
  console.log(`✓ U2  zero draft di model`);

  const live = await client.fetch<LiveModel[]>(
    `*[_type=="model"]| order(code asc){ _id, code, productType, productMacro, productSubtype }`,
  );

  // ─── U3: la tassonomia NUOVA è completa e valida ────────────────────────────
  const missingNew = live.filter((m) => !m.productMacro || !m.productSubtype);
  if (missingNew.length)
    abort(
      `U3: ${missingNew.length} model senza productMacro e/o productSubtype. Non si rimuove la rete vecchia finché la nuova non copre tutto.`,
      missingNew.slice(0, 20).map((m) => ({
        code: m.code,
        productMacro: m.productMacro,
        productSubtype: m.productSubtype,
      })),
    );
  const invalidPairs = live
    .filter((m) => !(MACRO_SUBTYPES[m.productMacro as string] ?? []).includes(m.productSubtype!))
    .map((m) => ({ code: m.code, macro: m.productMacro, subtype: m.productSubtype }));
  if (invalidPairs.length)
    abort(
      `U3: ${invalidPairs.length} coppie (macro, sottotipo) non ammesse da MACRO_SUBTYPES.`,
      invalidPairs.slice(0, 20),
    );
  console.log(
    `✓ U3  ${live.length}/${EXPECTED_ROWS} con la coppia nuova completa, 0 coppie non ammesse`,
  );

  const dist = live.reduce<Record<string, number>>(
    (a, m) => ((a[m.productMacro!] = (a[m.productMacro!] ?? 0) + 1), a),
    {},
  );
  let distOk = true;
  for (const k of Object.keys(EXPECTED_MACRO_DIST)) {
    if ((dist[k] ?? 0) !== EXPECTED_MACRO_DIST[k]) distOk = false;
  }
  console.log(
    `${distOk ? "✓" : "✗"} U3b distribuzione macro: ${MACRO_VALUES.map((m) => `${m}=${dist[m] ?? 0}`).join(" · ")}`,
  );
  if (!distOk)
    abort(`U3b: la distribuzione per macro è cambiata rispetto al post-migrazione #61.`, {
      atteso: EXPECTED_MACRO_DIST,
      trovato: dist,
    });

  // ─── U5: perimetro della scrittura ──────────────────────────────────────────
  const withLegacy = live.filter((m) => m.productType != null);
  console.log(`✓ U5  model con productType ancora presente: ${withLegacy.length}`);
  if (withLegacy.length !== EXPECTED_ROWS && withLegacy.length !== 0) {
    console.log(
      `  ⚠️  atteso ${EXPECTED_ROWS} (o 0 se già eseguito). Valore intermedio: procedere solo se spiegabile.`,
    );
  }

  // ─── report ─────────────────────────────────────────────────────────────────
  const byType = withLegacy.reduce<Record<string, number>>(
    (a, m) => ((a[m.productType!] = (a[m.productType!] ?? 0) + 1), a),
    {},
  );
  console.log(`\n── PIANO ──────────────────────────────────────────────`);
  console.log(`  unset productType su ${withLegacy.length} model, in UNA transazione`);
  console.log(`\n  valori che spariscono (per frequenza):`);
  for (const [t, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(4)}  ${t}`);
  }
  const mutations = withLegacy.map((m) => ({ patch: { id: m._id, unset: ["productType"] } }));
  const payloadKb = (JSON.stringify(mutations).length / 1024).toFixed(1);
  console.log(`\n  payload transazione: ~${payloadKb} kB`);

  // ─── BACKUP — il rollback di questa operazione ──────────────────────────────
  const backup = {
    generated: new Date().toISOString(),
    note: "Rollback di unset-product-type.ts. Questo unset NON e' auto-reversibile: questi sono gli unici valori productType superstiti.",
    schemaRemovedIn: "PR-B",
    rows: live
      .filter((m) => m.productType != null)
      .map((m) => ({ _id: m._id, code: m.code, productType: m.productType })),
  };
  writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2) + "\n");
  console.log(
    `  backup: ${BACKUP_PATH.replace(REPO_ROOT + "/", "")} (${backup.rows.length} righe)`,
  );

  writeFileSync(
    LOG_PATH,
    JSON.stringify(
      { mode: MODE, liveCount, draftCount, withLegacy: withLegacy.length, byType, dist, payloadKb },
      null,
      2,
    ) + "\n",
  );
  console.log(`  log:    ${LOG_PATH.replace(REPO_ROOT + "/", "")}`);

  if (!EXECUTE) {
    console.log(`\n═══ DRY-RUN: nessuna scrittura. Rilanciare con --execute per applicare. ═══\n`);
    return;
  }
  if (!withLegacy.length) {
    console.log(`\n═══ Niente da fare: nessun model ha più productType. ═══\n`);
    return;
  }

  // ─── execute ────────────────────────────────────────────────────────────────
  console.log(`\n── SCRITTURA (transazione singola, visibility:sync) ────`);
  const tx = client.transaction();
  for (const m of withLegacy) tx.patch(m._id, { unset: ["productType"] });
  await tx.commit({ visibility: "sync" });
  console.log(`  committate ${withLegacy.length} patch in UNA transazione`);
  await sleep(SETTLE_MS);

  // ─── verifica su query FRESCHE ──────────────────────────────────────────────
  console.log(`\n── VERIFICA (GROQ fresche, non il ritorno della transazione) ──`);
  const check = await client.fetch<{
    total: number;
    withLegacy: number;
    withMacro: number;
    withSubtype: number;
  }>(`{
    "total": count(*[_type=="model"]),
    "withLegacy": count(*[_type=="model" && defined(productType)]),
    "withMacro": count(*[_type=="model" && defined(productMacro)]),
    "withSubtype": count(*[_type=="model" && defined(productSubtype)])
  }`);
  const freshDist = await client.fetch<Record<string, number>>(
    `{${MACRO_VALUES.map((m) => `"${m}": count(*[_type=="model" && productMacro=="${m}"])`).join(",")}}`,
  );

  const fails: string[] = [];
  if (check.total !== EXPECTED_ROWS) fails.push(`model totali=${check.total}`);
  if (check.withLegacy !== 0) fails.push(`defined(productType)=${check.withLegacy}, atteso 0`);
  if (check.withMacro !== EXPECTED_ROWS)
    fails.push(`defined(productMacro)=${check.withMacro}, atteso ${EXPECTED_ROWS}`);
  if (check.withSubtype !== EXPECTED_ROWS)
    fails.push(`defined(productSubtype)=${check.withSubtype}, atteso ${EXPECTED_ROWS}`);
  for (const k of Object.keys(EXPECTED_MACRO_DIST)) {
    if (freshDist[k] !== EXPECTED_MACRO_DIST[k])
      fails.push(`${k}=${freshDist[k]}, atteso ${EXPECTED_MACRO_DIST[k]}`);
  }

  console.log(`  model totali:            ${check.total}`);
  console.log(`  con productType:         ${check.withLegacy}  (atteso 0)`);
  console.log(`  con productMacro:        ${check.withMacro}/${check.total}`);
  console.log(`  con productSubtype:      ${check.withSubtype}/${check.total}`);
  console.log(
    `  distribuzione viva:      ${MACRO_VALUES.map((m) => `${m}=${freshDist[m]}`).join(" · ")}`,
  );

  if (fails.length) abort(`verifica FALLITA dopo la scrittura:\n    - ${fails.join("\n    - ")}`);

  console.log(`\n✓ verifica superata su query fresche.`);
  console.log(`\n── ROLLBACK, se servisse ───────────────────────────────`);
  console.log(`  Questa operazione NON si annulla da sé: i valori non esistono più nel`);
  console.log(`  Content Lake. L'unica sorgente è il backup appena scritto,`);
  console.log(`  ${BACKUP_PATH.replace(REPO_ROOT + "/", "")}, che va committato con lo script.`);
  console.log(`  Ripristinare significherebbe anche rimettere il campo nello schema.`);
  console.log(`\n⚠️  Redeploy senza build cache: nota che qui è ASSICURAZIONE, non`);
  console.log(`   correttezza. Dopo PR-B nessuna query proietta productType, quindi`);
  console.log(`   nessuna pagina in cache può contenerlo e non esiste il dato stantio`);
  console.log(`   che quella regola serve a evitare (a differenza della migrazione #61).\n`);
}

main().catch((e) => {
  console.error("\n✖ errore non gestito:", e);
  process.exit(1);
});
