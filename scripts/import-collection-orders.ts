/**
 * import-collection-orders.ts — Block 3b-shared: per-collection sort positions.
 *
 * Reads scripts/data/blocco3b-collection-orders.json (`entries`: 23 non-first-print
 * occurrences of the 12 shared components) and sets model.collectionOrders — an
 * array of { collection: reference, position: float } — on the 12 models matched
 * by EXACT `code`. Only `code`, `collection` (series label) and `position` are
 * used; `page`/`listino`/`between` are provenance and are never written.
 *
 * WHY: catalogOrder (Block 3a) placed each shared component at its FIRST-print
 * position, so in its NON-native collections it sorts at the top of the grid.
 * collectionOrders carries the per-collection float; COLLECTION_DETAIL_QUERY
 * coalesces it over catalogOrder (Phase 3). The native collection deliberately
 * has NO override entry → coalesce falls back to catalogOrder there.
 *
 * DRY-RUN by default (read token, prints plan + writes log). `--execute` writes.
 *
 *   pnpm tsx scripts/import-collection-orders.ts             # DRY-RUN
 *   pnpm tsx scripts/import-collection-orders.ts --execute   # WRITES
 *
 * Double-net (per import-catalog-order.ts): count-before → mutate → count-after,
 * visibility:"sync" + settle, idempotent (a fully applied dataset with matching
 * arrays is skipped). Fail-closed validation: non-string/empty code or series
 * label, non-finite/non-positive position, duplicate (code, collection) pair.
 * Series label → slug (lowercase, spaces→hyphens) → collection _id resolved by
 * slug (language=="it"); STOP if any slug resolves to nothing. MEMBERSHIP guard:
 * every override's collection must already be in that model's `collections[]`
 * (else the override would be a dead ref the query never reaches). Codes absent
 * from the dataset are reported SKIPPED (guard expects 0 — all 12 pre-verified).
 * EXECUTE refuses to run on any skip, unresolved slug, membership violation, or
 * pre-existing collectionOrders outside the 12. Verify does a FULL match: every
 * stored { collection, position } equals its data-file expectation.
 */
