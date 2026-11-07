/**
 * Sprint 1 Sanity seed (idempotent).
 *
 * Wipes any pre-existing `finish` and `ambient` documents (to recover from
 * earlier manual creates with auto-generated _ids), then re-creates with
 * deterministic _ids. Collection (document-level i18n) gets `language: "it"`.
 *
 * Run with:  pnpm seed:sprint1
 */

import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01";
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId || !dataset) {
  console.error(
    "✖ Missing NEXT_PUBLIC_SANITY_PROJECT_ID or NEXT_PUBLIC_SANITY_DATASET in .env.local",
  );
  process.exit(1);
}
if (!token) {
  console.error(
    "✖ Missing SANITY_WRITE_TOKEN in .env.local — generate one with Editor permission at https://www.sanity.io/manage",
  );
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion,
  token,
  useCdn: false,
});

type FinishSeed = {
  code: string;
  it: string;
  en: string;
  category: "natural" | "mirror" | "painted" | "pvd";
  order: number;
};

const FINISHES: FinishSeed[] = [
  {
    code: "MX",
    it: "Lucido Supermirror",
    en: "Polished Supermirror",
    category: "mirror",
    order: 10,
  },
  { code: "BX", it: "Spazzolato", en: "Brushed", category: "natural", order: 20 },
  { code: "MB", it: "Nero Opaco", en: "Matte Black", category: "painted", order: 30 },
  {
    code: "RL",
    it: "Verniciato RAL/PANTONE/NCS",
    en: "Painted RAL/PANTONE/NCS",
    category: "painted",
    order: 35,
  },
  { code: "BB", it: "PVD Brushed Brass", en: "PVD Brushed Brass", category: "pvd", order: 40 },
  { code: "BC", it: "PVD Brushed Copper", en: "PVD Brushed Copper", category: "pvd", order: 50 },
  {
    code: "AB",
    it: "PVD Brushed Absolute Black",
    en: "PVD Brushed Absolute Black",
    category: "pvd",
    order: 60,
  },
  {
    code: "DB",
    it: "PVD Polished Deep Black",
    en: "PVD Polished Deep Black",
    category: "pvd",
    order: 70,
  },
];

type AnyDoc = Record<string, unknown> & { _id: string; _type: string };

function buildAmbientDoc(): AnyDoc {
  return {
    _id: "ambient-outdoor",
    _type: "ambient",
    title: { _type: "localizedString", it: "Outdoor", en: "Outdoor" },
    slug: {
      _type: "localizedSlug",
      it: { _type: "slug", current: "outdoor" },
      en: { _type: "slug", current: "outdoor" },
    },
    parentMenu: "outdoor",
    order: 1,
  };
}

function buildFinishDoc(f: FinishSeed): AnyDoc {
  return {
    _id: `finish-${f.code.toLowerCase()}`,
    _type: "finish",
    code: f.code,
    name: { _type: "localizedString", it: f.it, en: f.en },
    category: f.category,
    order: f.order,
  };
}

function buildCollectionBossIt(): AnyDoc {
  return {
    _id: "collection-boss-it",
    _type: "collection",
    language: "it",
    code: "boss",
    title: "Boss",
    slug: { _type: "slug", current: "boss" },
    tagline: "Imponente e deciso, acciaio protagonista",
    ambient: [{ _type: "reference", _ref: "ambient-outdoor", _key: "amb-outdoor-key" }],
    isOutdoor: true,
    isCustomizable: true,
    order: 10,
  };
}

function buildModels(): AnyDoc[] {
  return [
    {
      _id: "model-b76m",
      _type: "model",
      code: "B76.M",
      name: { _type: "localizedString", it: "Boss B76.M", en: "Boss B76.M" },
      slug: { _type: "slug", current: "b76-m" },
      collection: { _type: "reference", _ref: "collection-boss-it" },
      isOutdoor: true,
      isCustomizable: true,
    },
    {
      _id: "model-c90m",
      _type: "model",
      code: "C90.M",
      name: { _type: "localizedString", it: "Boss C90.M", en: "Boss C90.M" },
      slug: { _type: "slug", current: "c90-m" },
      collection: { _type: "reference", _ref: "collection-boss-it" },
      isOutdoor: true,
      isCustomizable: true,
    },
  ];
}

async function purgeStaleDocsByType(type: string, keepIds: string[]) {
  const stale = await client.fetch<{ _id: string }[]>(
    `*[_type == $type && !(_id in $keep) && !(_id in path("drafts.**"))]{ _id }`,
    { type, keep: keepIds },
  );
  if (stale.length === 0) return 0;
  const tx = client.transaction();
  for (const doc of stale) tx.delete(doc._id);
  await tx.commit({ visibility: "async" });
  for (const doc of stale) {
    console.log(`  ↳ Purged stale ${type} ${doc._id}`);
  }
  return stale.length;
}

async function main() {
  const t0 = Date.now();
  let created = 0;
  let purged = 0;

  console.log(`→ Seeding Sanity dataset "${dataset}" (project ${projectId})…`);

  // Build all docs first so we can compute keep-ids for purge.
  const ambient = buildAmbientDoc();
  const finishes = FINISHES.map(buildFinishDoc);
  const collection = buildCollectionBossIt();
  const models = buildModels();

  // 1) Purge stale ambients/finishes (manual creates with auto _ids).
  purged += await purgeStaleDocsByType("ambient", [ambient._id]);
  purged += await purgeStaleDocsByType(
    "finish",
    finishes.map((f) => f._id),
  );

  // 2) Create-or-replace ambient (upstream of collection ref).
  await client.createOrReplace(ambient);
  console.log(`✓ Created: ${ambient._type} ${ambient._id}`);
  created += 1;

  // 3) Finishes.
  for (const finish of finishes) {
    await client.createOrReplace(finish);
    console.log(`✓ Created: ${finish._type} ${finish._id}`);
    created += 1;
  }

  // 4) Collection (IT, document-level i18n).
  await client.createOrReplace(collection);
  console.log(`✓ Created: ${collection._type} ${collection._id}`);
  created += 1;

  // 5) Models.
  for (const model of models) {
    await client.createOrReplace(model);
    console.log(`✓ Created: ${model._type} ${model._id}`);
    created += 1;
  }

  const ms = Date.now() - t0;
  console.log(`\nSeeded ${created} documents in ${ms} ms (purged ${purged} stale docs).`);
}

main().catch((err) => {
  console.error("✖ Seed failed:", err);
  process.exit(1);
});
