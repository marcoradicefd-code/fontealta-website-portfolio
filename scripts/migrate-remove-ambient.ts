/**
 * migrate-remove-ambient.ts — one-shot teardown of the legacy ambient DATA.
 *
 * The ambient CODE is already removed and deployed (e96f83c): schema without the
 * `collection.ambient[]` / `model.ambient` fields, zero projections, zero tags.
 * This clears the orphaned DATA, in the obligatory order (refs before docs, or
 * Sanity blocks the delete).
 *
 * DRY-RUN by default (read token, prints only). `--execute` writes (write token).
 *
 *   pnpm tsx scripts/migrate-remove-ambient.ts             # DRY-RUN, no mutations
 *   pnpm tsx scripts/migrate-remove-ambient.ts --execute   # WRITES
 *
 * Phases (sequential, verified between each — ABORT on any count mismatch):
 *   A. unset(["ambient"]) on *[_type=="collection" && defined(ambient)]  (expect 21)
 *   B. unset(["ambient"]) on *[_type=="model"      && defined(ambient)]  (expect 591)
 *   C. delete the 4 ambient docs — ONLY after A+B, when collection refs == 0.
 *
 * Batching: transactions of ≤50 mutations, small pause between batches (rate limit).
 * Final self-check: ambientDocs==0, refs==0, model.ambient defined==0,
 * model.productType defined==591 (live-taxonomy non-regression).
 *
 * Idempotent: commits use visibility:"sync" + a settle delay (read-immediately-
 * after-write on the Content Lake is a classic race — the async commit returns
 * before the index is queryable, so a guard that re-reads sees the past), and each
 * phase is skipped when its "before" count is already 0. Safe to re-run: it only
 * does the missing work. (Applied 10 lug 2026: A committed then a false-negative
 * async re-read aborted before B/C; the sync fix + resume finished B+C cleanly.)
 *
 * NB: the mutations fire the Sanity webhook ~615× → a one-time revalidateTag
 * storm for the whole catalog. Harmless (lazy regen); revalidateTag("ambient")
 * now matches nothing (the ambient tags left the code in e96f83c).
 */
import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

// ─── args ────────────────────────────────────────────────────────────────────
const EXECUTE = process.argv.includes("--execute");
const MODE = EXECUTE ? "EXECUTE (writes)" : "DRY-RUN (read-only)";

// ─── constants ───────────────────────────────────────────────────────────────
const AMBIENT_DOC_IDS = ["ambient-indoor", "ambient-outdoor", "ambient-kitchen", "ambient-yacht"];
const BATCH_SIZE = 50;
const PAUSE_MS = 400;
// Settle delay before post-phase verification: commits use visibility:"sync"
// (returns only once queryable), but dataset-wide count() aggregations can lag a
// beat behind — this avoids a false-negative read-after-write on the re-count.
const SETTLE_MS = 1500;
// 21, not 20: all 21 collections carry the `ambient` field. `collection-accessories-it`
// has an empty array (`ambient: []`) — defined, 0 refs — so it counts toward
// defined(ambient) (21) but not toward the 31 refs (held by the other 20). Phase A
// unsets all 21, which also cleans up that orphan empty array.
const EXPECTED_COLLECTIONS = 21;
const EXPECTED_MODELS = 591;
const EXPECTED_PRODUCT_TYPES = 591;

// ─── env / client ────────────────────────────────────────────────────────────
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01";
// DRY-RUN → read-only token. --execute → write token. Never the write token in dry-run.
const token = EXECUTE ? process.env.SANITY_WRITE_TOKEN : process.env.SANITY_API_READ_TOKEN;

