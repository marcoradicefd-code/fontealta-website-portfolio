/**
 * populate-water-supply.ts — Block 2 (activation pass): set `model.waterSupply`
 * from Andrea's correction campaign (Contenuti_Sito-001.xlsx, 23/07/2026).
 *
 * SUPERSEDES the partial population done by scripts/import-gocce.ts (which set 294
 * models and left `pendingAndrea` (52) + `notInCatalog` (6) UNSET pending Andrea's
 * decision — see that file's header). Andrea's campaign IS that decision: it carries
 * verified drops (incl. EXPLICIT "none") for every matched article. After this runs,
 * import-gocce.ts's verify guard is expected to no longer hold — it is historical.
 *
 * Source of truth: scripts/data/andrea-corrections-2026-07-23.json  ({source, note, rows}).
 * 14 codes appear on multiple rows (multi-collection shared articles) with IDENTICAL
 * drop data → FIRST OCCURRENCE per code (asserted identical; abort on divergence).
 *
 * Mapping per matched code (drops → enum literal, schema WATER_SUPPLY = cold/hot-cold/none):
 *   drop_red && drop_blue → "hot-cold"
 *   !drop_red && drop_blue → "cold"
 *   !drop_red && !drop_blue → "none"   (EXPLICIT none: verified-no-drops, NOT null)
 *   drop_red && !drop_blue → ABORT     (red-only is impossible by design — data error)
 *
 * Scope: the 593 codes that match a Sanity `model` by EXACT code. JSON codes with no
 * model (111 Excel-only, mostly compound `.INC` concealed-body pairings) → SKIP+report.
 * The 6 Sanity-only models (D3, FLX03, FLX04, P60, S06, S07) are NOT in the file →
 * never targeted → stay untouched (pending listino cross-check). Conflicts (Sanity
 * already has a different value) are OVERWRITTEN (JSON is truth) and listed old→new.
 *
 * DRY-RUN by default (read token, prints plan + writes log). `--execute` writes.
 *   pnpm tsx scripts/populate-water-supply.ts             # DRY-RUN
 *   pnpm tsx scripts/populate-water-supply.ts --execute   # WRITES
 *
 * Double-net (per import-gocce.ts): visibility:"sync" + settle delay + before/after
 * counts + fresh independent GROQ verify (per-value, not script state) + abort-on-mismatch.
 * Only real changes are patched (new populations + conflicts); no-ops are reported, not
 * rewritten. Idempotent: a second run finds 0 changes.
 */
