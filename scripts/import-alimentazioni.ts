/**
 * import-alimentazioni.ts — Block 2b: freestanding alimentation types.
 *
 * Reads scripts/data/blocco2b-alimentazione-data.json and sets model.alimentationTypes
 * (array of enum: standard | standard-plus | cw | ew | 4s) on models matched by EXACT `code`:
 *   - apply[]             → its `alimentationTypes` array (written in canonical enum order)
 *   - skippedNoEvidence[] → NOT imported (Yacht well-code columns; drop lives on the well)
 *   - toVerifyOnListino[] → NOT imported (the 8 Flamingo `.D` PVD twins; a `.D` twin can carry a
 *                           DIFFERENT profile than its base — I40.D drops EW — so mirroring the base
 *                           is unsafe; they stay UNSET until verified on listino pages 12-13/22-23).
 *
 * DRY-RUN by default (read token, prints plan + writes log). `--execute` writes.
 *
 *   pnpm tsx scripts/import-alimentazioni.ts             # DRY-RUN
 *   pnpm tsx scripts/import-alimentazioni.ts --execute   # WRITES
 *
 * Double-net (per import-gocce.ts / migrate-remove-ambient.ts): visibility:"sync" + settle
 * delay + count-before → mutate → count-after guard + resume-by-state + abort-on-mismatch.
 * Idempotent (patch sets a fixed array). Fail-closed validation: dedup, code→types conflict,
 * enum-value check, and apply/skipped/toVerify disjointness. Skip-and-report codes not found.
 *
 * `cwBody` (CW.1/CW.2) in the data is INFORMATIVE ONLY — it is never written to Sanity and
 * never rendered (a future client-facing table may use it). `standard-plus` is in the enum but
 * never printed on any article in the listini, so it is expected to be absent from all data.
 */