if (!projectId || !dataset || !token) {
  console.error(
    `✖ Missing Sanity env (NEXT_PUBLIC_SANITY_PROJECT_ID, _DATASET, or ${
      EXECUTE ? "SANITY_WRITE_TOKEN" : "SANITY_API_READ_TOKEN"
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

// ─── helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function abort(msg: string): never {
  console.error(`\n✖ ABORT: ${msg}`);
  console.error("  No further phases run. Re-check the dataset before retrying.");
  process.exit(1);
}
const countCollectionsWithAmbient = () =>
  client.fetch<number>(`count(*[_type == "collection" && defined(ambient)])`);
const countModelsWithAmbient = () =>
  client.fetch<number>(`count(*[_type == "model" && defined(ambient)])`);
const countAmbientDocs = () => client.fetch<number>(`count(*[_type == "ambient"])`);
const countCollectionAmbientRefs = () =>
  client.fetch<number>(`count(*[_type == "collection" && defined(ambient)].ambient[])`);
const countModelsWithProductType = () =>
  client.fetch<number>(`count(*[_type == "model" && defined(productType)])`);

/** Patch/delete `ids` in transactions of ≤BATCH_SIZE, pausing between batches. */
async function applyInBatches(
  ids: string[],
  mutate: (tx: ReturnType<typeof client.transaction>, id: string) => void,
): Promise<void> {
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const tx = client.transaction();
    for (const id of batch) mutate(tx, id);
    await tx.commit({ visibility: "sync" });
    console.log(`     · batch ${Math.floor(i / BATCH_SIZE) + 1}: committed ${batch.length}`);
    if (i + BATCH_SIZE < ids.length) await sleep(PAUSE_MS);
  }
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n═══ migrate-remove-ambient — ${MODE} ═══\n`);
  console.log(`project=${projectId} dataset=${dataset} apiVersion=${apiVersion}\n`);

  // Baseline snapshot
  const [coll0, model0, docs0, refs0, pt0] = await Promise.all([
    countCollectionsWithAmbient(),
    countModelsWithAmbient(),
    countAmbientDocs(),
    countCollectionAmbientRefs(),
    countModelsWithProductType(),
  ]);
  const byValue = await client.fetch<Record<string, number>>(
    `{
      "indoor": count(*[_type=="model" && ambient=="indoor"]),
      "outdoor": count(*[_type=="model" && ambient=="outdoor"]),
      "kitchen": count(*[_type=="model" && ambient=="kitchen"]),
      "yacht": count(*[_type=="model" && ambient=="yacht"])
    }`,
  );
  console.log("── Baseline ──────────────────────────────────────");
  console.log(`  collections w/ ambient : ${coll0}  (expected ${EXPECTED_COLLECTIONS})`);
  console.log(`  collection ambient refs: ${refs0}`);
  console.log(`  models w/ ambient      : ${model0}  (expected ${EXPECTED_MODELS})`);
  console.log(`    · by value           : ${JSON.stringify(byValue)}`);
  console.log(`  ambient docs           : ${docs0}  (${AMBIENT_DOC_IDS.join(", ")})`);
  console.log(`  models w/ productType  : ${pt0}  (must stay ${EXPECTED_PRODUCT_TYPES})\n`);

  // ─── PHASE A: unset collection.ambient ───────────────────────────────────────
  console.log("── Phase A: unset collection.ambient ─────────────");
  const collIds = await client.fetch<string[]>(`*[_type == "collection" && defined(ambient)]._id`);
  console.log(`  targets: ${collIds.length}`);
  console.log(`  ids: ${collIds.join(", ")}`);
  if (!EXECUTE) {
    console.log(`  [dry-run] WOULD unset(["ambient"]) on ${collIds.length} collections\n`);
  } else if (coll0 === 0) {
    console.log("  already cleared (0 collections with ambient) — skipping Phase A\n");
  } else if (coll0 !== EXPECTED_COLLECTIONS) {
    abort(`Phase A baseline ${coll0} ≠ expected ${EXPECTED_COLLECTIONS} (nor 0/already-done)`);
  } else {
    await applyInBatches(collIds, (tx, id) => tx.patch(id, { unset: ["ambient"] }));
    await sleep(SETTLE_MS);
    const after = await countCollectionsWithAmbient();
    const refsAfter = await countCollectionAmbientRefs();
    console.log(
      `  after: collections w/ ambient = ${after} (expect 0), refs = ${refsAfter} (expect 0)`,
    );
    if (after !== 0 || refsAfter !== 0) abort(`Phase A left ${after} docs / ${refsAfter} refs`);
    console.log("  ✓ Phase A complete\n");
  }

  // ─── PHASE B: unset model.ambient ────────────────────────────────────────────
  console.log("── Phase B: unset model.ambient ──────────────────");
  const modelIds = await client.fetch<string[]>(`*[_type == "model" && defined(ambient)]._id`);
  console.log(`  targets: ${modelIds.length}`);
  console.log(
    `  ids (first 5): ${modelIds.slice(0, 5).join(", ")}${modelIds.length > 5 ? " …" : ""}`,
  );
  if (!EXECUTE) {
    console.log(`  [dry-run] WOULD unset(["ambient"]) on ${modelIds.length} models\n`);
  } else if (model0 === 0) {
    console.log("  already cleared (0 models with ambient) — skipping Phase B\n");
  } else if (model0 !== EXPECTED_MODELS) {
    abort(`Phase B baseline ${model0} ≠ expected ${EXPECTED_MODELS} (nor 0/already-done)`);
  } else {
    await applyInBatches(modelIds, (tx, id) => tx.patch(id, { unset: ["ambient"] }));
    await sleep(SETTLE_MS);
    const after = await countModelsWithAmbient();
    console.log(`  after: models w/ ambient = ${after} (expect 0)`);
    if (after !== 0) abort(`Phase B left ${after} models with ambient`);
    console.log("  ✓ Phase B complete\n");
  }

  // ─── PHASE C: delete the 4 ambient docs (only at refs == 0) ───────────────────
  console.log("── Phase C: delete ambient docs ──────────────────");
  if (!EXECUTE) {
    console.log(`  [dry-run] WOULD delete ${AMBIENT_DOC_IDS.length} docs AFTER refs reach 0:`);
    console.log(`            ${AMBIENT_DOC_IDS.join(", ")}\n`);
  } else if (docs0 === 0) {
    console.log("  already deleted (0 ambient docs) — skipping Phase C\n");
  } else {
    const refsNow = await countCollectionAmbientRefs();
    if (refsNow !== 0) abort(`Phase C gate: collection ambient refs = ${refsNow}, must be 0`);
    await applyInBatches(AMBIENT_DOC_IDS, (tx, id) => tx.delete(id));
    await sleep(SETTLE_MS);
    const after = await countAmbientDocs();
    console.log(`  after: ambient docs = ${after} (expect 0)`);
    if (after !== 0) abort(`Phase C left ${after} ambient docs`);
    console.log("  ✓ Phase C complete\n");
  }

  // ─── Final self-check ────────────────────────────────────────────────────────
  console.log("── Final self-check ──────────────────────────────");
  const [docsF, refsF, modelF, ptF] = await Promise.all([
    countAmbientDocs(),
    countCollectionAmbientRefs(),
    countModelsWithAmbient(),
    countModelsWithProductType(),
  ]);
  const checks = [
    ["ambientDocs == 0", docsF === 0, docsF],
    ["collectionAmbientRefs == 0", refsF === 0, refsF],
    ["model.ambient defined == 0", modelF === 0, modelF],
    [`model.productType defined == ${EXPECTED_PRODUCT_TYPES}`, ptF === EXPECTED_PRODUCT_TYPES, ptF],
  ] as const;
  for (const [label, ok, got] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${label}  (got ${got})`);
  }
  if (!EXECUTE) {
    console.log("\n  [dry-run] counts above reflect the CURRENT (pre-migration) state — the");
    console.log("  first two will be 4 / 31 until --execute runs. No mutations performed.\n");
  } else {
    const allOk = checks.every(([, ok]) => ok);
    console.log(allOk ? "\n  ✓ ALL CHECKS PASSED — ambient data fully removed.\n" : "");
    if (!allOk) abort("Final self-check failed");
  }
}

main().catch((err) => {
  console.error("\n✖ Unexpected error:", err);
  process.exit(1);
});
