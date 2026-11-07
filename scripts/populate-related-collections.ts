/**
 * Populate `collection.relatedCollections` per the client (Alma) affinity mapping.
 * DRY-RUN by default, `--apply` to write.
 *
 * The affinities are EDITORIAL, UNIDIRECTIONAL and have NO fallback / NO
 * reciprocity — the mapping below is materialised EXACTLY as delivered:
 * if A → B it does NOT imply B → A, and order is preserved verbatim.
 *
 * Only the 7 SOURCE collections that have affinities are patched. Collections
 * with none (incl. Origo Rame, listed by the client but empty, and every other
 * collection) are NOT touched — no empty-array writes.
 *
 * i18n note (document-level i18n / Approach A): only IT collection documents
 * exist today, so we resolve slugs against `language == "it"` and write IT→IT
 * references. When EN collection translations are created, the plugin does NOT
 * copy this reference field — re-run this script with LANG="en" and the EN
 * slugs (which may diverge from IT) to populate the EN documents.
 *
 * Guard: aborts if ANY referenced slug (source or target) fails to resolve, or
 * resolves ambiguously (more than one document for the same slug/language).
 *
 * Idempotent: `.set({ relatedCollections })` overwrites with the same
 * deterministically-keyed array → re-running is a no-op.
 *
 * Usage:
 *   pnpm tsx scripts/populate-related-collections.ts            # DRY-RUN (read-only)
 *   pnpm tsx scripts/populate-related-collections.ts --apply    # WRITES to Sanity
 */

import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

// ─── config ────────────────────────────────────────────────────────────────────
const APPLY = process.argv.includes("--apply");
const LANG = "it"; // Approach A: only IT docs exist today. See i18n note above.

/**
 * Official affinity mapping (verbatim from Alma). SLUG-BASED, order matters,
 * NOT mirrored/reciprocated. Origo Rame intentionally absent (client: none).
 */
const AFFINITY_MAP = {
  ille: ["waterline"],
  flamingo: ["waterline"],
  skinny: ["classy", "waterline"],
  classy: ["skinny"],
  twiggy: ["waterline"],
  boss: ["boss-wide", "waterline"],
  origo: ["club", "club-large", "waterline"],
} satisfies Record<string, readonly string[]>;

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01";
// DRY-RUN → read-only token. --apply → write token. Never the write token in dry-run.
const token = APPLY ? process.env.SANITY_WRITE_TOKEN : process.env.SANITY_API_READ_TOKEN;

if (!projectId || !dataset || !token) {
  console.error(
    `✖ Missing Sanity env (NEXT_PUBLIC_SANITY_PROJECT_ID, _DATASET, or ${
      APPLY ? "SANITY_WRITE_TOKEN" : "SANITY_API_READ_TOKEN"
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

// ─── types ─────────────────────────────────────────────────────────────────────
type CollectionDoc = { _id: string; slug: string | null; title: string | null };
type Reference = { _type: "reference"; _ref: string; _key: string };
type Patch = {
  sourceSlug: string;
  sourceId: string;
  sourceTitle: string | null;
  targets: { slug: string; id: string; title: string | null }[];
  refs: Reference[];
};

async function main() {
  const bar = "─".repeat(78);
  console.log(bar);
  console.log(
    `relatedCollections population — ${APPLY ? "🔴 APPLY (WRITES)" : "DRY-RUN (read-only)"}`,
  );
  console.log(`Sanity:  ${projectId}/${dataset}  perspective=published  language=${LANG}`);
  console.log(bar);

  // ── resolve slugs → docs (single language) ─────────────────────────────────────
  const docs = await client.fetch<CollectionDoc[]>(
    `*[_type == "collection" && language == $lang]{ _id, "slug": slug.current, title }`,
    { lang: LANG },
  );

  // Detect ambiguity: a slug must map to exactly ONE document for this language.
  const bySlug = new Map<string, CollectionDoc[]>();
  for (const d of docs) {
    if (!d.slug) continue;
    const arr = bySlug.get(d.slug) ?? [];
    arr.push(d);
    bySlug.set(d.slug, arr);
  }

  const referencedSlugs = new Set<string>();
  for (const [src, targets] of Object.entries(AFFINITY_MAP)) {
    referencedSlugs.add(src);
    for (const t of targets) referencedSlugs.add(t);
  }

  const unresolved: string[] = [];
  const ambiguous: string[] = [];
  for (const slug of referencedSlugs) {
    const hits = bySlug.get(slug) ?? [];
    if (hits.length === 0) unresolved.push(slug);
    else if (hits.length > 1)
      ambiguous.push(`${slug} (${hits.length} docs: ${hits.map((h) => h._id).join(", ")})`);
  }

  if (unresolved.length > 0 || ambiguous.length > 0) {
    if (unresolved.length > 0) console.error(`✖ Unresolved slug(s): ${unresolved.join(", ")}`);
    if (ambiguous.length > 0) console.error(`✖ Ambiguous slug(s): ${ambiguous.join(", ")}`);
    console.error("Aborting — no writes performed.");
    process.exit(1);
  }

  // ── build patch set ─────────────────────────────────────────────────────────────
  const idOf = (slug: string) => bySlug.get(slug)![0];
  const patches: Patch[] = Object.entries(AFFINITY_MAP).map(([sourceSlug, targetSlugs]) => {
    const source = idOf(sourceSlug);
    const targets = targetSlugs.map((slug) => {
      const d = idOf(slug);
      return { slug, id: d._id, title: d.title };
    });
    // _key = target slug: unique within each source array (no repeated targets),
    // stable across re-runs → idempotent overwrite.
    const refs: Reference[] = targets.map((t) => ({
      _type: "reference",
      _ref: t.id,
      _key: t.slug,
    }));
    return { sourceSlug, sourceId: source._id, sourceTitle: source.title, targets, refs };
  });

  const totalLinks = patches.reduce((n, p) => n + p.refs.length, 0);

  // ── report the exact patch set ──────────────────────────────────────────────────
  console.log(`\nPatch set — ${patches.length} source docs, ${totalLinks} reference links:\n`);
  for (const p of patches) {
    console.log(`  ${p.sourceSlug}  →  ${p.sourceTitle} (${p.sourceId})`);
    p.targets.forEach((t, i) => {
      console.log(`      ${i + 1}. ${t.slug}  →  ${t.title} (${t.id})   _key=${t.slug}`);
    });
  }
  console.log(
    `\nUntouched (no affinities): Origo Rame + every other collection — NO writes, no empty arrays.`,
  );

  if (!APPLY) {
    console.log(`\n${bar}`);
    console.log("DRY-RUN complete — nothing written. Re-run with --apply to persist.");
    console.log(bar);
    return;
  }

  // ── apply (single transaction; idempotent set) ──────────────────────────────────
  let tx = client.transaction();
  for (const p of patches)
    tx = tx.patch(p.sourceId, (patch) => patch.set({ relatedCollections: p.refs }));
  await tx.commit();
  console.log(
    `\n✔ APPLY complete — ${patches.length} documents patched, ${totalLinks} links written.`,
  );
  console.log("Now verify INDEPENDENTLY via a separate GROQ query (do not trust this output).");
}

main().catch((err) => {
  console.error("✖ Script failed:", err);
  process.exit(1);
});
