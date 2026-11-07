/**
 * import-blocco1.ts — Block 1: Flamingo freestanding split + concealed bodies.
 *
 * Reads scripts/data/blocco1-data.json (verified against the client master Excel
 * + the live dataset) and applies four operations, in order, each guarded:
 *
 *   Op1  create 17 concealedBody docs (the in-wall body registry)
 *   Op2  set model.requiredConcealedBody on the 92 unique association articles
 *   Op3  reduce availableFinishes to the 4 non-PVD refs on 8 Flamingo columns
 *   Op4  create 8 new `.D` Flamingo models carrying the 4 PVD finishes
 *
 * DRY-RUN by default (read token, prints the full plan + writes a log). `--execute`
 * writes (write token). Never the write token in dry-run.
 *
 *   pnpm tsx scripts/import-blocco1.ts             # DRY-RUN
 *   pnpm tsx scripts/import-blocco1.ts --execute   # WRITES
 *
 * Double-net (per migrate-remove-ambient.ts): commits use visibility:"sync" + a
 * settle delay (read-after-write on the Content Lake is a race — async commits
 * return before the index is queryable). Each op has a count-before → mutate →
 * count-after guard and is skipped when already applied (resume-by-state). ABORT on
 * any mismatch. Idempotent: creates use createOrReplace on deterministic _ids;
 * patches set fixed values — safe to re-run.
 *
 * Fail-closed validation before ANY write: dedup associations, reject article→multi-inc
 * conflicts, reject inc codes absent from the registry, require every base article to
 * exist, and reject _id / slug collisions against a DIFFERENT existing doc.
 */
import { createClient, type SanityClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const DATA_PATH = resolve(REPO_ROOT, "scripts/data/blocco1-data.json");
const LOG_PATH = resolve(REPO_ROOT, "scripts/migration/blocco1-dryrun-log.json");

// ─── args ────────────────────────────────────────────────────────────────────
const EXECUTE = process.argv.includes("--execute");
const MODE = EXECUTE ? "EXECUTE (writes)" : "DRY-RUN (read-only)";

// ─── constants ───────────────────────────────────────────────────────────────
const BATCH_SIZE = 50;
const PAUSE_MS = 400;
const SETTLE_MS = 1500;
const FLAMINGO_ID = "collection-flamingo-it";
const KEPT_FINISHES = ["MX", "BX", "MB", "RL"]; // 4 non-PVD kept on the existing columns
const PVD_FINISHES = ["BB", "BC", "AB", "DB"]; // 4 PVD moved to the new .D twins
// Expected magnitudes (from the 2026-07-20 read-only pre-check).
const EXP_REGISTRY = 17;
const EXP_ASSOC_UNIQUE = 92;
const EXP_UPDATE = 8;
const EXP_CREATE = 8;
const EXP_FLAMINGO_BEFORE = 44;
const EXP_FLAMINGO_AFTER = 52;

// ─── env / client ────────────────────────────────────────────────────────────
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
interface RegistryItem {
  code: string;
  it: string;
  en: string;
}
interface Association {
  series: string;
  category: string;
  article: string;
  inc: string;
}
interface UpdateFinishes {
  code: string;
  finishes: string[];
}
interface CreateItem {
  code: string;
  baseArticle: string;
  category: string;
  finishes: string[];
  descriptions: { it: string; en: string } & Record<string, string>;
  imageLink?: string | null;
}
interface Blocco1Data {
  concealedBodyRegistry: RegistryItem[];
  concealedBodyAssociations: Association[];
  flamingoFreestanding: { updateFinishes: UpdateFinishes[]; create: CreateItem[] };
}

type FinishRef = { _type: "reference"; _ref: string; _key: string };
type AnyDoc = Record<string, unknown> & { _id: string; _type: string };

// ─── helpers ───────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function abort(msg: string): never {
  console.error(`\n✖ ABORT: ${msg}`);
  console.error("  No further ops run. Re-check the dataset before retrying.");
  process.exit(1);
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) abort(msg);
}

