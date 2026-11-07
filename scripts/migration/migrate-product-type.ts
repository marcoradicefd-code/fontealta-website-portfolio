/**
 * productType migration — DRY-RUN by default, `--apply` to write.
 *
 * Re-tags `model.productType` from a mapping CSV. Two independent sources:
 *
 *   SECTION 1 (per exact code): Map<code → productType_NUOVO> built from the CSV
 *     rows. Matched with strict EQUALITY on `code` (never prefix/startsWith/regex
 *     — "MR" must not catch "MR2"/"MRL", "W2MB" must not catch "W2MBP").
 *
 *   SECTION 2 (per collection): every model that `references()` the "Accessories"
 *     collection → `doccia-accessori`. Resolved via the collection _id, NOT via
 *     `productType=="accessory"` (that would also sweep D50.x / D3 handled in S1).
 *
 * Precedence: if a model matches BOTH sections it is a CONFLICT — reported, and
 * Section 1 (the explicit code) wins in the projection. They are expected to be
 * disjoint; any overlap is surfaced loudly.
 *
 * Idempotent: `.set({productType})` to the target is a no-op once applied.
 *
 * Usage:
 *   pnpm tsx scripts/migration/migrate-product-type.ts --csv="/path/to/mapping.csv"
 *   pnpm tsx scripts/migration/migrate-product-type.ts --csv="..." --apply   # WRITES
 *
 * DRY-RUN reads with SANITY_API_READ_TOKEN and writes only the local log
 * scripts/migration/dryrun-log.json (full per-record before-state, for
 * reversibility). `--apply` switches to SANITY_WRITE_TOKEN and patches Sanity.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

// ─── args ────────────────────────────────────────────────────────────────────
const APPLY = process.argv.includes("--apply");
const csvArg = process.argv.find((a) => a.startsWith("--csv="));
const CSV_PATH = csvArg ? csvArg.slice("--csv=".length) : process.env.MAPPING_CSV;
const LOG_PATH = "scripts/migration/dryrun-log.json";

const ACCESSORIES_COLLECTION_TITLE = "Accessories";

// Canonical enum order (schema PRODUCT_TYPES, 14 values) — display ordering only.
const ENUM_ORDER = [
  "lavabo-miscelatore",
  "lavabo-batteria",
  "lavabo-incasso",
  "lavabo-colonna",
  "vasca-bordo",
  "vasca-colonna",
  "doccia-colonna",
  "doccia-pannello",
  "doccia-soffione",
  "doccia-miscelatore",
  "doccia-accessori",
  "kit-doccia",
  "controllo-termostatico",
  "accessory",
] as const;
const ENUM_SET = new Set<string>(ENUM_ORDER);

if (!CSV_PATH) {
  console.error('✖ Missing CSV path. Pass --csv="/abs/path/mapping.csv" (or MAPPING_CSV env).');
  process.exit(1);
}

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01";
// DRY-RUN → read-only token. --apply → write token. Never the write token in dry-run.
const token = APPLY ? process.env.SANITY_WRITE_TOKEN : process.env.SANITY_API_READ_TOKEN;

if (!projectId || !dataset || !token) {
  console.error(
    `✖ Missing Sanity env (NEXT_PUBLIC_SANITY_PROJECT_ID, _DATASET, or ${
      APPLY ? "SANITY_WRITE_TOKEN" : "SANITY_API_READ_TOKEN"
    }).`,
  );
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

// ─── RFC4180 CSV parser (handles quoted fields, embedded commas, "" escapes) ───
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // ignore CR (CRLF handled by the LF branch)
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ─── types ─────────────────────────────────────────────────────────────────────
type CollRef = { _id: string | null; title: string | null } | null;
type ModelDoc = {
  _id: string;
  code: string | null;
  productType: string | null;
  cols: CollRef[] | null;
};
type Section1Entry = { newType: string; csvCurrent: string; collezione: string };
type Change = {
  _id: string;
  code: string | null;
  collections: string[];
  productTypeOld: string | null;
  productTypeNew: string;
  rule: "S1" | "S2";
};

function tally(values: (string | null)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) {
    const k = v ?? "(null)";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

async function main() {
  console.log("─".repeat(78));
  console.log(`productType migration — ${APPLY ? "🔴 APPLY (WRITES)" : "DRY-RUN (read-only)"}`);
  console.log(`CSV:     ${CSV_PATH}`);
  console.log(`Sanity:  ${projectId}/${dataset}  perspective=published`);
  console.log("─".repeat(78));

  // ── parse CSV → Section 1 map ────────────────────────────────────────────────
  // Colonne lette per NOME dall'header (non per indice fisso): robusto a colonne
  // extra/mancanti/riordinate. Strip BOM (alcuni export salvano UTF-8 con BOM).
  let raw = readFileSync(CSV_PATH as string, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const rows = parseCsv(raw);
  if (rows.length === 0) {
    console.error("✖ CSV vuoto.");
    process.exit(1);
  }
  const header = rows[0].map((h) => h.trim());
  const idxCode = header.indexOf("code");
  const idxNuovo = header.indexOf("productType_NUOVO");
  const idxAttuale = header.indexOf("productType_ATTUALE"); // opzionale (solo warning drift)
  const idxCollezione = header.indexOf("collezione"); // opzionale (solo display)
  const missingCols = (["code", "productType_NUOVO"] as const).filter(
    (n) => header.indexOf(n) === -1,
  );
  if (missingCols.length > 0) {
    console.error(
      `✖ Colonne header obbligatorie mancanti nel CSV: ${missingCols.join(", ")}. ` +
        `Header trovato: [${header.join(", ")}]`,
    );
    process.exit(1);
  }

  const section1Map = new Map<string, Section1Entry>();
  const duplicateCsvCodes: string[] = [];
  const invalidTargetTypes: { code: string; target: string }[] = [];

  // rows[0] = header. Valid S1 row: `code` non-empty, not a comment ("#"), not the
  // "(52 model)" Section-2 pseudo-row, and `productType_NUOVO` present.
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const code = (cols[idxCode] ?? "").trim();
    if (!code || code.startsWith("#") || code === "(52 model)") continue;
    const csvCurrent = idxAttuale >= 0 ? (cols[idxAttuale] ?? "").trim() : "";
    const newType = (cols[idxNuovo] ?? "").trim();
    const collezione = idxCollezione >= 0 ? (cols[idxCollezione] ?? "").trim() : "";
    if (!newType) continue;
    if (!ENUM_SET.has(newType)) invalidTargetTypes.push({ code, target: newType });
    if (section1Map.has(code)) duplicateCsvCodes.push(code);
    section1Map.set(code, { newType, csvCurrent, collezione });
  }

  // ── fetch Sanity state (one round-trip) ──────────────────────────────────────
  const accessoriesId: string | null = await client.fetch(
    `*[_type=="collection" && title==$t][0]._id`,
    { t: ACCESSORIES_COLLECTION_TITLE },
  );
  const models: ModelDoc[] = await client.fetch(
    `*[_type=="model"]{ _id, code, productType, "cols": collections[]->{_id, title} }`,
  );

  if (!accessoriesId) {
    console.error(`✖ Accessories collection ("${ACCESSORIES_COLLECTION_TITLE}") not found.`);
    process.exit(1);
  }

  // ── index Sanity by code; detect duplicates & missing CSV codes ──────────────
  const byCode = new Map<string, ModelDoc[]>();
  for (const m of models) {
    if (!m.code) continue;
    const arr = byCode.get(m.code) ?? [];
    arr.push(m);
    byCode.set(m.code, arr);
  }
  const duplicateSanityCodes = [...byCode.entries()]
    .filter(([, a]) => a.length > 1)
    .map(([code, a]) => ({ code, count: a.length }));
  const missingCsvCodes = [...section1Map.keys()].filter((c) => !byCode.has(c)).sort();

  // ── compute changes (S1 precedence over S2 on overlap) ───────────────────────
  const changes: Change[] = [];
  const overlap: { code: string | null; current: string | null; s1Target: string }[] = [];
  const attualeMismatches: {
    code: string | null;
    csvAttuale: string;
    sanityCurrent: string | null;
  }[] = [];
  let section1Matched = 0;
  let section1Noop = 0;
  let section2Matched = 0;
  let section2Noop = 0;

  for (const m of models) {
    const inS1 = m.code != null && section1Map.has(m.code);
    const inS2 = (m.cols ?? []).some((c) => c?._id === accessoriesId);
    if (!inS1 && !inS2) continue;

    if (inS1) section1Matched++;
    if (inS2) section2Matched++;
    if (inS1 && inS2) {
      overlap.push({
        code: m.code,
        current: m.productType,
        s1Target: section1Map.get(m.code as string)!.newType,
      });
    }

    let target: string;
    let rule: "S1" | "S2";
    if (inS1) {
      const e = section1Map.get(m.code as string)!;
      target = e.newType;
      rule = "S1";
      if (e.csvCurrent && e.csvCurrent !== m.productType) {
        attualeMismatches.push({
          code: m.code,
          csvAttuale: e.csvCurrent,
          sanityCurrent: m.productType,
        });
      }
    } else {
      target = "doccia-accessori";
      rule = "S2";
    }

    if (target === m.productType) {
      if (rule === "S1") section1Noop++;
      else section2Noop++;
      continue;
    }
    changes.push({
      _id: m._id,
      code: m.code,
      collections: (m.cols ?? []).map((c) => c?.title).filter((t): t is string => Boolean(t)),
      productTypeOld: m.productType,
      productTypeNew: target,
      rule,
    });
  }

  // ── before / after projection ────────────────────────────────────────────────
  const countsBefore = tally(models.map((m) => m.productType));
  const finalType = new Map<string, string | null>(models.map((m) => [m._id, m.productType]));
  for (const ch of changes) finalType.set(ch._id, ch.productTypeNew);
  const countsAfter = tally(models.map((m) => finalType.get(m._id) ?? null));

  const residualTermostatico = models
    .filter((m) => finalType.get(m._id) === "controllo-termostatico")
    .map((m) => m.code);
  const residualAccessory = models
    .filter((m) => finalType.get(m._id) === "accessory")
    .map((m) => m.code);

  // ── console report ───────────────────────────────────────────────────────────
  const s1Changes = changes.filter((c) => c.rule === "S1");
  const s2Changes = changes.filter((c) => c.rule === "S2");

  const printChange = (c: Change) =>
    console.log(
      `  ${(c.code ?? "(no code)").padEnd(12)} | ${c.collections.join("; ").padEnd(40)} | ${
        c.productTypeOld ?? "(null)"
      } → ${c.productTypeNew}`,
    );

  console.log(
    `\n━━ SECTION 1 (per code esatto) — matched ${section1Matched}, changes ${s1Changes.length}, no-op ${section1Noop}`,
  );
  s1Changes.forEach(printChange);

  console.log(
    `\n━━ SECTION 2 (collezione "${ACCESSORIES_COLLECTION_TITLE}", _id ${accessoriesId}) — matched ${section2Matched}, changes ${s2Changes.length}, no-op ${section2Noop}`,
  );
  s2Changes.forEach(printChange);

  console.log(`\n━━ COUNTS productType — BEFORE → AFTER`);
  const allKeys = [...ENUM_ORDER, ...Object.keys(countsBefore), ...Object.keys(countsAfter)].filter(
    (k, i, a) => a.indexOf(k) === i,
  );
  for (const k of allKeys) {
    const b = countsBefore[k] ?? 0;
    const a = countsAfter[k] ?? 0;
    const delta = a - b;
    const flag = delta === 0 ? "" : delta > 0 ? `  (+${delta})` : `  (${delta})`;
    console.log(`  ${k.padEnd(24)} ${String(b).padStart(4)} → ${String(a).padStart(4)}${flag}`);
  }
  const totalBefore = Object.values(countsBefore).reduce((s, n) => s + n, 0);
  const totalAfter = Object.values(countsAfter).reduce((s, n) => s + n, 0);
  console.log(
    `  ${"TOTAL".padEnd(24)} ${String(totalBefore).padStart(4)} → ${String(totalAfter).padStart(4)}`,
  );

  console.log(`\n━━ VERIFICHE`);
  const okTermo = (countsAfter["controllo-termostatico"] ?? 0) === 0;
  const okAcc = (countsAfter["accessory"] ?? 0) === 0;
  const okTotal = totalBefore === totalAfter && totalAfter === 591;
  console.log(
    `  controllo-termostatico → 0 : ${okTermo ? "✅" : `❌ resta ${countsAfter["controllo-termostatico"] ?? 0}`}`,
  );
  if (!okTermo) console.log(`     residui: ${residualTermostatico.join(", ")}`);
  console.log(
    `  accessory → 0              : ${okAcc ? "✅" : `❌ resta ${countsAfter["accessory"] ?? 0}`}`,
  );
  if (!okAcc) console.log(`     residui: ${residualAccessory.join(", ")}`);
  console.log(
    `  totale invariato = 591     : ${okTotal ? "✅" : `❌ ${totalBefore} → ${totalAfter}`}`,
  );

  console.log(`\n━━ WARNINGS`);
  console.log(
    `  CSV codes mancanti in Sanity : ${missingCsvCodes.length}${missingCsvCodes.length ? " → " + missingCsvCodes.join(", ") : ""}`,
  );
  console.log(
    `  overlap Sez.1 ∩ Sez.2        : ${overlap.length}${overlap.length ? " → " + overlap.map((o) => o.code).join(", ") : " (disgiunte ✅)"}`,
  );
  console.log(
    `  code duplicati nel CSV       : ${duplicateCsvCodes.length}${duplicateCsvCodes.length ? " → " + duplicateCsvCodes.join(", ") : ""}`,
  );
  console.log(
    `  code duplicati in Sanity     : ${duplicateSanityCodes.length}${duplicateSanityCodes.length ? " → " + duplicateSanityCodes.map((d) => `${d.code}×${d.count}`).join(", ") : ""}`,
  );
  console.log(
    `  target type fuori enum       : ${invalidTargetTypes.length}${invalidTargetTypes.length ? " → " + invalidTargetTypes.map((t) => `${t.code}:${t.target}`).join(", ") : ""}`,
  );
  console.log(
    `  ATTUALE(CSV) ≠ current(Sanity): ${attualeMismatches.length}${attualeMismatches.length ? " → " + attualeMismatches.map((a) => `${a.code}[csv:${a.csvAttuale} vs sanity:${a.sanityCurrent}]`).join("; ") : ""}`,
  );

  // ── write reversibility log ──────────────────────────────────────────────────
  const log = {
    meta: {
      generatedAt: new Date().toISOString(),
      mode: APPLY ? "apply" : "dry-run",
      csvPath: CSV_PATH,
      projectId,
      dataset,
      accessoriesCollectionId: accessoriesId,
      totals: {
        models: models.length,
        section1Matched,
        section1Changes: s1Changes.length,
        section1Noop,
        section2Matched,
        section2Changes: s2Changes.length,
        totalChanges: changes.length,
      },
    },
    changes,
    warnings: {
      missingCsvCodes,
      section1Section2Overlap: overlap,
      duplicateCsvCodes,
      duplicateSanityCodes,
      invalidTargetTypes,
      attualeMismatches,
      residualAfter: {
        "controllo-termostatico": residualTermostatico,
        accessory: residualAccessory,
      },
    },
    countsBefore,
    countsAfter,
  };
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  writeFileSync(LOG_PATH, JSON.stringify(log, null, 2) + "\n", "utf8");
  console.log(
    `\n📄 Log scritto: ${LOG_PATH}  (${changes.length} record, before-state per reversibilità)`,
  );

  // ── apply (gated; NOT run in this step) ──────────────────────────────────────
  if (!APPLY) {
    console.log(
      `\nDRY-RUN — nessuna scrittura su Sanity. Per applicare: aggiungi --apply (usa SANITY_WRITE_TOKEN).`,
    );
    return;
  }

  const blocking =
    missingCsvCodes.length ||
    overlap.length ||
    invalidTargetTypes.length ||
    duplicateSanityCodes.length;
  if (blocking) {
    console.error(
      `\n✖ APPLY rifiutato: warning bloccanti irrisolti (missing/overlap/invalid/duplicate). Correggi il mapping.`,
    );
    process.exit(1);
  }
  const CHUNK = 50;
  for (let i = 0; i < changes.length; i += CHUNK) {
    const slice = changes.slice(i, i + CHUNK);
    let tx = client.transaction();
    for (const ch of slice) tx = tx.patch(ch._id, (p) => p.set({ productType: ch.productTypeNew }));
    await tx.commit();
    console.log(`  applied ${Math.min(i + CHUNK, changes.length)}/${changes.length}`);
  }
  console.log(`✔ APPLY completo — ${changes.length} record aggiornati.`);
}

main().catch((e) => {
  console.error("MIGRATION_FAILED", e);
  process.exit(1);
});
