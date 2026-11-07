/**
 * Sprint 2 schema migration (one-shot, idempotent).
 *
 * Sprint 1 seeded 2 model docs (model-b76m, model-c90m) with a singular
 * `collection` reference. Sprint 2 changes that field to a `collections`
 * array. This script:
 *
 *   1. Fetches every model that still has the legacy `collection` field
 *      (defined OR present even when null)
 *   2. Patches each one: sets `collections: [<previous collection ref>]`,
 *      then unsets `collection`
 *   3. Backfills the new required Sprint 2 fields with sensible defaults so
 *      schema validation in the Studio passes:
 *        - productType:           "doccia-colonna"  (B76.M / C90.M are columns)
 *        - tags:                  ["with-mixer"]    (.M suffix)
 *        - includesConcealedBody: false
 *        - availableFinishes:     all 8 finish refs (catalogue default)
 *
 * Re-running is safe: every patch is no-op once the migration has been
 * applied (no `collection` field left to read).
 */

import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01";
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId || !dataset || !token) {
  console.error(
    "✖ Missing Sanity env (NEXT_PUBLIC_SANITY_PROJECT_ID, _DATASET, or SANITY_WRITE_TOKEN)",
  );
  process.exit(1);
}

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });

const ALL_FINISH_IDS = [
  "finish-mx",
  "finish-bx",
  "finish-mb",
  "finish-rl",
  "finish-bb",
  "finish-bc",
  "finish-ab",
  "finish-db",
];

type LegacyModel = {
  _id: string;
  code: string;
  collection?: { _ref: string } | null;
};

async function main() {
  const t0 = Date.now();
  console.log(`→ Migrating models in dataset "${dataset}" (project ${projectId})…`);

  const stale = await client.fetch<LegacyModel[]>(
    `*[_type == "model" && defined(collection)]{ _id, code, collection }`,
  );

  if (stale.length === 0) {
    console.log("✓ Nothing to migrate (no models with legacy `collection` field).");
    return;
  }

  console.log(`→ Found ${stale.length} models with legacy field, patching…`);

  for (const model of stale) {
    const ref = model.collection?._ref ?? "collection-boss-it";
    await client
      .patch(model._id)
      .set({
        collections: [{ _type: "reference", _ref: ref, _key: `col-${ref}` }],
        productType: "doccia-colonna",
        tags: ["with-mixer"],
        includesConcealedBody: false,
        availableFinishes: ALL_FINISH_IDS.map((id) => ({
          _type: "reference",
          _ref: id,
          _key: `f-${id}`,
        })),
      })
      .unset(["collection"])
      .commit();
    console.log(`  ✓ Migrated ${model.code} (${model._id})`);
  }

  console.log(`\n✓ Migrated ${stale.length} models in ${Date.now() - t0} ms.`);
}

main().catch((err) => {
  console.error("✖ Migration failed:", err);
  process.exit(1);
});