import { createClient, type SanityClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const DATA_PATH = resolve(REPO_ROOT, "scripts/data/andrea-corrections-2026-07-23.json");
const LOG_PATH = resolve(REPO_ROOT, "scripts/migration/water-supply-dryrun-log.json");

const EXECUTE = process.argv.includes("--execute");
const MODE = EXECUTE ? "EXECUTE (writes)" : "DRY-RUN (read-only)";

const BATCH_SIZE = 50;
const PAUSE_MS = 400;
const SETTLE_MS = 1500;

type WaterValue = "cold" | "hot-cold" | "none";
const WATER_VALUES: readonly WaterValue[] = ["cold", "hot-cold", "none"] as const;

// Verità del file dedotta dall'audit (scratchpad/audit-correzioni-andrea.md §0):
// stato finale atteso sui 593 modelli matchati. Il report li confronta col vivo.
const EXPECTED_TARGET_DIST: Record<WaterValue, number> = { "hot-cold": 317, cold: 139, none: 137 };
const EXPECTED_MATCHED = 593;

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
interface AndreaRow {
  code: string;
  serie: string;
  listino_section: string;
  drop_red: boolean;
  drop_blue: boolean;
  card_fix: string | null;
  scheda_fix: string | null;
}
interface AndreaFile {
  source: string;
  note: string;
  rows: AndreaRow[];
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

function waterFromDrops(red: boolean, blue: boolean, code: string): WaterValue {
  if (red && blue) return "hot-cold";
  if (!red && blue) return "cold";
  if (!red && !blue) return "none";
  // red && !blue → red-only: impossibile by design (zero red-only nel file). Errore dati.
  return abort(`code ${code}: RED-ONLY (drop_red=true, drop_blue=false) — invalid, zero red-only by design.`);
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

// ─── plan ────────────────────────────────────────────────────────────────────
interface Change {
  code: string;
  id: string;
  from: string | null; // current waterSupply in Sanity
  to: WaterValue;
  kind: "new" | "overwrite";
}
interface Plan {
  targetByCode: Map<string, WaterValue>; // dedup, all JSON codes
  changes: Change[]; // new + overwrite (what we patch)
  noop: number; // matched & already-correct
  overwrites: Change[]; // conflicts (subset of changes), for the report
  skipped: string[]; // JSON codes with no model
  matchedCodes: string[]; // the codes present in Sanity (target scope)
  targetDist: Record<WaterValue, number>; // end-state dist over matched
}

function loadAndDedup(): Map<string, WaterValue> {
  const file = JSON.parse(readFileSync(DATA_PATH, "utf8")) as AndreaFile;
  assert(Array.isArray(file.rows), "andrea file: `rows` must be an array");
  console.log(`  source: ${file.source}`);
  console.log(`  rows: ${file.rows.length} (raw)`);

  // First occurrence per code; assert later occurrences carry IDENTICAL drop data.
  const seen = new Map<string, { red: boolean; blue: boolean }>();
  const target = new Map<string, WaterValue>();
  let dupRows = 0;
  for (const r of file.rows) {
    assert(typeof r.code === "string" && r.code.length > 0, "row with empty/invalid code");
    assert(typeof r.drop_red === "boolean" && typeof r.drop_blue === "boolean", `code ${r.code}: drop_red/drop_blue must be boolean`);
    const prev = seen.get(r.code);
    if (prev) {
      dupRows++;
      if (prev.red !== r.drop_red || prev.blue !== r.drop_blue)
        abort(`code ${r.code}: multi-row DIVERGENT drop data (first {red:${prev.red},blue:${prev.blue}} vs {red:${r.drop_red},blue:${r.drop_blue}}). First-occurrence rule unsafe.`);
      continue; // identical duplicate → keep first
    }
    seen.set(r.code, { red: r.drop_red, blue: r.drop_blue });
    target.set(r.code, waterFromDrops(r.drop_red, r.drop_blue, r.code));
  }
  console.log(`  distinct codes: ${target.size}  (deduped ${dupRows} identical duplicate rows across shared codes)`);
  return target;
}

async function buildPlan(): Promise<Plan> {
  const targetByCode = loadAndDedup();

  // Fetch current Sanity state for every targeted code (id + current value).
  const allCodes = [...targetByCode.keys()];
  const found = await client.fetch<{ _id: string; code: string; waterSupply: string | null }[]>(
    `*[_type=="model" && code in $codes]{ _id, code, waterSupply }`,
    { codes: allCodes },
  );
  const byCode = new Map<string, { id: string; current: string | null }>();
  for (const m of found) {
    if (byCode.has(m.code)) abort(`duplicate model code in dataset: ${m.code}`);
    byCode.set(m.code, { id: m._id, current: m.waterSupply ?? null });
  }

  const changes: Change[] = [];
  const overwrites: Change[] = [];
  const skipped: string[] = [];
  const matchedCodes: string[] = [];
  const targetDist: Record<WaterValue, number> = { cold: 0, "hot-cold": 0, none: 0 };
  let noop = 0;

  for (const [code, to] of targetByCode) {
    const hit = byCode.get(code);
    if (!hit) {
      skipped.push(code);
      continue;
    }
    matchedCodes.push(code);
    targetDist[to] += 1;
    if (hit.current === to) {
      noop++;
      continue;
    }
    const change: Change = {
      code,
      id: hit.id,
      from: hit.current,
      to,
      kind: hit.current == null ? "new" : "overwrite",
    };
    changes.push(change);
    if (change.kind === "overwrite") overwrites.push(change);
  }

  return { targetByCode, changes, noop, overwrites, skipped, matchedCodes, targetDist };
}

function printPlan(plan: Plan): void {
  const newCount = plan.changes.filter((c) => c.kind === "new").length;
  console.log("\n── Plan: set model.waterSupply (Andrea corrections) ─────────────");
  console.log(`  matched (Sanity models): ${plan.matchedCodes.length}  (expected ${EXPECTED_MATCHED})`);
  console.log(
    `  target end-state distribution over matched: hot-cold=${plan.targetDist["hot-cold"]} cold=${plan.targetDist.cold} none=${plan.targetDist.none}`,
  );
  console.log(
    `    expected (audit §0):                     hot-cold=${EXPECTED_TARGET_DIST["hot-cold"]} cold=${EXPECTED_TARGET_DIST.cold} none=${EXPECTED_TARGET_DIST.none}`,
  );
  const distOk =
    plan.matchedCodes.length === EXPECTED_MATCHED &&
    plan.targetDist["hot-cold"] === EXPECTED_TARGET_DIST["hot-cold"] &&
    plan.targetDist.cold === EXPECTED_TARGET_DIST.cold &&
    plan.targetDist.none === EXPECTED_TARGET_DIST.none;
  console.log(`  → distribution matches audit: ${distOk ? "✓" : "✗ MISMATCH — investigate before executing"}`);

  console.log(
    `\n  to patch: ${plan.changes.length}  (new null→value: ${newCount} · overwrite conflicts: ${plan.overwrites.length})`,
  );
  console.log(`  already correct (no-op, not rewritten): ${plan.noop}`);

  console.log(`\n  ── OVERWRITE conflicts (Sanity value → JSON truth) : ${plan.overwrites.length}`);
  for (const c of plan.overwrites) console.log(`     ${c.code.padEnd(14)} ${String(c.from).padEnd(10)} → ${c.to}`);

  console.log(`\n  ── SKIPPED (JSON code with no Sanity model): ${plan.skipped.length}`);
  console.log(`     (expected 111 Excel-only, mostly compound .INC concealed-body pairings)`);
  console.log(`     sample: ${plan.skipped.slice(0, 12).join(", ")}${plan.skipped.length > 12 ? " …" : ""}`);

  console.log(`\n  ── sample of NEW populations (first 10):`);
  for (const c of plan.changes.filter((x) => x.kind === "new").slice(0, 10))
    console.log(`     ${c.code.padEnd(14)} (null) → ${c.to}`);
}

async function verify(plan: Plan): Promise<void> {
  console.log("\n── Verify (fresh independent GROQ, not script state) ──────────");
  const matched = plan.matchedCodes;
  const [definedInMatched, hotCold, cold, none, definedOutside] = await Promise.all([
    client.fetch<number>(`count(*[_type=="model" && code in $codes && defined(waterSupply)])`, { codes: matched }),
    client.fetch<number>(`count(*[_type=="model" && code in $codes && waterSupply=="hot-cold"])`, { codes: matched }),
    client.fetch<number>(`count(*[_type=="model" && code in $codes && waterSupply=="cold"])`, { codes: matched }),
    client.fetch<number>(`count(*[_type=="model" && code in $codes && waterSupply=="none"])`, { codes: matched }),
    client.fetch<number>(`count(*[_type=="model" && defined(waterSupply) && !(code in $codes)])`, { codes: matched }),
  ]);
  const checks: Array<[string, boolean, number, number]> = [
    ["all matched have waterSupply defined", definedInMatched === matched.length, definedInMatched, matched.length],
    ["hot-cold == target", hotCold === plan.targetDist["hot-cold"], hotCold, plan.targetDist["hot-cold"]],
    ["cold == target", cold === plan.targetDist.cold, cold, plan.targetDist.cold],
    ["none == target", none === plan.targetDist.none, none, plan.targetDist.none],
    ["no waterSupply defined OUTSIDE matched set (6 Sanity-only stay null)", definedOutside === 0, definedOutside, 0],
  ];
  for (const [label, ok, got, want] of checks)
    console.log(`  ${ok ? "✓" : "✗"} ${label}  (got ${got}, want ${want})`);
  if (!checks.every(([, ok]) => ok)) abort("Verify failed — Sanity state does not match plan.");
  console.log("\n  ✓ ALL CHECKS PASSED — waterSupply population complete.\n");
}

async function main(): Promise<void> {
  console.log(`\n═══ populate-water-supply — ${MODE} ═══\n`);
  console.log(`project=${projectId} dataset=${dataset} apiVersion=${apiVersion}\n`);

  const plan = await buildPlan();
  printPlan(plan);

  writeFileSync(
    LOG_PATH,
    JSON.stringify(
      {
        mode: MODE,
        generatedFrom: DATA_PATH,
        matched: plan.matchedCodes.length,
        targetDist: plan.targetDist,
        toPatch: plan.changes.length,
        noop: plan.noop,
        overwrites: plan.overwrites,
        skippedCount: plan.skipped.length,
        skipped: plan.skipped,
        changes: plan.changes,
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
  console.log("\n── Apply: patch waterSupply (changes only) ───────────────────");
  const before = await client.fetch<number>(`count(*[_type=="model" && defined(waterSupply)])`);
  console.log(`  waterSupply defined BEFORE: ${before}`);
  if (plan.changes.length === 0) {
    console.log("  no changes — nothing to patch (idempotent re-run).");
  } else {
    await commitInBatches(plan.changes, (tx, c) => tx.patch(c.id, { set: { waterSupply: c.to } }));
    await sleep(SETTLE_MS);
  }

  await verify(plan);
}

main().catch((err) => {
  console.error("\n✖ Unexpected error:", err);
  process.exit(1);
});
