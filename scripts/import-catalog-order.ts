/**
 * import-catalog-order.ts — Block 3a: catalog reading order.
 *
 * Reads scripts/data/blocco3-ordine-data.json (`items`: 515 entries) and sets
 * model.catalogOrder = position on models matched by EXACT `code`. Every item is
 * imported identically, including the 3 print-anomaly corrections flagged
 * `insertedFrom: "proposedAdditions"` (P60, C50AS.YEWS.M/ME). Only `code` and
 * `position` are used; all other item fields (series/section/ambient/page/
 * listino/isPvdVariant/blockBase) are provenance and are never written.
 *
 * DRY-RUN by default (read token, prints plan + writes log). `--execute` writes.
 *
 *   pnpm tsx scripts/import-catalog-order.ts             # DRY-RUN
 *   pnpm tsx scripts/import-catalog-order.ts --execute   # WRITES
 *
 * Double-net (per import-alimentazioni.ts): count-before → mutate → count-after,
 * visibility:"sync" + settle, idempotent (patch sets a fixed integer; a fully
 * applied dataset with matching values is skipped). Fail-closed validation:
 * non-string/empty code, non-integer/non-positive position, duplicate code,
 * duplicate position. Codes absent from the dataset are reported as SKIPPED
 * (guard expects 0 — all 515 are pre-verified to exist). EXECUTE refuses to run
 * on any skip or on pre-existing catalogOrder outside the data set. Verify does a
 * FULL value match: every stored catalogOrder equals its data-file position.
 */