import { createClient, type SanityClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const DATA_PATH = resolve(REPO_ROOT, "scripts/data/blocco2b-alimentazione-data.json");
const LOG_PATH = resolve(REPO_ROOT, "scripts/migration/alimentazioni-dryrun-log.json");

const EXECUTE = process.argv.includes("--execute");
const MODE = EXECUTE ? "EXECUTE (writes)" : "DRY-RUN (read-only)";

const BATCH_SIZE = 50;
const PAUSE_MS = 400;
const SETTLE_MS = 1500;

// Canonical write order = schema enum order (model.ts ALIMENTATION_TYPES). Every written
// array is filtered through this, so the stored order is stable regardless of source order.
const ALIM_ENUM_ORDER = ["standard", "standard-plus", "cw", "ew", "4s"] as const;
const ALIM_VALUES = new Set<string>(ALIM_ENUM_ORDER);

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01";
const token = EXECUTE ? process.env.SANITY_WRITE_TOKEN : process.env.SANITY_API_READ_TOKEN;

if (!projectId || !dataset || !token) {
  console.error(
    `✖ Missing Sanity env (NEXT_PUBLIC_SANITY_PROJECT_ID, _DATASET, or ${
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

// ─── data shapes ───────────────────────────────────────────────────────────────
interface ApplyItem {
  series: string;
  code: string;
  alimentationTypes: string[];
  cwBody: string | null;
  page: number;
}
interface Blocco2bData {
  _source?: string;
  apply: ApplyItem[];
  skippedNoEvidence: string[];
  toVerifyOnListino: string[];
}

// ─── helpers ───────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function abort(msg: string): never {
  console.error(`\n✖ ABORT: ${msg}`);
  console.error("  No mutation performed. Re-check the data before retrying.");
  process.exit(1);
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) abort(msg);
}
/** Canonicalize a type list to enum order, de-duplicated. */
function canonicalize(types: string[]): string[] {
  const present = new Set(types);
  return ALIM_ENUM_ORDER.filter((t) => present.has(t));
}

async function commitInBatches<T>(
  items: T[],
  apply: (tx: ReturnType<typeof client.transaction>, item: T) => void,
): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const tx = client.transaction();
    for (const it of batch) apply(tx, it);
    await tx.commit({ visibility: "sync" });
    console.log(`     · batch ${Math.floor(i / BATCH_SIZE) + 1}: committed ${batch.length}`);
    if (i + BATCH_SIZE < items.length) await sleep(PAUSE_MS);
  }
}

const countAlim = () =>
  client.fetch<number>(`count(*[_type=="model" && defined(alimentationTypes)])`);

// ─── plan ────────────────────────────────────────────────────────────────────
interface Patch {
  code: string;
  id: string;
  value: string[];
}
interface Plan {
  patches: Patch[];
  skipped: string[];
  applyCodes: string[];
  excludedCodes: string[];
  toVerifyCodes: string[];
  dist: Record<string, number>;
  // diagnostics (ground-truth existence in the dataset)
  toVerifyExisting: number;
  skippedExisting: number;
  definedBefore: number;
}

async function buildPlan(data: Blocco2bData): Promise<Plan> {
  const { apply, skippedNoEvidence, toVerifyOnListino } = data;
  assert(Array.isArray(apply), "apply must be an array");
  assert(Array.isArray(skippedNoEvidence), "skippedNoEvidence must be an array");
  assert(Array.isArray(toVerifyOnListino), "toVerifyOnListino must be an array");
  console.log(
    `  lists: apply=${apply.length} skippedNoEvidence=${skippedNoEvidence.length} (skip) ` +
      `toVerifyOnListino=${toVerifyOnListino.length} (skip)`,
  );

  // code → canonical types, with conflict detection.
  const targets = new Map<string, string[]>();
  const dist: Record<string, number> = {};
  for (const it of apply) {
    assert(it.code, "entry missing code");
    assert(
      Array.isArray(it.alimentationTypes) && it.alimentationTypes.length > 0,
      `entry ${it.code}: alimentationTypes must be a non-empty array`,
    );
    for (const t of it.alimentationTypes)
      assert(ALIM_VALUES.has(t), `entry ${it.code}: invalid alimentation value "${t}"`);
    const value = canonicalize(it.alimentationTypes);
    const prev = targets.get(it.code);
    if (prev !== undefined && JSON.stringify(prev) !== JSON.stringify(value))
      abort(`code ${it.code}: conflict "${prev.join(",")}" vs "${value.join(",")}"`);
    targets.set(it.code, value);
  }

  // Invariant: the import set must never overlap the excluded sets.
  const excludedCodes = [...skippedNoEvidence, ...toVerifyOnListino];
  const excluded = new Set(excludedCodes);
  const overlap = [...targets.keys()].filter((c) => excluded.has(c));
  if (overlap.length)
    abort(`apply codes overlap skippedNoEvidence/toVerifyOnListino: ${overlap.join(", ")}`);

  // Resolve targets → model _ids; report SKIPPED for codes absent in the dataset.
  const applyCodes = [...targets.keys()];
  const found = await client.fetch<{ _id: string; code: string }[]>(
    `*[_type=="model" && code in $codes]{ _id, code }`,
    { codes: applyCodes },
  );
  const codeToId = new Map<string, string>();
  for (const m of found) {
    if (codeToId.has(m.code)) abort(`duplicate model code in dataset: ${m.code}`);
    codeToId.set(m.code, m._id);
  }
  const skipped = applyCodes.filter((c) => !codeToId.has(c));
  const patches: Patch[] = [];
  for (const [code, value] of targets) {
    const id = codeToId.get(code);
    if (!id) continue;
    patches.push({ code, id, value });
    const sig = value.join("+");
    dist[sig] = (dist[sig] ?? 0) + 1;
  }

  // Diagnostics: how many excluded codes actually exist as models (must stay UNSET).
  const toVerifyExisting = await client.fetch<number>(
    `count(*[_type=="model" && code in $codes])`,
    { codes: toVerifyOnListino },
  );
  const skippedExisting = await client.fetch<number>(`count(*[_type=="model" && code in $codes])`, {
    codes: skippedNoEvidence,
  });
  const definedBefore = await countAlim();

  return {
    patches,
    skipped,
    applyCodes,
    excludedCodes,
    toVerifyCodes: toVerifyOnListino,
    dist,
    toVerifyExisting,
    skippedExisting,
    definedBefore,
  };
}

function printPlan(plan: Plan): void {
  console.log("\n── Plan: set model.alimentationTypes ─────────────");
  console.log("  distribution by type-set (to patch):");
  for (const sig of Object.keys(plan.dist).sort())
    console.log(`    ${sig.padEnd(24)} ${plan.dist[sig]}`);
  console.log(
    `  → ${plan.patches.length} models to patch (of ${plan.applyCodes.length} apply codes)`,
  );
  if (plan.skipped.length) {
    console.log(`  ⚠ SKIPPED (code not found in dataset): ${plan.skipped.length}`);
    console.log(`    ${plan.skipped.join(", ")}`);
  } else {
    console.log("  skipped: 0");
  }
  console.log(
    `  EXCLUDED (never patched): skippedNoEvidence=${plan.excludedCodes.length - plan.toVerifyCodes.length} ` +
      `toVerifyOnListino=${plan.toVerifyCodes.length}`,
  );
  console.log("\n  diagnostics (ground truth in dataset):");
  console.log(`    alimentationTypes already defined: ${plan.definedBefore} (expect 0 pre-apply)`);
  console.log(
    `    toVerifyOnListino codes existing as models: ${plan.toVerifyExisting}/${plan.toVerifyCodes.length} (must stay UNSET)`,
  );
  console.log(
    `    skippedNoEvidence codes existing as models: ${plan.skippedExisting}/${plan.excludedCodes.length - plan.toVerifyCodes.length}`,
  );
  // Sample so the dry-run is auditable without dumping 156 rows.
  console.log("\n  sample (first 12):");
  for (const p of plan.patches.slice(0, 12))
    console.log(`    ${p.code.padEnd(16)} (${p.id.padEnd(20)}) → [${p.value.join(", ")}]`);
}

async function main(): Promise<void> {
  console.log(`\n═══ import-alimentazioni — ${MODE} ═══\n`);
  console.log(`project=${projectId} dataset=${dataset} apiVersion=${apiVersion}\n`);

  const data = JSON.parse(readFileSync(DATA_PATH, "utf8")) as Blocco2bData;
  const plan = await buildPlan(data);
  printPlan(plan);

  writeFileSync(
    LOG_PATH,
    JSON.stringify(
      {
        mode: MODE,
        generatedFrom: DATA_PATH,
        distribution: plan.dist,
        toPatch: plan.patches.length,
        skipped: plan.skipped,
        excludedNeverPatched: {
          skippedNoEvidence: plan.excludedCodes.length - plan.toVerifyCodes.length,
          toVerifyOnListino: plan.toVerifyCodes.length,
        },
        diagnostics: {
          definedBefore: plan.definedBefore,
          toVerifyExisting: plan.toVerifyExisting,
          skippedExisting: plan.skippedExisting,
        },
        patches: plan.patches,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`\n  log written → ${LOG_PATH}`);

  if (!EXECUTE) {
    console.log("\n  [dry-run] no writes performed. Re-run with --execute to apply.\n");
    return;
  }

  // ─── EXECUTE ─────────────────────────────────────────────────────────────────
  console.log("\n── Apply: set alimentationTypes ──────────────────");
  const applyCodes = plan.applyCodes;
  const excludedCodes = plan.excludedCodes;
  const before = await countAlim();
  const unexpectedBefore = await client.fetch<number>(
    `count(*[_type=="model" && defined(alimentationTypes) && !(code in $codes)])`,
    { codes: applyCodes },
  );
  if (unexpectedBefore !== 0)
    abort(`${unexpectedBefore} models carry alimentationTypes OUTSIDE the apply set`);

  if (before === plan.patches.length) {
    console.log(`  already set (${before}) — skipping apply`);
  } else {
    await commitInBatches(plan.patches, (tx, p) =>
      tx.patch(p.id, { set: { alimentationTypes: p.value } }),
    );
    await sleep(SETTLE_MS);
  }

  // ─── Verify (double-net) ──────────────────────────────────────────────────────
  console.log("\n── Verify ────────────────────────────────────────");
  const after = await countAlim();
  const unexpectedAfter = await client.fetch<number>(
    `count(*[_type=="model" && defined(alimentationTypes) && !(code in $codes)])`,
    { codes: applyCodes },
  );
  const excludedPatched = await client.fetch<number>(
    `count(*[_type=="model" && defined(alimentationTypes) && code in $codes])`,
    { codes: excludedCodes },
  );
  const toVerifyPatched = await client.fetch<number>(
    `count(*[_type=="model" && defined(alimentationTypes) && code in $codes])`,
    { codes: plan.toVerifyCodes },
  );
  const checks: Array<[string, boolean, number]> = [
    [`alimentationTypes defined == ${plan.patches.length}`, after === plan.patches.length, after],
    ["no alimentationTypes outside apply set", unexpectedAfter === 0, unexpectedAfter],
    ["skipped/toVerify models patched == 0", excludedPatched === 0, excludedPatched],
    ["toVerifyOnListino (8 .D) remain UNSET", toVerifyPatched === 0, toVerifyPatched],
  ];
  for (const [label, ok, got] of checks) console.log(`  ${ok ? "✓" : "✗"} ${label}  (got ${got})`);
  if (!checks.every(([, ok]) => ok)) abort("Verify failed");
  console.log("\n  ✓ ALL CHECKS PASSED — alimentation import complete.\n");
}

main().catch((err) => {
  console.error("\n✖ Unexpected error:", err);
  process.exit(1);
});