const dotStripId = (code: string) => code.toLowerCase().replace(/\./g, "");
const modelId = (code: string) => `model-${dotStripId(code)}`;
const modelSlug = (code: string) => code.toLowerCase().replace(/\./g, "-");
const cbId = (code: string) =>
  `concealedBody-${code
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
const randomKey = () => Math.random().toString(36).slice(2, 14);
const toPortableText = (text: string): Array<Record<string, unknown>> => [
  {
    _type: "block",
    _key: randomKey(),
    style: "normal",
    markDefs: [],
    children: [{ _type: "span", _key: randomKey(), text, marks: [] }],
  },
];
const finishRefs = (codes: string[]): FinishRef[] =>
  codes.map((c, i) => ({
    _type: "reference",
    _ref: `finish-${c.toLowerCase()}`,
    _key: `f-${i}-${c.toLowerCase()}`,
  }));

/** Apply `items` in transactions of ≤BATCH_SIZE with visibility:"sync". */
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

const countConcealed = () => client.fetch<number>(`count(*[_type=="concealedBody"])`);
const countReq = () =>
  client.fetch<number>(`count(*[_type=="model" && defined(requiredConcealedBody)])`);
const countFlamingo = () =>
  client.fetch<number>(`count(*[_type=="model" && references($id)])`, { id: FLAMINGO_ID });

// ─── plan types ────────────────────────────────────────────────────────────────
interface Op2Patch {
  article: string;
  id: string;
  inc: string;
  cbRef: string;
}
interface Op3Patch {
  code: string;
  id: string;
  beforeCount: number;
  finishes: FinishRef[];
}
interface Plan {
  op1: AnyDoc[];
  op2: Op2Patch[];
  op3: Op3Patch[];
  op4: AnyDoc[];
  skipped: string[];
}

// ─── build + validate the plan (fail-closed, no writes) ─────────────────────────
async function buildPlan(data: Blocco1Data): Promise<Plan> {
  const { concealedBodyRegistry: registry, concealedBodyAssociations: assoc } = data;
  const { updateFinishes, create } = data.flamingoFreestanding;

  // -- shape --
  assert(registry.length === EXP_REGISTRY, `registry: ${registry.length} ≠ ${EXP_REGISTRY}`);
  assert(
    updateFinishes.length === EXP_UPDATE,
    `updateFinishes: ${updateFinishes.length} ≠ ${EXP_UPDATE}`,
  );
  assert(create.length === EXP_CREATE, `create: ${create.length} ≠ ${EXP_CREATE}`);

  // -- registry: unique codes + unique derived cbIds --
  const regCodes = registry.map((r) => r.code);
  assert(new Set(regCodes).size === regCodes.length, "registry has duplicate codes");
  const cbIds = regCodes.map(cbId);
  assert(new Set(cbIds).size === cbIds.length, "registry codes collide after cbId() slugify");
  for (const r of registry)
    assert(r.code && r.it && r.en, `registry item missing code/it/en: ${r.code}`);
  const regCodeSet = new Set(regCodes);

  // -- associations: dedup by article, reject conflicts + unknown inc --
  const byArticle = new Map<string, string>(); // article → inc
  for (const a of assoc) {
    assert(a.article && a.inc, `association missing article/inc in series ${a.series}`);
    assert(
      regCodeSet.has(a.inc),
      `association inc "${a.inc}" (article ${a.article}) not in registry`,
    );
    const prev = byArticle.get(a.article);
    if (prev !== undefined && prev !== a.inc) {
      abort(`association conflict: ${a.article} → both "${prev}" and "${a.inc}"`);
    }
    byArticle.set(a.article, a.inc);
  }
  const uniqueArticles = [...byArticle.keys()];
  console.log(
    `  associations: ${assoc.length} rows → ${uniqueArticles.length} unique articles (expect ${EXP_ASSOC_UNIQUE})`,
  );

  // -- resolve association articles → model _ids (report SKIPPED if absent) --
  const foundModels = await client.fetch<{ _id: string; code: string }[]>(
    `*[_type=="model" && code in $codes]{ _id, code }`,
    { codes: uniqueArticles },
  );
  const codeToId = new Map<string, string>();
  for (const m of foundModels) {
    if (codeToId.has(m.code)) abort(`duplicate model code in dataset: ${m.code}`);
    codeToId.set(m.code, m._id);
  }
  const skipped = uniqueArticles.filter((a) => !codeToId.has(a));
  const op2: Op2Patch[] = [];
  for (const article of uniqueArticles) {
    const id = codeToId.get(article);
    const inc = byArticle.get(article);
    if (!id || !inc) continue;
    op2.push({ article, id, inc, cbRef: cbId(inc) });
  }

  // -- Op1: concealedBody docs (name = code; description = PortableText(it/en)) --
  const op1: AnyDoc[] = registry.map((r) => ({
    _id: cbId(r.code),
    _type: "concealedBody",
    code: r.code,
    name: { _type: "localizedString", it: r.code, en: r.code },
    description: {
      _type: "localizedPortableText",
      it: toPortableText(r.it),
      en: toPortableText(r.en),
    },
  }));

  // -- Op3: reduce finishes on the 8 existing columns --
  const updateCodes = updateFinishes.map((u) => u.code);
  const updateModels = await client.fetch<{ _id: string; code: string; n: number }[]>(
    `*[_type=="model" && code in $codes]{ _id, code, "n": count(availableFinishes) }`,
    { codes: updateCodes },
  );
  const updById = new Map(updateModels.map((m) => [m.code, m]));
  const op3: Op3Patch[] = updateFinishes.map((u) => {
    const m = updById.get(u.code);
    assert(m, `updateFinishes model not found: ${u.code}`);
    assert(
      u.finishes.length === 4,
      `updateFinishes ${u.code}: expected 4 finishes, got ${u.finishes.length}`,
    );
    return { code: u.code, id: m._id, beforeCount: m.n, finishes: finishRefs(u.finishes) };
  });

  // -- Op4: create 8 .D models, copying taxonomy from the base article --
  const baseCodes = create.map((c) => c.baseArticle);
  const baseModels = await client.fetch<
    {
      _id: string;
      code: string;
      productType: string | null;
      isOutdoor: boolean | null;
      isCustomizable: boolean | null;
      includesConcealedBody: boolean | null;
      tags: string[] | null;
    }[]
  >(
    `*[_type=="model" && code in $codes]{ _id, code, productType, isOutdoor, isCustomizable, includesConcealedBody, tags }`,
    { codes: baseCodes },
  );
  const baseByCode = new Map(baseModels.map((m) => [m.code, m]));

  const newIds = create.map((c) => modelId(c.code));
  const newSlugs = create.map((c) => modelSlug(c.code));
  // collision guard: any EXISTING doc occupying one of our _ids/slugs but not one of us
  const collisions = await client.fetch<
    { _id: string; slug: string | null; code: string | null }[]
  >(
    `*[_type=="model" && (_id in $ids || slug.current in $slugs)]{ _id, "slug": slug.current, code }`,
    { ids: newIds, slugs: newSlugs },
  );
  for (const c of collisions) {
    // Acceptable only if it IS our intended doc (same _id AND same code) — a prior run.
    const intended = create.find((x) => modelId(x.code) === c._id && x.code === c.code);
    if (!intended) {
      abort(
        `collision: existing model ${c._id} (code ${c.code}, slug ${c.slug}) blocks a new .D id/slug`,
      );
    }
  }

  const op4: AnyDoc[] = create.map((c) => {
    const base = baseByCode.get(c.baseArticle);
    assert(base, `create ${c.code}: base article "${c.baseArticle}" not found in dataset`);
    assert(
      c.finishes.length === 4,
      `create ${c.code}: expected 4 PVD finishes, got ${c.finishes.length}`,
    );
    assert(c.descriptions.it && c.descriptions.en, `create ${c.code}: missing it/en description`);
    return {
      _id: modelId(c.code),
      _type: "model",
      code: c.code,
      name: { _type: "localizedString", it: `Flamingo ${c.code}`, en: `Flamingo ${c.code}` },
      slug: { _type: "slug", current: modelSlug(c.code) },
      description: {
        _type: "localizedPortableText",
        it: toPortableText(c.descriptions.it),
        en: toPortableText(c.descriptions.en),
      },
      productType: base.productType,
      tags: base.tags ?? [],
      includesConcealedBody: base.includesConcealedBody ?? false,
      isOutdoor: base.isOutdoor ?? false,
      isCustomizable: base.isCustomizable ?? true,
      availableFinishes: finishRefs(c.finishes),
      collections: [{ _type: "reference", _ref: FLAMINGO_ID, _key: "c-0-flamingo" }],
    };
  });

  return { op1, op2, op3, op4, skipped };
}

// ─── plan printing ───────────────────────────────────────────────────────────
function printPlan(plan: Plan): void {
  console.log("\n── Op1: create concealedBody (registry) ──────────");
  for (const d of plan.op1) console.log(`  ${d._id.padEnd(28)}  code=${String(d.code)}`);
  console.log(`  → ${plan.op1.length} docs (expect ${EXP_REGISTRY})`);

  console.log("\n── Op2: set model.requiredConcealedBody ──────────");
  for (const p of plan.op2) {
    console.log(
      `  ${p.article.padEnd(12)} (${p.id.padEnd(16)}) → requiredConcealedBody = ${p.inc}  [${p.cbRef}]`,
    );
  }
  console.log(`  → ${plan.op2.length} patches (expect ${EXP_ASSOC_UNIQUE})`);
  if (plan.skipped.length) {
    console.log(`  ⚠ SKIPPED (article not found): ${plan.skipped.join(", ")}`);
  } else {
    console.log("  skipped: 0");
  }

  console.log("\n── Op3: reduce availableFinishes to 4 (non-PVD) ──");
  for (const p of plan.op3) {
    const after = p.finishes.map((f) => f._ref.replace("finish-", "").toUpperCase()).join(",");
    console.log(
      `  ${p.code.padEnd(10)} (${p.id.padEnd(14)})  ${p.beforeCount} finishes → 4  [${after}]`,
    );
  }
  console.log(`  → ${plan.op3.length} patches (expect ${EXP_UPDATE})`);

  console.log("\n── Op4: create .D PVD models ─────────────────────");
  for (const d of plan.op4) {
    const fins = (d.availableFinishes as FinishRef[])
      .map((f) => f._ref.replace("finish-", "").toUpperCase())
      .join(",");
    console.log(
      `  ${d._id.padEnd(16)}  code=${String(d.code).padEnd(12)} type=${String(d.productType)}  [${fins}]`,
    );
  }
  console.log(
    `  → ${plan.op4.length} new models (expect ${EXP_CREATE}); flamingo ${EXP_FLAMINGO_BEFORE}→${EXP_FLAMINGO_AFTER}`,
  );
}

// ─── main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`\n═══ import-blocco1 — ${MODE} ═══\n`);
  console.log(`project=${projectId} dataset=${dataset} apiVersion=${apiVersion}\n`);

  const data = JSON.parse(readFileSync(DATA_PATH, "utf8")) as Blocco1Data;
  const plan = await buildPlan(data);
  printPlan(plan);

  // Write the plan log (record of what a dry-run computed).
  writeFileSync(
    LOG_PATH,
    JSON.stringify(
      {
        mode: MODE,
        generatedFrom: DATA_PATH,
        op1: plan.op1.map((d) => ({ _id: d._id, code: d.code })),
        op2: plan.op2,
        op3: plan.op3.map((p) => ({ code: p.code, id: p.id, before: p.beforeCount, after: 4 })),
        op4: plan.op4.map((d) => ({ _id: d._id, code: d.code, productType: d.productType })),
        skipped: plan.skipped,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`\n  log written → ${LOG_PATH}`);

  // Guards on the pre-checked magnitudes (fail-closed even in dry-run).
  assert(plan.op1.length === EXP_REGISTRY, `Op1 ${plan.op1.length} ≠ ${EXP_REGISTRY}`);
  assert(plan.op2.length === EXP_ASSOC_UNIQUE, `Op2 ${plan.op2.length} ≠ ${EXP_ASSOC_UNIQUE}`);
  assert(
    plan.skipped.length === 0,
    `Op2 expected 0 skipped, got ${plan.skipped.length}: ${plan.skipped.join(", ")}`,
  );
  assert(plan.op3.length === EXP_UPDATE, `Op3 ${plan.op3.length} ≠ ${EXP_UPDATE}`);
  assert(plan.op4.length === EXP_CREATE, `Op4 ${plan.op4.length} ≠ ${EXP_CREATE}`);

  if (!EXECUTE) {
    console.log(
      "\n  [dry-run] plan validated against the pre-check magnitudes. No writes performed.",
    );
    console.log("  Re-run with --execute to apply.\n");
    return;
  }

  // ─── EXECUTE ─────────────────────────────────────────────────────────────────
  const targetCodes = plan.op2.map((p) => p.article);

  // Op1 — concealedBody
  console.log("\n── Apply Op1: concealedBody ──────────────────────");
  const cb0 = await countConcealed();
  if (cb0 === EXP_REGISTRY) {
    console.log(`  already present (${cb0}) — skipping Op1`);
  } else {
    await commitInBatches(plan.op1, (tx, d) => tx.createOrReplace(d));
    await sleep(SETTLE_MS);
    const cb1 = await countConcealed();
    if (cb1 !== EXP_REGISTRY) abort(`Op1 left ${cb1} concealedBody (expect ${EXP_REGISTRY})`);
    console.log(`  ✓ ${cb1} concealedBody`);
  }

  // Op2 — requiredConcealedBody
  console.log("\n── Apply Op2: requiredConcealedBody ──────────────");
  const req0 = await countReq();
  const unexpected0 = await client.fetch<number>(
    `count(*[_type=="model" && defined(requiredConcealedBody) && !(code in $codes)])`,
    { codes: targetCodes },
  );
  if (unexpected0 !== 0)
    abort(`Op2: ${unexpected0} models carry requiredConcealedBody OUTSIDE the target set`);
  if (req0 === EXP_ASSOC_UNIQUE) {
    console.log(`  already set (${req0}) — skipping Op2`);
  } else {
    await commitInBatches(plan.op2, (tx, p) =>
      tx.patch(p.id, { set: { requiredConcealedBody: { _type: "reference", _ref: p.cbRef } } }),
    );
    await sleep(SETTLE_MS);
    const req1 = await countReq();
    const unexpected1 = await client.fetch<number>(
      `count(*[_type=="model" && defined(requiredConcealedBody) && !(code in $codes)])`,
      { codes: targetCodes },
    );
    if (req1 !== EXP_ASSOC_UNIQUE || unexpected1 !== 0) {
      abort(
        `Op2 left ${req1} models with req (expect ${EXP_ASSOC_UNIQUE}), ${unexpected1} unexpected`,
      );
    }
    console.log(`  ✓ ${req1} models patched`);
  }

  // Op3 — finish reduction
  console.log("\n── Apply Op3: reduce finishes ────────────────────");
  await commitInBatches(plan.op3, (tx, p) =>
    tx.patch(p.id, { set: { availableFinishes: p.finishes } }),
  );
  await sleep(SETTLE_MS);
  const op3After = await client.fetch<{ code: string; n: number; refs: string[] }[]>(
    `*[_id in $ids]{ code, "n": count(availableFinishes), "refs": availableFinishes[]._ref }`,
    { ids: plan.op3.map((p) => p.id) },
  );
  const keptRefs = new Set(KEPT_FINISHES.map((c) => `finish-${c.toLowerCase()}`));
  for (const m of op3After) {
    if (m.n !== 4 || !m.refs.every((r) => keptRefs.has(r))) {
      abort(
        `Op3 model ${m.code}: ${m.n} finishes ${JSON.stringify(m.refs)} (expect 4 = ${[...keptRefs].join(",")})`,
      );
    }
  }
  console.log(`  ✓ ${op3After.length} models reduced to 4 non-PVD finishes`);

  // Op4 — create .D models
  console.log("\n── Apply Op4: create .D models ───────────────────");
  await commitInBatches(plan.op4, (tx, d) => tx.createOrReplace(d));
  await sleep(SETTLE_MS);
  const newIds = plan.op4.map((d) => d._id);
  const op4After = await client.fetch<
    { _id: string; code: string; n: number; hasIt: boolean; hasEn: boolean }[]
  >(
    `*[_id in $ids]{ _id, code, "n": count(availableFinishes), "hasIt": defined(description.it[0]), "hasEn": defined(description.en[0]) }`,
    { ids: newIds },
  );
  const pvdRefs = new Set(PVD_FINISHES.map((c) => `finish-${c.toLowerCase()}`));
  const op4Refs = await client.fetch<{ _id: string; refs: string[] }[]>(
    `*[_id in $ids]{ _id, "refs": availableFinishes[]._ref }`,
    { ids: newIds },
  );
  assert(op4After.length === EXP_CREATE, `Op4 created ${op4After.length} (expect ${EXP_CREATE})`);
  for (const m of op4After) {
    if (m.n !== 4 || !m.hasIt || !m.hasEn) {
      abort(`Op4 model ${m.code}: ${m.n} finishes, hasIt=${m.hasIt}, hasEn=${m.hasEn}`);
    }
  }
  for (const m of op4Refs) {
    if (!m.refs.every((r) => pvdRefs.has(r)))
      abort(`Op4 model ${m._id}: non-PVD finish ${JSON.stringify(m.refs)}`);
  }
  const flamAfter = await countFlamingo();
  if (flamAfter !== EXP_FLAMINGO_AFTER)
    abort(`flamingo count ${flamAfter} (expect ${EXP_FLAMINGO_AFTER})`);
  console.log(`  ✓ ${op4After.length} .D models created; flamingo now ${flamAfter}`);

  // ─── Final self-check ─────────────────────────────────────────────────────────
  console.log("\n── Final self-check ──────────────────────────────");
  const [cbF, reqF, flamF] = await Promise.all([countConcealed(), countReq(), countFlamingo()]);
  const checks: Array<[string, boolean, number]> = [
    [`concealedBody == ${EXP_REGISTRY}`, cbF === EXP_REGISTRY, cbF],
    [`models.requiredConcealedBody == ${EXP_ASSOC_UNIQUE}`, reqF === EXP_ASSOC_UNIQUE, reqF],
    [`flamingo models == ${EXP_FLAMINGO_AFTER}`, flamF === EXP_FLAMINGO_AFTER, flamF],
  ];
  for (const [label, ok, got] of checks) console.log(`  ${ok ? "✓" : "✗"} ${label}  (got ${got})`);
  if (!checks.every(([, ok]) => ok)) abort("Final self-check failed");
  console.log("\n  ✓ ALL CHECKS PASSED — Block 1 import complete.\n");
}

main().catch((err) => {
  console.error("\n✖ Unexpected error:", err);
  process.exit(1);
});
