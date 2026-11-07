/**
 * import-gocce.ts — Block 2: water-supply (hot/cold drop) markers.
 *
 * Reads scripts/data/blocco2-gocce-data.json and sets model.waterSupply on models
 * matched by EXACT `code`:
 *   - confirmed[]     → its `water` value ("cold" | "hot-cold")
 *   - noneConfirmed[] → "none"
 *   - pendingAndrea[] → NOT imported (drops missing in the catalogue, awaiting Andrea)
 *   - notInCatalog[]  → NOT imported (article absent from the catalogue)
 *
 * DRY-RUN by default (read token, prints plan + writes log). `--execute` writes.
 *
 *   pnpm tsx scripts/import-gocce.ts             # DRY-RUN
 *   pnpm tsx scripts/import-gocce.ts --execute   # WRITES
 *
 * Double-net (per migrate-remove-ambient.ts): visibility:"sync" + settle delay +
 * count-before → mutate → count-after guard + resume-by-state + abort-on-mismatch.
 * Idempotent (patch sets a fixed value). Fail-closed validation: dedup, code→value
 * conflict, enum-value check, and target/pendingAndrea/notInCatalog disjointness.
 * Skip-and-report codes not found in the dataset.
 *
 * NO SECOND PASS PLANNED (client rule "the catalogue is the Bible", lug 2026): the
 * pendingAndrea (52) + notInCatalog (6) articles stay waterSupply UNSET permanently —
 * no drop in the catalogue → no drop on the site (covers the 28 Yacht columns whose drop
 * lives on the shared well, not the article; YCWS/YEWS are well codes, artifacts, never
 * matched). ACTIVATION if the client ever reverses: set waterSupply in Studio (single) or
 * move the now-confirmed entries into confirmed[] here and re-run (idempotent) — no
 * schema/UI work needed either way.
 */