import { createClient, type SanityClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const DATA_PATH = resolve(REPO_ROOT, "scripts/data/blocco3-ordine-data.json");
const LOG_PATH = resolve(REPO_ROOT, "scripts/migration/catalog-order-dryrun-log.json");

const EXECUTE = process.argv.includes("--execute");
const MODE = EXECUTE ? "EXECUTE (writes)" : "DRY-RUN (read-only)";

const BATCH_SIZE = 50;
const PAUSE_MS = 400;
const SETTLE_MS = 1500;

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
interface OrderItem {
  code: string;
  position: number;
  // provenance only — never written to Sanity
  series?: string;
  section?: string;
  ambient?: string;
  page?: number;
  listino?: string;
  isPvdVariant?: boolean;
  blockBase?: string | null;
  insertedFrom?: string;
}
interface Blocco3Data {
  items: OrderItem[];
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

const countDefined = () =>
  client.fetch<number>(`count(*[_type=="model" && defined(catalogOrder)])`);
const countOutside = (codes: string[]) =>
  client.fetch<number>(`count(*[_type=="model" && defined(catalogOrder) && !(code in $codes)])`, {
    codes,
  });

async function commitInBatches(patches: Patch[]): Promise<void> {
  for (let i = 0; i < patches.length; i += BATCH_SIZE) {
    const batch = patches.slice(i, i + BATCH_SIZE);
    const tx = client.transaction();
    for (const p of batch) tx.patch(p.id, { set: { catalogOrder: p.position } });
    await tx.commit({ visibility: "sync" });
    console.log(`     · batch ${Math.floor(i / BATCH_SIZE) + 1}: committed ${batch.length}`);
    if (i + BATCH_SIZE < patches.length) await sleep(PAUSE_MS);
  }
}

// ─── plan ──────────────────────────────────────────────────────────────────────
interface Patch {
  code: string;
  id: string;
  position: number;
}
interface Plan {
  patches: Patch[];
  skipped: string[];
  codes: string[];
  itemsCount: number;
  definedBefore: number;
  unexpectedBefore: number;
  contiguityGaps: number[];
}

async function buildPlan(data: Blocco3Data): Promise<Plan> {
  assert(Array.isArray(data.items), "data.items must be an array");
  const items = data.items;
  assert(items.length > 0, "data.items is empty");
  console.log(`  items: ${items.length}`);

  // Fail-closed validation: code + position shape and uniqueness.
  const seenCode = new Set<string>();
  const seenPos = new Set<number>();
  for (const it of items) {
    assert(
      typeof it.code === "string" && it.code.length > 0,
      `item missing code: ${JSON.stringify(it)}`,
    );
    assert(
      Number.isInteger(it.position) && it.position > 0,
      `item ${it.code}: position must be a positive integer (got ${it.position})`,
    );
    if (seenCode.has(it.code)) abort(`duplicate code in data: ${it.code}`);
    if (seenPos.has(it.position)) abort(`duplicate position in data: ${it.position}`);
    seenCode.add(it.code);
    seenPos.add(it.position);
  }

  // Contiguity 1..N — informational (reported, not required for correctness).
  const contiguityGaps: number[] = [];
  for (let i = 1; i <= items.length; i++) if (!seenPos.has(i)) contiguityGaps.push(i);

  // Resolve codes → model _ids; SKIPPED = codes absent from the dataset.
  const codes = items.map((it) => it.code);
  const found = await client.fetch<{ _id: string; code: string }[]>(
    `*[_type=="model" && code in $codes]{ _id, code }`,
    { codes },
  );
  const codeToId = new Map<string, string>();
  for (const m of found) {
    if (codeToId.has(m.code)) abort(`duplicate model code in dataset: ${m.code}`);
    codeToId.set(m.code, m._id);
  }
  const skipped = codes.filter((c) => !codeToId.has(c));
  const patches: Patch[] = [];
  for (const it of items) {
    const id = codeToId.get(it.code);
    if (!id) continue;
    patches.push({ code: it.code, id, position: it.position });
  }

  const definedBefore = await countDefined();
  const unexpectedBefore = await countOutside(codes);

  return {
    patches,
    skipped,
    codes,
    itemsCount: items.length,
    definedBefore,
    unexpectedBefore,
    contiguityGaps,
  };
}

function printPlan(plan: Plan): void {
  const byPos = [...plan.patches].sort((a, b) => a.position - b.position);
  console.log("\n── Plan: set model.catalogOrder ──────────────────");
  console.log(`  → ${plan.patches.length} models to patch (of ${plan.itemsCount} items)`);
  if (plan.skipped.length) {
    console.log(`  ⚠ SKIPPED (code not found in dataset): ${plan.skipped.length}`);
    console.log(`    ${plan.skipped.join(", ")}`);
  } else {
    console.log("  skipped: 0");
  }
  console.log(
    `  contiguity 1..${plan.itemsCount}: ${
      plan.contiguityGaps.length
        ? "GAPS " + plan.contiguityGaps.slice(0, 20).join(",")
        : "OK (no gaps)"
    }`,
  );
  console.log("\n  diagnostics (ground truth in dataset):");
  console.log(`    catalogOrder already defined: ${plan.definedBefore} (expect 0 pre-apply)`);
  console.log(`    catalogOrder defined OUTSIDE data set: ${plan.unexpectedBefore} (must be 0)`);
  console.log("\n  sample (first 10 by position):");
  for (const p of byPos.slice(0, 10))
    console.log(`    #${String(p.position).padStart(3)}  ${p.code.padEnd(16)} (${p.id})`);
  console.log("  sample (last 5 by position):");
  for (const p of byPos.slice(-5))
    console.log(`    #${String(p.position).padStart(3)}  ${p.code.padEnd(16)} (${p.id})`);
}

async function verify(plan: Plan, data: Blocco3Data): Promise<void> {
  console.log("\n── Verify ────────────────────────────────────────");
  const after = await countDefined();
  const unexpectedAfter = await countOutside(plan.codes);

  // Full value-match: every stored catalogOrder equals its data-file position.
  const stored = await client.fetch<{ code: string; catalogOrder: number }[]>(
    `*[_type=="model" && defined(catalogOrder)]{ code, catalogOrder }`,
  );
  const expected = new Map(data.items.map((it) => [it.code, it.position]));
  const mismatches = stored.filter((m) => expected.get(m.code) !== m.catalogOrder);

  // Named spot-checks (data-driven expected values).
  const lastCode = data.items.find((i) => i.position === plan.itemsCount)?.code ?? "";
  const spotCodes = ["F50", "F60.D.M", "I30", lastCode];
  const spot = await client.fetch<{ code: string; catalogOrder: number }[]>(
    `*[_type=="model" && code in $codes]{ code, catalogOrder }`,
    { codes: spotCodes },
  );
  const spotMap = new Map(spot.map((s) => [s.code, s.catalogOrder]));

  const checks: Array<[string, boolean, string]> = [
    [
      `catalogOrder defined == ${plan.patches.length}`,
      after === plan.patches.length,
      String(after),
    ],
    ["no catalogOrder outside data set", unexpectedAfter === 0, String(unexpectedAfter)],
    [
      "all stored values match data positions",
      mismatches.length === 0,
      `${mismatches.length} mismatch`,
    ],
    ...spotCodes.map((c): [string, boolean, string] => {
      const exp = expected.get(c);
      const got = spotMap.get(c);
      return [`${c} == ${exp}`, got === exp, String(got)];
    }),
  ];
  for (const [label, ok, got] of checks) console.log(`  ${ok ? "✓" : "✗"} ${label}  (got ${got})`);
  if (!checks.every(([, ok]) => ok)) {
    if (mismatches.length) console.error("  first mismatches:", mismatches.slice(0, 10));
    abort("Verify failed");
  }
  console.log("\n  ✓ ALL CHECKS PASSED — catalog-order import complete.\n");
}

async function main(): Promise<void> {
  console.log(`\n═══ import-catalog-order — ${MODE} ═══\n`);
  console.log(`project=${projectId} dataset=${dataset} apiVersion=${apiVersion}\n`);

  const data = JSON.parse(readFileSync(DATA_PATH, "utf8")) as Blocco3Data;
  const plan = await buildPlan(data);
  printPlan(plan);

  writeFileSync(
    LOG_PATH,
    JSON.stringify(
      {
        mode: MODE,
        generatedFrom: DATA_PATH,
        itemsCount: plan.itemsCount,
        toPatch: plan.patches.length,
        skipped: plan.skipped,
        contiguityGaps: plan.contiguityGaps,
        diagnostics: {
          definedBefore: plan.definedBefore,
          unexpectedBefore: plan.unexpectedBefore,
        },
        patches: plan.patches,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`\n  log written → ${LOG_PATH}`);

  // Loud divergence signal vs the locked expectation (patched==515, skipped==0).
  if (plan.patches.length !== plan.itemsCount || plan.skipped.length !== 0) {
    console.log(
      `\n  ⚠ DIVERGENCE: expected patched=${plan.itemsCount} skipped=0, got patched=` +
        `${plan.patches.length} skipped=${plan.skipped.length}. STOP and review.`,
    );
  }
  if (plan.unexpectedBefore !== 0) {
    console.log(
      `\n  ⚠ ${plan.unexpectedBefore} models already carry catalogOrder OUTSIDE the data set. STOP and review.`,
    );
  }

  if (!EXECUTE) {
    console.log("\n  [dry-run] no writes performed. Re-run with --execute to apply.\n");
    return;
  }

  // ─── EXECUTE ─────────────────────────────────────────────────────────────────
  if (plan.skipped.length !== 0)
    abort(
      `refusing to execute: ${plan.skipped.length} codes not found (${plan.skipped.slice(0, 10).join(", ")})`,
    );
  if (plan.unexpectedBefore !== 0)
    abort(
      `refusing to execute: ${plan.unexpectedBefore} models carry catalogOrder outside the data set`,
    );

  console.log("\n── Apply: set catalogOrder ───────────────────────");
  let skipApply = false;
  if (plan.definedBefore === plan.patches.length) {
    const stored = await client.fetch<{ code: string; catalogOrder: number }[]>(
      `*[_type=="model" && defined(catalogOrder)]{ code, catalogOrder }`,
    );
    const expected = new Map(data.items.map((it) => [it.code, it.position]));
    skipApply =
      stored.length === plan.patches.length &&
      stored.every((m) => expected.get(m.code) === m.catalogOrder);
  }
  if (skipApply) {
    console.log(
      `  already fully applied with matching values (${plan.definedBefore}) — skipping apply`,
    );
  } else {
    await commitInBatches(plan.patches);
    await sleep(SETTLE_MS);
  }

  await verify(plan, data);
}

main().catch((err) => {
  console.error("\n✖ Unexpected error:", err);
  process.exit(1);
});
