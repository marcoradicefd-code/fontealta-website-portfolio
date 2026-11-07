/**
 * scripts/purge-finish-drafts.ts
 *
 * One-shot cleanup: purge orphan finish drafts created manually in Studio
 * during Sprint 1. They have auto-generated UUIDs and codes that duplicate
 * the published `finish-{code}` docs (BX, MB, BB, MX, BC).
 *
 * Modes:
 *   pnpm purge:finish-drafts             → DRY RUN (lists, no delete)
 *   pnpm purge:finish-drafts -- --execute → real delete
 */

import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

// NOTE: The "Remaining: X" line printed at the end may show a non-zero count due to
// Sanity's `visibility: "deferred"` indexing lag. The actual purge is successful — re-query after a few seconds confirms count=0.

loadEnv({ path: ".env.local" });

const EXECUTE = process.argv.includes("--execute");

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01";
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId || !dataset || !token) {
  console.error(
    "✖ Missing Sanity env (NEXT_PUBLIC_SANITY_PROJECT_ID / _DATASET / SANITY_WRITE_TOKEN)",
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

interface FinishDraft {
  _id: string;
  code: string;
}

async function main(): Promise<void> {
  console.log(`→ Finish drafts purge${EXECUTE ? "" : " (DRY RUN)"}`);

  const drafts = await client.fetch<FinishDraft[]>(
    `*[_type == "finish" && _id in path("drafts.**")]{_id, code} | order(_id)`,
  );

  if (drafts.length === 0) {
    console.log("  ✓ No finish drafts found — nothing to do.");
    return;
  }

  console.log(`  Found ${drafts.length} finish draft(s):`);
  for (const d of drafts) console.log(`    ${d._id}  code=${d.code}`);

  if (!EXECUTE) {
    console.log(
      `\n→ DRY RUN — no docs deleted. Re-run with \`pnpm purge:finish-drafts -- --execute\` to commit.`,
    );
    return;
  }

  const tx = client.transaction();
  for (const d of drafts) tx.delete(d._id);
  await tx.commit({ visibility: "deferred" });
  console.log(`\n✓ Deleted ${drafts.length} draft(s).`);

  // Verify
  const remaining = await client.fetch<number>(
    `count(*[_type == "finish" && _id in path("drafts.**")])`,
  );
  const totalFinishes = await client.fetch<number>(`count(*[_type == "finish"])`);
  console.log(`  Remaining finish drafts: ${remaining} (expected 0)`);
  console.log(`  Total finish docs:       ${totalFinishes} (expected 8)`);
}

main().catch((err) => {
  console.error("✖ Purge failed:", err);
  process.exit(1);
});