import { createClient, type SanityClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const DATA_PATH = resolve(REPO_ROOT, "scripts/data/blocco3b-collection-orders.json");
const LOG_PATH = resolve(REPO_ROOT, "scripts/migration/collection-orders-dryrun-log.json");

const EXPECTED_MODELS = 12;
const EXPECTED_ENTRIES = 23;

const EXECUTE = process.argv.includes("--execute");
const MODE = EXECUTE ? "EXECUTE (writes)" : "DRY-RUN (read-only)";

const BATCH_SIZE = 50;
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
interface OrderEntry {
  code: string;
  collection: string; // series label, e.g. "BOSS WIDE"
  position: number; // float — sits between neighbours' global positions
  // provenance only — never written to Sanity
  page?: number;
  listino?: string;
  between?: number[];
}
interface Blocco3bData {
  entries: OrderEntry[];
}

// Reference stored inside the collectionOrders array (anonymous object member:
// _key + fields, no item-level _type — matches the TypeGen shape).
interface CollectionOrderItem {
  _key: string;
  collection: { _type: "reference"; _ref: string };
  position: number;
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

// Series label → collection slug: lowercase, collapse whitespace to hyphens.
const labelToSlug = (label: string) => label.toLowerCase().trim().replace(/\s+/g, "-");

const countDefined = () =>
  client.fetch<number>(`count(*[_type=="model" && defined(collectionOrders)])`);
const countOutside = (codes: string[]) =>
  client.fetch<number>(
    `count(*[_type=="model" && defined(collectionOrders) && !(code in $codes)])`,
    { codes },
  );

// ─── plan ──────────────────────────────────────────────────────────────────────
interface ModelPatch {
  code: string;
  id: string;
  items: CollectionOrderItem[]; // sorted by position
}
interface Plan {
  patches: ModelPatch[];
  skipped: string[];
  codes: string[];
  entriesCount: number;
  definedBefore: number;
  unexpectedBefore: number;
  slugToId: Map<string, string>;
}

async function buildPlan(data: Blocco3bData): Promise<Plan> {
  assert(Array.isArray(data.entries), "data.entries must be an array");
  const entries = data.entries;
  assert(entries.length > 0, "data.entries is empty");
  assert(
    entries.length === EXPECTED_ENTRIES,
    `expected ${EXPECTED_ENTRIES} entries, got ${entries.length}`,
  );
  console.log(`  entries: ${entries.length}`);

  // Fail-closed shape validation + (code, collection) uniqueness.
  const seenPair = new Set<string>();
  for (const e of entries) {
    assert(
      typeof e.code === "string" && e.code.length > 0,
      `entry missing code: ${JSON.stringify(e)}`,
    );
    assert(
      typeof e.collection === "string" && e.collection.length > 0,
      `entry ${e.code}: missing collection label`,
    );
    assert(
      typeof e.position === "number" && Number.isFinite(e.position) && e.position > 0,
      `entry ${e.code}/${e.collection}: position must be a positive finite number (got ${e.position})`,
    );
    const pair = `${e.code}::${labelToSlug(e.collection)}`;
    if (seenPair.has(pair)) abort(`duplicate (code, collection) pair in data: ${pair}`);
    seenPair.add(pair);
  }

  // Resolve series labels → collection _ids (by slug, IT docs). STOP if any is unresolved.
  const wantedSlugs = [...new Set(entries.map((e) => labelToSlug(e.collection)))];
  const collections = await client.fetch<{ _id: string; slug: string }[]>(
    `*[_type=="collection" && language=="it" && slug.current in $slugs]{ _id, "slug": slug.current }`,
    { slugs: wantedSlugs },
  );
  const slugToId = new Map<string, string>();
  for (const c of collections) {
    if (slugToId.has(c.slug)) abort(`duplicate IT collection for slug: ${c.slug}`);
    slugToId.set(c.slug, c._id);
  }
  const unresolvedSlugs = wantedSlugs.filter((s) => !slugToId.has(s));
  if (unresolvedSlugs.length)
    abort(`collection slug(s) resolve to nothing: ${unresolvedSlugs.join(", ")}`);

  // Resolve codes → model _ids (+ their collection memberships for the guard).
  const codes = [...new Set(entries.map((e) => e.code))];
  const found = await client.fetch<{ _id: string; code: string; collRefs: string[] }[]>(
    `*[_type=="model" && code in $codes]{ _id, code, "collRefs": collections[]._ref }`,
    { codes },
  );
  const codeToId = new Map<string, string>();
  const codeToColl = new Map<string, Set<string>>();
  for (const m of found) {
    if (codeToId.has(m.code)) abort(`duplicate model code in dataset: ${m.code}`);
    codeToId.set(m.code, m._id);
    codeToColl.set(m.code, new Set(m.collRefs ?? []));
  }
  const skipped = codes.filter((c) => !codeToId.has(c));

  // Membership guard: every override must target a collection the model belongs to.
  const violations: string[] = [];
  for (const e of entries) {
    const collId = slugToId.get(labelToSlug(e.collection));
    const memberships = codeToColl.get(e.code);
    if (!collId || !memberships) continue; // unresolved handled above / skipped code
    if (!memberships.has(collId))
      violations.push(
        `${e.code} → ${labelToSlug(e.collection)} (${collId}) not in model.collections`,
      );
  }
  if (violations.length)
    abort(
      `membership violation(s) — override targets a collection the model isn't in:\n    ${violations.join("\n    ")}`,
    );

  // Group entries by code → one patch per model, items sorted by position.
  const byCode = new Map<string, CollectionOrderItem[]>();
  for (const e of entries) {
    const id = codeToId.get(e.code);
    if (!id) continue; // skipped
    const slug = labelToSlug(e.collection);
    const collId = slugToId.get(slug)!;
    const item: CollectionOrderItem = {
      _key: `co-${slug}`,
      collection: { _type: "reference", _ref: collId },
      position: e.position,
    };
    const arr = byCode.get(e.code) ?? [];
    arr.push(item);
    byCode.set(e.code, arr);
  }
  const patches: ModelPatch[] = [];
  for (const [code, items] of byCode) {
    items.sort((a, b) => a.position - b.position);
    patches.push({ code, id: codeToId.get(code)!, items });
  }
  patches.sort((a, b) => a.code.localeCompare(b.code));

  const definedBefore = await countDefined();
  const unexpectedBefore = await countOutside(codes);

  return {
    patches,
    skipped,
    codes,
    entriesCount: entries.length,
    definedBefore,
    unexpectedBefore,
    slugToId,
  };
}

function slugOf(item: CollectionOrderItem): string {
  return item._key.replace(/^co-/, "");
}

function printPlan(plan: Plan): void {
  console.log("\n── Plan: set model.collectionOrders ──────────────");
  console.log(
    `  → ${plan.patches.length} models to patch (of ${plan.entriesCount} entries; expect ${EXPECTED_MODELS} models)`,
  );
  if (plan.skipped.length) {
    console.log(
      `  ⚠ SKIPPED (code not found): ${plan.skipped.length} — ${plan.skipped.join(", ")}`,
    );
  } else {
    console.log("  skipped: 0");
  }
  console.log("  membership guard: OK (every override targets a collection the model belongs to)");
  console.log("\n  resolved collection slugs → _id:");
  for (const [slug, id] of [...plan.slugToId].sort()) console.log(`    ${slug.padEnd(12)} → ${id}`);
  console.log("\n  diagnostics (ground truth in dataset):");
  console.log(`    collectionOrders already defined: ${plan.definedBefore} (expect 0 pre-apply)`);
  console.log(
    `    defined OUTSIDE the ${plan.codes.length} codes: ${plan.unexpectedBefore} (must be 0)`,
  );
  console.log("\n  per-model overrides (code → slug@position):");
  const totalItems = plan.patches.reduce((n, p) => n + p.items.length, 0);
  for (const p of plan.patches) {
    const cells = p.items.map((it) => `${slugOf(it)}@${it.position}`).join(", ");
    console.log(`    ${p.code.padEnd(10)} [${p.items.length}]  ${cells}`);
  }
  console.log(`  total override items: ${totalItems} (expect ${plan.entriesCount})`);
}

async function verify(plan: Plan, data: Blocco3bData): Promise<void> {
  console.log("\n── Verify ────────────────────────────────────────");
  const after = await countDefined();
  const unexpectedAfter = await countOutside(plan.codes);

  // Expected: (code, collId) → position.
  const expected = new Map<string, number>();
  for (const e of data.entries)
    expected.set(`${e.code}::${plan.slugToId.get(labelToSlug(e.collection))}`, e.position);

  const stored = await client.fetch<
    { code: string; items: { _ref: string; position: number }[] }[]
  >(
    `*[_type=="model" && defined(collectionOrders)]{ code, "items": collectionOrders[]{ "_ref": collection._ref, position } }`,
  );
  const storedPairs = new Map<string, number>();
  let storedItemCount = 0;
  for (const m of stored)
    for (const it of m.items ?? []) {
      storedPairs.set(`${m.code}::${it._ref}`, it.position);
      storedItemCount++;
    }
  const mismatches: string[] = [];
  for (const [key, pos] of expected)
    if (storedPairs.get(key) !== pos)
      mismatches.push(`${key} expected ${pos} got ${storedPairs.get(key)}`);
  // Also flag any stored pair not in expected (over-application).
  for (const [key] of storedPairs)
    if (!expected.has(key)) mismatches.push(`unexpected stored ${key}`);

  // Named spot-checks from the locked expectation.
  const bossId = plan.slugToId.get("boss");
  const illeId = plan.slugToId.get("ille");
  const wmrl = stored.find((m) => m.code === "WMRL");
  const wx75 = stored.find((m) => m.code === "WX75.SK");
  const wmrlBoss = wmrl?.items.find((i) => i._ref === bossId)?.position;
  const wx75Ille = wx75?.items.find((i) => i._ref === illeId)?.position;

  const checks: Array<[string, boolean, string]> = [
    [`collectionOrders defined == ${EXPECTED_MODELS}`, after === EXPECTED_MODELS, String(after)],
    ["no collectionOrders outside the 12", unexpectedAfter === 0, String(unexpectedAfter)],
    [
      `total stored items == ${plan.entriesCount}`,
      storedItemCount === plan.entriesCount,
      String(storedItemCount),
    ],
    ["all stored values match data", mismatches.length === 0, `${mismatches.length} mismatch`],
    ["WMRL has 4 entries", (wmrl?.items.length ?? 0) === 4, String(wmrl?.items.length)],
    ["WMRL boss == 176.5", wmrlBoss === 176.5, String(wmrlBoss)],
    ["WX75.SK has 4 entries", (wx75?.items.length ?? 0) === 4, String(wx75?.items.length)],
    ["WX75.SK ille == 505.5", wx75Ille === 505.5, String(wx75Ille)],
  ];
  for (const [label, ok, got] of checks) console.log(`  ${ok ? "✓" : "✗"} ${label}  (got ${got})`);
  if (!checks.every(([, ok]) => ok)) {
    if (mismatches.length) console.error("  first mismatches:", mismatches.slice(0, 10));
    abort("Verify failed");
  }
  console.log("\n  ✓ ALL CHECKS PASSED — collection-orders import complete.\n");
}

async function commitPatches(patches: ModelPatch[]): Promise<void> {
  for (let i = 0; i < patches.length; i += BATCH_SIZE) {
    const batch = patches.slice(i, i + BATCH_SIZE);
    const tx = client.transaction();
    for (const p of batch) tx.patch(p.id, { set: { collectionOrders: p.items } });
    await tx.commit({ visibility: "sync" });
    console.log(`     · batch ${Math.floor(i / BATCH_SIZE) + 1}: committed ${batch.length}`);
  }
}

async function main(): Promise<void> {
  console.log(`\n═══ import-collection-orders — ${MODE} ═══\n`);
  console.log(`project=${projectId} dataset=${dataset} apiVersion=${apiVersion}\n`);

  const data = JSON.parse(readFileSync(DATA_PATH, "utf8")) as Blocco3bData;
  const plan = await buildPlan(data);
  printPlan(plan);

  writeFileSync(
    LOG_PATH,
    JSON.stringify(
      {
        mode: MODE,
        generatedFrom: DATA_PATH,
        entriesCount: plan.entriesCount,
        modelsToPatch: plan.patches.length,
        skipped: plan.skipped,
        diagnostics: { definedBefore: plan.definedBefore, unexpectedBefore: plan.unexpectedBefore },
        resolvedSlugs: Object.fromEntries(plan.slugToId),
        patches: plan.patches,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`\n  log written → ${LOG_PATH}`);

  // Loud divergence signal vs the locked expectation (models==12, entries==23, skipped==0).
  const totalItems = plan.patches.reduce((n, p) => n + p.items.length, 0);
  if (
    plan.patches.length !== EXPECTED_MODELS ||
    totalItems !== EXPECTED_ENTRIES ||
    plan.skipped.length !== 0
  ) {
    console.log(
      `\n  ⚠ DIVERGENCE: expected models=${EXPECTED_MODELS} items=${EXPECTED_ENTRIES} skipped=0, got ` +
        `models=${plan.patches.length} items=${totalItems} skipped=${plan.skipped.length}. STOP and review.`,
    );
  }
  if (plan.unexpectedBefore !== 0) {
    console.log(
      `\n  ⚠ ${plan.unexpectedBefore} models already carry collectionOrders OUTSIDE the data set. STOP and review.`,
    );
  }

  if (!EXECUTE) {
    console.log("\n  [dry-run] no writes performed. Re-run with --execute to apply.\n");
    return;
  }

  // ─── EXECUTE ─────────────────────────────────────────────────────────────────
  if (plan.skipped.length !== 0)
    abort(
      `refusing to execute: ${plan.skipped.length} codes not found (${plan.skipped.join(", ")})`,
    );
  if (plan.unexpectedBefore !== 0)
    abort(
      `refusing to execute: ${plan.unexpectedBefore} models carry collectionOrders outside the data set`,
    );

  console.log("\n── Apply: set collectionOrders ───────────────────");
  let skipApply = false;
  if (plan.definedBefore === plan.patches.length) {
    const stored = await client.fetch<
      { code: string; items: { _ref: string; position: number }[] }[]
    >(
      `*[_type=="model" && defined(collectionOrders)]{ code, "items": collectionOrders[]{ "_ref": collection._ref, position } }`,
    );
    const expected = new Map<string, number>();
    for (const e of data.entries)
      expected.set(`${e.code}::${plan.slugToId.get(labelToSlug(e.collection))}`, e.position);
    const storedPairs = new Map<string, number>();
    for (const m of stored)
      for (const it of m.items ?? []) storedPairs.set(`${m.code}::${it._ref}`, it.position);
    skipApply =
      storedPairs.size === expected.size &&
      [...expected].every(([k, v]) => storedPairs.get(k) === v);
  }
  if (skipApply) {
    console.log(`  already fully applied with matching values — skipping apply`);
  } else {
    await commitPatches(plan.patches);
    await sleep(SETTLE_MS);
  }

  await verify(plan, data);
}

main().catch((err) => {
  console.error("\n✖ Unexpected error:", err);
  process.exit(1);
});
