/**
 * Sprint 2 Sanity seed — full catalog (idempotent).
 *
 * Reads scripts/seed-data/parsed-catalog.json (output of parse-catalog.ts)
 * and seeds:
 *   - 4 ambient docs (outdoor, indoor, kitchen, yacht) — bagno omitted (legacy)
 *   - 21 collection docs (IT locale)
 *   - 591 model docs (with denormalized ambient field, dot-stripped _ids)
 *
 * Sprint 1 finish docs (8) preserved untouched. Sprint 1 model docs
 * (model-b76m, model-c90m) overwritten via createOrReplace with same _id
 * but full Sprint 2 fields.
 *
 * Run modes:
 *   pnpm seed:sprint2 -- --dry-run   → Zod validate + 6 sample, no Sanity write
 *   pnpm seed:sprint2                → Full seed run
 */

import { createClient, type SanityClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

loadEnv({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const PARSED_CATALOG_PATH = resolve(REPO_ROOT, "scripts/seed-data/parsed-catalog.json");

const DRY_RUN = process.argv.includes("--dry-run");

// ──────────────────────────────────────────────────────────────────────
// Zod runtime schema (matches ParsedCatalog from parse-catalog.ts)
// ──────────────────────────────────────────────────────────────────────

const FinishCodeZ = z.enum(["MX", "BX", "MB", "RL", "BB", "BC", "AB", "DB"]);

const ProductTypeZ = z.enum([
  "lavabo-miscelatore",
  "lavabo-batteria",
  "lavabo-incasso",
  "lavabo-colonna",
  "vasca-bordo",
  "vasca-colonna",
  "doccia-colonna",
  "doccia-pannello",
  "doccia-soffione",
  "kit-doccia",
  "controllo-termostatico",
  "accessory",
]);

const AmbientZ = z.enum(["outdoor", "indoor", "kitchen", "yacht", "bagno"]).nullable();

const ParsedCollectionZ = z.object({
  code: z.string(),
  title: z.string(),
  slug: z.string(),
  ambients: z.array(z.string()),
  order: z.number(),
  articleCount: z.number(),
  articleCountNative: z.number(),
});

const ParsedModelZ = z.object({
  code: z.string(),
  slug: z.string(),
  name: z.object({ it: z.string(), en: z.string() }),
  description: z.object({ it: z.string(), en: z.string() }),
  productType: ProductTypeZ,
  ambient: AmbientZ,
  tags: z.array(z.string()),
  includesConcealedBody: z.boolean(),
  availableFinishes: z.array(FinishCodeZ),
  collections: z.array(z.string()),
  isOutdoor: z.boolean(),
  isCustomizable: z.boolean(),
});

const ParsedCatalogZ = z.object({
  collections: z.array(ParsedCollectionZ),
  models: z.array(ParsedModelZ),
  stats: z.unknown(),
});

type ParsedCollection = z.infer<typeof ParsedCollectionZ>;
type ParsedModel = z.infer<typeof ParsedModelZ>;

// ──────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────

const AMBIENT_VALUES = ["outdoor", "indoor", "kitchen", "yacht"] as const;
const AMBIENT_TITLES: Record<string, { it: string; en: string }> = {
  outdoor: { it: "Outdoor", en: "Outdoor" },
  indoor: { it: "Indoor", en: "Indoor" },
  kitchen: { it: "Cucina", en: "Kitchen" },
  yacht: { it: "Yacht", en: "Yacht" },
};
const AMBIENT_ORDERS: Record<string, number> = {
  outdoor: 1,
  indoor: 2,
  kitchen: 3,
  yacht: 4,
};

const BATCH_SIZE = 50;
const THROTTLE_MS = 50;
const SAMPLE_CODES = ["B76.M", "B76.AST", "BW50.YCWS.M", "Q500", "TC.HF2", "K35.S"];

// ──────────────────────────────────────────────────────────────────────
// Sanity client
// ──────────────────────────────────────────────────────────────────────

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01";
const token = process.env.SANITY_WRITE_TOKEN;

let client: SanityClient | null = null;
if (projectId && dataset && token) {
  client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });
} else if (!DRY_RUN) {
  console.error(
    "✖ Missing Sanity env (NEXT_PUBLIC_SANITY_PROJECT_ID / _DATASET / SANITY_WRITE_TOKEN in .env.local)",
  );
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function dotStripId(code: string): string {
  return code.toLowerCase().replace(/\./g, "");
}

function randomKey(): string {
  return Math.random().toString(36).slice(2, 14);
}

function toPortableTextBlock(text: string): Record<string, unknown> {
  return {
    _type: "block",
    _key: randomKey(),
    style: "normal",
    markDefs: [],
    children: [{ _type: "span", _key: randomKey(), text, marks: [] }],
  };
}

// ──────────────────────────────────────────────────────────────────────
// Doc builders
// ──────────────────────────────────────────────────────────────────────

type AnyDoc = Record<string, unknown> & { _id: string; _type: string };

function buildAmbientDoc(value: (typeof AMBIENT_VALUES)[number]): AnyDoc {
  return {
    _id: `ambient-${value}`,
    _type: "ambient",
    title: { _type: "localizedString", ...AMBIENT_TITLES[value] },
    slug: {
      _type: "localizedSlug",
      it: { _type: "slug", current: value },
      en: { _type: "slug", current: value },
    },
    parentMenu: value,
    order: AMBIENT_ORDERS[value],
  };
}

function buildCollectionDoc(c: ParsedCollection): AnyDoc {
  const ambientRefs = c.ambients
    .filter((a): a is (typeof AMBIENT_VALUES)[number] =>
      (AMBIENT_VALUES as readonly string[]).includes(a),
    )
    .map((a, i) => ({
      _type: "reference" as const,
      _ref: `ambient-${a}`,
      _key: `amb-${i}-${a}`,
    }));
  return {
    _id: `collection-${c.code}-it`,
    _type: "collection",
    language: "it",
    code: c.code,
    title: c.title,
    slug: { _type: "slug", current: c.slug },
    ambient: ambientRefs,
    isCustomizable: true,
    order: c.order,
    featured: false,
    articleCountNative: c.articleCountNative,
  };
}

function buildModelDoc(m: ParsedModel, fallbackStats: { defaulted: string[] }): AnyDoc {
  // Schema requires ambient (non-null). Default null (ACCESSORIES) → "outdoor"
  // (Fontealta is outdoor-first; accessories are mostly outdoor-friendly).
  // Tagged with "accessory-default-ambient" for audit / future correction.
  let ambient: string;
  const tags = [...m.tags];
  if (m.ambient === null) {
    ambient = "outdoor";
    fallbackStats.defaulted.push(m.code);
    if (!tags.includes("accessory-default-ambient")) {
      tags.push("accessory-default-ambient");
    }
    console.log(
      `    → ${m.code}: ambient null defaulted to "outdoor", added accessory-default-ambient tag`,
    );
  } else {
    ambient = m.ambient;
  }

  const _id = `model-${dotStripId(m.code)}`;

  const doc: AnyDoc = {
    _id,
    _type: "model",
    code: m.code,
    name: { _type: "localizedString", it: m.name.it, en: m.name.en },
    slug: { _type: "slug", current: m.slug },
    productType: m.productType,
    ambient,
    tags,
    includesConcealedBody: m.includesConcealedBody,
    availableFinishes: m.availableFinishes.map((c, i) => ({
      _type: "reference",
      _ref: `finish-${c.toLowerCase()}`,
      _key: `f-${i}-${c.toLowerCase()}`,
    })),
    collections: m.collections.map((c, i) => ({
      _type: "reference",
      _ref: `collection-${c}-it`,
      _key: `c-${i}-${c}`,
    })),
    isOutdoor: m.isOutdoor,
    isCustomizable: m.isCustomizable,
  };

  // Optional description (omit for ILLE empty descriptions)
  if (m.description.it) {
    doc.description = {
      _type: "localizedPortableText",
      it: [toPortableTextBlock(m.description.it)],
      en: [],
    };
  }

  return doc;
}

// ──────────────────────────────────────────────────────────────────────
// Sanity ops
// ──────────────────────────────────────────────────────────────────────

async function listStaleIds(type: string, keepIds: string[]): Promise<string[]> {
  if (!client) return [];
  const stale = await client.fetch<{ _id: string }[]>(
    `*[_type == $type && !(_id in $keep) && !(_id in path("drafts.**"))]{ _id }`,
    { type, keep: keepIds },
  );
  return stale.map((d) => d._id);
}

async function purgeStale(type: string, keepIds: string[]): Promise<string[]> {
  if (!client) return [];
  const ids = await listStaleIds(type, keepIds);
  if (ids.length === 0) return [];
  const tx = client.transaction();
  for (const id of ids) tx.delete(id);
  await tx.commit({ visibility: "deferred" });
  return ids;
}

async function commitBatch(docs: AnyDoc[]): Promise<void> {
  if (!client) return;
  const tx = client.transaction();
  for (const d of docs) tx.createOrReplace(d);
  await tx.commit({ visibility: "deferred" });
}

async function fetchCount(type: string): Promise<number> {
  if (!client) return -1;
  return client.fetch<number>(`count(*[_type == $t])`, { t: type });
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const t0 = Date.now();
  console.log(`→ Sprint 2 seed${DRY_RUN ? " (DRY RUN)" : ""}`);
  console.log(`  Reading parsed-catalog.json…`);

  const raw = readFileSync(PARSED_CATALOG_PATH, "utf8");
  const json = JSON.parse(raw);

  console.log(`  Validating with Zod…`);
  const parseResult = ParsedCatalogZ.safeParse(json);
  if (!parseResult.success) {
    console.error("✖ Zod validation FAILED:");
    console.error(JSON.stringify(parseResult.error.issues.slice(0, 20), null, 2));
    if (parseResult.error.issues.length > 20) {
      console.error(`(+ ${parseResult.error.issues.length - 20} more issues)`);
    }
    process.exit(1);
  }
  const parsed = parseResult.data;
  console.log(
    `  ✓ Zod OK: ${parsed.collections.length} collections + ${parsed.models.length} models`,
  );

  // Build docs
  const ambientDocs = AMBIENT_VALUES.map(buildAmbientDoc);
  const collectionDocs = parsed.collections.map(buildCollectionDoc);
  const fallbackStats = { defaulted: [] as string[] };
  const modelDocs = parsed.models.map((m) => buildModelDoc(m, fallbackStats));

  console.log(
    `  Built: ${ambientDocs.length} ambients + ${collectionDocs.length} collections + ${modelDocs.length} models`,
  );
  if (fallbackStats.defaulted.length > 0) {
    console.log(
      `  ⚠ ${fallbackStats.defaulted.length} models had ambient: null → defaulted to "outdoor" (accessories of outdoor brand)`,
    );
  }

  // ─── DRY RUN ─────────────────────────────────────────────────────────
  if (DRY_RUN) {
    console.log("");
    console.log("─── DRY RUN — no Sanity writes ───");
    if (client) {
      const staleModel = await listStaleIds(
        "model",
        modelDocs.map((d) => d._id),
      );
      const staleCollection = await listStaleIds(
        "collection",
        collectionDocs.map((d) => d._id),
      );
      const staleAmbient = await listStaleIds(
        "ambient",
        ambientDocs.map((d) => d._id),
      );
      console.log(
        `Would purge: ${staleModel.length} model + ${staleCollection.length} collection + ${staleAmbient.length} ambient stale docs`,
      );
      if (staleModel.length) console.log(`  models:      ${staleModel.join(", ")}`);
      if (staleCollection.length) console.log(`  collections: ${staleCollection.join(", ")}`);
      if (staleAmbient.length) console.log(`  ambients:    ${staleAmbient.join(", ")}`);
    } else {
      console.log("(skipping purge preview: no Sanity env configured)");
    }

    console.log("");
    console.log("─── 6 SAMPLE MODEL DOCS (as would be sent to Sanity) ───");
    for (const code of SAMPLE_CODES) {
      const doc = modelDocs.find((d) => d.code === code);
      console.log(`\n► ${code}`);
      if (doc) console.log(JSON.stringify(doc, null, 2));
      else console.log("    NOT FOUND IN PARSED OUTPUT");
    }

    console.log("");
    console.log(`✓ DRY RUN complete in ${Date.now() - t0} ms.`);
    process.exit(0);
  }

  if (!client) {
    console.error("✖ Sanity client not configured");
    process.exit(1);
  }

  // ─── REAL RUN ────────────────────────────────────────────────────────
  console.log("");
  console.log("─── PURGE ───");
  const purgedModels = await purgeStale(
    "model",
    modelDocs.map((d) => d._id),
  );
  console.log(`  ✓ Purged ${purgedModels.length} stale model docs`);
  if (purgedModels.length) console.log(`    ${purgedModels.join(", ")}`);
  const purgedCollections = await purgeStale(
    "collection",
    collectionDocs.map((d) => d._id),
  );
  console.log(`  ✓ Purged ${purgedCollections.length} stale collection docs`);
  if (purgedCollections.length) console.log(`    ${purgedCollections.join(", ")}`);
  const purgedAmbients = await purgeStale(
    "ambient",
    ambientDocs.map((d) => d._id),
  );
  console.log(`  ✓ Purged ${purgedAmbients.length} stale ambient docs`);
  if (purgedAmbients.length) console.log(`    ${purgedAmbients.join(", ")}`);

  console.log("");
  console.log("─── SEED ───");

  // Ambients (single transaction)
  await commitBatch(ambientDocs);
  console.log(`  ✓ Seeded ${ambientDocs.length} ambient docs`);

  // Collections (single transaction — 21 docs ≪ 500 KB limit)
  await commitBatch(collectionDocs);
  console.log(`  ✓ Seeded ${collectionDocs.length} collection docs`);

  // Models (batched 50 + 50ms throttle)
  const totalBatches = Math.ceil(modelDocs.length / BATCH_SIZE);
  for (let i = 0; i < modelDocs.length; i += BATCH_SIZE) {
    const batch = modelDocs.slice(i, i + BATCH_SIZE);
    await commitBatch(batch);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    console.log(
      `  ✓ Batch ${batchNum}/${totalBatches} — ${i + batch.length} of ${modelDocs.length} models`,
    );
    if (i + BATCH_SIZE < modelDocs.length) await sleep(THROTTLE_MS);
  }

  // Verify
  console.log("");
  console.log("─── VERIFY ───");
  const counts = await Promise.all([
    fetchCount("ambient"),
    fetchCount("finish"),
    fetchCount("collection"),
    fetchCount("model"),
  ]);
  console.log(`  ambient:    ${counts[0]} (expected 4)`);
  console.log(`  finish:     ${counts[1]} (expected 8)`);
  console.log(`  collection: ${counts[2]} (expected 21)`);
  console.log(`  model:      ${counts[3]} (expected 591)`);

  // Audit: count of models tagged with accessory-default-ambient
  const accessoryDefaultedCount = await client.fetch<number>(
    `count(*[_type == "model" && "accessory-default-ambient" in tags])`,
  );
  console.log("");
  console.log(
    `  accessory-default-ambient tag: ${accessoryDefaultedCount} models (expected ${fallbackStats.defaulted.length})`,
  );

  const ms = Date.now() - t0;
  console.log("");
  console.log(`✓ Sprint 2 seed complete in ${(ms / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("✖ Seed failed:", err);
  process.exit(1);
});