import { createClient, type SanityClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const DATA_PATH = resolve(REPO_ROOT, "scripts/data/blocco2-gocce-data.json");
const LOG_PATH = resolve(REPO_ROOT, "scripts/migration/gocce-dryrun-log.json");

const EXECUTE = process.argv.includes("--execute");
const MODE = EXECUTE ? "EXECUTE (writes)" : "DRY-RUN (read-only)";

const BATCH_SIZE = 50;
const PAUSE_MS = 400;
const SETTLE_MS = 1500;
const WATER_VALUES = new Set(["cold", "hot-cold", "none"]);

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
interface GocceItem {
  series: string;
  code: string;
  water: string;
}
interface PendingItem {
  series: string;
  code: string;
  expected: string;
}
interface NotInCatalogItem {
  series: string;
  code: string;
  stato: string;
}
interface Blocco2Data {
  confirmed: GocceItem[];
  noneConfirmed: GocceItem[];
  pendingAndrea: PendingItem[];
  notInCatalog: NotInCatalogItem[];
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

const countWaterSupply = () =>
  client.fetch<number>(`count(*[_type=="model" && defined(waterSupply)])`);

// ─── plan ────────────────────────────────────────────────────────────────────
interface Patch {
  code: string;
  id: string;
  value: string;
}
interface Plan {
  patches: Patch[];
  skipped: string[];
  allTargetCodes: string[];
  pendingCodes: string[];
  dist: Record<string, number>;
}

async function buildPlan(data: Blocco2Data): Promise<Plan> {
  const { confirmed, noneConfirmed, pendingAndrea, notInCatalog } = data;
  assert(
    Array.isArray(confirmed) && Array.isArray(noneConfirmed),
    "confirmed/noneConfirmed must be arrays",
  );
  assert(
    Array.isArray(pendingAndrea) && Array.isArray(notInCatalog),
    "pendingAndrea/notInCatalog must be arrays",
  );
  console.log(
    `  lists: confirmed=${confirmed.length} noneConfirmed=${noneConfirmed.length} ` +
      `pendingAndrea=${pendingAndrea.length} (skip) notInCatalog=${notInCatalog.length} (skip)`,
  );

  // code → value, with conflict detection.
  const targets = new Map<string, string>();
  const add = (code: string, value: string) => {
    assert(code, "entry missing code");
    assert(WATER_VALUES.has(value), `entry ${code}: invalid water value "${value}"`);
    const prev = targets.get(code);
    if (prev !== undefined && prev !== value)
      abort(`code ${code}: conflict "${prev}" vs "${value}"`);
    targets.set(code, value);
  };
  for (const it of confirmed) {
    assert(
      it.water === "cold" || it.water === "hot-cold",
      `confirmed ${it.code}: water="${it.water}" (want cold/hot-cold)`,
    );
    add(it.code, it.water);
  }
  for (const it of noneConfirmed) {
    assert(it.water === "none", `noneConfirmed ${it.code}: water="${it.water}" (want none)`);
    add(it.code, it.water);
  }

  const pendingCodes = pendingAndrea.map((p) => p.code);
  const notInCatCodes = notInCatalog.map((p) => p.code);
  // Invariant: the import set must never overlap the excluded sets.
  const excluded = new Set<string>([...pendingCodes, ...notInCatCodes]);
  const overlap = [...targets.keys()].filter((c) => excluded.has(c));
  if (overlap.length)
    abort(`target codes overlap pendingAndrea/notInCatalog: ${overlap.join(", ")}`);

  // Resolve targets → model _ids; report SKIPPED for codes absent in the dataset.
  const allTargetCodes = [...targets.keys()];
  const found = await client.fetch<{ _id: string; code: string }[]>(
    `*[_type=="model" && code in $codes]{ _id, code }`,
    { codes: allTargetCodes },
  );
  const codeToId = new Map<string, string>();
  for (const m of found) {
    if (codeToId.has(m.code)) abort(`duplicate model code in dataset: ${m.code}`);
    codeToId.set(m.code, m._id);
  }
  const skipped = allTargetCodes.filter((c) => !codeToId.has(c));
  const patches: Patch[] = [];
  const dist: Record<string, number> = { cold: 0, "hot-cold": 0, none: 0 };
  for (const [code, value] of targets) {
    const id = codeToId.get(code);
    if (!id) continue;
    patches.push({ code, id, value });
    dist[value] = (dist[value] ?? 0) + 1;
  }

  return { patches, skipped, allTargetCodes, pendingCodes, dist };
}

function printPlan(plan: Plan): void {
  console.log("\n── Plan: set model.waterSupply ───────────────────");
  console.log(
    `  value distribution (to patch): cold=${plan.dist.cold} hot-cold=${plan.dist["hot-cold"]} none=${plan.dist.none}`,
  );
  console.log(
    `  → ${plan.patches.length} models to patch (of ${plan.allTargetCodes.length} target codes)`,
  );
  if (plan.skipped.length) {
    console.log(`  ⚠ SKIPPED (code not found in dataset): ${plan.skipped.length}`);
    console.log(`    ${plan.skipped.join(", ")}`);
  } else {
    console.log("  skipped: 0");
  }
  console.log(`  pendingAndrea EXCLUDED: ${plan.pendingCodes.length} (never patched)`);
  // Sample so the dry-run is auditable without dumping 300 rows.
  console.log("  sample (first 12):");
  for (const p of plan.patches.slice(0, 12))
    console.log(`    ${p.code.padEnd(14)} (${p.id.padEnd(16)}) → ${p.value}`);
}

async function main(): Promise<void> {
  console.log(`\n═══ import-gocce — ${MODE} ═══\n`);
  console.log(`project=${projectId} dataset=${dataset} apiVersion=${apiVersion}\n`);

  const data = JSON.parse(readFileSync(DATA_PATH, "utf8")) as Blocco2Data;
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
        pendingExcluded: plan.pendingCodes.length,
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
  console.log("\n── Apply: set waterSupply ────────────────────────");
  const targetSet = plan.allTargetCodes;
  const pendingSet = plan.pendingCodes;
  const before = await countWaterSupply();
  const unexpectedBefore = await client.fetch<number>(
    `count(*[_type=="model" && defined(waterSupply) && !(code in $codes)])`,
    { codes: targetSet },
  );
  if (unexpectedBefore !== 0)
    abort(`${unexpectedBefore} models carry waterSupply OUTSIDE the target set`);

  if (before === plan.patches.length) {
    console.log(`  already set (${before}) — skipping apply`);
  } else {
    await commitInBatches(plan.patches, (tx, p) =>
      tx.patch(p.id, { set: { waterSupply: p.value } }),
    );
    await sleep(SETTLE_MS);
  }

  // ─── Verify (double-net) ──────────────────────────────────────────────────────
  console.log("\n── Verify ────────────────────────────────────────");
  const after = await countWaterSupply();
  const unexpectedAfter = await client.fetch<number>(
    `count(*[_type=="model" && defined(waterSupply) && !(code in $codes)])`,
    { codes: targetSet },
  );
  const pendingPatched = await client.fetch<number>(
    `count(*[_type=="model" && defined(waterSupply) && code in $codes])`,
    { codes: pendingSet },
  );
  const checks: Array<[string, boolean, number]> = [
    [`waterSupply defined == ${plan.patches.length}`, after === plan.patches.length, after],
    ["no waterSupply outside target set", unexpectedAfter === 0, unexpectedAfter],
    ["pendingAndrea models patched == 0", pendingPatched === 0, pendingPatched],
  ];
  for (const [label, ok, got] of checks) console.log(`  ${ok ? "✓" : "✗"} ${label}  (got ${got})`);
  if (!checks.every(([, ok]) => ok)) abort("Verify failed");
  console.log("\n  ✓ ALL CHECKS PASSED — gocce import complete.\n");
}

main().catch((err) => {
  console.error("\n✖ Unexpected error:", err);
  process.exit(1);
});
